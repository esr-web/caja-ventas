
// ==========================================
// CAJA DE VENTAS - APLICACIÓN PRINCIPAL
// USD + CUP | OFFLINE | INDEXEDDB
// SALARIO SIEMPRE CALCULADO SOBRE CUP
// ==========================================

let productos = [];
let carrito = [];
let ventas = [];
let productoEnEdicion = null;

let porcentajeSalario = 5;
let pantallaActual = "inicio";
let monedaVenta = "CUP";

// ==========================================
// CONTEO DE EFECTIVO
// ==========================================

const DENOMINACIONES = [
  5, 10, 20, 50, 100, 200,
  500, 1000, 2000, 5000, 10000, 20000
];

const CLAVE_CONTEO_EFECTIVO = "caja_conteo_efectivo_v1";

let conteoEfectivo = cargarConteoEfectivo();

function cargarConteoEfectivo() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_CONTEO_EFECTIVO) || "{}"
    );

    const resultado = {};

    DENOMINACIONES.forEach(d => {
      const cantidad = Number(datos[d] || 0);

      resultado[d] = Number.isFinite(cantidad) && cantidad >= 0
        ? Math.floor(cantidad)
        : 0;
    });

    return resultado;
  } catch (error) {
    console.error(error);

    return Object.fromEntries(
      DENOMINACIONES.map(d => [d, 0])
    );
  }
}

function guardarConteoEfectivo() {
  try {
    localStorage.setItem(
      CLAVE_CONTEO_EFECTIVO,
      JSON.stringify(conteoEfectivo)
    );
  } catch (error) {
    alert("No se pudo guardar el conteo de efectivo.");
    console.error(error);
  }
}

function calcularTotalEfectivo() {
  return DENOMINACIONES.reduce(
    (total, d) => total + d * Number(conteoEfectivo[d] || 0),
    0
  );
}

function actualizarCantidadBilletes(denominacion, valor) {
  if (String(valor).trim() === "") return;

  const cantidad = Number(valor);

  if (
    !Number.isFinite(cantidad) ||
    cantidad < 0 ||
    !Number.isInteger(cantidad)
  ) return;

  conteoEfectivo[denominacion] = cantidad;
  guardarConteoEfectivo();

  const importe = document.getElementById(
    `importeBillete${denominacion}`
  );

  if (importe) {
    importe.textContent =
      formato(denominacion * cantidad) + " CUP";
  }

  const total = formato(calcularTotalEfectivo()) + " CUP";

  const superior = document.getElementById(
    "totalConteoEfectivoSuperior"
  );

  const inferior = document.getElementById(
    "totalConteoEfectivoInferior"
  );

  if (superior) superior.textContent = total;
  if (inferior) inferior.textContent = total;
}

function limpiarConteoEfectivo() {
  if (!confirm(
    "¿Deseas borrar todas las cantidades del conteo de efectivo?\n\n" +
    "Esta acción no se puede deshacer."
  )) return;

  DENOMINACIONES.forEach(d => {
    conteoEfectivo[d] = 0;
  });

  guardarConteoEfectivo();
  mostrarConteoEfectivo();

  alert("El conteo de efectivo ha sido limpiado.");
}

function mostrarConteoEfectivo() {
  const pantalla = document.getElementById("pantallaEfectivo");
  if (!pantalla) return;

  const filas = DENOMINACIONES.map(d => {
    const cantidad = conteoEfectivo[d] || 0;
    const importe = d * cantidad;

    return `
      <div class="tarjeta" style="
        display:grid;
        grid-template-columns:1fr 100px;
        gap:12px;
        align-items:center;
        margin-bottom:10px;
      ">
        <div>
          <strong style="font-size:17px">${formato(d)} CUP</strong>

          <div style="font-size:12px;color:#777;margin-top:7px">
            Importe:
          </div>

          <strong id="importeBillete${d}"
            style="color:#16834a;font-size:14px">
            ${formato(importe)} CUP
          </strong>
        </div>

        <div>
          <label for="billete${d}" style="font-size:11px">
            Cantidad
          </label>

          <input
            id="billete${d}"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            value="${cantidad}"
            onfocus="if(this.value==='0')this.value=''"
            oninput="actualizarCantidadBilletes(${d},this.value)"
            onblur="if(this.value.trim()===''){this.value='0';actualizarCantidadBilletes(${d},0)}"
            style="width:100%;text-align:center;font-size:18px;font-weight:bold"
          >
        </div>
      </div>
    `;
  }).join("");

  const total = formato(calcularTotalEfectivo()) + " CUP";

  pantalla.innerHTML = `
    <span class="etiqueta">CONTROL DE DINERO</span>

    <h2 class="titulo-seccion">Conteo de efectivo</h2>

    <div class="tarjeta" style="background:#151515;color:white;margin-bottom:18px">
      <div style="color:#f28c28;font-size:11px;font-weight:bold;letter-spacing:1px">
        TOTAL DE EFECTIVO
      </div>

      <div id="totalConteoEfectivoSuperior"
        style="font-size:30px;font-weight:bold;margin-top:12px">
        ${total}
      </div>

      <p style="color:#bbb;font-size:12px;margin-top:8px">
        Suma de todos los billetes contabilizados.
      </p>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 13px">
      <h3>Denominación de billetes</h3>
      <span style="font-size:11px;color:#777">CUP</span>
    </div>

    ${filas}

    <div class="tarjeta" style="background:#151515;color:white;margin-top:18px">
      <div style="color:#f28c28;font-size:11px;font-weight:bold;letter-spacing:1px">
        TOTAL GENERAL
      </div>

      <div id="totalConteoEfectivoInferior"
        style="font-size:30px;font-weight:bold;margin-top:10px">
        ${total}
      </div>
    </div>

    <button class="btn-peligro"
      style="width:100%;margin:15px 0 25px"
      onclick="limpiarConteoEfectivo()">
      🗑 LIMPIAR CONTEO
    </button>
  `;
}

// ==========================================
// FORMATO Y UTILIDADES
// ==========================================

const formato = valor =>
  Number(valor || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, letra => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[letra]);
}

// CORREGIDO: acepta una fecha opcional.
// Si no recibe fecha, utiliza la fecha actual.
function fechaLocal(fecha = new Date()) {
  const ahora = new Date(fecha);

  if (Number.isNaN(ahora.getTime())) return "";

  const zona = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );

  return zona.toISOString().slice(0, 16);
}

