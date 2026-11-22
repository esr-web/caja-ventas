// ==========================================
// CAJA - APLICACIÓN PRINCIPAL
// ==========================================

// ==========================================
// VARIABLES PRINCIPALES
// ==========================================

let productos = [];
let carrito = [];
let ventas = [];

let productoEnEdicion = null;

let porcentajeSalario = 5;
let pantallaActual = "inicio";
let monedaVenta = "CUP";

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CLAVE_EFECTIVO = "caja_conteo_efectivo_v1";

const LUGARES_VENTA = [
  "Almacén",
  "Tienda",
  "Casa"
];

// ==========================================
// FORMATO DE NÚMEROS
// ==========================================

function formato(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ==========================================
// EVITAR INYECCIÓN DE HTML
// ==========================================

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
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function fechaParaComparar(fecha) {
  if (!fecha) return "";
  return String(fecha).slice(0, 10);
}

function mesLocal(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${anio}-${mes}`;
}

function mostrarFecha(fecha) {
  if (!fecha) return "";
  const partes = String(fecha).slice(0, 10).split("-");
  if (partes.length !== 3) return String(fecha);
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ==========================================
// ADAPTACIÓN DE PRODUCTOS
// ==========================================

function adaptarProducto(producto) {
  if (!producto || typeof producto !== "object") return null;

  const stockOriginal = producto.stock || {};

  return {
    ...producto,
    id: producto.id,
    nombre: String(producto.nombre || ""),
    descripcion: String(producto.descripcion || ""),
    precioCUP: Number(producto.precioCUP ?? producto.precio) || 0,
    precioUSD: Number(producto.precioUSD) || 0,
    stock: {
      // Almacén se considera infinito por lógica; no se guarda su cantidad.
      tienda: Number(stockOriginal.tienda) || 0,
      casa: Number(stockOriginal.casa) || 0
    }
  };
}

// ==========================================
// ADAPTACIÓN DE VENTAS
// ==========================================

function adaptarVenta(venta) {
  if (!venta || typeof venta !== "object") return null;

  // Normalizar líneas para aceptar productoId, idProducto o id.
  const productosNormalizados = Array.isArray(venta.productos)
    ? venta.productos.map(linea => {
        const idProducto =
          linea.idProducto ??
          linea.productoId ??
          linea.id ??
          null;

        return {
          ...linea,
          idProducto,
          nombre: String(linea.nombre || "Producto"),
          cantidad: Number(linea.cantidad) || 0,
          precio: Number(linea.precio) || 0,
          precioCUP: Number(linea.precioCUP) || 0,
          subtotal: Number(linea.subtotal) || 0
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
    productos: productosNormalizados
  };
}

// ==========================================
// PRECIOS
// ==========================================

function precioProducto(producto, moneda = monedaVenta) {
  if (!producto) return 0;
  if (moneda === "USD") return Number(producto.precioUSD) || 0;
  return Number(producto.precioCUP) || 0;
}

function precioCUPProducto(producto) {
  if (!producto) return 0;
  return Number(producto.precioCUP) || 0;
}

// ==========================================
// STOCK POR ÁREA
// ==========================================

// Devuelve la clave de stock para un lugar de venta.
// Almacén devuelve null (infinito).
function claveStockLugar(lugar) {
  if (lugar === "Tienda") return "tienda";
  if (lugar === "Casa") return "casa";
  return null;
}

// Cantidad disponible de un producto en un lugar.
// Almacén = Infinity.
function stockDisponible(producto, lugar) {
  if (!producto) return 0;
  if (lugar === "Almacén") return Infinity;
  const clave = claveStockLugar(lugar);
  if (!clave) return 0;
  return Number(producto.stock?.[clave]) || 0;
}

// Descontar stock al confirmar una venta.
async function descontarStockVenta(lineas, lugar) {
  const clave = claveStockLugar(lugar);

  // Almacén es infinito: no se descuenta nada.
  if (!clave) return;

  for (const linea of lineas) {
    const producto = productos.find(
      p => Number(p.id) === Number(linea.idProducto)
    );

    if (!producto) continue;

    const actual = Number(producto.stock?.[clave]) || 0;
    const nueva = Math.max(0, actual - Number(linea.cantidad || 0));

    producto.stock[clave] = nueva;

    try {
      await guardarDato("productos", producto);
    } catch (error) {
      console.warn("No se pudo actualizar stock:", error);
    }
  }
}

// ==========================================
// CÁLCULO DEL SALARIO
// ==========================================

function calcularSalarioLineasCUP(lineas) {
  if (!Array.isArray(lineas)) return 0;

  const baseCUP = lineas.reduce((total, linea) => {
    const cantidad = Number(linea.cantidad) || 0;
    const precioCUP =
      Number(linea.precioCUP) ||
      Number(linea.precioCUPUnitario) ||
      0;
    return total + cantidad * precioCUP;
  }, 0);

  return baseCUP * (porcentajeSalario / 100);
}

// ==========================================
// INICIAR APLICACIÓN
// ==========================================

async function iniciarAplicacion() {
  await abrirBaseDatos();

  const productosGuardados = await obtenerTodos("productos");
  const ventasGuardadas = await obtenerTodos("ventas");

  productos = productosGuardados.map(adaptarProducto).filter(Boolean);
  ventas = ventasGuardadas.map(adaptarVenta).filter(Boolean);

  // Sincronizar estructuras sin cambiar ID.
  for (const producto of productos) {
    await guardarDato("productos", producto);
  }

  for (const venta of ventas) {
    await guardarDato("ventas", venta);
  }

  navegar("inicio");
  actualizarEstadoConexion();
}

// ==========================================
// ESTADO DE CONEXIÓN
// ==========================================

function actualizarEstadoConexion() {
  const punto = document.getElementById("puntoConexion");
  const texto = document.getElementById("textoConexion");

  if (!punto) return;

  if (navigator.onLine) {
    punto.style.background = "#58c985";
    punto.title = "Con conexión";
    if (texto) texto.textContent = "En línea";
  } else {
    punto.style.background = "#f28c28";
    punto.title = "Funcionamiento sin conexión";
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
    registro: "pantallaRegistro",
    estadisticas: "pantallaEstadisticas",
    efectivo: "pantallaEfectivo"
  };

  const idPantalla = pantallas[nombre];
  if (!idPantalla) return;

  const destino = document.getElementById(idPantalla);
  if (!destino) return;

  document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("activa"));
  destino.classList.add("activa");

  pantallaActual = nombre;

  document.querySelectorAll(".nav-item").forEach(boton => {
    boton.classList.remove("activo");
    if (boton.dataset.pantalla === nombre) {
      boton.classList.add("activo");
    }
  });

  if (nombre === "inicio") actualizarInicio();
  if (nombre === "caja") mostrarCaja();
  if (nombre === "productos") mostrarProductos();
  if (nombre === "registro") mostrarRegistro();
  if (nombre === "estadisticas") mostrarEstadisticas();
  if (nombre === "efectivo") mostrarEfectivo();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cambiarPantalla(nombre) { navegar(nombre); }
function irPantalla(nombre) { navegar(nombre); }

// ==========================================
// PRODUCTOS - MOSTRAR
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
        <p>CUP: ${formato(producto.precioCUP)} · USD: ${formato(producto.precioUSD)}</p>
        <p class="stock-linea">
          Tienda: <strong>${producto.stock.tienda}</strong> ·
          Casa: <strong>${producto.stock.casa}</strong> ·
          Almacén: <strong>∞</strong>
        </p>
      </div>

      <div style="display:flex;flex-direction:column;gap:7px">
        <button type="button" class="btn-secundario"
                onclick="editarProducto(${Number(producto.id)})">EDITAR</button>
        <button type="button" class="btn-secundario"
                onclick="eliminarProducto(${Number(producto.id)})">ELIMINAR</button>
      </div>
    </div>
  `).join("");
}

