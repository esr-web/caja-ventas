// ==========================================
// CAJA - APLICACIÓN PRINCIPAL
// ==========================================

let productos = [];
let carrito = [];          // { idProducto, idVariante, cantidad, precio }
let ventas = [];
let entradas = [];
let comprasUSD = [];

let productoEnEdicion = null;
let porcentajeSalario = 5;
let pantallaActual = "inicio";
let monedaVenta = "CUP";

let productosDesplegadosCaja = new Set();

const CLAVE_EFECTIVO = "caja_conteo_efectivo_v1";
const LUGARES_VENTA = ["Almacén", "Tienda", "Casa"];

const denominacionesEfectivo = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

// ==========================================
// UTILIDADES
// ==========================================

function formato(valor) {
  return (Number(valor) || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapar(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fechaLocal() {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,"0")}-${String(f.getDate()).padStart(2,"0")}`;
}

function fechaParaComparar(fecha) { return fecha ? String(fecha).slice(0, 10) : ""; }
function mesLocal(fecha = new Date()) { return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}`; }

function mostrarFecha(fecha) {
  if (!fecha) return "";
  const p = String(fecha).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(fecha);
}

function mostrarFechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function generarIdVariante() {
  return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ==========================================
// ADAPTADORES
// ==========================================

function normalizarVariantes(producto) {
  if (Array.isArray(producto.variantes) && producto.variantes.length) {
    return producto.variantes.map(v => ({
      id: String(v.id || generarIdVariante()),
      etiqueta: String(v.etiqueta || ""),
      precioCUP: Number(v.precioCUP) || 0,
      precioUSD: Number(v.precioUSD) || 0
    }));
  }
  const pCUP = Number(producto.precioCUP ?? producto.precio) || 0;
  const pUSD = Number(producto.precioUSD) || 0;
  if (pCUP === 0 && pUSD === 0) return [];
  return [{ id: generarIdVariante(), etiqueta: "Único", precioCUP: pCUP, precioUSD: pUSD }];
}

function adaptarProducto(producto) {
  if (!producto || typeof producto !== "object") return null;
  const stock = producto.stock || {};
  return {
    ...producto,
    id: producto.id,
    nombre: String(producto.nombre || ""),
    descripcion: String(producto.descripcion || ""),
    stock: { tienda: Number(stock.tienda) || 0, casa: Number(stock.casa) || 0 },
    variantes: normalizarVariantes(producto)
  };
}

function adaptarVenta(venta) {
  if (!venta || typeof venta !== "object") return null;
  const productosNorm = Array.isArray(venta.productos)
    ? venta.productos.map(linea => {
        const idProducto = linea.idProducto ?? linea.productoId ?? linea.id ?? null;
        const cantidad = Number(linea.cantidad) || 0;
        const precio = Number(linea.precio) || 0;
        const precioCUP = Number(linea.precioCUP) || 0;
        const subtotal = Number(linea.subtotal) || (cantidad * precio);
        return {
          ...linea, idProducto,
          idVariante: linea.idVariante || null,
          etiquetaVariante: String(linea.etiquetaVariante || ""),
          nombre: String(linea.nombre || "Producto"),
          cantidad, precio, precioCUP, subtotal
        };
      })
    : [];
  return {
    ...venta, id: venta.id,
    fecha: venta.fecha || "",
    moneda: venta.moneda || "CUP",
    total: Number(venta.total) || 0,
    totalCUP: Number(venta.totalCUP) || 0,
    salario: Number(venta.salario) || 0,
    lugarVenta: venta.lugarVenta || "Sin especificar",
    productos: productosNorm
  };
}

function adaptarEntrada(e) {
  if (!e || typeof e !== "object") return null;
  return {
    ...e, id: e.id,
    idProducto: e.idProducto ?? null,
    nombre: String(e.nombre || "Producto"),
    area: e.area === "Casa" ? "Casa" : "Tienda",
    cantidad: Number(e.cantidad) || 0,
    fecha: e.fecha || new Date().toISOString()
  };
}

function adaptarCompraUSD(c) {
  if (!c || typeof c !== "object") return null;
  return {
    ...c, id: c.id,
    fecha: c.fecha || fechaLocal(),
    fechaRegistro: c.fechaRegistro || new Date().toISOString(),
    tasaCUP: Number(c.tasaCUP) || 0,
    cantidadUSD: Number(c.cantidadUSD) || 0,
    totalCUP: Number(c.totalCUP) || 0,
    desglose: Array.isArray(c.desglose)
      ? c.desglose.map(d => ({
          denominacion: Number(d.denominacion) || 0,
          cantidad: Number(d.cantidad) || 0,
          subtotal: Number(d.subtotal) || 0
        }))
      : []
  };
}

// ==========================================
// PRECIOS / VARIANTES
// ==========================================

function precioVariante(variante, moneda = monedaVenta) {
  if (!variante) return 0;
  return moneda === "USD" ? Number(variante.precioUSD) || 0 : Number(variante.precioCUP) || 0;
}

function nombreConVariante(nombre, etiqueta) {
  if (!etiqueta || etiqueta === "Único") return nombre;
  return `${nombre} (${etiqueta})`;
}

// ==========================================
// STOCK
// ==========================================

function claveStockLugar(lugar) {
  if (lugar === "Tienda") return "tienda";
  if (lugar === "Casa") return "casa";
  return null;
}

function stockDisponible(producto, lugar) {
  if (!producto) return 0;
  if (lugar === "Almacén") return Infinity;
  const clave = claveStockLugar(lugar);
  if (!clave) return 0;
  return Number(producto.stock?.[clave]) || 0;
}

function totalUnidadesEnCarrito(idProducto) {
  return carrito
    .filter(l => Number(l.idProducto) === Number(idProducto))
    .reduce((s, l) => s + Number(l.cantidad || 0), 0);
}

function cantidadEnCarritoVariante(idProducto, idVariante) {
  const linea = carrito.find(l =>
    Number(l.idProducto) === Number(idProducto) && l.idVariante === idVariante
  );
  return linea ? Number(linea.cantidad) || 0 : 0;
}

async function descontarStockVenta(lineas, lugar) {
  const clave = claveStockLugar(lugar);
  if (!clave) return;
  const porProducto = {};
  for (const linea of lineas) {
    const idP = Number(linea.idProducto);
    porProducto[idP] = (porProducto[idP] || 0) + Number(linea.cantidad || 0);
  }
  for (const idP in porProducto) {
    const producto = productos.find(p => Number(p.id) === Number(idP));
    if (!producto) continue;
    const actual = Number(producto.stock?.[clave]) || 0;
    producto.stock[clave] = Math.max(0, actual - porProducto[idP]);
    try { await guardarDato("productos", producto); }
    catch (e) { console.warn(e); }
  }
}

// ==========================================
// INICIO
// ==========================================

async function iniciarAplicacion() {
  await abrirBaseDatos();
  productos = (await obtenerTodos("productos")).map(adaptarProducto).filter(Boolean);
  ventas = (await obtenerTodos("ventas")).map(adaptarVenta).filter(Boolean);
  try { entradas = (await obtenerTodos("entradas")).map(adaptarEntrada).filter(Boolean); }
  catch (_) { entradas = []; }
  try { comprasUSD = (await obtenerTodos("comprasUSD")).map(adaptarCompraUSD).filter(Boolean); }
  catch (_) { comprasUSD = []; }

  for (const p of productos) await guardarDato("productos", p);
  for (const v of ventas) await guardarDato("ventas", v);

  navegar("inicio");
  actualizarEstadoConexion();
}

function actualizarEstadoConexion() {
  const punto = document.getElementById("puntoConexion");
  const texto = document.getElementById("textoConexion");
  if (!punto) return;
  if (navigator.onLine) {
    punto.style.background = "#58c985";
    if (texto) texto.textContent = "En línea";
  } else {
    punto.style.background = "#f28c28";
    if (texto) texto.textContent = "Sin conexión";
  }
}

window.addEventListener("online", actualizarEstadoConexion);
window.addEventListener("offline", actualizarEstadoConexion);

// ==========================================
// NAVEGACIÓN
// ==========================================

function navegar(nombre) {
  const pantallas = {
    inicio: "pantallaInicio",
    caja: "pantallaCaja",
    productos: "pantallaProductos",
    inventario: "pantallaInventario",
    compraUSD: "pantallaCompraUSD",
    registro: "pantallaRegistro",
    estadisticas: "pantallaEstadisticas",
    efectivo: "pantallaEfectivo"
  };
  const id = pantallas[nombre];
  if (!id) return;
  const destino = document.getElementById(id);
  if (!destino) return;
  document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("activa"));
  destino.classList.add("activa");
  pantallaActual = nombre;
  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.remove("activo");
    if (b.dataset.pantalla === nombre) b.classList.add("activo");
  });
  if (nombre === "inicio") actualizarInicio();
  if (nombre === "caja") mostrarCaja();
  if (nombre === "productos") mostrarProductos();
  if (nombre === "inventario") mostrarInventario();
  if (nombre === "compraUSD") mostrarCompraUSD();
  if (nombre === "registro") mostrarRegistro();
  if (nombre === "estadisticas") mostrarEstadisticas();
  if (nombre === "efectivo") mostrarEfectivo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cambiarPantalla(n) { navegar(n); }
function irPantalla(n) { navegar(n); }

// ==========================================
// PRODUCTOS
// ==========================================

function mostrarProductos() { dibujarCatalogo(); cancelarEdicion(); }