function fechaParaComparar(fecha) {
  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) return "";

  const zona = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );

  return zona.toISOString().slice(0, 10);
}

// CORREGIDO: utiliza la fecha recibida para obtener su mes.
function mesLocal(fecha = new Date()) {
  const ahora = new Date(fecha);

  if (Number.isNaN(ahora.getTime())) return "";

  return `${ahora.getFullYear()}-${String(
    ahora.getMonth() + 1
  ).padStart(2, "0")}`;
}

function mostrarFecha(fecha) {
  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) {
    return "Fecha no disponible";
  }

  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function precioProducto(producto, moneda) {
  if (moneda === "USD") {
    return Number(producto.precioUSD ?? 0);
  }

  return Number(producto.precioCUP ?? producto.precio ?? 0);
}

function precioCUPProducto(producto) {
  return Number(
    producto?.precioCUP ?? producto?.precio ?? 0
  );
}

// ==========================================
// COMPATIBILIDAD CON DATOS ANTERIORES
// ==========================================

function adaptarProducto(producto) {
  if (producto.precioCUP === undefined) {
    producto.precioCUP = Number(producto.precio || 0);
  }

  if (producto.precioUSD === undefined) {
    producto.precioUSD = 0;
  }

  return producto;
}

function adaptarVenta(venta) {
  if (!venta.moneda) {
    venta.moneda = "CUP";
  }

  const lugaresValidos = [
    "Almacén",
    "Tienda",
    "Casa"
  ];

  if (!lugaresValidos.includes(venta.lugarVenta)) {
    venta.lugarVenta = "Sin especificar";
  }

  venta.productos = (venta.productos || []).map(item => {
    const precioAntiguo = Number(item.precio || 0);

    const catalogo = productos.find(
      p => String(p.id) === String(item.productoId || item.id)
    );

    let precioCUP = Number(item.precioCUP || 0);

    if (precioCUP <= 0 && venta.moneda === "USD") {
      precioCUP = precioCUPProducto(catalogo);
    }

    if (precioCUP <= 0 && venta.moneda === "CUP") {
      precioCUP = precioAntiguo;
    }

    const precioUSD = Number(
      item.precioUSD ??
      (venta.moneda === "USD" ? precioAntiguo : 0)
    );

    return {
      ...item,
      precioCUP,
      precioUSD
    };
  });

  if (venta.totalCUP === undefined) {
    venta.totalCUP = venta.moneda === "CUP"
      ? Number(venta.total || 0)
      : 0;
  }

  if (venta.totalUSD === undefined) {
    venta.totalUSD = venta.moneda === "USD"
      ? Number(venta.total || 0)
      : 0;
  }

  const porcentaje = Number(venta.porcentaje || 0);

  venta.salarioCUP = venta.productos.reduce(
    (suma, item) =>
      suma +
      Number(item.precioCUP || 0) *
      Number(item.cantidad || 0) *
      porcentaje / 100,
    0
  );

  venta.salarioUSD = 0;
  venta.salario = venta.salarioCUP;

  return venta;
}

// ==========================================
// CÁLCULO DEL SALARIO EN CUP
// ==========================================

function calcularSalarioLineasCUP(lineas, porcentaje) {
  return lineas.reduce((suma, item) => {
    return suma +
      Number(item.precioCUP || 0) *
      Number(item.cantidad || 0) *
      porcentaje / 100;
  }, 0);
}

// ==========================================
// INICIO Y BASE DE DATOS
// ==========================================

async function iniciarAplicacion() {
  try {
    await abrirBaseDatos();

    productos = (await obtenerTodos("productos"))
      .map(adaptarProducto);

    ventas = (await obtenerTodos("ventas"))
      .map(adaptarVenta);

    // Actualiza los datos antiguos sin cambiar la estructura
    // ni la versión de IndexedDB.
    for (const producto of productos) {
      await guardarDato("productos", producto);
    }

    for (const venta of ventas) {
      await guardarDato("ventas", venta);
    }

    actualizarConexion();
    navegar("inicio");
    solicitarAlmacenamientoPersistente();

  } catch (error) {
    alert("No se pudo abrir la base de datos del teléfono.");
    console.error(error);
  }
}

async function solicitarAlmacenamientoPersistente() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (error) {
      console.warn(error);
    }
  }
}

function actualizarConexion() {
  const estado = document.getElementById("estadoConexion");
  const punto = document.getElementById("puntoConexion");

  if (!estado || !punto) return;

  if (navigator.onLine) {
    estado.textContent = "Con conexión";
    punto.style.background = "#58c985";
  } else {
    estado.textContent = "Sin Internet";
    punto.style.background = "#f28c28";
  }
}

window.addEventListener("online", actualizarConexion);
window.addEventListener("offline", actualizarConexion);

// ==========================================
// NAVEGACIÓN
// ==========================================

function navegar(destino) {
  pantallaActual = destino;

  const pantallas = {
    inicio: "pantallaInicio",
    caja: "pantallaCaja",
    productos: "pantallaProductos",
    registro: "pantallaRegistro",
    efectivo: "pantallaEfectivo",
    estadisticas: "pantallaEstadisticas"
  };

  Object.entries(pantallas).forEach(([nombre, id]) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.classList.toggle("activa", nombre === destino);
    }
  });

  const botones = {
    inicio: "navInicio",
    caja: "navCaja",
    productos: "navProductos",
    registro: "navRegistro",
    efectivo: "navEfectivo"
  };

  Object.entries(botones).forEach(([nombre, id]) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.classList.toggle("activo", nombre === destino);
    }
  });

  if (destino === "caja") mostrarCaja();
  if (destino === "productos") mostrarProductos();
  if (destino === "registro") mostrarRegistro();
  if (destino === "efectivo") mostrarConteoEfectivo();
  if (destino === "estadisticas") mostrarEstadisticas();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ==========================================
// PRODUCTOS
// ==========================================