// ==========================================
// PRODUCTOS - GUARDAR
// ==========================================

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
    !Number.isFinite(precioUSD) ||
    !Number.isFinite(precioCUP) ||
    precioUSD < 0 ||
    precioCUP < 0 ||
    (precioUSD === 0 && precioCUP === 0)
  ) {
    alert("Introduce al menos un precio válido.");
    return;
  }

  const producto = {
    nombre,
    precioUSD,
    precioCUP,
    stock: { tienda: stockTienda, casa: stockCasa }
  };

  if (estabaEditando) {
    producto.id = productoEnEdicion.id;
    Object.assign(producto, productoEnEdicion, {
      nombre,
      precioUSD,
      precioCUP,
      stock: { tienda: stockTienda, casa: stockCasa }
    });
  }

  try {
    const id = await guardarDato("productos", producto);

    if (!estabaEditando) {
      producto.id = id;
      productos.push(adaptarProducto(producto));
    } else {
      const indice = productos.findIndex(
        p => Number(p.id) === Number(producto.id)
      );
      if (indice !== -1) {
        productos[indice] = adaptarProducto(producto);
      }
    }

    cancelarEdicion();
    dibujarCatalogo();
    dibujarProductosCaja();

    alert(estabaEditando ? "Producto actualizado." : "Producto guardado.");

  } catch (error) {
    console.error("Error al guardar producto:", error);
    alert("No se pudo guardar el producto.");
  }
}

// ==========================================
// PRODUCTOS - EDITAR / CANCELAR / ELIMINAR
// ==========================================