function dibujarCatalogo() {
  const lista = document.getElementById("listaCatalogo");
  if (!lista) return;
  if (!productos.length) {
    lista.innerHTML = `<div class="texto-vacio">No hay productos registrados.</div>`;
    return;
  }
  lista.innerHTML = productos.map(producto => {
    const variantesHtml = producto.variantes.length
      ? producto.variantes.map(v => `
          <div class="variante-linea">
            <span class="variante-etiqueta">${escapar(v.etiqueta || "Único")}</span>
            <span class="variante-precios">${formato(v.precioCUP)} CUP · ${formato(v.precioUSD)} USD</span>
          </div>
        `).join("")
      : `<div class="variante-linea"><em>Sin precios</em></div>`;
    return `
      <div class="producto producto-con-variantes">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>
          <p class="stock-linea">
            Tienda: <strong>${producto.stock.tienda}</strong> ·
            Casa: <strong>${producto.stock.casa}</strong> ·
            Almacén: <strong>∞</strong>
          </p>
          <div class="variantes-lista">${variantesHtml}</div>
        </div>
        <div class="acciones-producto">
          <button type="button" class="btn-secundario"
                  onclick="editarProducto(${Number(producto.id)})">EDITAR</button>
          <button type="button" class="btn-secundario"
                  onclick="eliminarProducto(${Number(producto.id)})">ELIMINAR</button>
        </div>
      </div>
    `;
  }).join("");
}

function crearFilaVarianteHTML(variante = null) {
  const id = variante?.id || generarIdVariante();
  const etiqueta = variante?.etiqueta || "";
  const cup = variante?.precioCUP ?? "";
  const usd = variante?.precioUSD ?? "";
  return `
    <div class="variante-fila" data-id="${escapar(id)}">
      <input type="text" class="variante-input-etiqueta"
             placeholder="Nombre del precio (ej. 1 kg)" value="${escapar(etiqueta)}">
      <div class="variante-fila-precios">
        <div>
          <label style="font-size:11px">Precio CUP</label>
          <input type="number" class="variante-input-cup" min="0" step="0.01"
                 inputmode="decimal" placeholder="0.00" value="${cup}">
        </div>
        <div>
          <label style="font-size:11px">Precio USD</label>
          <input type="number" class="variante-input-usd" min="0" step="0.01"
                 inputmode="decimal" placeholder="0.00" value="${usd}">
        </div>
        <button type="button" class="btn-peligro variante-btn-quitar"
                style="padding:10px 12px;align-self:flex-end"
                onclick="this.closest('.variante-fila').remove()">✕</button>
      </div>
    </div>
  `;
}

function agregarVarianteFormulario(variante = null) {
  const cont = document.getElementById("listaVariantesFormulario");
  if (!cont) return;
  const aviso = cont.querySelector(".sin-variantes-aviso");
  if (aviso) aviso.remove();
  cont.insertAdjacentHTML("beforeend", crearFilaVarianteHTML(variante));
}

function leerVariantesFormulario() {
  const cont = document.getElementById("listaVariantesFormulario");
  if (!cont) return [];
  const filas = cont.querySelectorAll(".variante-fila");
  const variantes = [];
  filas.forEach(fila => {
    const etiqueta = fila.querySelector(".variante-input-etiqueta").value.trim();
    const cup = Number(fila.querySelector(".variante-input-cup").value) || 0;
    const usd = Number(fila.querySelector(".variante-input-usd").value) || 0;
    if (!etiqueta && cup === 0 && usd === 0) return;
    variantes.push({
      id: fila.dataset.id || generarIdVariante(),
      etiqueta: etiqueta || "Único",
      precioCUP: cup, precioUSD: usd
    });
  });
  return variantes;
}

function limpiarVariantesFormulario() {
  const cont = document.getElementById("listaVariantesFormulario");
  if (cont) cont.innerHTML = "";
}

async function guardarProducto() {
  const nombreInput = document.getElementById("nombreProducto");
  const stockTiendaInput = document.getElementById("stockTienda");
  const stockCasaInput = document.getElementById("stockCasa");
  if (!nombreInput) return;
  const estabaEditando = productoEnEdicion !== null;
  const nombre = nombreInput.value.trim();
  const stockTienda = Math.max(0, Math.floor(Number(stockTiendaInput?.value) || 0));
  const stockCasa = Math.max(0, Math.floor(Number(stockCasaInput?.value) || 0));
  if (!nombre) { alert("Escribe el nombre del producto."); nombreInput.focus(); return; }
  const variantes = leerVariantesFormulario();
  if (!variantes.length) { alert("Añade al menos un precio."); return; }
  const conPrecio = variantes.some(v => v.precioCUP > 0 || v.precioUSD > 0);
  if (!conPrecio) { alert("Al menos un precio debe ser mayor que 0."); return; }
  const producto = { nombre, stock: { tienda: stockTienda, casa: stockCasa }, variantes };
  if (estabaEditando) {
    producto.id = productoEnEdicion.id;
    Object.assign(producto, productoEnEdicion, {
      nombre, stock: { tienda: stockTienda, casa: stockCasa }, variantes
    });
  }
  try {
    const id = await guardarDato("productos", producto);
    if (!estabaEditando) {
      producto.id = id;
      productos.push(adaptarProducto(producto));
    } else {
      const idx = productos.findIndex(p => Number(p.id) === Number(producto.id));
      if (idx !== -1) productos[idx] = adaptarProducto(producto);
    }
    cancelarEdicion();
    dibujarCatalogo();
    dibujarProductosCaja();
    dibujarInventario();
    actualizarInicio();
    alert(estabaEditando ? "Producto actualizado." : "Producto guardado.");
  } catch (e) {
    console.error(e);
    alert("No se pudo guardar el producto.");
  }
}

function editarProducto(id) {
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) return;
  productoEnEdicion = { ...producto };
  document.getElementById("nombreProducto").value = producto.nombre || "";
  document.getElementById("stockTienda").value = producto.stock.tienda || 0;
  document.getElementById("stockCasa").value = producto.stock.casa || 0;
  limpiarVariantesFormulario();
  producto.variantes.forEach(v => agregarVarianteFormulario(v));
  document.getElementById("btnGuardarProducto").textContent = "ACTUALIZAR PRODUCTO";
  document.getElementById("btnCancelarEdicion").style.display = "block";
  document.getElementById("tituloFormularioProducto").textContent = "Editar producto";
  if (pantallaActual === "inventario") navegar("productos");
  setTimeout(() => {
    const n = document.getElementById("nombreProducto");
    if (n) n.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function cancelarEdicion() {
  productoEnEdicion = null;
  ["nombreProducto", "stockTienda", "stockCasa"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  limpiarVariantesFormulario();
  const bg = document.getElementById("btnGuardarProducto");
  const bc = document.getElementById("btnCancelarEdicion");
  const t = document.getElementById("tituloFormularioProducto");
  if (bg) bg.textContent = "GUARDAR PRODUCTO";
  if (bc) bc.style.display = "none";
  if (t) t.textContent = "Añadir producto";
}

async function eliminarProducto(id) {
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) return;
  if (!confirm("¿Deseas eliminar el producto " + producto.nombre + "?")) return;
  try {
    await eliminarDato("productos", producto.id);
    productos = productos.filter(p => Number(p.id) !== Number(id));
    if (productoEnEdicion && Number(productoEnEdicion.id) === Number(id)) cancelarEdicion();
    carrito = carrito.filter(l => Number(l.idProducto) !== Number(id));
    productosDesplegadosCaja.delete(Number(id));
    dibujarCatalogo();
    dibujarProductosCaja();
    dibujarCarrito();
    dibujarInventario();
    actualizarInicio();
    alert("Producto eliminado.");
  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar el producto.");
  }
}

// ==========================================
// INVENTARIO
// ==========================================

function calcularTotalesInventario() {
  let tienda = 0, casa = 0;
  productos.forEach(p => {
    tienda += Number(p.stock?.tienda) || 0;
    casa += Number(p.stock?.casa) || 0;
  });
  return { tienda, casa, almacen: Infinity, productos: productos.length };
}

function actualizarInventarioInicio() {
  const cont = document.getElementById("inventarioInicio");
  if (!cont) return;
  if (!productos.length) { cont.innerHTML = ""; return; }
  const totales = calcularTotalesInventario();
  cont.innerHTML = `
    <h3>📦 Inventario por área</h3>
    <div class="inventario-inicio-totales">
      <div class="inventario-inicio-total almacen"><small>Almacén</small><strong>∞</strong></div>
      <div class="inventario-inicio-total tienda"><small>Tienda</small><strong>${totales.tienda}</strong></div>
      <div class="inventario-inicio-total casa"><small>Casa</small><strong>${totales.casa}</strong></div>
    </div>
    <button type="button" class="ver-todos" onclick="navegar('inventario')">Ver inventario detallado →</button>
  `;
}

function mostrarInventario() {
  cargarOpcionesEntradaProducto();
  dibujarInventario();
  dibujarEntradas();
}

function cargarOpcionesEntradaProducto() {
  const sel = document.getElementById("entradaProducto");
  if (!sel) return;
  const actual = sel.value;
  if (!productos.length) {
    sel.innerHTML = `<option value="">— Sin productos —</option>`;
    sel.value = "";
    return;
  }
  sel.innerHTML = productos.map(p =>
    `<option value="${Number(p.id)}">${escapar(p.nombre)}</option>`
  ).join("");
  if (actual && productos.some(p => String(p.id) === String(actual))) sel.value = actual;
}

async function registrarEntradaInventario() {
  const selProducto = document.getElementById("entradaProducto");
  const selArea = document.getElementById("entradaArea");
  const inputCantidad = document.getElementById("entradaCantidad");
  if (!selProducto || !selArea || !inputCantidad) return;
  const idProducto = Number(selProducto.value);
  const area = selArea.value;
  const cantidad = Math.floor(Number(inputCantidad.value));
  if (!idProducto) { alert("Selecciona un producto."); return; }
  if (area !== "Tienda" && area !== "Casa") { alert("Área inválida."); return; }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    alert("La cantidad debe ser mayor que 0.");
    inputCantidad.focus();
    return;
  }
  const producto = productos.find(p => Number(p.id) === idProducto);
  if (!producto) { alert("Producto no encontrado."); return; }
  const clave = claveStockLugar(area);
  try {
    producto.stock[clave] = (Number(producto.stock[clave]) || 0) + cantidad;
    await guardarDato("productos", producto);
    const entrada = {
      idProducto: producto.id, nombre: producto.nombre,
      area, cantidad, fecha: new Date().toISOString()
    };
    const id = await guardarDato("entradas", entrada);
    entrada.id = id;
    entradas.push(adaptarEntrada(entrada));
    dibujarInventario();
    dibujarEntradas();
    dibujarCatalogo();
    actualizarInicio();
    inputCantidad.value = "1";
    alert(`Entrada registrada: +${cantidad} de "${producto.nombre}" en ${area}.`);
  } catch (e) {
    console.error(e);
    alert("No se pudo registrar la entrada.");
  }
}

function dibujarInventario() {
  const lista = document.getElementById("listaInventario");
  const resumen = document.getElementById("resumenInventario");
  if (!lista) return;
  const totales = calcularTotalesInventario();
  if (resumen) {
    resumen.innerHTML = `
      <div class="inventario-resumen-total almacen"><small>Almacén</small><strong>∞</strong></div>
      <div class="inventario-resumen-total tienda"><small>Tienda</small><strong>${totales.tienda}</strong></div>
      <div class="inventario-resumen-total casa"><small>Casa</small><strong>${totales.casa}</strong></div>
    `;
  }
  const busquedaInput = document.getElementById("buscarInventario");
  const busqueda = busquedaInput ? busquedaInput.value.trim().toLowerCase() : "";
  const filtrados = productos.filter(p =>
    String(p.nombre || "").toLowerCase().includes(busqueda)
  );
  if (!filtrados.length) {
    lista.innerHTML = `<div class="texto-vacio">No hay productos${busqueda ? " que coincidan" : ""}.</div>`;
    return;
  }
  lista.innerHTML = filtrados.map(p => {
    const variantesTxt = p.variantes.length
      ? p.variantes.map(v => v.etiqueta || "Único").join(" · ")
      : "—";
    return `
      <div class="inventario-fila inventario-fila-con-acciones">
        <div class="inventario-fila-nombre">
          <h3>${escapar(p.nombre)}</h3>
          <small>${escapar(variantesTxt)}</small>
        </div>
        <div class="inventario-col almacen"><small>Almacén</small><strong>∞</strong></div>
        <div class="inventario-col tienda"><small>Tienda</small><strong>${p.stock.tienda}</strong></div>
        <div class="inventario-col casa"><small>Casa</small><strong>${p.stock.casa}</strong></div>
        <div class="inventario-acciones">
          <button type="button" class="btn-secundario inventario-btn"
                  onclick="editarProducto(${Number(p.id)})">EDITAR</button>
          <button type="button" class="btn-peligro inventario-btn"
                  onclick="eliminarProducto(${Number(p.id)})">ELIMINAR</button>
        </div>
      </div>
    `;
  }).join("");
}

function dibujarEntradas() {
  const cont = document.getElementById("listaEntradas");
  if (!cont) return;
  if (!entradas.length) {
    cont.innerHTML = `<div class="texto-vacio">Aún no hay entradas registradas.</div>`;
    return;
  }
  const lista = entradas.slice()
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, 100);
  cont.innerHTML = lista.map(e => `
    <div class="entrada-fila">
      <div class="entrada-info">
        <h4>${escapar(e.nombre)}</h4>
        <small>${escapar(e.area)} · ${escapar(mostrarFechaHora(e.fecha))}</small>
      </div>
      <div class="entrada-cantidad">+${e.cantidad}<small>uds</small></div>
    </div>
  `).join("");
}