function mostrarProductos() {
  const pantalla = document.getElementById("pantallaProductos");
  if (!pantalla) return;

  pantalla.innerHTML = `
    <span class="etiqueta">INVENTARIO</span>
    <h2 class="titulo-seccion">Productos</h2>

    <div class="tarjeta">
      <h3 id="tituloFormularioProducto">Agregar producto</h3>

      <input type="hidden" id="productoId">

      <label for="nombreProducto">Nombre del producto</label>
      <input
        id="nombreProducto"
        type="text"
        placeholder="Nombre del producto">

      <label for="descripcionProducto">Descripción</label>
      <input
        id="descripcionProducto"
        type="text"
        placeholder="Descripción">

      <label for="precioCUP">Precio en CUP</label>
      <input
        id="precioCUP"
        type="number"
        min="0"
        step="0.01"
        placeholder="0">

      <label for="precioUSD">Precio en USD</label>
      <input
        id="precioUSD"
        type="number"
        min="0"
        step="0.01"
        placeholder="0">

      <button
        class="btn-principal"
        onclick="guardarProducto()">
        Guardar producto
      </button>

      <button
        id="btnCancelarProducto"
        class="btn-secundario"
        onclick="cancelarEdicion()"
        style="display:none;width:100%;margin-top:10px">
        Cancelar edición
      </button>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Catálogo de productos</h3>
      <div id="catalogoProductos"></div>
    </div>
  `;

  dibujarCatalogo();
}

function dibujarCatalogo() {
  const contenedor = document.getElementById("catalogoProductos");
  if (!contenedor) return;

  if (!productos.length) {
    contenedor.innerHTML = `
      <p class="texto-vacio">
        No hay productos registrados.
      </p>
    `;
    return;
  }

  contenedor.innerHTML = productos.map(producto => `
    <div class="producto">
      <div class="producto-info">
        <h3>${escapar(producto.nombre)}</h3>

        <p style="font-size:12px;color:#777;margin:5px 0">
          ${escapar(producto.descripcion || "")}
        </p>

        <p class="precio">
          ${formato(producto.precioCUP || 0)} CUP
        </p>

        <p style="font-size:13px;color:#3979c6;font-weight:bold;margin-top:4px">
          ${formato(producto.precioUSD || 0)} USD
        </p>
      </div>

      <div style="display:flex;flex-direction:column;gap:7px">
        <button
          class="btn-secundario"
          onclick="editarProducto('${escapar(String(producto.id))}')">
          Editar
        </button>

        <button
          class="btn-peligro"
          onclick="eliminarProducto('${escapar(String(producto.id))}')">
          Eliminar
        </button>
      </div>
    </div>
  `).join("");
}

async function guardarProducto() {
  const nombre = document
    .getElementById("nombreProducto")?.value.trim();

  const descripcion = document
    .getElementById("descripcionProducto")?.value.trim() || "";

  const precioCUP = Number(
    document.getElementById("precioCUP")?.value || 0
  );

  const precioUSD = Number(
    document.getElementById("precioUSD")?.value || 0
  );

  const id = document.getElementById("productoId")?.value;

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    return;
  }

  if (
    !Number.isFinite(precioCUP) ||
    !Number.isFinite(precioUSD) ||
    precioCUP < 0 ||
    precioUSD < 0 ||
    (!precioCUP && !precioUSD)
  ) {
    alert("Introduce al menos un precio válido.");
    return;
  }

  const producto = {
    id: id || (
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now())
    ),
    nombre,
    descripcion,
    precioCUP,
    precioUSD
  };

  try {
    await guardarRegistro("productos", producto);

    const indice = productos.findIndex(
      p => String(p.id) === String(producto.id)
    );

    if (indice >= 0) {
      productos[indice] = producto;
    } else {
      productos.push(producto);
    }

    cancelarEdicion();
    dibujarCatalogo();

    alert("Producto guardado correctamente.");

  } catch (error) {
    console.error(error);
    alert("No se pudo guardar el producto.");
  }
}

function editarProducto(id) {
  const producto = productos.find(
    p => String(p.id) === String(id)
  );

  if (!producto) return;

  document.getElementById("productoId").value = producto.id;
  document.getElementById("nombreProducto").value = producto.nombre || "";
  document.getElementById("descripcionProducto").value =
    producto.descripcion || "";

  document.getElementById("precioCUP").value =
    producto.precioCUP || 0;

  document.getElementById("precioUSD").value =
    producto.precioUSD || 0;

  document.getElementById("tituloFormularioProducto").textContent =
    "Editar producto";

  const botonCancelar = document.getElementById("btnCancelarProducto");

  if (botonCancelar) {
    botonCancelar.style.display = "block";
  }

  document.getElementById("nombreProducto").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function cancelarEdicion() {
  const campos = [
    "productoId",
    "nombreProducto",
    "descripcionProducto",
    "precioCUP",
    "precioUSD"
  ];

  campos.forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = "";
  });

  const titulo = document.getElementById("tituloFormularioProducto");

  if (titulo) {
    titulo.textContent = "Agregar producto";
  }

  const botonCancelar = document.getElementById("btnCancelarProducto");

  if (botonCancelar) {
    botonCancelar.style.display = "none";
  }
}

async function eliminarProducto(id) {
  const producto = productos.find(
    p => String(p.id) === String(id)
  );

  if (!producto) return;

  if (!confirm(`¿Eliminar el producto "${producto.nombre}"?`)) {
    return;
  }

  try {
    await eliminarRegistro("productos", id);

    productos = productos.filter(
      p => String(p.id) !== String(id)
    );

    dibujarCatalogo();

  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar el producto.");
  }
}

// ==========================================
// CAJA DE VENTAS
// ==========================================

function mostrarCaja() {
  const pantalla = document.getElementById("pantallaCaja");
  if (!pantalla) return;

  carrito = [];

  const ahora = new Date();

  pantalla.innerHTML = `
    <span class="etiqueta">NUEVA OPERACIÓN</span>
    <h2 class="titulo-seccion">Caja de ventas</h2>

    <div class="tarjeta">
      <h3 style="margin-bottom:14px">Moneda de venta</h3>

      <div style="display:flex;gap:10px">
        <button
          class="${monedaVenta === "CUP" ? "btn-principal" : "btn-secundario"}"
          style="flex:1"
          onclick="cambiarMonedaVenta('CUP')">
          CUP
        </button>

        <button
          class="${monedaVenta === "USD" ? "btn-principal" : "btn-secundario"}"
          style="flex:1"
          onclick="cambiarMonedaVenta('USD')">
          USD
        </button>
      </div>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Datos de la venta</h3>

      <label for="fechaVenta">Fecha y hora</label>

      <input
        type="datetime-local"
        id="fechaVenta"
        value="${fechaLocal(ahora)}">

      <label for="lugarVenta">Lugar donde se realizó la venta</label>

      <select id="lugarVenta">
        <option value="">Seleccionar lugar...</option>
        <option value="Almacén">Almacén</option>
        <option value="Tienda">Tienda</option>
        <option value="Casa">Casa</option>
      </select>

      <label for="porcentajeVenta">Porcentaje de salario</label>

      <input
        type="number"
        id="porcentajeVenta"
        min="0"
        step="0.1"
        value="${porcentajeSalario}"
        onchange="actualizarResumen()">
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Productos disponibles</h3>

      <input
        type="search"
        id="buscarProductoCaja"
        placeholder="Buscar producto..."
        oninput="dibujarProductosCaja()">

      <div id="productosCaja"></div>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Carrito de venta</h3>

      <div id="carritoVenta"></div>

      <div id="resumenVenta"></div>

      <button
        class="btn-vendido"
        onclick="registrarVenta()">
        REGISTRAR VENTA
      </button>
    </div>
  `;

  dibujarProductosCaja();
  actualizarResumen();
}