function editarProducto(id) {
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) {
    alert("No se encontró el producto.");
    return;
  }

  productoEnEdicion = { ...producto };

  document.getElementById("nombreProducto").value = producto.nombre || "";
  document.getElementById("precioUSD").value = ""; // fallback
  document.getElementById("precioProductoUSD").value = producto.precioUSD || 0;
  document.getElementById("precioProductoCUP").value = producto.precioCUP || 0;
  document.getElementById("stockTienda").value = producto.stock.tienda || 0;
  document.getElementById("stockCasa").value = producto.stock.casa || 0;

  document.getElementById("btnGuardarProducto").textContent = "ACTUALIZAR PRODUCTO";
  document.getElementById("btnCancelarEdicion").style.display = "block";
  document.getElementById("tituloFormularioProducto").textContent = "Editar producto";

  document.getElementById("nombreProducto").scrollIntoView({
    behavior: "smooth", block: "center"
  });
}

function cancelarEdicion() {
  productoEnEdicion = null;

  ["nombreProducto","precioProductoCUP","precioProductoUSD","stockTienda","stockCasa"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  const btnGuardar = document.getElementById("btnGuardarProducto");
  const btnCancelar = document.getElementById("btnCancelarEdicion");
  const titulo = document.getElementById("tituloFormularioProducto");

  if (btnGuardar) btnGuardar.textContent = "GUARDAR PRODUCTO";
  if (btnCancelar) btnCancelar.style.display = "none";
  if (titulo) titulo.textContent = "Añadir producto";
}

async function eliminarProducto(id) {
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) return;

  if (!confirm("¿Deseas eliminar el producto " + producto.nombre + "?")) return;

  try {
    await eliminarDato("productos", producto.id);

    productos = productos.filter(p => Number(p.id) !== Number(id));

    if (productoEnEdicion && Number(productoEnEdicion.id) === Number(id)) {
      cancelarEdicion();
    }

    carrito = carrito.filter(l => Number(l.idProducto) !== Number(id));

    dibujarCatalogo();
    dibujarProductosCaja();
    dibujarCarrito();

    alert("Producto eliminado.");

  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar el producto.");
  }
}

// ==========================================
// CAJA - MOSTRAR
// ==========================================

function mostrarCaja() {
  const fechaInput = document.getElementById("fechaVenta");
  if (fechaInput && !fechaInput.value) fechaInput.value = fechaLocal();

  const porcentajeInput = document.getElementById("porcentajeVenta");
  if (porcentajeInput) porcentajeInput.value = porcentajeSalario;

  const monedaSelect = document.getElementById("monedaSeleccionada");
  if (monedaSelect) monedaSelect.value = monedaVenta;

  dibujarProductosCaja();
  dibujarCarrito();
}

// ==========================================
// CAJA - CAMBIAR MONEDA
// ==========================================

function cambiarMonedaVenta() {
  const selector = document.getElementById("monedaSeleccionada");
  if (!selector) return;

  const monedaAnterior = monedaVenta;
  const nuevaMoneda = selector.value;

  if (nuevaMoneda !== "CUP" && nuevaMoneda !== "USD") {
    selector.value = monedaAnterior;
    return;
  }

  const preciosActualizados = [];

  for (const linea of carrito) {
    const producto = productos.find(
      p => Number(p.id) === Number(linea.idProducto)
    );

    if (!producto) {
      alert("No se encontró uno de los productos del carrito.");
      selector.value = monedaAnterior;
      return;
    }

    const nuevoPrecio = Number(precioProducto(producto, nuevaMoneda));

    if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
      alert(
        "El producto " + producto.nombre +
        " no tiene un precio válido en " + nuevaMoneda + "."
      );
      selector.value = monedaAnterior;
      return;
    }

    preciosActualizados.push(nuevoPrecio);
  }

  monedaVenta = nuevaMoneda;

  carrito.forEach((linea, i) => {
    linea.precio = preciosActualizados[i];
    linea.subtotal = linea.precio * Number(linea.cantidad);
  });

  dibujarProductosCaja();
  dibujarCarrito();
}

