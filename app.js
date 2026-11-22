// ==========================================
// CAJA - APLICACIÓN PRINCIPAL
// ==========================================

let productos = [];
let carrito = [];
let ventas = [];

let productoEnEdicion = null;

let porcentajeSalario = 5;
let pantallaActual = "inicio";
let monedaVenta = "CUP";

const CLAVE_EFECTIVO = "caja_conteo_efectivo_v1";

const LUGARES_VENTA = ["Almacén", "Tienda", "Casa"];

// ==========================================
// FORMATEO Y ESCAPE
// ==========================================

function formato(valor) {
  return (Number(valor) || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapar(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// FECHAS
// ==========================================

function fechaLocal() {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,"0")}-${String(f.getDate()).padStart(2,"0")}`;
}

function fechaParaComparar(fecha) {
  return fecha ? String(fecha).slice(0, 10) : "";
}

function mesLocal(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}`;
}

function mostrarFecha(fecha) {
  if (!fecha) return "";
  const p = String(fecha).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(fecha);
}

// ==========================================
// ADAPTADORES
// ==========================================

function adaptarProducto(producto) {
  if (!producto || typeof producto !== "object") return null;
  const stock = producto.stock || {};

  return {
    ...producto,
    id: producto.id,
    nombre: String(producto.nombre || ""),
    descripcion: String(producto.descripcion || ""),
    precioCUP: Number(producto.precioCUP ?? producto.precio) || 0,
    precioUSD: Number(producto.precioUSD) || 0,
    stock: {
      tienda: Number(stock.tienda) || 0,
      casa: Number(stock.casa) || 0
    }
  };
}

function adaptarVenta(venta) {
  if (!venta || typeof venta !== "object") return null;

  const productosNorm = Array.isArray(venta.productos)
    ? venta.productos.map(linea => {
        const idProducto =
          linea.idProducto ?? linea.productoId ?? linea.id ?? null;

        const cantidad = Number(linea.cantidad) || 0;
        const precio = Number(linea.precio) || 0;
        const precioCUP = Number(linea.precioCUP) || 0;
        const subtotal =
          Number(linea.subtotal) || (cantidad * precio);

        return {
          ...linea,
          idProducto,
          nombre: String(linea.nombre || "Producto"),
          cantidad,
          precio,
          precioCUP,
          subtotal
        };
      })
    : [];

  return {
    ...venta,
    id: venta.id,
    fecha: venta.fecha || "",
    moneda: venta.moneda || "CUP",
    total: Number(venta.total) || 0,
    totalCUP: Number(venta.totalCUP) || 0,
    salario: Number(venta.salario) || 0,
    lugarVenta: venta.lugarVenta || "Sin especificar",
    productos: productosNorm
  };
}

// ==========================================
// PRECIOS Y STOCK
// ==========================================

function precioProducto(producto, moneda = monedaVenta) {
  if (!producto) return 0;
  return moneda === "USD"
    ? Number(producto.precioUSD) || 0
    : Number(producto.precioCUP) || 0;
}

function precioCUPProducto(producto) {
  return producto ? (Number(producto.precioCUP) || 0) : 0;
}

function claveStockLugar(lugar) {
  if (lugar === "Tienda") return "tienda";
  if (lugar === "Casa") return "casa";
  return null; // Almacén = infinito
}

function stockDisponible(producto, lugar) {
  if (!producto) return 0;
  if (lugar === "Almacén") return Infinity;
  const clave = claveStockLugar(lugar);
  if (!clave) return 0;
  return Number(producto.stock?.[clave]) || 0;
}

async function descontarStockVenta(lineas, lugar) {
  const clave = claveStockLugar(lugar);
  if (!clave) return;

  for (const linea of lineas) {
    const producto = productos.find(
      p => Number(p.id) === Number(linea.idProducto)
    );
    if (!producto) continue;

    const actual = Number(producto.stock?.[clave]) || 0;
    producto.stock[clave] = Math.max(0, actual - Number(linea.cantidad || 0));

    try {
      await guardarDato("productos", producto);
    } catch (e) {
      console.warn("No se pudo actualizar stock:", e);
    }
  }
}

// ==========================================
// INICIAR
// ==========================================

async function iniciarAplicacion() {
  await abrirBaseDatos();

  productos = (await obtenerTodos("productos")).map(adaptarProducto).filter(Boolean);
  ventas = (await obtenerTodos("ventas")).map(adaptarVenta).filter(Boolean);

  for (const p of productos) await guardarDato("productos", p);
  for (const v of ventas) await guardarDato("ventas", v);

  navegar("inicio");
  actualizarEstadoConexion();
}

// ==========================================
// CONEXIÓN
// ==========================================

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

function mostrarProductos() {
  dibujarCatalogo();
  cancelarEdicion();
}

function dibujarCatalogo() {
  const lista = document.getElementById("listaCatalogo");
  if (!lista) return;

  if (!productos.length) {
    lista.innerHTML = `<div class="texto-vacio">No hay productos registrados.</div>`;
    return;
  }

  lista.innerHTML = productos.map(producto => `
    <div class="producto">
      <div class="producto-info">
        <h3>${escapar(producto.nombre)}</h3>
        <p>CUP: <strong>${formato(producto.precioCUP)}</strong> · USD: <strong>${formato(producto.precioUSD)}</strong></p>
        <p class="stock-linea">
          Tienda: <strong>${producto.stock.tienda}</strong> ·
          Casa: <strong>${producto.stock.casa}</strong> ·
          Almacén: <strong>∞</strong>
        </p>
      </div>

      <div class="acciones-producto">
        <button type="button" class="btn-secundario"
                onclick="editarProducto(${Number(producto.id)})">EDITAR</button>
        <button type="button" class="btn-secundario"
                onclick="eliminarProducto(${Number(producto.id)})">ELIMINAR</button>
      </div>
    </div>
  `).join("");
}

async function guardarProducto() {
  const nombreInput = document.getElementById("nombreProducto");
  const precioUSDInput = document.getElementById("precioProductoUSD");
  const precioCUPInput = document.getElementById("precioProductoCUP");
  const stockTiendaInput = document.getElementById("stockTienda");
  const stockCasaInput = document.getElementById("stockCasa");

  if (!nombreInput || !precioUSDInput || !precioCUPInput) {
    alert("No se encontraron los campos del producto.");
    return;
  }

  const estabaEditando = productoEnEdicion !== null;
  const nombre = nombreInput.value.trim();
  const precioUSD = Number(precioUSDInput.value);
  const precioCUP = Number(precioCUPInput.value);
  const stockTienda = Math.max(0, Math.floor(Number(stockTiendaInput?.value) || 0));
  const stockCasa = Math.max(0, Math.floor(Number(stockCasaInput?.value) || 0));

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    nombreInput.focus();
    return;
  }

  if (
    !Number.isFinite(precioUSD) || !Number.isFinite(precioCUP) ||
    precioUSD < 0 || precioCUP < 0 ||
    (precioUSD === 0 && precioCUP === 0)
  ) {
    alert("Introduce al menos un precio válido.");
    return;
  }

  const producto = { nombre, precioUSD, precioCUP, stock: { tienda: stockTienda, casa: stockCasa } };

  if (estabaEditando) {
    producto.id = productoEnEdicion.id;
    Object.assign(producto, productoEnEdicion, { nombre, precioUSD, precioCUP, stock: { tienda: stockTienda, casa: stockCasa } });
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
  document.getElementById("precioProductoUSD").value = producto.precioUSD || 0;
  document.getElementById("precioProductoCUP").value = producto.precioCUP || 0;
  document.getElementById("stockTienda").value = producto.stock.tienda || 0;
  document.getElementById("stockCasa").value = producto.stock.casa || 0;

  document.getElementById("btnGuardarProducto").textContent = "ACTUALIZAR PRODUCTO";
  document.getElementById("btnCancelarEdicion").style.display = "block";
  document.getElementById("tituloFormularioProducto").textContent = "Editar producto";

  document.getElementById("nombreProducto").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicion() {
  productoEnEdicion = null;

  ["nombreProducto","precioProductoCUP","precioProductoUSD","stockTienda","stockCasa"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  const bg = document.getElementById("btnGuardarProducto");
  const bc = document.getElementById("btnCancelarEdicion");
  const t  = document.getElementById("tituloFormularioProducto");

  if (bg) bg.textContent = "GUARDAR PRODUCTO";
  if (bc) bc.style.display = "none";
  if (t)  t.textContent = "Añadir producto";
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

    dibujarCatalogo();
    dibujarProductosCaja();
    dibujarCarrito();
    actualizarInicio();

    alert("Producto eliminado.");
  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar el producto.");
  }
}

// ==========================================
// INVENTARIO (pantalla + resumen inicio)
// ==========================================

function calcularTotalesInventario() {
  let tienda = 0, casa = 0;
  productos.forEach(p => {
    tienda += Number(p.stock?.tienda) || 0;
    casa   += Number(p.stock?.casa)   || 0;
  });
  return { tienda, casa, almacen: Infinity, productos: productos.length };
}

function actualizarInventarioInicio() {
  const cont = document.getElementById("inventarioInicio");
  if (!cont) return;

  if (!productos.length) {
    cont.innerHTML = "";
    return;
  }

  const totales = calcularTotalesInventario();

  cont.innerHTML = `
    <h3>📦 Inventario por área</h3>
    <div class="inventario-inicio-totales">
      <div class="inventario-inicio-total almacen">
        <small>Almacén</small>
        <strong>∞</strong>
      </div>
      <div class="inventario-inicio-total tienda">
        <small>Tienda</small>
        <strong>${totales.tienda}</strong>
      </div>
      <div class="inventario-inicio-total casa">
        <small>Casa</small>
        <strong>${totales.casa}</strong>
      </div>
    </div>
    <button type="button" class="ver-todos" onclick="navegar('inventario')">
      Ver inventario detallado →
    </button>
  `;
}

function mostrarInventario() {
  dibujarInventario();
}

function dibujarInventario() {
  const lista = document.getElementById("listaInventario");
  const resumen = document.getElementById("resumenInventario");
  if (!lista) return;

  const totales = calcularTotalesInventario();

  if (resumen) {
    resumen.innerHTML = `
      <div class="inventario-resumen-total almacen">
        <small>Almacén</small>
        <strong>∞</strong>
      </div>
      <div class="inventario-resumen-total tienda">
        <small>Tienda</small>
        <strong>${totales.tienda}</strong>
      </div>
      <div class="inventario-resumen-total casa">
        <small>Casa</small>
        <strong>${totales.casa}</strong>
      </div>
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

  lista.innerHTML = filtrados.map(p => `
    <div class="inventario-fila">
      <div class="inventario-fila-nombre">
        <h3>${escapar(p.nombre)}</h3>
        <small>CUP ${formato(p.precioCUP)} · USD ${formato(p.precioUSD)}</small>
      </div>
      <div class="inventario-col almacen">
        <small>Almacén</small>
        <strong>∞</strong>
      </div>
      <div class="inventario-col tienda">
        <small>Tienda</small>
        <strong>${p.stock.tienda}</strong>
      </div>
      <div class="inventario-col casa">
        <small>Casa</small>
        <strong>${p.stock.casa}</strong>
      </div>
    </div>
  `).join("");
}

// ==========================================
// CAJA
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

  if (nueva !== "CUP" && nueva !== "USD") {
    selector.value = anterior;
    return;
  }

  const precios = [];

  for (const linea of carrito) {
    const producto = productos.find(p => Number(p.id) === Number(linea.idProducto));
    if (!producto) {
      alert("No se encontró uno de los productos del carrito.");
      selector.value = anterior;
      return;
    }
    const np = Number(precioProducto(producto, nueva));
    if (!Number.isFinite(np) || np <= 0) {
      alert(`El producto ${producto.nombre} no tiene precio en ${nueva}.`);
      selector.value = anterior;
      return;
    }
    precios.push(np);
  }

  monedaVenta = nueva;
  carrito.forEach((l, i) => {
    l.precio = precios[i];
    l.subtotal = l.precio * Number(l.cantidad);
  });

  dibujarProductosCaja();
  dibujarCarrito();
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
    const precio = precioProducto(producto, monedaVenta);
    const stock = stockDisponible(producto, lugar);
    const stockTexto = stock === Infinity ? "∞" : stock;
    const sinStock = stock !== Infinity && stock <= 0;

    return `
      <div class="producto">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>
          <div class="precio">${formato(precio)} ${monedaVenta}</div>
          <small class="stock-linea ${sinStock ? "sin-stock" : ""}">
            Stock ${lugar}: <strong>${stockTexto}</strong>
          </small>
        </div>

        <button type="button" class="btn-principal"
                style="width:auto;min-width:100px;padding:12px 14px;font-size:13px"
                ${sinStock ? "disabled" : ""}
                onclick="agregarAlCarrito(${Number(producto.id)})">
          ${sinStock ? "SIN STOCK" : "AGREGAR"}
        </button>
      </div>
    `;
  }).join("");
}

function agregarAlCarrito(id) {
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) return;

  const lugarInput = document.getElementById("lugarVenta");
  const lugar = lugarInput ? lugarInput.value : "Tienda";

  const precio = Number(precioProducto(producto, monedaVenta));
  if (!Number.isFinite(precio) || precio <= 0) {
    alert(`El producto no tiene precio válido en ${monedaVenta}.`);
    return;
  }

  const existente = carrito.find(l => Number(l.idProducto) === Number(id));
  const enCarrito = existente ? existente.cantidad : 0;
  const disponible = stockDisponible(producto, lugar);

  if (disponible !== Infinity && enCarrito + 1 > disponible) {
    alert(`No hay stock suficiente en ${lugar}.`);
    return;
  }

  if (existente) {
    existente.cantidad += 1;
    existente.subtotal = existente.precio * existente.cantidad;
  } else {
    carrito.push({
      idProducto: producto.id,
      nombre: producto.nombre,
      cantidad: 1,
      precio,
      subtotal: precio
    });
  }

  dibujarCarrito();
}

function cambiarCantidadCarrito(id, cambio) {
  const linea = carrito.find(l => Number(l.idProducto) === Number(id));
  if (!linea) return;

  const producto = productos.find(p => Number(p.id) === Number(id));
  const lugarInput = document.getElementById("lugarVenta");
  const lugar = lugarInput ? lugarInput.value : "Tienda";
  const disponible = producto ? stockDisponible(producto, lugar) : Infinity;

  const nueva = linea.cantidad + Number(cambio);

  if (nueva <= 0) {
    quitarDelCarrito(id);
    return;
  }

  if (disponible !== Infinity && nueva > disponible) {
    alert(`No hay stock suficiente en ${lugar}.`);
    return;
  }

  linea.cantidad = nueva;
  linea.subtotal = linea.precio * linea.cantidad;
  dibujarCarrito();
}

function quitarDelCarrito(id) {
  carrito = carrito.filter(l => Number(l.idProducto) !== Number(id));
  dibujarCarrito();
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
      baseCUP += cantidad * precioCUPProducto(producto);
    }
  });

  const salario = baseCUP * (Number(porcentajeSalario) || 0) / 100;

  return {
    total, baseCUP, salario,
    cantidadProductos: carrito.reduce((s, l) => s + Number(l.cantidad || 0), 0)
  };
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

  cont.innerHTML = carrito.map(linea => `
    <div class="producto">
      <div class="producto-info">
        <h3>${escapar(linea.nombre)}</h3>
        <p>${formato(linea.precio)} ${monedaVenta} × ${linea.cantidad}</p>
        <strong>${formato(linea.subtotal)} ${monedaVenta}</strong>
      </div>

      <div class="controles-cantidad">
        <button type="button" class="btn-cantidad"
                onclick="cambiarCantidadCarrito(${Number(linea.idProducto)},-1)">−</button>
        <span class="cantidad">${linea.cantidad}</span>
        <button type="button" class="btn-cantidad"
                onclick="cambiarCantidadCarrito(${Number(linea.idProducto)},1)">+</button>
        <button type="button" class="btn-secundario"
                style="padding:8px 10px;font-size:14px"
                onclick="quitarDelCarrito(${Number(linea.idProducto)})">×</button>
      </div>
    </div>
  `).join("");

  if (resumen) {
    const t = calcularTotalesVenta();
    resumen.innerHTML = `
      <div class="total">TOTAL: ${formato(t.total)} ${monedaVenta}</div>
      <div class="salario">Base salarial: ${formato(t.baseCUP)} CUP</div>
      <div class="salario">Salario (${porcentajeSalario}%): ${formato(t.salario)} CUP</div>
    `;
  }
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

// ==========================================
// REGISTRAR VENTA
// ==========================================

let guardandoVenta = false;

function registrarVenta() {
  if (!carrito.length) {
    alert("Agrega productos antes de registrar la venta.");
    return;
  }

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

  if (!fecha || !LUGARES_VENTA.includes(lugar)) {
    alert("Datos de venta inválidos.");
    return;
  }

  const t = calcularTotalesVenta();
  if (!Number.isFinite(t.total) || t.total <= 0) {
    alert("Importe inválido.");
    return;
  }

  guardandoVenta = true;

  try {
    const lineasVenta = carrito.map(linea => {
      const cantidad = Number(linea.cantidad) || 0;
      const precio = Number(linea.precio) || 0;
      const subtotal = cantidad * precio;
      const producto = productos.find(p => Number(p.id) === Number(linea.idProducto));
      const precioCUP = producto ? precioCUPProducto(producto) : 0;
      const subtotalCUP = cantidad * precioCUP;
      const baseCUP = monedaVenta === "CUP" ? subtotal : subtotalCUP;
      const salarioLinea = baseCUP * Number(porcentajeSalario) / 100;

      return {
        idProducto: linea.idProducto,
        nombre: linea.nombre,
        cantidad,
        precio,
        precioCUP,
        subtotal,
        subtotalCUP,
        total: subtotal,
        baseCUP,
        totalCUP: monedaVenta === "CUP" ? subtotal : 0,
        porcentajeSalario,
        salario: salarioLinea
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
    dibujarCarrito();
    dibujarProductosCaja();
    dibujarCatalogo();
    actualizarInicio();

    alert(
      "Venta registrada correctamente.\n\n" +
      "Total: " + formato(venta.total) + " " + venta.moneda + "\n" +
      "Lugar: " + venta.lugarVenta + "\n" +
      "Salario: " + formato(venta.salario) + " CUP"
    );

  } catch (e) {
    console.error(e);
    alert("No se pudo registrar la venta.\n\nLos productos permanecen en el carrito.");
  } finally {
    guardandoVenta = false;
  }
}

function cancelarVenta() {
  if (!carrito.length) return;
  if (!confirm("¿Cancelar esta venta y vaciar el carrito?")) return;
  carrito = [];
  dibujarCarrito();
  dibujarProductosCaja();
}

// ==========================================
// REGISTRO (con precio por línea)
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
  const producto = valorFiltro("filtroProducto");
  const moneda = valorFiltro("filtroMoneda");
  const lugar = valorFiltro("filtroLugar");
  const minimo = valorFiltro("filtroMinimo");
  const maximo = valorFiltro("filtroMaximo");

  const hoy = fechaLocal();
  const mesActual = mesLocal();
  const fechaHoy = new Date(); fechaHoy.setHours(0,0,0,0);
  const inicioSemana = new Date(fechaHoy);
  const dia = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - dia);

  return ventas.filter(venta => {
    const fecha = fechaParaComparar(venta.fecha);

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

function dibujarRegistro() {
  const cont = document.getElementById("listaRegistro");
  if (!cont) return;

  const filtradas = obtenerVentasFiltradas()
    .slice()
    .sort((a, b) => {
      const fa = a.fechaRegistro || a.fecha || "";
      const fb = b.fechaRegistro || b.fecha || "";
      return String(fb).localeCompare(String(fa));
    });

  if (!filtradas.length) {
    cont.innerHTML = `<div class="texto-vacio">No hay ventas que coincidan con los filtros.</div>`;
    actualizarResumenRegistro([]);
    return;
  }

  cont.innerHTML = filtradas.map(venta => {
    const moneda = escapar(venta.moneda);

    // Cada línea: nombre, cantidad, precio unitario, subtotal.
    const lineas = venta.productos.map(l => {
      const cantidad = Number(l.cantidad) || 0;
      const precio = Number(l.precio) || 0;
      const subtotal = Number(l.subtotal) || (cantidad * precio);

      return `
        <div class="linea-venta">
          <div class="linea-venta-nombre">
            ${escapar(l.nombre || "Producto")} × ${cantidad}
          </div>
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
          <strong class="precio" style="flex-shrink:0">
            ${formato(venta.total)} ${moneda}
          </strong>
        </div>

        <div style="margin-top:10px;font-size:13px">
          <strong>Lugar:</strong> ${escapar(venta.lugarVenta || "Sin especificar")}
        </div>

        <div style="margin-top:10px">${lineas}</div>

        <div style="margin-top:12px;font-size:13px;padding-top:10px;border-top:1px solid var(--borde)">
          <strong>Salario:</strong> ${formato(venta.salario)} CUP
        </div>

        <button type="button" class="btn-peligro"
                style="margin-top:12px;width:100%"
                onclick="eliminarVenta(${Number(venta.id)})">
          Eliminar venta
        </button>
      </div>
    `;
  }).join("");

  actualizarResumenRegistro(filtradas);
}

function actualizarResumenRegistro(lista) {
  const cont = document.getElementById("resumenRegistro");
  if (!cont) return;

  const cup = lista.filter(v => v.moneda === "CUP").reduce((s, v) => s + v.total, 0);
  const usd = lista.filter(v => v.moneda === "USD").reduce((s, v) => s + v.total, 0);
  const sal = lista.reduce((s, v) => s + (Number(v.salario) || 0), 0);

  cont.innerHTML = `
    <div class="tarjeta">
      <h3>Resumen de operaciones</h3>
      <p style="margin-top:10px">Operaciones: <strong>${lista.length}</strong></p>
      <p style="margin-top:7px">Ventas CUP: <strong>${formato(cup)} CUP</strong></p>
      <p style="margin-top:7px">Ventas USD: <strong>${formato(usd)} USD</strong></p>
      <p style="margin-top:7px">Salarios: <strong>${formato(sal)} CUP</strong></p>
    </div>
  `;
}

function aplicarFiltrosRegistro() { dibujarRegistro(); }
function filtrarRegistro() { dibujarRegistro(); }

function limpiarFiltrosRegistro() {
  ["filtroPeriodo","filtroProducto","filtroMoneda","filtroLugar","filtroMinimo","filtroMaximo"]
    .forEach(id => { const c = document.getElementById(id); if (c) c.value = ""; });
  dibujarRegistro();
}

async function eliminarVenta(id) {
  const venta = ventas.find(v => Number(v.id) === Number(id));
  if (!venta) return;
  if (!confirm(`¿Eliminar la venta #${venta.id}?\n\nEsta acción no se puede deshacer.`)) return;

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
// EXPORTAR PDF
// ==========================================

function exportarRegistroPDF() {
  const lista = obtenerVentasFiltradas().slice().sort((a, b) =>
    String(b.fechaRegistro || b.fecha || "").localeCompare(
      String(a.fechaRegistro || a.fecha || "")
    )
  );

  if (!lista.length) { alert("No hay ventas para exportar."); return; }

  const cup = lista.filter(v => v.moneda === "CUP").reduce((s, v) => s + Number(v.total || 0), 0);
  const usd = lista.filter(v => v.moneda === "USD").reduce((s, v) => s + Number(v.total || 0), 0);
  const sal = lista.reduce((s, v) => s + Number(v.salario || 0), 0);

  const filas = lista.map(venta => {
    const detalle = venta.productos.map(l =>
      `<div>${escapar(l.nombre)} × ${Number(l.cantidad) || 0} — ${formato(l.precio)} ${escapar(venta.moneda)}</div>`
    ).join("");

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
      .r strong{display:block;margin-top:6px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
      th{background:#222;color:white}
      .numero{text-align:right;white-space:nowrap}
      tr{page-break-inside:avoid}
      .pie{margin-top:25px;color:#777;font-size:10px;text-align:center}
    </style></head><body>
    <h1>CAJA | Registro de ventas</h1>
    <div class="sub">Informe generado el ${escapar(mostrarFecha(fechaLocal()))}</div>
    <div class="r">
      <div>Operaciones<strong>${lista.length}</strong></div>
      <div>Total CUP<strong>${formato(cup)} CUP</strong></div>
      <div>Total USD<strong>${formato(usd)} USD</strong></div>
      <div>Salario<strong>${formato(sal)} CUP</strong></div>
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
      const n = linea.nombre || "Producto";
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

const denominacionesEfectivo = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
let conteoEfectivo = {};

function cargarConteoEfectivo() {
  try {
    const g = localStorage.getItem(CLAVE_EFECTIVO);
    conteoEfectivo = g ? JSON.parse(g) : {};
    if (!conteoEfectivo || typeof conteoEfectivo !== "object" || Array.isArray(conteoEfectivo)) {
      conteoEfectivo = {};
    }
  } catch (_) {
    conteoEfectivo = {};
  }
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
      <p style="font-size:13px;color:#777">Introduce la cantidad de billetes. El total se calcula automáticamente.</p>
    </div>
    ${filas}
    <div class="resumen">
      <div>Total en efectivo</div>
      <div class="total" id="totalEfectivo">${formato(calcularTotalEfectivo())} CUP</div>
      <p style="font-size:12px;color:#ccc">Guardado automáticamente en este dispositivo.</p>
    </div>
    <button type="button" class="btn-secundario" style="width:100%;margin-top:15px"
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

  // Inventario en inicio
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
    alert("No se pudo iniciar la aplicación.\n\nComprueba la base de datos y vuelve a cargar.");
  }
});