function cambiarMonedaVenta(moneda) {
  if (moneda !== "CUP" && moneda !== "USD") return;

  monedaVenta = moneda;
  mostrarCaja();
}

function dibujarProductosCaja() {
  const contenedor = document.getElementById("productosCaja");
  if (!contenedor) return;

  const busqueda = (
    document.getElementById("buscarProductoCaja")?.value || ""
  ).toLowerCase().trim();

  const lista = productos.filter(producto =>
    (producto.nombre || "").toLowerCase().includes(busqueda)
  );

  if (!lista.length) {
    contenedor.innerHTML = `
      <p class="texto-vacio">
        No se encontraron productos.
      </p>
    `;
    return;
  }

  contenedor.innerHTML = lista.map(producto => {
    const precio = precioProducto(producto, monedaVenta);

    return `
      <div class="producto">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>

          <p class="precio">
            ${formato(precio)} ${monedaVenta}
          </p>
        </div>

        <button
          class="btn-principal"
          style="width:auto;padding:11px 15px"
          onclick="cambiarCantidad('${escapar(String(producto.id))}',1)">
          Agregar
        </button>
      </div>
    `;
  }).join("");
}

function cambiarCantidad(id, cambio) {
  const producto = productos.find(
    p => String(p.id) === String(id)
  );

  if (!producto) return;

  let linea = carrito.find(
    p => String(p.id) === String(id)
  );

  if (!linea && cambio > 0) {
    linea = {
      id: producto.id,
      nombre: producto.nombre,
      cantidad: 0,
      precioCUP: Number(
        producto.precioCUP ?? producto.precio ?? 0
      ),
      precioUSD: Number(producto.precioUSD || 0)
    };

    carrito.push(linea);
  }

  if (!linea) return;

  linea.cantidad += cambio;

  if (linea.cantidad <= 0) {
    carrito = carrito.filter(
      p => String(p.id) !== String(id)
    );
  }

  actualizarResumen();
}

// ==========================================
// CÁLCULO Y RESUMEN DE VENTA
// ==========================================

function calcularVenta() {
  const porcentaje = Number(
    document.getElementById("porcentajeVenta")?.value ?? porcentajeSalario
  );

  let total = 0;
  let totalCUP = 0;

  const lineas = carrito.map(item => {
    const precio = precioProducto(item, monedaVenta);
    const subtotal = precio * item.cantidad;

    total += subtotal;

    const precioEnCUP = monedaVenta === "CUP"
      ? precio
      : precioCUPProducto(item);

    totalCUP += precioEnCUP * item.cantidad;

    return {
      id: item.id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio,
      subtotal,
      moneda: monedaVenta,
      precioCUP: precioEnCUP,
      precioUSD: Number(item.precioUSD || 0),
      subtotalCUP: precioEnCUP * item.cantidad
    };
  });

  const salarioCUP = calcularSalarioLineasCUP(
    lineas,
    porcentaje
  );

  return {
    lineas,
    total,
    totalCUP,
    salarioCUP,
    porcentaje
  };
}