// ==========================================
// CAJA - DIBUJAR PRODUCTOS
// ==========================================

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
                ${sinStock ? "disabled" : ""}
                onclick="agregarAlCarrito(${Number(producto.id)})">
          ${sinStock ? "SIN STOCK" : "AGREGAR"}
        </button>
      </div>
    `;
  }).join("");
}

// ==========================================
// CAJA - CARRITO
// ==========================================

function agregarAlCarrito(id) {
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) return;

  const lugarInput = document.getElementById("lugarVenta");
  const lugar = lugarInput ? lugarInput.value : "Tienda";

  const precio = Number(precioProducto(producto, monedaVenta));
  if (!Number.isFinite(precio) || precio <= 0) {
    alert("El producto no tiene un precio válido en " + monedaVenta + ".");
    return;
  }

  const existente = carrito.find(l => Number(l.idProducto) === Number(id));
  const cantidadEnCarrito = existente ? existente.cantidad : 0;
  const disponible = stockDisponible(producto, lugar);

  if (disponible !== Infinity && cantidadEnCarrito + 1 > disponible) {
    alert("No hay stock suficiente en " + lugar + ".");
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

  const nuevaCantidad = linea.cantidad + Number(cambio);

  if (nuevaCantidad <= 0) {
    quitarDelCarrito(id);
    return;
  }

  if (disponible !== Infinity && nuevaCantidad > disponible) {
    alert("No hay stock suficiente en " + lugar + ".");
    return;
  }

  linea.cantidad = nuevaCantidad;
  linea.subtotal = linea.precio * linea.cantidad;
  dibujarCarrito();
}

function quitarDelCarrito(id) {
  carrito = carrito.filter(l => Number(l.idProducto) !== Number(id));
  dibujarCarrito();
}

// ==========================================
// CAJA - TOTALES
// ==========================================

function calcularTotalesVenta() {
  let total = 0;
  let baseCUP = 0;

  carrito.forEach(linea => {
    const cantidad = Number(linea.cantidad) || 0;
    const precio = Number(linea.precio) || 0;
    const subtotal = cantidad * precio;

    total += subtotal;

    if (monedaVenta === "CUP") {
      baseCUP += subtotal;
    } else {
      const producto = productos.find(
        p => Number(p.id) === Number(linea.idProducto)
      );
      baseCUP += cantidad * precioCUPProducto(producto);
    }
  });

  const porcentaje = Number(porcentajeSalario) || 0;
  const salario = baseCUP * porcentaje / 100;

  return {
    total,
    baseCUP,
    salario,
    cantidadProductos: carrito.reduce(
      (s, l) => s + Number(l.cantidad || 0), 0
    )
  };
}

// ==========================================
// CAJA - DIBUJAR CARRITO
// ==========================================

function dibujarCarrito() {
  const contenedor = document.getElementById("carritoVenta");
  const resumen = document.getElementById("resumenVenta");
  if (!contenedor) return;

  if (!carrito.length) {
    contenedor.innerHTML = `<div class="texto-vacio">No hay productos en la venta.</div>`;
    if (resumen) {
      resumen.innerHTML = `
        <div class="total">0 ${monedaVenta}</div>
        <div class="salario">Salario: 0 CUP</div>
      `;
    }
    return;
  }

  contenedor.innerHTML = carrito.map(linea => `
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

// ==========================================
// CAJA - PORCENTAJE
// ==========================================

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
// VENTAS - REGISTRAR
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

  if (!fecha) {
    alert("Selecciona la fecha de la venta.");
    return;
  }

  if (!LUGARES_VENTA.includes(lugar)) {
    alert("Selecciona un lugar de venta válido.");
    return;
  }

  const totales = calcularTotalesVenta();

  const confirmar = confirm(
    "¿Confirmar esta venta?\n\n" +
    "Productos: " + totales.cantidadProductos + "\n" +
    "Total: " + formato(totales.total) + " " + monedaVenta + "\n" +
    "Lugar: " + lugar + "\n" +
    "Salario: " + formato(totales.salario) + " CUP"
  );

  if (!confirmar) return;
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

  const totales = calcularTotalesVenta();

  if (!Number.isFinite(totales.total) || totales.total <= 0) {
    alert("El importe de la venta no es válido.");
    return;
  }

  guardandoVenta = true;

  try {
    const lineasVenta = carrito.map(linea => {
      const cantidad = Number(linea.cantidad) || 0;
      const precio = Number(linea.precio) || 0;
      const subtotal = cantidad * precio;

      const producto = productos.find(
        p => Number(p.id) === Number(linea.idProducto)
      );

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
      total: totales.total,
      totalCUP: monedaVenta === "CUP" ? totales.total : 0,
      baseCUP: totales.baseCUP,
      porcentajeSalario,
      salario: totales.salario
    };

    const id = await guardarDato("ventas", venta);
    venta.id = id;
    ventas.push(adaptarVenta(venta));

    // Descontar stock solo después de guardar la venta.
    await descontarStockVenta(lineasVenta, lugar);

    carrito = [];

    dibujarCarrito();
    dibujarProductosCaja();
    dibujarCatalogo();

    alert(
      "Venta registrada correctamente.\n\n" +
      "Total: " + formato(venta.total) + " " + venta.moneda + "\n" +
      "Lugar: " + venta.lugarVenta + "\n" +
      "Salario generado: " + formato(venta.salario) + " CUP"
    );

    actualizarInicio();

  } catch (error) {
    console.error("Error al registrar venta:", error);
    alert("No se pudo registrar la venta.\n\nLos productos permanecen en el carrito.");
  } finally {
    guardandoVenta = false;
  }
}