// ==========================================
// EXPORTAR INVENTARIO A PDF
// ==========================================

function exportarInventarioPDF() {
  if (!productos.length) { alert("No hay productos para exportar."); return; }
  const totales = calcularTotalesInventario();
  const generado = mostrarFechaHora(new Date().toISOString());

  const filasStock = productos.map(p => {
    const variantesTxt = p.variantes.map(v =>
      `${escapar(v.etiqueta || "Único")}: ${formato(v.precioCUP)} CUP / ${formato(v.precioUSD)} USD`
    ).join("<br>") || "—";
    return `
      <tr>
        <td>${escapar(p.nombre)}</td>
        <td>${variantesTxt}</td>
        <td class="numero">∞</td>
        <td class="numero">${p.stock.tienda}</td>
        <td class="numero">${p.stock.casa}</td>
      </tr>
    `;
  }).join("");

  const entradasOrdenadas = entradas.slice()
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const filasEntradas = entradasOrdenadas.length
    ? entradasOrdenadas.map(e => `
        <tr>
          <td>${escapar(mostrarFechaHora(e.fecha))}</td>
          <td>${escapar(e.nombre)}</td>
          <td>${escapar(e.area)}</td>
          <td class="numero">+${e.cantidad}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#999">Sin entradas</td></tr>`;

  const documento = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Inventario - CAJA</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#242424;margin:25px}
      h1{margin-bottom:5px;font-size:25px}
      h2{font-size:16px;margin:22px 0 10px;border-bottom:2px solid #f28c28;padding-bottom:5px}
      .subtitulo{color:#777;margin-bottom:20px;font-size:13px}
      .resumen{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
      .resumen div{border:1px solid #ddd;border-radius:8px;padding:12px;flex:1;min-width:120px}
      .resumen small{display:block;font-size:10px;color:#777;text-transform:uppercase}
      .resumen strong{display:block;margin-top:6px;font-size:18px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
      th{background:#222;color:white}
      .numero{text-align:right;white-space:nowrap}
      tr{page-break-inside:avoid}
      .pie{margin-top:30px;color:#777;font-size:10px;text-align:center}
    </style></head><body>
    <h1>CAJA | Inventario</h1>
    <div class="subtitulo">Informe generado el ${escapar(generado)}</div>
    <div class="resumen">
      <div><small>Productos</small><strong>${totales.productos}</strong></div>
      <div><small>Almacén</small><strong>∞</strong></div>
      <div><small>Total Tienda</small><strong>${totales.tienda} uds</strong></div>
      <div><small>Total Casa</small><strong>${totales.casa} uds</strong></div>
    </div>
    <h2>Stock actual por producto</h2>
    <table><thead><tr>
      <th>Producto</th><th>Presentaciones / precios</th>
      <th>Almacén</th><th>Tienda</th><th>Casa</th>
    </tr></thead><tbody>${filasStock}</tbody></table>
    <h2>Historial de entradas</h2>
    <table><thead><tr>
      <th>Fecha y hora</th><th>Producto</th><th>Área</th><th>Cantidad</th>
    </tr></thead><tbody>${filasEntradas}</tbody></table>
    <div class="pie">Sistema de gestión de ventas CAJA</div>
    <script>window.onload=function(){window.print()};<\/script>
    </body></html>
  `;

  const v = window.open("", "_blank");
  if (!v) { alert("El navegador bloqueó la ventana."); return; }
  v.document.open(); v.document.write(documento); v.document.close();
}
// ==========================================
// CAJA - NUEVA VENTA
// ==========================================

function mostrarCaja() {
  const f = document.getElementById("fechaVenta");
  if (f && !f.value) f.value = fechaLocal();
  const p = document.getElementById("porcentajeVenta");
  if (p) p.value = porcentajeSalario;
  const m = document.getElementById("monedaSeleccionada");
  if (m) m.value = monedaVenta;
  dibujarProductosCaja();
  dibujarCarrito();
}

function cambiarMonedaVenta() {
  const selector = document.getElementById("monedaSeleccionada");
  if (!selector) return;
  const anterior = monedaVenta;
  const nueva = selector.value;
  if (nueva !== "CUP" && nueva !== "USD") { selector.value = anterior; return; }

  const precios = [];
  for (const linea of carrito) {
    const producto = productos.find(p => Number(p.id) === Number(linea.idProducto));
    const variante = producto?.variantes?.find(v => v.id === linea.idVariante);
    if (!variante) {
      alert("No se encontró un precio del carrito.");
      selector.value = anterior;
      return;
    }
    const np = Number(precioVariante(variante, nueva));
    if (!Number.isFinite(np) || np <= 0) {
      alert(`El precio "${variante.etiqueta}" no tiene valor en ${nueva}.`);
      selector.value = anterior;
      return;
    }
    precios.push(np);
  }
  monedaVenta = nueva;
  carrito.forEach((l, i) => { l.precio = precios[i]; });
  dibujarProductosCaja();
  dibujarCarrito();
}

function toggleProductoCaja(idProducto) {
  const id = Number(idProducto);
  if (productosDesplegadosCaja.has(id)) {
    productosDesplegadosCaja.delete(id);
  } else {
    productosDesplegadosCaja.add(id);
  }
  dibujarProductosCaja();
}

function dibujarProductosCaja() {
  const lista = document.getElementById("listaProductosCaja");
  if (!lista) return;

  const busquedaInput = document.getElementById("buscarProductoCaja");
  const busqueda = busquedaInput ? busquedaInput.value.trim().toLowerCase() : "";
  const lugarInput = document.getElementById("lugarVenta");
  const lugar = lugarInput ? lugarInput.value : "Tienda";

  const filtrados = productos.filter(p =>
    String(p.nombre || "").toLowerCase().includes(busqueda)
  );

  if (!filtrados.length) {
    lista.innerHTML = `<div class="texto-vacio">No hay productos disponibles.</div>`;
    return;
  }

  lista.innerHTML = filtrados.map(producto => {
    const idProducto = Number(producto.id);
    const disponible = stockDisponible(producto, lugar);
    const stockTexto = disponible === Infinity ? "∞" : disponible;
    const sinStock = disponible !== Infinity && disponible <= 0;

    const totalEnCarrito = totalUnidadesEnCarrito(idProducto);
    const abierto = productosDesplegadosCaja.has(idProducto) || totalEnCarrito > 0;

    const botonAgregar = abierto
      ? ""
      : `
        <button type="button" class="btn-principal"
                style="width:auto;min-width:100px;padding:10px 14px;font-size:13px"
                ${sinStock ? "disabled" : ""}
                onclick="toggleProductoCaja(${idProducto})">
          ${sinStock ? "SIN STOCK" : "AGREGAR"}
        </button>
      `;

    const filasPrecios = abierto
      ? producto.variantes.map(v => {
          const precio = precioVariante(v, monedaVenta);
          const enCarrito = cantidadEnCarritoVariante(idProducto, v.id);
          const bloqueado = sinStock || precio <= 0;

          return `
            <div class="precio-fila">
              <div class="precio-fila-info">
                <span class="precio-etiqueta">${escapar(v.etiqueta || "Único")}</span>
                <span class="precio-valor">
                  ${precio > 0 ? formato(precio) + " " + monedaVenta : "— sin precio —"}
                </span>
              </div>
              <div class="precio-fila-controles">
                <button type="button" class="btn-cantidad"
                        onclick="cambiarCantidadVarianteCaja(${idProducto},'${escapar(v.id)}',-1)"
                        ${enCarrito === 0 ? "disabled" : ""}>−</button>
                <span class="cantidad">${enCarrito}</span>
                <button type="button" class="btn-cantidad"
                        onclick="cambiarCantidadVarianteCaja(${idProducto},'${escapar(v.id)}',1)"
                        ${bloqueado ? "disabled" : ""}>+</button>
              </div>
            </div>
          `;
        }).join("")
      : "";

    const botonCerrar = abierto
      ? `
        <button type="button" class="btn-secundario"
                style="padding:6px 10px;font-size:11px;margin-top:8px"
                onclick="toggleProductoCaja(${idProducto})">
          Cerrar precios
        </button>
      `
      : "";

    return `
      <div class="producto-caja">
        <div class="producto-caja-header">
          <div>
            <h3>${escapar(producto.nombre)}</h3>
            <small class="stock-linea ${sinStock ? "sin-stock" : ""}">
              Stock ${lugar}: <strong>${stockTexto}</strong>
            </small>
          </div>
          ${botonAgregar}
        </div>
        ${filasPrecios}
        ${botonCerrar}
      </div>
    `;
  }).join("");
}

function cambiarCantidadVarianteCaja(idProducto, idVariante, cambio) {
  const producto = productos.find(p => Number(p.id) === Number(idProducto));
  if (!producto) return;

  const lugarInput = document.getElementById("lugarVenta");
  const lugar = lugarInput ? lugarInput.value : "Tienda";
  const disponible = stockDisponible(producto, lugar);

  const linea = carrito.find(l =>
    Number(l.idProducto) === Number(idProducto) && l.idVariante === idVariante
  );

  const cantidadActual = linea ? Number(linea.cantidad) : 0;
  const nueva = cantidadActual + Number(cambio);

  if (nueva <= 0) {
    if (linea) {
      carrito = carrito.filter(l =>
        !(Number(l.idProducto) === Number(idProducto) && l.idVariante === idVariante)
      );
      if (totalUnidadesEnCarrito(idProducto) === 0) {
        productosDesplegadosCaja.delete(Number(idProducto));
      }
      dibujarProductosCaja();
      dibujarCarrito();
    }
    return;
  }

  const totalProducto = totalUnidadesEnCarrito(idProducto);
  const nuevoTotal = totalProducto - cantidadActual + nueva;

  if (disponible !== Infinity && nuevoTotal > disponible) {
    alert(`No hay stock suficiente en ${lugar}. Disponible: ${disponible}.`);
    return;
  }

  if (linea) {
    linea.cantidad = nueva;
  } else {
    const variante = producto.variantes.find(v => v.id === idVariante);
    if (!variante) { alert("Precio no encontrado."); return; }
    const precio = Number(precioVariante(variante, monedaVenta));
    if (!Number.isFinite(precio) || precio <= 0) {
      alert(`El precio "${variante.etiqueta}" no tiene valor en ${monedaVenta}.`);
      return;
    }
    carrito.push({
      idProducto: producto.id,
      idVariante: variante.id,
      etiquetaVariante: variante.etiqueta,
      nombre: producto.nombre,
      cantidad: 1,
      precio
    });
  }

  productosDesplegadosCaja.add(Number(idProducto));

  dibujarProductosCaja();
  dibujarCarrito();
}

function quitarVarianteDelCarrito(idProducto, idVariante) {
  carrito = carrito.filter(l =>
    !(Number(l.idProducto) === Number(idProducto) && l.idVariante === idVariante)
  );
  if (totalUnidadesEnCarrito(idProducto) === 0) {
    productosDesplegadosCaja.delete(Number(idProducto));
  }
  dibujarProductosCaja();
  dibujarCarrito();
}

function dibujarCarrito() {
  const cont = document.getElementById("carritoVenta");
  const resumen = document.getElementById("resumenVenta");
  if (!cont) return;

  if (!carrito.length) {
    cont.innerHTML = `<div class="texto-vacio">No hay productos en la venta.</div>`;
    if (resumen) resumen.innerHTML = `
      <div class="total">0 ${monedaVenta}</div>
      <div class="salario">Salario: 0 CUP</div>`;
    return;
  }

  const porProducto = {};
  carrito.forEach(linea => {
    const idP = Number(linea.idProducto);
    if (!porProducto[idP]) porProducto[idP] = [];
    porProducto[idP].push(linea);
  });

  cont.innerHTML = Object.entries(porProducto).map(([idP, lineas]) => {
    const producto = productos.find(p => Number(p.id) === Number(idP));
    const nombre = producto ? producto.nombre : "Producto";

    const totalProducto = lineas.reduce((s, l) =>
      s + Number(l.precio) * Number(l.cantidad), 0);

    const presentacionesHtml = lineas.map(linea => {
      const variante = producto?.variantes?.find(v => v.id === linea.idVariante);
      const etiqueta = variante ? (variante.etiqueta || "Único") : (linea.etiquetaVariante || "");
      const subtotal = Number(linea.precio) * Number(linea.cantidad);
      return `
        <div class="carrito-presentacion">
          <div class="carrito-presentacion-info">
            <span class="carrito-presentacion-etiqueta">
              ${escapar(etiqueta || "Único")} — ${formato(linea.precio)} ${monedaVenta}
            </span>
            <span class="carrito-presentacion-subtotal">
              × ${linea.cantidad} = ${formato(subtotal)} ${monedaVenta}
            </span>
          </div>
          <div class="controles-cantidad">
            <button type="button" class="btn-cantidad"
                    onclick="cambiarCantidadVarianteCaja(${Number(idP)},'${escapar(linea.idVariante)}',-1)">−</button>
            <span class="cantidad">${linea.cantidad}</span>
            <button type="button" class="btn-cantidad"
                    onclick="cambiarCantidadVarianteCaja(${Number(idP)},'${escapar(linea.idVariante)}',1)">+</button>
            <button type="button" class="btn-secundario"
                    style="padding:8px 10px;font-size:13px"
                    onclick="quitarVarianteDelCarrito(${Number(idP)},'${escapar(linea.idVariante)}')">×</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="carrito-producto">
        <div class="carrito-producto-header">
          <h3>${escapar(nombre)}</h3>
          <span class="carrito-producto-total">${formato(totalProducto)} ${monedaVenta}</span>
        </div>
        ${presentacionesHtml}
      </div>
    `;
  }).join("");

  if (resumen) {
    const t = calcularTotalesVenta();
    resumen.innerHTML = `
      <div class="total">TOTAL: ${formato(t.total)} ${monedaVenta}</div>
      <div class="salario">Base salarial: ${formato(t.baseCUP)} CUP</div>
      <div class="salario">Salario (${porcentajeSalario}%): ${formato(t.salario)} CUP</div>
    `;
  }
}

function calcularTotalesVenta() {
  let total = 0, baseCUP = 0;

  carrito.forEach(linea => {
    const cantidad = Number(linea.cantidad) || 0;
    const precio = Number(linea.precio) || 0;
    const subtotal = cantidad * precio;
    total += subtotal;

    if (monedaVenta === "CUP") {
      baseCUP += subtotal;
    } else {
      const producto = productos.find(p => Number(p.id) === Number(linea.idProducto));
      const variante = producto?.variantes?.find(v => v.id === linea.idVariante);
      baseCUP += cantidad * (Number(variante?.precioCUP) || 0);
    }
  });

  const salario = baseCUP * (Number(porcentajeSalario) || 0) / 100;
  return {
    total, baseCUP, salario,
    cantidadProductos: carrito.reduce((s, l) => s + Number(l.cantidad || 0), 0)
  };
}

function actualizarPorcentajeSalario() {
  const input = document.getElementById("porcentajeVenta");
  if (!input) return;
  const valor = Number(input.value);
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    alert("Introduce un porcentaje entre 0 y 100.");
    input.value = porcentajeSalario;
    return;
  }
  porcentajeSalario = valor;
  dibujarCarrito();
}

let guardandoVenta = false;

function registrarVenta() {
  if (!carrito.length) { alert("Agrega productos antes de registrar."); return; }
  const fechaInput = document.getElementById("fechaVenta");
  const lugarInput = document.getElementById("lugarVenta");
  const fecha = fechaInput ? fechaInput.value : fechaLocal();
  const lugar = lugarInput ? lugarInput.value : "Tienda";
  if (!fecha) { alert("Selecciona la fecha."); return; }
  if (!LUGARES_VENTA.includes(lugar)) { alert("Lugar inválido."); return; }

  const t = calcularTotalesVenta();
  if (!confirm(
    "¿Confirmar esta venta?\n\n" +
    "Productos: " + t.cantidadProductos + "\n" +
    "Total: " + formato(t.total) + " " + monedaVenta + "\n" +
    "Lugar: " + lugar + "\n" +
    "Salario: " + formato(t.salario) + " CUP"
  )) return;
  confirmarVenta();
}

async function confirmarVenta() {
  if (guardandoVenta) return;
  if (!carrito.length) return;

  const fechaInput = document.getElementById("fechaVenta");
  const lugarInput = document.getElementById("lugarVenta");
  const fecha = fechaInput ? fechaInput.value : fechaLocal();
  const lugar = lugarInput ? lugarInput.value : "Tienda";
  if (!fecha || !LUGARES_VENTA.includes(lugar)) { alert("Datos inválidos."); return; }

  const t = calcularTotalesVenta();
  if (!Number.isFinite(t.total) || t.total <= 0) { alert("Importe inválido."); return; }

  guardandoVenta = true;
  try {
    const lineasVenta = carrito.map(linea => {
      const cantidad = Number(linea.cantidad) || 0;
      const precio = Number(linea.precio) || 0;
      const subtotal = cantidad * precio;
      const producto = productos.find(p => Number(p.id) === Number(linea.idProducto));
      const variante = producto?.variantes?.find(v => v.id === linea.idVariante);

      const precioCUP = Number(variante?.precioCUP) || 0;
      const subtotalCUP = cantidad * precioCUP;
      const baseCUP = monedaVenta === "CUP" ? subtotal : subtotalCUP;
      const salarioLinea = baseCUP * Number(porcentajeSalario) / 100;

      return {
        idProducto: linea.idProducto,
        idVariante: linea.idVariante,
        etiquetaVariante: linea.etiquetaVariante || "",
        nombre: linea.nombre || (producto ? producto.nombre : "Producto"),
        nombreCompleto: nombreConVariante(
          linea.nombre || (producto ? producto.nombre : "Producto"),
          linea.etiquetaVariante
        ),
        cantidad, precio, precioCUP, subtotal, subtotalCUP,
        total: subtotal, baseCUP,
        totalCUP: monedaVenta === "CUP" ? subtotal : 0,
        porcentajeSalario, salario: salarioLinea
      };
    });

    const venta = {
      fecha,
      fechaRegistro: new Date().toISOString(),
      moneda: monedaVenta,
      lugarVenta: lugar,
      productos: lineasVenta,
      total: t.total,
      totalCUP: monedaVenta === "CUP" ? t.total : 0,
      baseCUP: t.baseCUP,
      porcentajeSalario,
      salario: t.salario
    };

    const id = await guardarDato("ventas", venta);
    venta.id = id;
    ventas.push(adaptarVenta(venta));

    await descontarStockVenta(lineasVenta, lugar);

    carrito = [];
    productosDesplegadosCaja.clear();
    dibujarProductosCaja();
    dibujarCarrito();
    dibujarCatalogo();
    dibujarInventario();
    actualizarInicio();

    alert(
      "Venta registrada.\n\n" +
      "Total: " + formato(venta.total) + " " + venta.moneda + "\n" +
      "Lugar: " + venta.lugarVenta + "\n" +
      "Salario: " + formato(venta.salario) + " CUP"
    );
  } catch (e) {
    console.error(e);
    alert("No se pudo registrar la venta.");
  } finally {
    guardandoVenta = false;
  }
}

function cancelarVenta() {
  if (!carrito.length) return;
  if (!confirm("¿Cancelar esta venta y vaciar el carrito?")) return;
  carrito = [];
  productosDesplegadosCaja.clear();
  dibujarProductosCaja();
  dibujarCarrito();
}

// ==========================================
// COMPRA USD
// ==========================================

function mostrarCompraUSD() {
  const contDesglose = document.getElementById("compraUSD_desglose");
  if (contDesglose && !contDesglose.dataset.inicializado) {
    contDesglose.dataset.inicializado = "1";
    contDesglose.innerHTML = denominacionesEfectivo.map(v => `
      <div class="compra-desglose-fila">
        <span class="compra-desglose-denom">${formato(v)} CUP</span>
        <span class="compra-desglose-subtotal" id="compra-desglose-subtotal-${v}">0.00 CUP</span>
        <input type="number" class="compra-desglose-input" id="compra-desglose-${v}"
               min="0" step="1" inputmode="numeric" placeholder="0"
               oninput="actualizarTotalCompraUSD()">
      </div>
    `).join("");
  }

  const fecha = document.getElementById("compraUSD_fecha");
  if (fecha && !fecha.value) fecha.value = fechaLocal();

  actualizarTotalCompraUSD();
  dibujarComprasUSD();
  dibujarResumenComprasUSD();
}

function leerDesgloseCompraUSD() {
  const desglose = [];
  let totalBilletesCUP = 0;
  denominacionesEfectivo.forEach(v => {
    const input = document.getElementById("compra-desglose-" + v);
    const cantidad = Math.max(0, Math.floor(Number(input?.value) || 0));
    const subtotal = v * cantidad;
    desglose.push({ denominacion: v, cantidad, subtotal });
    totalBilletesCUP += subtotal;

    const sub = document.getElementById("compra-desglose-subtotal-" + v);
    if (sub) sub.textContent = formato(subtotal) + " CUP";
  });
  return { desglose, totalBilletesCUP };
}

function actualizarTotalCompraUSD() {
  const tasa = Number(document.getElementById("compraUSD_tasa")?.value) || 0;
  const cantidadUSD = Number(document.getElementById("compraUSD_cantidad")?.value) || 0;
  const { totalBilletesCUP } = leerDesgloseCompraUSD();

  const totalPagado = tasa * cantidadUSD;

  const cont = document.getElementById("compraUSD_totalPagado");
  if (cont) cont.textContent = formato(totalPagado) + " CUP";

  const aviso = document.getElementById("compraUSD_aviso");
  if (aviso) {
    if (totalBilletesCUP > 0 && Math.abs(totalBilletesCUP - totalPagado) > 0.01) {
      aviso.textContent =
        `⚠️ La suma de billetes (${formato(totalBilletesCUP)} CUP) no coincide con tasa × USD (${formato(totalPagado)} CUP).`;
    } else {
      aviso.textContent = "";
    }
  }
}

async function registrarCompraUSD() {
  const fechaInput = document.getElementById("compraUSD_fecha");
  const tasaInput = document.getElementById("compraUSD_tasa");
  const cantidadInput = document.getElementById("compraUSD_cantidad");

  if (!fechaInput || !tasaInput || !cantidadInput) return;

  const fecha = fechaInput.value || fechaLocal();
  const tasaCUP = Number(tasaInput.value) || 0;
  const cantidadUSD = Number(cantidadInput.value) || 0;

  if (tasaCUP <= 0) { alert("Introduce un precio del USD mayor que 0."); tasaInput.focus(); return; }
  if (cantidadUSD <= 0) { alert("Introduce una cantidad de USD mayor que 0."); cantidadInput.focus(); return; }

  const { desglose, totalBilletesCUP } = leerDesgloseCompraUSD();
  const totalCUP = tasaCUP * cantidadUSD;

  if (totalBilletesCUP > 0 && Math.abs(totalBilletesCUP - totalCUP) > 0.01) {
    if (!confirm(
      "La suma de los billetes no coincide con tasa × USD.\n\n" +
      `Tasa × USD = ${formato(totalCUP)} CUP\n` +
      `Billetes = ${formato(totalBilletesCUP)} CUP\n\n` +
      "¿Registrar de todos modos?"
    )) return;
  }

  const compra = {
    fecha,
    fechaRegistro: new Date().toISOString(),
    tasaCUP,
    cantidadUSD,
    totalCUP,
    desglose: desglose.filter(d => d.cantidad > 0)
  };

  try {
    const id = await guardarDato("comprasUSD", compra);
    compra.id = id;
    comprasUSD.push(adaptarCompraUSD(compra));

    tasaInput.value = "";
    cantidadInput.value = "";
    denominacionesEfectivo.forEach(v => {
      const input = document.getElementById("compra-desglose-" + v);
      if (input) input.value = "";
      const sub = document.getElementById("compra-desglose-subtotal-" + v);
      if (sub) sub.textContent = "0.00 CUP";
    });
    actualizarTotalCompraUSD();

    dibujarComprasUSD();
    dibujarResumenComprasUSD();

    alert(
      "Compra registrada.\n\n" +
      "USD comprados: " + formato(cantidadUSD) + " USD\n" +
      "Tasa: " + formato(tasaCUP) + " CUP/USD\n" +
      "Total pagado: " + formato(totalCUP) + " CUP"
    );
  } catch (e) {
    console.error(e);
    alert("No se pudo registrar la compra.");
  }
}

function obtenerComprasUSDFiltradas() {
  const dia = valorFiltro("filtroCompraUSD_dia");
  const desde = valorFiltro("filtroCompraUSD_desde");
  const hasta = valorFiltro("filtroCompraUSD_hasta");
  const tasaMin = valorFiltro("filtroCompraUSD_tasaMin");
  const tasaMax = valorFiltro("filtroCompraUSD_tasaMax");

  return comprasUSD.filter(c => {
    const fecha = fechaParaComparar(c.fecha);
    if (dia && fecha !== dia) return false;
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;

    const tasa = Number(c.tasaCUP) || 0;
    if (tasaMin !== "" && tasa < Number(tasaMin)) return false;
    if (tasaMax !== "" && tasa > Number(tasaMax)) return false;

    return true;
  });
}

function aplicarFiltrosComprasUSD() {
  dibujarComprasUSD();
  dibujarResumenComprasUSD();
}

function limpiarFiltrosComprasUSD() {
  [
    "filtroCompraUSD_dia",
    "filtroCompraUSD_desde",
    "filtroCompraUSD_hasta",
    "filtroCompraUSD_tasaMin",
    "filtroCompraUSD_tasaMax"
  ].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.value = "";
  });
  dibujarComprasUSD();
  dibujarResumenComprasUSD();
}

function dibujarComprasUSD() {
  const cont = document.getElementById("listaComprasUSD");
  if (!cont) return;

  const lista = obtenerComprasUSDFiltradas().slice().sort((a, b) => {
    const fa = a.fechaRegistro || a.fecha || "";
    const fb = b.fechaRegistro || b.fecha || "";
    return String(fb).localeCompare(String(fa));
  });

  if (!lista.length) {
    cont.innerHTML = `<div class="texto-vacio">No hay compras de USD que coincidan.</div>`;
    return;
  }

  cont.innerHTML = lista.map(c => {
    const chips = (c.desglose || [])
      .filter(d => d.cantidad > 0)
      .map(d => `
        <span class="compra-billete-chip">
          <strong>${d.cantidad}</strong> × ${formato(d.denominacion)} CUP
        </span>
      `).join("");

    return `
      <div class="compra-card">
        <div class="compra-card-header">
          <div style="min-width:0">
            <h3>Compra #${Number(c.id)}</h3>
            <small>${mostrarFecha(c.fecha)} · Tasa ${formato(c.tasaCUP)} CUP/USD</small>
          </div>
          <div style="text-align:right">
            <div class="compra-card-total">${formato(c.totalCUP)} CUP</div>
            <div class="compra-card-total-usd">${formato(c.cantidadUSD)} USD</div>
          </div>
        </div>
        ${chips ? `<div class="compra-card-desglose">${chips}</div>` : ""}
        <button type="button" class="btn-peligro"
                style="margin-top:10px;width:100%"
                onclick="eliminarCompraUSD(${Number(c.id)})">
          Eliminar compra
        </button>
      </div>
    `;
  }).join("");
}

function dibujarResumenComprasUSD() {
  const cont = document.getElementById("resumenComprasUSD");
  if (!cont) return;

  const lista = obtenerComprasUSDFiltradas();

  const compras = lista.length;
  let usdTotal = 0, cupTotal = 0;
  lista.forEach(c => {
    usdTotal += Number(c.cantidadUSD) || 0;
    cupTotal += Number(c.totalCUP) || 0;
  });
  const tasaPromedio = usdTotal > 0 ? cupTotal / usdTotal : 0;

  cont.innerHTML = `
    <div class="tarjeta resumen-filtrado">
      <div class="resumen-filtrado-header">
        <h3>Resumen de compras USD</h3>
        <small>${compras} compra${compras === 1 ? "" : "s"}</small>
      </div>
      <div class="resumen-filtrado-grid">
        <div class="resumen-filtrado-item">
          <small>Compras</small>
          <strong>${compras}</strong>
        </div>
        <div class="resumen-filtrado-item verde">
          <small>USD comprados</small>
          <strong>${formato(usdTotal)} USD</strong>
        </div>
        <div class="resumen-filtrado-item naranja">
          <small>Total pagado</small>
          <strong>${formato(cupTotal)} CUP</strong>
        </div>
        <div class="resumen-filtrado-item">
          <small>Tasa promedio</small>
          <strong>${formato(tasaPromedio)} CUP/USD</strong>
        </div>
      </div>
    </div>
  `;
}

async function eliminarCompraUSD(id) {
  const compra = comprasUSD.find(c => Number(c.id) === Number(id));
  if (!compra) return;
  if (!confirm(`¿Eliminar la compra #${compra.id}?`)) return;

  try {
    await eliminarDato("comprasUSD", compra.id);
    comprasUSD = comprasUSD.filter(c => Number(c.id) !== Number(id));
    dibujarComprasUSD();
    dibujarResumenComprasUSD();
    alert("Compra eliminada.");
  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar la compra.");
  }
}

function exportarComprasUSDPDF() {
  const lista = obtenerComprasUSDFiltradas().slice().sort((a, b) =>
    String(b.fechaRegistro || b.fecha || "").localeCompare(
      String(a.fechaRegistro || a.fecha || "")
    )
  );

  if (!lista.length) { alert("No hay compras para exportar."); return; }

  let usdTotal = 0, cupTotal = 0;
  lista.forEach(c => {
    usdTotal += Number(c.cantidadUSD) || 0;
    cupTotal += Number(c.totalCUP) || 0;
  });
  const tasaPromedio = usdTotal > 0 ? cupTotal / usdTotal : 0;

  const filas = lista.map(c => {
    const desgloseHtml = (c.desglose || [])
      .filter(d => d.cantidad > 0)
      .map(d => `${d.cantidad} × ${formato(d.denominacion)}`)
      .join("<br>") || "—";

    return `
      <tr>
        <td>${Number(c.id)}</td>
        <td>${escapar(mostrarFecha(c.fecha))}</td>
        <td class="numero">${formato(c.tasaCUP)}</td>
        <td class="numero">${formato(c.cantidadUSD)}</td>
        <td class="numero">${formato(c.totalCUP)} CUP</td>
        <td>${desgloseHtml}</td>
      </tr>
    `;
  }).join("");

  const doc = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Compras USD - CAJA</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#242424;margin:25px}
      h1{margin-bottom:5px;font-size:25px}
      .sub{color:#777;margin-bottom:20px;font-size:13px}
      .r{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
      .r div{border:1px solid #ddd;border-radius:8px;padding:12px;flex:1;min-width:140px}
      .r small{display:block;font-size:10px;color:#777;text-transform:uppercase}
      .r strong{display:block;margin-top:6px;font-size:16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
      th{background:#222;color:white}
      .numero{text-align:right;white-space:nowrap}
      tr{page-break-inside:avoid}
      .pie{margin-top:25px;color:#777;font-size:10px;text-align:center}
    </style></head><body>
    <h1>CAJA | Compras de USD</h1>
    <div class="sub">Generado el ${escapar(mostrarFechaHora(new Date().toISOString()))}</div>
    <div class="r">
      <div><small>Compras</small><strong>${lista.length}</strong></div>
      <div><small>USD totales</small><strong>${formato(usdTotal)} USD</strong></div>
      <div><small>Total pagado</small><strong>${formato(cupTotal)} CUP</strong></div>
      <div><small>Tasa promedio</small><strong>${formato(tasaPromedio)} CUP/USD</strong></div>
    </div>
    <table><thead><tr>
      <th>N.º</th><th>Fecha</th><th>Tasa (CUP/USD)</th><th>USD</th>
      <th>Total pagado</th><th>Desglose billetes</th>
    </tr></thead><tbody>${filas}</tbody></table>
    <div class="pie">Sistema de gestión de ventas CAJA</div>
    <script>window.onload=function(){window.print()};<\/script>
    </body></html>
  `;

  const v = window.open("", "_blank");
  if (!v) { alert("El navegador bloqueó la ventana."); return; }
  v.document.open(); v.document.write(doc); v.document.close();
}

// ==========================================
// REGISTRO
// ==========================================

function mostrarRegistro() {
  cargarOpcionesFiltroProductos();
  dibujarRegistro();
}

function cargarOpcionesFiltroProductos() {
  const campo = document.getElementById("filtroProducto");
  if (!campo) return;
  const actual = campo.value;
  campo.innerHTML = `
    <option value="">Todos los productos</option>
    ${productos.map(p => `<option value="${Number(p.id)}">${escapar(p.nombre)}</option>`).join("")}
  `;
  campo.value = actual;
}

function valorFiltro(id) {
  const c = document.getElementById(id);
  return c ? c.value.trim() : "";
}

function obtenerVentasFiltradas() {
  const periodo = valorFiltro("filtroPeriodo");
  const dia = valorFiltro("filtroDia");
  const fechaDesde = valorFiltro("filtroFechaDesde");
  const fechaHasta = valorFiltro("filtroFechaHasta");
  const producto = valorFiltro("filtroProducto");
  const moneda = valorFiltro("filtroMoneda");
  const lugar = valorFiltro("filtroLugar");
  const minimo = valorFiltro("filtroMinimo");
  const maximo = valorFiltro("filtroMaximo");

  const hoy = fechaLocal();
  const mesActual = mesLocal();
  const fechaHoy = new Date(); fechaHoy.setHours(0,0,0,0);
  const inicioSemana = new Date(fechaHoy);
  const diaSemana = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);

  const usaDiaConcreto = !!dia;
  const usaRango = !!(fechaDesde || fechaHasta);

  return ventas.filter(venta => {
    const fecha = fechaParaComparar(venta.fecha);

    if (usaDiaConcreto) {
      if (fecha !== dia) return false;
    } else if (usaRango) {
      if (!fecha) return false;
      if (fechaDesde && fecha < fechaDesde) return false;
      if (fechaHasta && fecha > fechaHasta) return false;
    } else {
      if (periodo === "hoy" && fecha !== hoy) return false;
      if (periodo === "mes" && !fecha.startsWith(mesActual)) return false;
      if (periodo === "anio" && !fecha.startsWith(String(new Date().getFullYear()))) return false;
      if (periodo === "semana") {
        if (!fecha) return false;
        const fv = new Date(fecha + "T00:00:00");
        if (Number.isNaN(fv.getTime())) return false;
        fv.setHours(0,0,0,0);
        if (fv < inicioSemana || fv > fechaHoy) return false;
      }
    }

    if (producto) {
      const idP = Number(producto);
      const tiene = venta.productos.some(l => {
        const id = l.idProducto ?? l.productoId ?? l.id;
        return Number(id) === idP;
      });
      if (!tiene) return false;
    }

    if (moneda && venta.moneda !== moneda) return false;
    if (lugar && venta.lugarVenta !== lugar) return false;

    const imp = Number(venta.total) || 0;
    if (minimo !== "" && imp < Number(minimo)) return false;
    if (maximo !== "" && imp > Number(maximo)) return false;

    return true;
  });
}

function actualizarResumenRegistro(lista) {
  const cont = document.getElementById("resumenRegistro");
  if (!cont) return;

  const operaciones = lista.length;
  const sacosVendidos = lista.reduce((sum, v) => {
    return sum + (v.productos || []).reduce(
      (s, l) => s + (Number(l.cantidad) || 0), 0
    );
  }, 0);
  const ventasCUP = lista
    .filter(v => (v.moneda || "CUP") === "CUP")
    .reduce((s, v) => s + (Number(v.total) || 0), 0);
  const ventasUSD = lista
    .filter(v => v.moneda === "USD")
    .reduce((s, v) => s + (Number(v.total) || 0), 0);
  const salarioAcumulado = lista.reduce(
    (s, v) => s + (Number(v.salario) || 0), 0
  );

  cont.innerHTML = `
    <div class="tarjeta resumen-filtrado">
      <div class="resumen-filtrado-header">
        <h3>Resumen del filtro actual</h3>
        <small>${operaciones} operación${operaciones === 1 ? "" : "es"}</small>
      </div>
      <div class="resumen-filtrado-grid">
        <div class="resumen-filtrado-item">
          <small>Operaciones</small>
          <strong>${operaciones}</strong>
        </div>
        <div class="resumen-filtrado-item">
          <small>Sacos vendidos</small>
          <strong>${sacosVendidos}</strong>
        </div>
        <div class="resumen-filtrado-item verde">
          <small>Ventas en CUP</small>
          <strong>${formato(ventasCUP)} CUP</strong>
        </div>
        <div class="resumen-filtrado-item verde">
          <small>Ventas en USD</small>
          <strong>${formato(ventasUSD)} USD</strong>
        </div>
        <div class="resumen-filtrado-item naranja">
          <small>Salario acumulado</small>
          <strong>${formato(salarioAcumulado)} CUP</strong>
        </div>
      </div>
    </div>
  `;
}

function dibujarRegistro() {
  const cont = document.getElementById("listaRegistro");
  if (!cont) return;

  const filtradas = obtenerVentasFiltradas().slice().sort((a, b) => {
    const fa = a.fechaRegistro || a.fecha || "";
    const fb = b.fechaRegistro || b.fecha || "";
    return String(fb).localeCompare(String(fa));
  });

  if (!filtradas.length) {
    cont.innerHTML = `<div class="texto-vacio">No hay ventas que coincidan.</div>`;
    actualizarResumenRegistro([]);
    return;
  }

  cont.innerHTML = filtradas.map(venta => {
    const moneda = escapar(venta.moneda);
    const lineas = venta.productos.map(l => {
      const cantidad = Number(l.cantidad) || 0;
      const precio = Number(l.precio) || 0;
      const subtotal = Number(l.subtotal) || (cantidad * precio);
      const nombre = l.nombreCompleto ||
        nombreConVariante(l.nombre || "Producto", l.etiquetaVariante || "");
      return `
        <div class="linea-venta">
          <div class="linea-venta-nombre">${escapar(nombre)} × ${cantidad}</div>
          <div class="linea-venta-precio">
            ${formato(precio)} ${moneda}
            <small>Subtotal: ${formato(subtotal)} ${moneda}</small>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="tarjeta">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0">
            <h3>Venta #${Number(venta.id)}</h3>
            <small style="color:#777">${mostrarFecha(venta.fecha)}</small>
          </div>
          <strong class="precio" style="flex-shrink:0">${formato(venta.total)} ${moneda}</strong>
        </div>
        <div style="margin-top:10px;font-size:13px">
          <strong>Lugar:</strong> ${escapar(venta.lugarVenta || "Sin especificar")}
        </div>
        <div style="margin-top:10px">${lineas}</div>
        <div style="margin-top:12px;font-size:13px;padding-top:10px;border-top:1px solid var(--borde)">
          <strong>Salario:</strong> ${formato(venta.salario)} CUP
        </div>
        <button type="button" class="btn-peligro" style="margin-top:12px;width:100%"
                onclick="eliminarVenta(${Number(venta.id)})">Eliminar venta</button>
      </div>
    `;
  }).join("");

  actualizarResumenRegistro(filtradas);
}

function aplicarFiltrosRegistro() { dibujarRegistro(); }
function filtrarRegistro() { dibujarRegistro(); }

function limpiarFiltrosRegistro() {
  [
    "filtroPeriodo",
    "filtroDia",
    "filtroFechaDesde",
    "filtroFechaHasta",
    "filtroProducto",
    "filtroMoneda",
    "filtroLugar",
    "filtroMinimo",
    "filtroMaximo"
  ].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.value = "";
  });
  dibujarRegistro();
}

async function eliminarVenta(id) {
  const venta = ventas.find(v => Number(v.id) === Number(id));
  if (!venta) return;
  if (!confirm(`¿Eliminar la venta #${venta.id}?`)) return;
  try {
    await eliminarDato("ventas", venta.id);
    ventas = (await obtenerTodos("ventas")).map(adaptarVenta).filter(Boolean);
    dibujarRegistro();
    actualizarInicio();
    alert("Venta eliminada.");
  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar la venta.");
  }
}

// ==========================================
// EXPORTAR REGISTRO PDF
// ==========================================

function exportarRegistroPDF() {
  const lista = obtenerVentasFiltradas().slice().sort((a, b) =>
    String(b.fechaRegistro || b.fecha || "").localeCompare(
      String(a.fechaRegistro || a.fecha || "")
    )
  );
  if (!lista.length) { alert("No hay ventas para exportar."); return; }

  const operaciones = lista.length;
  const sacos = lista.reduce((s, v) =>
    s + (v.productos || []).reduce((a, l) => a + (Number(l.cantidad) || 0), 0), 0);
  const cup = lista.filter(v => (v.moneda || "CUP") === "CUP")
    .reduce((s, v) => s + Number(v.total || 0), 0);
  const usd = lista.filter(v => v.moneda === "USD")
    .reduce((s, v) => s + Number(v.total || 0), 0);
  const sal = lista.reduce((s, v) => s + Number(v.salario || 0), 0);

  const filas = lista.map(venta => {
    const detalle = venta.productos.map(l => {
      const nombre = l.nombreCompleto || nombreConVariante(l.nombre, l.etiquetaVariante);
      return `<div>${escapar(nombre)} × ${Number(l.cantidad) || 0} — ${formato(l.precio)} ${escapar(venta.moneda)}</div>`;
    }).join("");
    return `
      <tr>
        <td>${Number(venta.id)}</td>
        <td>${escapar(mostrarFecha(venta.fecha))}</td>
        <td>${escapar(venta.lugarVenta || "Sin especificar")}</td>
        <td>${detalle}</td>
        <td>${escapar(venta.moneda)}</td>
        <td class="numero">${formato(venta.total)}</td>
        <td class="numero">${formato(venta.salario)} CUP</td>
      </tr>
    `;
  }).join("");

  const doc = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Registro - CAJA</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#242424;margin:25px}
      h1{margin-bottom:5px;font-size:25px}
      .sub{color:#777;margin-bottom:25px;font-size:13px}
      .r{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
      .r div{border:1px solid #ddd;border-radius:8px;padding:12px;flex:1;min-width:140px}
      .r small{display:block;font-size:10px;color:#777;text-transform:uppercase}
      .r strong{display:block;margin-top:6px;font-size:16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
      th{background:#222;color:white}
      .numero{text-align:right;white-space:nowrap}
      tr{page-break-inside:avoid}
      .pie{margin-top:25px;color:#777;font-size:10px;text-align:center}
    </style></head><body>
    <h1>CAJA | Registro de ventas</h1>
    <div class="sub">Generado el ${escapar(mostrarFechaHora(new Date().toISOString()))}</div>
    <div class="r">
      <div><small>Operaciones</small><strong>${operaciones}</strong></div>
      <div><small>Sacos vendidos</small><strong>${sacos}</strong></div>
      <div><small>Ventas en CUP</small><strong>${formato(cup)} CUP</strong></div>
      <div><small>Ventas en USD</small><strong>${formato(usd)} USD</strong></div>
      <div><small>Salario acumulado</small><strong>${formato(sal)} CUP</strong></div>
    </div>
    <table><thead><tr>
      <th>N.º</th><th>Fecha</th><th>Lugar</th><th>Productos</th>
      <th>Moneda</th><th>Total</th><th>Salario</th>
    </tr></thead><tbody>${filas}</tbody></table>
    <div class="pie">Sistema de gestión de ventas CAJA</div>
    <script>window.onload=function(){window.print()};<\/script>
    </body></html>
  `;

  const v = window.open("", "_blank");
  if (!v) { alert("El navegador bloqueó la ventana."); return; }
  v.document.open(); v.document.write(doc); v.document.close();
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

function obtenerResumenEstadisticas() {
  const operaciones = ventas.length;
  let unidades = 0, totalCUP = 0, totalUSD = 0, salarioTotal = 0;
  const porLugar = { "Almacén": 0, "Tienda": 0, "Casa": 0, "Sin especificar": 0 };
  const ranking = {};

  ventas.forEach(v => {
    salarioTotal += Number(v.salario) || 0;
    if (v.moneda === "USD") totalUSD += Number(v.total) || 0;
    else totalCUP += Number(v.total) || 0;
    const l = v.lugarVenta || "Sin especificar";
    if (porLugar[l] !== undefined) porLugar[l] += 1;
    (v.productos || []).forEach(linea => {
      const c = Number(linea.cantidad) || 0;
      const n = linea.nombreCompleto || linea.nombre || "Producto";
      unidades += c;
      ranking[n] = (ranking[n] || 0) + c;
    });
  });

  return { operaciones, unidades, totalCUP, totalUSD, salarioTotal, porLugar, ranking };
}

function obtenerUltimosSeisMeses() {
  const r = [];
  const ahora = new Date();
  for (let i = 5; i >= 0; i--) {
    const f = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    r.push({
      clave: mesLocal(f),
      etiqueta: f.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
      CUP: 0, USD: 0
    });
  }
  ventas.forEach(v => {
    const fecha = fechaParaComparar(v.fecha);
    const m = r.find(x => x.clave === fecha.slice(0, 7));
    if (!m) return;
    if (v.moneda === "USD") m.USD += Number(v.total) || 0;
    else m.CUP += Number(v.total) || 0;
  });
  return r;
}

function crearGraficoBarras(titulo, datos, sufijo = "") {
  if (!datos.length) return `<div class="tarjeta"><h3>${escapar(titulo)}</h3><p class="texto-vacio">Sin datos.</p></div>`;
  const max = Math.max(...datos.map(i => Number(i.valor) || 0), 1);
  const barras = datos.map(item => {
    const v = Number(item.valor) || 0;
    const ancho = Math.max(0, (v / max) * 100);
    return `
      <div style="margin:13px 0">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:5px">
          <strong>${escapar(item.nombre)}</strong>
          <span>${formato(v)} ${escapar(sufijo)}</span>
        </div>
        <div style="width:100%;height:12px;background:#eee;border-radius:20px;overflow:hidden">
          <div style="width:${ancho}%;height:100%;background:#f28c28;border-radius:20px"></div>
        </div>
      </div>
    `;
  }).join("");
  return `<div class="tarjeta"><h3 style="margin-bottom:15px">${escapar(titulo)}</h3>${barras}</div>`;
}

function mostrarEstadisticas() {
  const cont = document.getElementById("contenidoEstadisticas");
  if (!cont) return;
  const d = obtenerResumenEstadisticas();
  const m = obtenerUltimosSeisMeses();
  const lugares = Object.entries(d.porLugar).map(([n, v]) => ({ nombre: n, valor: v }));
  const top = Object.entries(d.ranking).map(([n, v]) => ({ nombre: n, valor: v }))
    .sort((a, b) => b.valor - a.valor).slice(0, 5);

  cont.innerHTML = `
    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Resumen general</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:#fff1e2;padding:14px;border-radius:12px">
          <small>Operaciones</small>
          <div style="font-size:23px;font-weight:bold">${d.operaciones}</div>
        </div>
        <div style="background:#fff1e2;padding:14px;border-radius:12px">
          <small>Unidades</small>
          <div style="font-size:23px;font-weight:bold">${formato(d.unidades)}</div>
        </div>
        <div style="background:#eaf5ee;padding:14px;border-radius:12px">
          <small>Ventas CUP</small>
          <div style="font-size:18px;font-weight:bold;color:#16834a">${formato(d.totalCUP)}</div>
        </div>
        <div style="background:#eaf5ee;padding:14px;border-radius:12px">
          <small>Ventas USD</small>
          <div style="font-size:18px;font-weight:bold;color:#16834a">${formato(d.totalUSD)}</div>
        </div>
      </div>
      <div style="margin-top:12px;padding:15px;background:#222;color:white;border-radius:12px">
        <small>Salarios acumulados</small>
        <div style="font-size:24px;font-weight:bold;color:#75df9a;margin-top:5px">
          ${formato(d.salarioTotal)} CUP
        </div>
      </div>
    </div>
    ${crearGraficoBarras("Operaciones por lugar", lugares, "ventas")}
    ${crearGraficoBarras("Ingresos CUP - 6 meses", m.map(x => ({ nombre: x.etiqueta, valor: x.CUP })), "CUP")}
    ${crearGraficoBarras("Ingresos USD - 6 meses", m.map(x => ({ nombre: x.etiqueta, valor: x.USD })), "USD")}
    ${crearGraficoBarras("Productos más vendidos", top, "unidades")}
    <button type="button" class="btn-secundario" style="width:100%;margin-bottom:20px"
            onclick="mostrarEstadisticas()">ACTUALIZAR ESTADÍSTICAS</button>
  `;
}

// ==========================================
// EFECTIVO
// ==========================================

let conteoEfectivo = {};

function cargarConteoEfectivo() {
  try {
    const g = localStorage.getItem(CLAVE_EFECTIVO);
    conteoEfectivo = g ? JSON.parse(g) : {};
    if (!conteoEfectivo || typeof conteoEfectivo !== "object" || Array.isArray(conteoEfectivo)) {
      conteoEfectivo = {};
    }
  } catch (_) { conteoEfectivo = {}; }
  denominacionesEfectivo.forEach(v => {
    const c = Number(conteoEfectivo[v]);
    conteoEfectivo[v] = Number.isFinite(c) && c >= 0 ? c : 0;
  });
}

function guardarConteoEfectivo() {
  try { localStorage.setItem(CLAVE_EFECTIVO, JSON.stringify(conteoEfectivo)); return true; }
  catch (_) { alert("No se pudo guardar el conteo."); return false; }
}

function calcularTotalEfectivo() {
  return denominacionesEfectivo.reduce((t, v) => t + v * (Number(conteoEfectivo[v]) || 0), 0);
}

function mostrarEfectivo() {
  cargarConteoEfectivo();
  const cont = document.getElementById("contenidoEfectivo");
  if (!cont) return;

  const filas = denominacionesEfectivo.map(v => `
    <div class="producto">
      <div class="producto-info">
        <h3>${formato(v)} CUP</h3>
        <small style="color:#777">
          Subtotal: <strong id="subtotalEfectivo${v}">${formato(v * conteoEfectivo[v])} CUP</strong>
        </small>
      </div>
      <div style="width:100px;flex-shrink:0">
        <label for="billetes${v}">Cantidad</label>
        <input id="billetes${v}" type="number" min="0" step="1" inputmode="numeric"
               value="${conteoEfectivo[v]}" style="margin-bottom:0"
               oninput="actualizarConteoEfectivo(${v},this.value)">
      </div>
    </div>
  `).join("");

  cont.innerHTML = `
    <div class="tarjeta">
      <h3 style="margin-bottom:8px">Conteo de efectivo</h3>
      <p style="font-size:13px;color:#777">Introduce la cantidad de billetes.</p>
    </div>
    ${filas}
    <div class="resumen">
      <div>Total en efectivo</div>
      <div class="total" id="totalEfectivo">${formato(calcularTotalEfectivo())} CUP</div>
      <p style="font-size:12px;color:#ccc">Guardado automáticamente.</p>
    </div>

    <button type="button" class="btn-principal" style="width:100%;margin-top:15px"
            onclick="exportarEfectivoPDF()">📄 EXPORTAR CONTEO PDF</button>

    <button type="button" class="btn-secundario" style="width:100%;margin-top:10px"
            onclick="limpiarConteoEfectivo()">LIMPIAR CONTEO</button>
  `;
}

function actualizarConteoEfectivo(valor, cantidad) {
  const n = Number(cantidad);
  if (cantidad === "" || !Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    conteoEfectivo[valor] = 0;
  } else {
    conteoEfectivo[valor] = n;
  }
  guardarConteoEfectivo();
  const sub = document.getElementById("subtotalEfectivo" + valor);
  if (sub) sub.textContent = formato(valor * conteoEfectivo[valor]) + " CUP";
  const tot = document.getElementById("totalEfectivo");
  if (tot) tot.textContent = formato(calcularTotalEfectivo()) + " CUP";
}

function limpiarConteoEfectivo() {
  if (!confirm("¿Poner todas las cantidades en cero?")) return;
  denominacionesEfectivo.forEach(v => conteoEfectivo[v] = 0);
  guardarConteoEfectivo();
  mostrarEfectivo();
}

function exportarEfectivoPDF() {
  cargarConteoEfectivo();

  const fechaHora = mostrarFechaHora(new Date().toISOString());
  const total = calcularTotalEfectivo();

  const filas = denominacionesEfectivo.map(v => {
    const cantidad = Number(conteoEfectivo[v]) || 0;
    const subtotal = v * cantidad;
    return `
      <tr>
        <td>${formato(v)} CUP</td>
        <td class="numero">${cantidad}</td>
        <td class="numero">${formato(subtotal)} CUP</td>
      </tr>
    `;
  }).join("");

  const totalBilletes = denominacionesEfectivo.reduce(
    (s, v) => s + (Number(conteoEfectivo[v]) || 0), 0
  );

  const documento = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Conteo de efectivo - CAJA</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,sans-serif;color:#242424;margin:25px}
        h1{margin-bottom:5px;font-size:25px}
        .subtitulo{color:#777;margin-bottom:25px;font-size:13px}
        .resumen{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
        .resumen div{border:1px solid #ddd;border-radius:8px;padding:12px;flex:1;min-width:140px}
        .resumen small{display:block;font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.4px}
        .resumen strong{display:block;margin-top:6px;font-size:18px}
        .resumen div.total-final{background:#222;color:white;border-color:#222}
        .resumen div.total-final small{color:#bbb}
        .resumen div.total-final strong{color:#75df9a}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
        th{background:#222;color:white}
        .numero{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
        tr{page-break-inside:avoid}
        tfoot td{background:#f5f5f5;font-weight:bold}
        .pie{margin-top:30px;color:#777;font-size:10px;text-align:center}
      </style>
    </head>
    <body>
      <h1>CAJA | Conteo de efectivo</h1>
      <div class="subtitulo">Informe generado el ${escapar(fechaHora)}</div>

      <div class="resumen">
        <div>
          <small>Fecha y hora</small>
          <strong style="font-size:14px">${escapar(fechaHora)}</strong>
        </div>
        <div>
          <small>Total de billetes</small>
          <strong>${totalBilletes}</strong>
        </div>
        <div class="total-final">
          <small>Total en efectivo</small>
          <strong>${formato(total)} CUP</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Denominación</th>
            <th class="numero">Cantidad de billetes</th>
            <th class="numero">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="numero">${totalBilletes}</td>
            <td class="numero">${formato(total)} CUP</td>
          </tr>
        </tfoot>
      </table>

      <div class="pie">Sistema de gestión de ventas CAJA</div>

      <script>window.onload=function(){window.print()};<\/script>
    </body>
    </html>
  `;

  const ventana = window.open("", "_blank");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión.\n\nPermite las ventanas emergentes.");
    return;
  }
  ventana.document.open();
  ventana.document.write(documento);
  ventana.document.close();
}

// ==========================================
// INICIO
// ==========================================

function actualizarInicio() {
  const r = obtenerResumenEstadisticas();
  const cont = document.getElementById("resumenRapidoInicio");
  if (cont) {
    cont.innerHTML = `
      <div class="resumen-rapido-item"><small>Operaciones</small><strong>${r.operaciones}</strong></div>
      <div class="resumen-rapido-item"><small>Ventas CUP</small><strong>${formato(r.totalCUP)}</strong></div>
      <div class="resumen-rapido-item"><small>Ventas USD</small><strong>${formato(r.totalUSD)}</strong></div>
      <div class="resumen-rapido-item"><small>Salarios</small><strong>${formato(r.salarioTotal)}</strong></div>
    `;
  }
  const t = document.getElementById("textoEstadisticasInicio");
  if (t) t.textContent = `${r.operaciones} operaciones registradas. Consulta tus estadísticas.`;
  actualizarInventarioInicio();
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", async function() {
  try {
    cargarConteoEfectivo();
    await iniciarAplicacion();
    actualizarInicio();
    actualizarEstadoConexion();
    console.log("CAJA iniciada.");
  } catch (e) {
    console.error(e);
    alert("No se pudo iniciar la aplicación.");
  }
});