function actualizarResumen() {
  const contenedorCarrito = document.getElementById("carritoVenta");
  const contenedorResumen = document.getElementById("resumenVenta");

  if (!contenedorCarrito || !contenedorResumen) return;

  const calculo = calcularVenta();

  if (!carrito.length) {
    contenedorCarrito.innerHTML = `
      <p class="texto-vacio">El carrito está vacío.</p>
    `;
  } else {
    contenedorCarrito.innerHTML = carrito.map(item => {
      const precio = precioProducto(item, monedaVenta);

      return `
        <div class="producto">
          <div class="producto-info">
            <h3>${escapar(item.nombre)}</h3>

            <p style="font-size:12px;color:#777;margin-top:5px">
              ${formato(precio)} ${monedaVenta} x ${item.cantidad}
            </p>

            <p class="precio" style="margin-top:5px">
              Subtotal: ${formato(precio * item.cantidad)} ${monedaVenta}
            </p>
          </div>

          <div class="controles-cantidad">
            <button
              class="btn-cantidad"
              onclick="cambiarCantidad('${escapar(String(item.id))}',-1)">
              −
            </button>

            <span class="cantidad">${item.cantidad}</span>

            <button
              class="btn-cantidad"
              onclick="cambiarCantidad('${escapar(String(item.id))}',1)">
              +
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  contenedorResumen.innerHTML = `
    <div class="resumen">
      <p style="font-size:13px;color:#ddd">
        Total de venta
      </p>

      <div class="total">
        ${formato(calculo.total)} ${monedaVenta}
      </div>

      <hr style="border:0;border-top:1px solid #ffffff30;margin:15px 0">

      <div style="display:flex;justify-content:space-between;gap:10px;margin:9px 0">
        <span style="color:#ddd">Base para salario:</span>
        <strong>${formato(calculo.totalCUP)} CUP</strong>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;margin:9px 0">
        <span style="color:#ddd">Salario (${formato(calculo.porcentaje)}%):</span>
        <strong class="salario">${formato(calculo.salarioCUP)} CUP</strong>
      </div>
    </div>
  `;
}

// ==========================================
// REGISTRAR VENTA
// ==========================================

async function registrarVenta() {
  if (!carrito.length) {
    alert("Agrega al menos un producto al carrito.");
    return;
  }

  const fecha = document.getElementById("fechaVenta")?.value;
  const lugarVenta = document.getElementById("lugarVenta")?.value || "";

  const porcentaje = Number(
    document.getElementById("porcentajeVenta")?.value
  );

  if (!fecha || Number.isNaN(new Date(fecha).getTime())) {
    alert("Selecciona una fecha y hora válidas.");
    return;
  }

  if (!["Almacén", "Tienda", "Casa"].includes(lugarVenta)) {
    alert("Selecciona dónde se realizó la venta: Almacén, Tienda o Casa.");
    return;
  }

  if (!Number.isFinite(porcentaje) || porcentaje < 0) {
    alert("Introduce un porcentaje de salario válido.");
    return;
  }

  porcentajeSalario = porcentaje;

  const calculo = calcularVenta();

  if (!Number.isFinite(calculo.total) || calculo.total <= 0) {
    alert("El total de la venta debe ser mayor que cero.");
    return;
  }

  const confirmacion = confirm(
    `¿Registrar esta venta?\n\n` +
    `Lugar: ${lugarVenta}\n` +
    `Total: ${formato(calculo.total)} ${monedaVenta}\n` +
    `Salario: ${formato(calculo.salarioCUP)} CUP`
  );

  if (!confirmacion) return;

  const venta = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),

    fecha: new Date(fecha).toISOString(),
    lugarVenta,
    moneda: monedaVenta,
    productos: calculo.lineas,
    total: calculo.total,
    salario: calculo.salarioCUP,
    porcentaje: calculo.porcentaje,

    totalUSD: monedaVenta === "USD"
      ? calculo.total
      : 0,

    totalCUP: monedaVenta === "CUP"
      ? calculo.total
      : 0,

    salarioUSD: 0,
    salarioCUP: calculo.salarioCUP
  };

  try {
    await guardarRegistro("ventas", venta);

    ventas.push(adaptarVenta(venta));

    carrito = [];

    alert("Venta registrada correctamente.");

    navegar("inicio");

  } catch (error) {
    console.error(error);
    alert("No se pudo registrar la venta.");
  }
}

// ==========================================
// REGISTRO DE VENTAS Y FILTROS
// ==========================================

function mostrarRegistro() {
  const pantalla = document.getElementById("pantallaRegistro");
  if (!pantalla) return;

  pantalla.innerHTML = `
    <span class="etiqueta">HISTORIAL</span>

    <h2 class="titulo-seccion">Registro de ventas</h2>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Filtros de búsqueda</h3>

      <label for="filtroPeriodo">Período</label>

      <select
        id="filtroPeriodo"
        onchange="actualizarVisibilidadFiltros();actualizarRegistro()">

        <option value="todo">Todas las ventas</option>
        <option value="dia">Por día</option>
        <option value="mes">Por mes</option>
        <option value="anio">Por año</option>
        <option value="rango">Rango de fechas</option>
      </select>

      <div id="filtrosFecha"></div>

      <label for="filtroProducto">Producto</label>

      <select id="filtroProducto" onchange="actualizarRegistro()">
        <option value="">Todos los productos</option>

        ${productos.map(p => `
          <option value="${escapar(String(p.id))}">
            ${escapar(p.nombre)}
          </option>
        `).join("")}
      </select>

      <label for="filtroMoneda">Moneda</label>

      <select id="filtroMoneda" onchange="actualizarRegistro()">
        <option value="">Todas las monedas</option>
        <option value="CUP">CUP</option>
        <option value="USD">USD</option>
      </select>

      <label for="filtroLugar">Lugar de venta</label>

      <select id="filtroLugar" onchange="actualizarRegistro()">
        <option value="">Todos los lugares</option>
        <option value="Almacén">Almacén</option>
        <option value="Tienda">Tienda</option>
        <option value="Casa">Casa</option>
        <option value="Sin especificar">Sin especificar</option>
      </select>

      <label for="filtroMinimo">Importe mínimo</label>

      <input
        type="number"
        id="filtroMinimo"
        min="0"
        placeholder="Sin mínimo"
        oninput="actualizarRegistro()">

      <label for="filtroMaximo">Importe máximo</label>

      <input
        type="number"
        id="filtroMaximo"
        min="0"
        placeholder="Sin máximo"
        oninput="actualizarRegistro()">

      <button
        class="btn-secundario"
        style="width:100%;margin-bottom:10px"
        onclick="limpiarFiltrosRegistro()">
        Limpiar filtros
      </button>

      <button
        class="btn-principal"
        onclick="exportarRegistroPDF()">
        Exportar PDF
      </button>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Resumen de todas las ventas</h3>
      <div id="resumenCompletoVentas"></div>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Resultados del filtro</h3>
      <div id="resultadosRegistro"></div>
    </div>
  `;

  actualizarVisibilidadFiltros();
  mostrarResumenVentas();
  actualizarRegistro();
}

// ==========================================
// RESUMEN GENERAL DE VENTAS
// ==========================================

function mostrarResumenVentas() {
  const contenedor = document.getElementById("resumenCompletoVentas");
  if (!contenedor) return;

  const totalCUP = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0),
    0
  );

  const totalUSD = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0),
    0
  );

  const salarioCUP = ventas.reduce(
    (suma, venta) =>
      suma + Number(venta.salarioCUP || venta.salario || 0),
    0
  );

  const unidades = ventas.reduce((suma, venta) => {
    return suma + (venta.productos || []).reduce(
      (subtotal, producto) =>
        subtotal + Number(producto.cantidad || 0),
      0
    );
  }, 0);

  contenedor.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;margin:10px 0">
      <span>Operaciones registradas:</span>
      <strong>${ventas.length}</strong>
    </div>

    <div style="display:flex;justify-content:space-between;gap:10px;margin:10px 0">
      <span>Unidades vendidas:</span>
      <strong>${unidades}</strong>
    </div>

    <div style="display:flex;justify-content:space-between;gap:10px;margin:10px 0">
      <span>Total vendido en CUP:</span>
      <strong>${formato(totalCUP)} CUP</strong>
    </div>

    <div style="display:flex;justify-content:space-between;gap:10px;margin:10px 0">
      <span>Total vendido en USD:</span>
      <strong>${formato(totalUSD)} USD</strong>
    </div>

    <div style="display:flex;justify-content:space-between;gap:10px;margin:10px 0">
      <span>Salario acumulado:</span>
      <strong style="color:#16834a">${formato(salarioCUP)} CUP</strong>
    </div>
  `;
}

// ==========================================
// VISIBILIDAD DE FILTROS DE FECHA
// ==========================================

function actualizarVisibilidadFiltros() {
  const periodo = document.getElementById("filtroPeriodo")?.value;
  const contenedor = document.getElementById("filtrosFecha");

  if (!contenedor) return;

  if (periodo === "dia") {
    contenedor.innerHTML = `
      <label for="fechaFiltro">Seleccionar día</label>
      <input
        type="date"
        id="fechaFiltro"
        value="${fechaLocal().slice(0, 10)}"
        onchange="actualizarRegistro()">
    `;
  } else if (periodo === "mes") {
    contenedor.innerHTML = `
      <label for="mesFiltro">Seleccionar mes</label>
      <input
        type="month"
        id="mesFiltro"
        value="${mesLocal()}"
        onchange="actualizarRegistro()">
    `;
  } else if (periodo === "anio") {
    contenedor.innerHTML = `
      <label for="anioFiltro">Seleccionar año</label>
      <input
        type="number"
        id="anioFiltro"
        min="2000"
        max="2100"
        value="${new Date().getFullYear()}"
        onchange="actualizarRegistro()">
    `;
  } else if (periodo === "rango") {
    contenedor.innerHTML = `
      <label for="fechaDesde">Desde</label>
      <input
        type="date"
        id="fechaDesde"
        onchange="actualizarRegistro()">

      <label for="fechaHasta">Hasta</label>
      <input
        type="date"
        id="fechaHasta"
        onchange="actualizarRegistro()">
    `;
  } else {
    contenedor.innerHTML = "";
  }
}

// ==========================================
// LIMPIAR FILTROS
// ==========================================

function limpiarFiltrosRegistro() {
  const periodo = document.getElementById("filtroPeriodo");
  const producto = document.getElementById("filtroProducto");
  const moneda = document.getElementById("filtroMoneda");
  const lugar = document.getElementById("filtroLugar");
  const minimo = document.getElementById("filtroMinimo");
  const maximo = document.getElementById("filtroMaximo");

  if (periodo) periodo.value = "todo";
  if (producto) producto.value = "";
  if (moneda) moneda.value = "";
  if (lugar) lugar.value = "";
  if (minimo) minimo.value = "";
  if (maximo) maximo.value = "";

  actualizarVisibilidadFiltros();
  actualizarRegistro();
}

// ==========================================
// ACTUALIZAR REGISTRO DE VENTAS
// ==========================================

function actualizarRegistro() {
  const contenedor = document.getElementById("resultadosRegistro");
  if (!contenedor) return;

  const periodo = document.getElementById("filtroPeriodo")?.value || "todo";
  const productoFiltro = document.getElementById("filtroProducto")?.value || "";
  const monedaFiltro = document.getElementById("filtroMoneda")?.value || "";
  const lugarFiltro = document.getElementById("filtroLugar")?.value || "";

  const minimoTexto = document.getElementById("filtroMinimo")?.value ?? "";
  const maximoTexto = document.getElementById("filtroMaximo")?.value ?? "";

  const minimo = minimoTexto === "" ? null : Number(minimoTexto);
  const maximo = maximoTexto === "" ? null : Number(maximoTexto);

  let lista = [...ventas];

  // FILTRO POR FECHA
  if (periodo === "dia") {
    const fecha = document.getElementById("fechaFiltro")?.value;

    if (fecha) {
      lista = lista.filter(venta =>
        fechaParaComparar(venta.fecha) === fecha
      );
    }
  }

  if (periodo === "mes") {
    const mes = document.getElementById("mesFiltro")?.value;

    if (mes) {
      lista = lista.filter(venta =>
        mesLocal(venta.fecha) === mes
      );
    }
  }

  if (periodo === "anio") {
    const anio = document.getElementById("anioFiltro")?.value;

    if (anio) {
      lista = lista.filter(venta =>
        String(new Date(venta.fecha).getFullYear()) === String(anio)
      );
    }
  }

  if (periodo === "rango") {
    const desde = document.getElementById("fechaDesde")?.value;
    const hasta = document.getElementById("fechaHasta")?.value;

    if (desde) {
      lista = lista.filter(venta =>
        fechaParaComparar(venta.fecha) >= desde
      );
    }

    if (hasta) {
      lista = lista.filter(venta =>
        fechaParaComparar(venta.fecha) <= hasta
      );
    }
  }

  // FILTRO POR PRODUCTO
  if (productoFiltro) {
    lista = lista.filter(venta =>
      (venta.productos || []).some(producto =>
        String(producto.id) === String(productoFiltro)
      )
    );
  }

  // FILTRO POR MONEDA
  if (monedaFiltro) {
    lista = lista.filter(venta =>
      (venta.moneda || "CUP") === monedaFiltro
    );
  }

  // FILTRO POR LUGAR
  if (lugarFiltro) {
    lista = lista.filter(venta =>
      (venta.lugarVenta || "Sin especificar") === lugarFiltro
    );
  }

  // FILTRO POR IMPORTE
  if (minimo !== null && Number.isFinite(minimo)) {
    lista = lista.filter(venta =>
      Number(venta.total || 0) >= minimo
    );
  }

  if (maximo !== null && Number.isFinite(maximo)) {
    lista = lista.filter(venta =>
      Number(venta.total || 0) <= maximo
    );
  }

  // ORDENAR DE MÁS RECIENTE A MÁS ANTIGUA
  lista.sort((a, b) =>
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  if (!lista.length) {
    contenedor.innerHTML = `
      <p class="texto-vacio">
        No hay ventas que coincidan con los filtros seleccionados.
      </p>
    `;
    return;
  }

  const totalCUP = lista.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0),
    0
  );

  const totalUSD = lista.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0),
    0
  );

  const salario = lista.reduce(
    (suma, venta) =>
      suma + Number(venta.salarioCUP || venta.salario || 0),
    0
  );

  let html = `
    <div class="resumen" style="margin-bottom:15px">
      <p style="color:#ddd;font-size:13px">Ventas encontradas: ${lista.length}</p>

      <div style="margin-top:10px">
        <strong>Total CUP:</strong> ${formato(totalCUP)} CUP
      </div>

      <div style="margin-top:7px">
        <strong>Total USD:</strong> ${formato(totalUSD)} USD
      </div>

      <div style="margin-top:7px">
        <strong>Salario:</strong>
        <span class="salario">${formato(salario)} CUP</span>
      </div>
    </div>
  `;

  html += lista.map(venta => {
    const moneda = venta.moneda || "CUP";
    const lugar = venta.lugarVenta || "Sin especificar";

    const salarioVenta = Number(
      venta.salarioCUP ?? venta.salario ?? 0
    );

    const fecha = mostrarFecha(venta.fecha);

    const productosHTML = (venta.productos || []).map(producto => `
      <div class="producto" style="padding:10px 0">
        <div class="producto-info">
          <strong>${escapar(producto.nombre || "Producto")}</strong>

          <p style="font-size:12px;color:#777;margin-top:4px">
            ${Number(producto.cantidad || 0)} unidades
            × ${formato(producto.precio || 0)} ${moneda}
          </p>
        </div>

        <strong>
          ${formato(producto.subtotal ?? (
            Number(producto.cantidad || 0) *
            Number(producto.precio || 0)
          ))} ${moneda}
        </strong>
      </div>
    `).join("");

    return `
      <div class="tarjeta" style="margin-bottom:15px">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div>
            <span class="etiqueta">VENTA REGISTRADA</span>

            <h3 style="margin-top:7px">
              ${escapar(fecha)}
            </h3>
          </div>

          <strong>${moneda}</strong>
        </div>

        <div style="margin:12px 0;padding:10px;background:#f5f5f5;border-radius:8px">
          <strong>Lugar de venta:</strong>
          ${escapar(lugar)}
        </div>

        <div style="margin-top:10px">
          ${productosHTML}
        </div>

        <hr style="border:0;border-top:1px solid #ddd;margin:12px 0">

        <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
          <strong>Total de venta:</strong>
          <strong class="precio">
            ${formato(venta.total || 0)} ${moneda}
          </strong>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
          <span>Porcentaje de salario:</span>
          <strong>${formato(venta.porcentaje || 0)}%</strong>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
          <span>Salario calculado:</span>
          <strong class="salario">
            ${formato(salarioVenta)} CUP
          </strong>
        </div>

        <button
          class="btn-peligro"
          style="width:100%;margin-top:12px"
          onclick="eliminarVenta('${escapar(String(venta.id))}')">
          Eliminar venta
        </button>

      </div>
    `;
  }).join("");

  contenedor.innerHTML = html;
}