function cancelarVenta() {
  if (!carrito.length) return;
  if (!confirm("¿Deseas cancelar esta venta y vaciar el carrito?")) return;
  carrito = [];
  dibujarCarrito();
  dibujarProductosCaja();
}

// ==========================================
// REGISTRO - FILTROS
// ==========================================

function mostrarRegistro() {
  cargarOpcionesFiltroProductos();
  dibujarRegistro();
}

function cargarOpcionesFiltroProductos() {
  const campo = document.getElementById("filtroProducto");
  if (!campo) return;

  const seleccionActual = campo.value;

  campo.innerHTML = `
    <option value="">Todos los productos</option>
    ${productos.map(p => `
      <option value="${Number(p.id)}">${escapar(p.nombre)}</option>
    `).join("")}
  `;

  campo.value = seleccionActual;
}

function valorFiltro(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : "";
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

  const fechaHoy = new Date();
  fechaHoy.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(fechaHoy);
  const diaSemana = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);

  return ventas.filter(venta => {
    const fecha = fechaParaComparar(venta.fecha);

    if (periodo === "hoy" && fecha !== hoy) return false;
    if (periodo === "mes" && !fecha.startsWith(mesActual)) return false;
    if (periodo === "anio" && !fecha.startsWith(String(new Date().getFullYear()))) return false;

    if (periodo === "semana") {
      if (!fecha) return false;
      const fechaVenta = new Date(fecha + "T00:00:00");
      if (Number.isNaN(fechaVenta.getTime())) return false;
      fechaVenta.setHours(0, 0, 0, 0);
      if (fechaVenta < inicioSemana || fechaVenta > fechaHoy) return false;
    }

    if (producto) {
      const idProducto = Number(producto);
      const contiene = venta.productos.some(linea => {
        const id = linea.idProducto ?? linea.productoId ?? linea.id;
        return Number(id) === idProducto;
      });
      if (!contiene) return false;
    }

    if (moneda && venta.moneda !== moneda) return false;
    if (lugar && venta.lugarVenta !== lugar) return false;

    const importe = Number(venta.total) || 0;
    if (minimo !== "" && importe < Number(minimo)) return false;
    if (maximo !== "" && importe > Number(maximo)) return false;

    return true;
  });
}