// ==========================================
// EXPORTAR REGISTRO A PDF
// ==========================================

function exportarRegistroPDF() {
  const contenedor = document.getElementById("resultadosRegistro");

  if (!contenedor || !contenedor.innerHTML.trim()) {
    alert("No hay ventas para exportar.");
    return;
  }

  if (!ventas.length) {
    alert("No existen ventas registradas.");
    return;
  }

  const contenido = contenedor.innerHTML;
  const ventana = window.open("", "_blank");

  if (!ventana) {
    alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para exportar.");
    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <title>Registro de ventas - Caja</title>

      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 25px;
          color: #222;
        }

        h1 {
          text-align: center;
          margin-bottom: 5px;
        }

        .subtitulo {
          text-align: center;
          color: #666;
          margin-bottom: 25px;
        }

        .tarjeta {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          page-break-inside: avoid;
        }

        .producto {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .producto-info {
          flex: 1;
        }

        .resumen {
          background: #f2f2f2;
          color: #222;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 15px;
        }

        .total, .precio, .salario {
          font-weight: bold;
        }

        .etiqueta {
          font-size: 11px;
          font-weight: bold;
        }

        button {
          display: none !important;
        }

        @media print {
          body {
            padding: 0;
          }

          .tarjeta {
            break-inside: avoid;
          }
        }
      </style>
    </head>

    <body>
      <h1>CAJA DE VENTAS</h1>
      <p class="subtitulo">Registro de operaciones comerciales</p>

      <p>
        Fecha de exportación:
        ${escapar(mostrarFecha(new Date().toISOString()))}
      </p>

      ${contenido}

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  ventana.document.close();
}

// ==========================================
// ELIMINAR VENTA
// ==========================================

async function eliminarVenta(id) {
  const venta = ventas.find(
    item => String(item.id) === String(id)
  );

  if (!venta) {
    alert("No se encontró la venta seleccionada.");
    return;
  }

  const confirmar = confirm(
    "¿Estás seguro de eliminar esta venta?\n\n" +
    "Esta operación no se puede deshacer."
  );

  if (!confirmar) return;

  try {
    await eliminarRegistro("ventas", venta.id);

    ventas = ventas.filter(
      item => String(item.id) !== String(id)
    );

    mostrarResumenVentas();
    actualizarRegistro();

    alert("Venta eliminada correctamente.");

  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar la venta.");
  }
}

// ==========================================
// BARRAS PARA GRÁFICOS ESTADÍSTICOS
// ==========================================

function barraEstadistica(valor, maximo, color) {
  const numero = Math.max(0, Number(valor) || 0);
  const limite = Math.max(0, Number(maximo) || 0);

  const porcentaje = limite > 0
    ? Math.min(100, (numero / limite) * 100)
    : 0;

  return `
    <div style="
      width:100%;
      height:12px;
      background:#e9e9e9;
      border-radius:20px;
      overflow:hidden;
      margin-top:7px;
    ">
      <div style="
        width:${porcentaje}%;
        height:100%;
        background:${color};
        border-radius:20px;
      "></div>
    </div>
  `;
}

// ==========================================
// PANEL DE ESTADÍSTICAS
// ==========================================

function mostrarEstadisticas() {
  const pantalla = document.getElementById("pantallaEstadisticas");
  if (!pantalla) return;

  const totalOperaciones = ventas.length;

  const totalUnidades = ventas.reduce((suma, venta) => {
    return suma + (venta.productos || []).reduce(
      (subtotal, producto) =>
        subtotal + Number(producto.cantidad || 0),
      0
    );
  }, 0);

  const totalCUP = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0),
    0
  );

  const totalUSD = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0),
    0
  );

  const totalSalario = ventas.reduce(
    (suma, venta) =>
      suma + Number(venta.salarioCUP || venta.salario || 0),
    0
  );

  // ------------------------------------------
  // VENTAS POR LUGAR
  // ------------------------------------------

  const lugares = [
    "Almacén",
    "Tienda",
    "Casa",
    "Sin especificar"
  ];

  const operacionesPorLugar = {};

  lugares.forEach(lugar => {
    operacionesPorLugar[lugar] = ventas.filter(venta =>
      (venta.lugarVenta || "Sin especificar") === lugar
    ).length;
  });

  const maxLugar = Math.max(
    1,
    ...Object.values(operacionesPorLugar)
  );

  const coloresLugares = [
    "#e87520",
    "#2878c8",
    "#29965b",
    "#888888"
  ];

  const graficoLugares = lugares.map((lugar, indice) => `
    <div style="margin:15px 0">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <strong>${escapar(lugar)}</strong>
        <strong>${operacionesPorLugar[lugar]} ventas</strong>
      </div>

      ${barraEstadistica(
        operacionesPorLugar[lugar],
        maxLugar,
        coloresLugares[indice]
      )}
    </div>
  `).join("");

  // ------------------------------------------
  // EVOLUCIÓN MENSUAL: CUP Y USD POR SEPARADO
  // ------------------------------------------

  const meses = [];

  const fechaActual = new Date();

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(
      fechaActual.getFullYear(),
      fechaActual.getMonth() - i,
      1
    );

    const clave = mesLocal(fecha);

    const nombre = fecha.toLocaleDateString("es", {
      month: "short",
      year: "numeric"
    });

    const ventasMes = ventas.filter(venta =>
      mesLocal(venta.fecha) === clave
    );

    const cup = ventasMes.reduce(
      (suma, venta) => suma + Number(venta.totalCUP || 0),
      0
    );

    const usd = ventasMes.reduce(
      (suma, venta) => suma + Number(venta.totalUSD || 0),
      0
    );

    meses.push({
      clave,
      nombre,
      cup,
      usd
    });
  }

  const maxCUP = Math.max(
    1,
    ...meses.map(mes => mes.cup)
  );

  const maxUSD = Math.max(
    1,
    ...meses.map(mes => mes.usd)
  );

  const graficoCUP = meses.map(mes => `
    <div style="margin:14px 0">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <span>${escapar(mes.nombre)}</span>
        <strong>${formato(mes.cup)} CUP</strong>
      </div>

      ${barraEstadistica(mes.cup, maxCUP, "#29965b")}
    </div>
  `).join("");

  const graficoUSD = meses.map(mes => `
    <div style="margin:14px 0">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <span>${escapar(mes.nombre)}</span>
        <strong>${formato(mes.usd)} USD</strong>
      </div>

      ${barraEstadistica(mes.usd, maxUSD, "#2878c8")}
    </div>
  `).join("");

  // ------------------------------------------
  // PRODUCTOS MÁS VENDIDOS
  // ------------------------------------------

  const unidadesPorProducto = {};

  ventas.forEach(venta => {
    (venta.productos || []).forEach(producto => {
      const nombre = producto.nombre || "Producto sin nombre";

      if (!unidadesPorProducto[nombre]) {
        unidadesPorProducto[nombre] = 0;
      }

      unidadesPorProducto[nombre] += Number(
        producto.cantidad || 0
      );
    });
  });

  const productosTop = Object.entries(unidadesPorProducto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxProducto = Math.max(
    1,
    ...productosTop.map(item => item[1])
  );

  const graficoProductos = productosTop.length
    ? productosTop.map(([nombre, cantidad], indice) => `
        <div style="margin:15px 0">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <strong>${indice + 1}. ${escapar(nombre)}</strong>
            <strong>${cantidad} unidades</strong>
          </div>

          ${barraEstadistica(cantidad, maxProducto, "#e87520")}
        </div>
      `).join("")
    : `
      <p class="texto-vacio">
        Todavía no hay productos vendidos.
      </p>
    `;

  // ------------------------------------------
  // CONSTRUIR PANTALLA
  // ------------------------------------------

  pantalla.innerHTML = `
    <span class="etiqueta">ANÁLISIS COMERCIAL</span>

    <h2 class="titulo-seccion">Estadísticas</h2>

    <div class="tarjeta">
      <h3>Indicadores generales</h3>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px">

        <div style="background:#f5f5f5;padding:14px;border-radius:9px">
          <p style="font-size:12px;color:#777">Operaciones</p>
          <h2>${totalOperaciones}</h2>
        </div>

        <div style="background:#f5f5f5;padding:14px;border-radius:9px">
          <p style="font-size:12px;color:#777">Unidades vendidas</p>
          <h2>${totalUnidades}</h2>
        </div>

        <div style="background:#f5f5f5;padding:14px;border-radius:9px">
          <p style="font-size:12px;color:#777">Ventas CUP</p>
          <h3 style="color:#29965b">${formato(totalCUP)}</h3>
        </div>

        <div style="background:#f5f5f5;padding:14px;border-radius:9px">
          <p style="font-size:12px;color:#777">Ventas USD</p>
          <h3 style="color:#2878c8">${formato(totalUSD)}</h3>
        </div>

        <div style="background:#f5f5f5;padding:14px;border-radius:9px;grid-column:1/-1">
          <p style="font-size:12px;color:#777">Salario acumulado</p>
          <h2 style="color:#29965b">${formato(totalSalario)} CUP</h2>
        </div>

      </div>
    </div>

    <div class="tarjeta">
      <h3>Ventas por lugar</h3>
      <p style="font-size:12px;color:#777;margin-top:5px">
        Cantidad de operaciones realizadas en cada ubicación.
      </p>

      ${graficoLugares}
    </div>

    <div class="tarjeta">
      <h3>Evolución mensual en CUP</h3>
      <p style="font-size:12px;color:#777;margin-top:5px">
        Últimos seis meses.
      </p>

      ${graficoCUP}
    </div>

    <div class="tarjeta">
      <h3>Evolución mensual en USD</h3>
      <p style="font-size:12px;color:#777;margin-top:5px">
        Últimos seis meses.
      </p>

      ${graficoUSD}
    </div>

    <div class="tarjeta">
      <h3>Productos más vendidos</h3>
      <p style="font-size:12px;color:#777;margin-top:5px">
        Clasificación por cantidad de unidades.
      </p>

      ${graficoProductos}
    </div>

    <button
      class="btn-principal"
      onclick="navegar('inicio')">
      Volver al inicio
    </button>
  `;
}

// ==========================================
// INICIAR APLICACIÓN
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  iniciarAplicacion
);