function dibujarRegistro() {
  const contenedor = document.getElementById("listaRegistro");
  if (!contenedor) return;

  const filtradas = obtenerVentasFiltradas()
    .slice()
    .sort((a, b) => {
      const fa = a.fechaRegistro || a.fecha || "";
      const fb = b.fechaRegistro || b.fecha || "";
      return String(fb).localeCompare(String(fa));
    });

  if (!filtradas.length) {
    contenedor.innerHTML = `<div class="texto-vacio">No hay ventas que coincidan con los filtros.</div>`;
    actualizarResumenRegistro([]);
    return;
  }

  contenedor.innerHTML = filtradas.map(venta => {
    const lineas = venta.productos.map(linea => `
      <div style="font-size:12px;color:#666;margin-top:5px">
        ${escapar(linea.nombre || "Producto")} × ${Number(linea.cantidad) || 0}
      </div>
    `).join("");

    return `
      <div class="tarjeta">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>
            <h3>Venta #${Number(venta.id)}</h3>
            <small style="color:#777">${mostrarFecha(venta.fecha)}</small>
          </div>
          <strong class="precio">${formato(venta.total)} ${escapar(venta.moneda)}</strong>
        </div>

        <div style="margin-top:10px;font-size:13px">
          <strong>Lugar:</strong> ${escapar(venta.lugarVenta || "Sin especificar")}
        </div>

        <div style="margin-top:5px;font-size:13px">
          <strong>Moneda:</strong> ${escapar(venta.moneda)}
        </div>

        ${lineas}

        <div style="margin-top:12px;font-size:13px">
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
  const contenedor = document.getElementById("resumenRegistro");
  if (!contenedor) return;

  const totalCUP = lista
    .filter(v => v.moneda === "CUP")
    .reduce((s, v) => s + v.total, 0);

  const totalUSD = lista
    .filter(v => v.moneda === "USD")
    .reduce((s, v) => s + v.total, 0);

  const salario = lista.reduce((s, v) => s + (Number(v.salario) || 0), 0);

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3>Resumen de operaciones</h3>
      <p style="margin-top:10px">Operaciones: <strong>${lista.length}</strong></p>
      <p style="margin-top:7px">Ventas CUP: <strong>${formato(totalCUP)} CUP</strong></p>
      <p style="margin-top:7px">Ventas USD: <strong>${formato(totalUSD)} USD</strong></p>
      <p style="margin-top:7px">Salarios: <strong>${formato(salario)} CUP</strong></p>
    </div>
  `;
}

function aplicarFiltrosRegistro() { dibujarRegistro(); }
function filtrarRegistro() { dibujarRegistro(); }

function limpiarFiltrosRegistro() {
  ["filtroPeriodo","filtroProducto","filtroMoneda","filtroLugar","filtroMinimo","filtroMaximo"]
    .forEach(id => {
      const campo = document.getElementById(id);
      if (campo) campo.value = "";
    });
  dibujarRegistro();
}

// ==========================================
// REGISTRO - ELIMINAR VENTA
// ==========================================

async function eliminarVenta(id) {
  const venta = ventas.find(v => Number(v.id) === Number(id));
  if (!venta) return;

  if (!confirm(`¿Eliminar la venta #${venta.id}?\n\nEsta acción no se puede deshacer.`)) return;

  try {
    await eliminarDato("ventas", venta.id);

    const ventasGuardadas = await obtenerTodos("ventas");
    ventas = ventasGuardadas.map(adaptarVenta).filter(Boolean);

    dibujarRegistro();
    alert("Venta eliminada.");

  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar la venta.");
  }
}

// ==========================================
// REGISTRO - EXPORTAR PDF
// ==========================================

function exportarRegistroPDF() {
  const lista = obtenerVentasFiltradas()
    .slice()
    .sort((a, b) =>
      String(b.fechaRegistro || b.fecha || "").localeCompare(
        String(a.fechaRegistro || a.fecha || "")
      )
    );

  if (!lista.length) {
    alert("No hay ventas para exportar.");
    return;
  }

  const totalCUP = lista.filter(v => v.moneda === "CUP")
    .reduce((s, v) => s + Number(v.total || 0), 0);

  const totalUSD = lista.filter(v => v.moneda === "USD")
    .reduce((s, v) => s + Number(v.total || 0), 0);

  const salarioTotal = lista.reduce((s, v) => s + Number(v.salario || 0), 0);

  const filas = lista.map(venta => {
    const detalle = venta.productos.map(l =>
      `<div>${escapar(l.nombre)} × ${Number(l.cantidad) || 0}</div>`
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

  const documento = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Registro de ventas - CAJA</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #242424; margin: 25px; }
        h1 { margin-bottom: 5px; font-size: 25px; }
        .subtitulo { color: #777; margin-bottom: 25px; font-size: 13px; }
        .resumen { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
        .resumen div { border: 1px solid #ddd; border-radius: 8px; padding: 12px; flex: 1; min-width: 140px; }
        .resumen strong { display: block; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #222; color: white; }
        .numero { text-align: right; white-space: nowrap; }
        tr { page-break-inside: avoid; }
        .pie { margin-top: 25px; color: #777; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <h1>CAJA | Registro de ventas</h1>
      <div class="subtitulo">Informe generado el ${escapar(mostrarFecha(fechaLocal()))}</div>
      <div class="resumen">
        <div>Operaciones<strong>${lista.length}</strong></div>
        <div>Total CUP<strong>${formato(totalCUP)} CUP</strong></div>
        <div>Total USD<strong>${formato(totalUSD)} USD</strong></div>
        <div>Salario acumulado<strong>${formato(salarioTotal)} CUP</strong></div>
      </div>
      <table>
        <thead><tr>
          <th>N.º</th><th>Fecha</th><th>Lugar</th><th>Productos</th>
          <th>Moneda</th><th>Total</th><th>Salario</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="pie">Sistema de gestión de ventas CAJA</div>
      <script>window.onload = function() { window.print(); };<\/script>
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
// ESTADÍSTICAS
// ==========================================

function obtenerResumenEstadisticas() {
  const operaciones = ventas.length;
  let unidades = 0, totalCUP = 0, totalUSD = 0, salarioTotal = 0;

  const porLugar = { "Almacén": 0, "Tienda": 0, "Casa": 0, "Sin especificar": 0 };
  const ranking = {};

  ventas.forEach(venta => {
    salarioTotal += Number(venta.salario) || 0;

    if (venta.moneda === "USD") totalUSD += Number(venta.total) || 0;
    else totalCUP += Number(venta.total) || 0;

    const lugar = venta.lugarVenta || "Sin especificar";
    if (porLugar[lugar] !== undefined) porLugar[lugar] += 1;

    (venta.productos || []).forEach(linea => {
      const cantidad = Number(linea.cantidad) || 0;
      const nombre = linea.nombre || "Producto";
      unidades += cantidad;
      ranking[nombre] = (ranking[nombre] || 0) + cantidad;
    });
  });

  return { operaciones, unidades, totalCUP, totalUSD, salarioTotal, porLugar, ranking };
}

function obtenerUltimosSeisMeses() {
  const resultado = [];
  const ahora = new Date();

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    resultado.push({
      clave: mesLocal(fecha),
      etiqueta: fecha.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
      CUP: 0, USD: 0
    });
  }

  ventas.forEach(venta => {
    const fecha = fechaParaComparar(venta.fecha);
    const mes = resultado.find(item => item.clave === fecha.slice(0, 7));
    if (!mes) return;
    if (venta.moneda === "USD") mes.USD += Number(venta.total) || 0;
    else mes.CUP += Number(venta.total) || 0;
  });

  return resultado;
}

function crearGraficoBarras(titulo, datos, sufijo = "") {
  if (!datos.length) {
    return `<div class="tarjeta"><h3>${escapar(titulo)}</h3>
      <p class="texto-vacio">No hay datos disponibles.</p></div>`;
  }

  const maximo = Math.max(...datos.map(i => Number(i.valor) || 0), 1);

  const barras = datos.map(item => {
    const valor = Number(item.valor) || 0;
    const ancho = Math.max(0, (valor / maximo) * 100);

    return `
      <div style="margin:13px 0">
        <div style="display:flex;justify-content:space-between;gap:10px;
                    font-size:12px;margin-bottom:5px">
          <strong>${escapar(item.nombre)}</strong>
          <span>${formato(valor)} ${escapar(sufijo)}</span>
        </div>
        <div style="width:100%;height:12px;background:#eee;border-radius:20px;overflow:hidden">
          <div style="width:${ancho}%;height:100%;background:#f28c28;border-radius:20px"></div>
        </div>
      </div>
    `;
  }).join("");

  return `<div class="tarjeta">
    <h3 style="margin-bottom:15px">${escapar(titulo)}</h3>
    ${barras}
  </div>`;
}

function mostrarEstadisticas() {
  const contenedor = document.getElementById("contenidoEstadisticas");
  if (!contenedor) return;

  const datos = obtenerResumenEstadisticas();
  const meses = obtenerUltimosSeisMeses();

  const lugares = Object.entries(datos.porLugar).map(([n, v]) => ({ nombre: n, valor: v }));

  const mejoresProductos = Object.entries(datos.ranking)
    .map(([n, v]) => ({ nombre: n, valor: v }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Resumen general</h3>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:#fff1e2;padding:14px;border-radius:12px">
          <small>Operaciones</small>
          <div style="font-size:23px;font-weight:bold">${datos.operaciones}</div>
        </div>
        <div style="background:#fff1e2;padding:14px;border-radius:12px">
          <small>Unidades vendidas</small>
          <div style="font-size:23px;font-weight:bold">${formato(datos.unidades)}</div>
        </div>
        <div style="background:#eaf5ee;padding:14px;border-radius:12px">
          <small>Ventas CUP</small>
          <div style="font-size:18px;font-weight:bold;color:#16834a">${formato(datos.totalCUP)}</div>
        </div>
        <div style="background:#eaf5ee;padding:14px;border-radius:12px">
          <small>Ventas USD</small>
          <div style="font-size:18px;font-weight:bold;color:#16834a">${formato(datos.totalUSD)}</div>
        </div>
      </div>

      <div style="margin-top:12px;padding:15px;background:#222;color:white;border-radius:12px">
        <small>Salarios acumulados</small>
        <div style="font-size:24px;font-weight:bold;color:#75df9a;margin-top:5px">
          ${formato(datos.salarioTotal)} CUP
        </div>
      </div>
    </div>

    ${crearGraficoBarras("Operaciones por lugar", lugares, "ventas")}
    ${crearGraficoBarras("Ingresos CUP - 6 meses", meses.map(m => ({ nombre: m.etiqueta, valor: m.CUP })), "CUP")}
    ${crearGraficoBarras("Ingresos USD - 6 meses", meses.map(m => ({ nombre: m.etiqueta, valor: m.USD })), "USD")}
    ${crearGraficoBarras("Productos más vendidos", mejoresProductos, "unidades")}

    <button type="button" class="btn-secundario" style="width:100%;margin-bottom:20px"
            onclick="mostrarEstadisticas()">
      ACTUALIZAR ESTADÍSTICAS
    </button>
  `;
}

// ==========================================
// EFECTIVO
// ==========================================

const denominacionesEfectivo = [
  10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000
];

let conteoEfectivo = {};

function cargarConteoEfectivo() {
  try {
    const guardado = localStorage.getItem(CLAVE_EFECTIVO);
    conteoEfectivo = guardado ? JSON.parse(guardado) : {};

    if (!conteoEfectivo || typeof conteoEfectivo !== "object" || Array.isArray(conteoEfectivo)) {
      conteoEfectivo = {};
    }
  } catch (error) {
    console.error("Error al cargar conteo:", error);
    conteoEfectivo = {};
  }

  denominacionesEfectivo.forEach(valor => {
    const cantidad = Number(conteoEfectivo[valor]);
    conteoEfectivo[valor] = Number.isFinite(cantidad) && cantidad >= 0 ? cantidad : 0;
  });
}

function guardarConteoEfectivo() {
  try {
    localStorage.setItem(CLAVE_EFECTIVO, JSON.stringify(conteoEfectivo));
    return true;
  } catch (error) {
    console.error("Error al guardar conteo:", error);
    alert("No se pudo guardar el conteo.");
    return false;
  }
}

function calcularTotalEfectivo() {
  return denominacionesEfectivo.reduce((total, valor) => {
    const cantidad = Number(conteoEfectivo[valor]) || 0;
    return total + valor * cantidad;
  }, 0);
}

function mostrarEfectivo() {
  cargarConteoEfectivo();

  const contenedor = document.getElementById("contenidoEfectivo");
  if (!contenedor) return;

  const filas = denominacionesEfectivo.map(valor => `
    <div class="producto">
      <div class="producto-info">
        <h3>${formato(valor)} CUP</h3>
        <small style="color:#777">
          Subtotal: <strong id="subtotalEfectivo${valor}">
            ${formato(valor * conteoEfectivo[valor])} CUP
          </strong>
        </small>
      </div>

      <div style="width:100px">
        <label for="billetes${valor}">Cantidad</label>
        <input id="billetes${valor}" type="number" min="0" step="1"
               inputmode="numeric" value="${conteoEfectivo[valor]}"
               style="margin-bottom:0"
               oninput="actualizarConteoEfectivo(${valor},this.value)">
      </div>
    </div>
  `).join("");

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3 style="margin-bottom:8px">Conteo de efectivo</h3>
      <p style="font-size:13px;color:#777">
        Introduce la cantidad de billetes. El total se calcula automáticamente.
      </p>
    </div>

    ${filas}

    <div class="resumen">
      <div>Total en efectivo</div>
      <div class="total" id="totalEfectivo">${formato(calcularTotalEfectivo())} CUP</div>
      <p style="font-size:12px;color:#ccc">
        Conteo guardado automáticamente en este dispositivo.
      </p>
    </div>

    <button type="button" class="btn-secundario" style="width:100%;margin-top:15px"
            onclick="limpiarConteoEfectivo()">
      LIMPIAR CONTEO
    </button>
  `;
}

function actualizarConteoEfectivo(valor, cantidad) {
  const numero = Number(cantidad);

  if (cantidad === "" || !Number.isFinite(numero) || numero < 0 || !Number.isInteger(numero)) {
    conteoEfectivo[valor] = 0;
  } else {
    conteoEfectivo[valor] = numero;
  }

  guardarConteoEfectivo();

  const subtotal = document.getElementById("subtotalEfectivo" + valor);
  if (subtotal) subtotal.textContent = formato(valor * conteoEfectivo[valor]) + " CUP";

  const total = document.getElementById("totalEfectivo");
  if (total) total.textContent = formato(calcularTotalEfectivo()) + " CUP";
}

function limpiarConteoEfectivo() {
  if (!confirm("¿Poner todas las cantidades en cero?")) return;

  denominacionesEfectivo.forEach(v => conteoEfectivo[v] = 0);
  guardarConteoEfectivo();
  mostrarEfectivo();
}

// ==========================================
// INICIO - ACTUALIZAR
// ==========================================

function actualizarInicio() {
  const resumen = obtenerResumenEstadisticas();

  // Resumen rápido arriba.
  const contenedorResumen = document.getElementById("resumenRapidoInicio");
  if (contenedorResumen) {
    contenedorResumen.innerHTML = `
      <div class="resumen-rapido-item">
        <small>Operaciones</small>
        <strong>${resumen.operaciones}</strong>
      </div>
      <div class="resumen-rapido-item">
        <small>Ventas CUP</small>
        <strong>${formato(resumen.totalCUP)}</strong>
      </div>
      <div class="resumen-rapido-item">
        <small>Ventas USD</small>
        <strong>${formato(resumen.totalUSD)}</strong>
      </div>
      <div class="resumen-rapido-item">
        <small>Salarios</small>
        <strong>${formato(resumen.salarioTotal)}</strong>
      </div>
    `;
  }

  // Texto dinámico de la tarjeta Estadísticas (sin duplicar).
  const textoEst = document.getElementById("textoEstadisticasInicio");
  if (textoEst) {
    textoEst.textContent = `${resumen.operaciones} operaciones registradas. Consulta tus estadísticas.`;
  }
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
    console.log("CAJA iniciada correctamente.");
  } catch (error) {
    console.error("Error al iniciar CAJA:", error);
    alert(
      "No se pudo iniciar la aplicación.\n\n" +
      "Comprueba la conexión con la base de datos y vuelve a cargar."
    );
  }
});