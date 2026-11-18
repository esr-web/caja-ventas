
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
    return Object.fromEntries(DENOMINACIONES.map(d => [d, 0]));
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
    importe.textContent = formato(denominacion * cantidad) + " CUP";
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

  DENOMINACIONES.forEach(d => conteoEfectivo[d] = 0);

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
  return String(texto).replace(/[&<>"']/g, letra => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[letra]);
}

function fechaLocal() {
  const ahora = new Date();
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

function mesLocal() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(
    ahora.getMonth() + 1
  ).padStart(2, "0")}`;
}

function mostrarFecha(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "Fecha no disponible";

  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function precioProducto(producto, moneda) {
  if (moneda === "USD") return Number(producto.precioUSD ?? 0);
  return Number(producto.precioCUP ?? producto.precio ?? 0);
}

function precioCUPProducto(producto) {
  return Number(producto?.precioCUP ?? producto?.precio ?? 0);
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
  if (!venta.moneda) venta.moneda = "CUP";

  const lugaresValidos = ["Almacén", "Tienda", "Casa"];

  if (!lugaresValidos.includes(venta.lugarVenta)) {
    venta.lugarVenta = "Sin especificar";
  }

  venta.productos = (venta.productos || []).map(item => {
    const precioAntiguo = Number(item.precio || 0);

    const catalogo = productos.find(
      p => String(p.id) === String(item.productoId)
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

    return { ...item, precioCUP, precioUSD };
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
    if (elemento) elemento.classList.toggle("activa", nombre === destino);
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
    if (elemento) elemento.classList.toggle("activo", nombre === destino);
  });

  if (destino === "caja") mostrarCaja();
  if (destino === "productos") mostrarProductos();
  if (destino === "registro") mostrarRegistro();
  if (destino === "efectivo") mostrarConteoEfectivo();
  if (destino === "estadisticas") mostrarEstadisticas();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// PRODUCTOS
// ==========================================

function mostrarProductos() {
  const pantalla = document.getElementById("pantallaProductos");
  if (!pantalla) return;

  pantalla.innerHTML = `
    <div class="encabezado-pantalla">
      <h2>Productos</h2>
      <p>Administra el catálogo de productos.</p>
    </div>

    <div class="tarjeta">
      <h3 id="tituloFormularioProducto">Agregar producto</h3>

      <input type="hidden" id="productoId">

      <label for="nombreProducto">Nombre del producto</label>
      <input id="nombreProducto" type="text" placeholder="Nombre">

      <label for="descripcionProducto">Descripción</label>
      <input id="descripcionProducto" type="text" placeholder="Descripción">

      <label for="precioCUP">Precio en CUP</label>
      <input id="precioCUP" type="number" min="0" step="0.01" placeholder="0">

      <label for="precioUSD">Precio en USD</label>
      <input id="precioUSD" type="number" min="0" step="0.01" placeholder="0">

      <div class="acciones-formulario">
        <button onclick="guardarProducto()">Guardar producto</button>
        <button onclick="cancelarEdicion()" class="boton-secundario">Cancelar</button>
      </div>
    </div>

    <div class="tarjeta">
      <h3>Catálogo</h3>
      <div id="catalogoProductos"></div>
    </div>
  `;

  dibujarCatalogo();
}

function dibujarCatalogo() {
  const contenedor = document.getElementById("catalogoProductos");
  if (!contenedor) return;

  if (!productos.length) {
    contenedor.innerHTML = "<p>No hay productos registrados.</p>";
    return;
  }

  contenedor.innerHTML = productos.map(producto => `
    <div class="producto-item">
      <div>
        <strong>${escapar(producto.nombre)}</strong>
        <p>${escapar(producto.descripcion || "")}</p>
        <p>CUP: ${formato(producto.precioCUP || 0)}</p>
        <p>USD: ${formato(producto.precioUSD || 0)}</p>
      </div>

      <div class="acciones-producto">
        <button onclick="editarProducto('${producto.id}')">Editar</button>
        <button onclick="eliminarProducto('${producto.id}')">Eliminar</button>
      </div>
    </div>
  `).join("");
}

async function guardarProducto() {
  const nombre = document.getElementById("nombreProducto")?.value.trim();
  const descripcion = document.getElementById("descripcionProducto")?.value.trim() || "";
  const precioCUP = Number(document.getElementById("precioCUP")?.value || 0);
  const precioUSD = Number(document.getElementById("precioUSD")?.value || 0);
  const id = document.getElementById("productoId")?.value;

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    return;
  }

  if (precioCUP < 0 || precioUSD < 0 || (!precioCUP && !precioUSD)) {
    alert("Introduce al menos un precio válido.");
    return;
  }

  const producto = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    nombre,
    descripcion,
    precioCUP,
    precioUSD
  };

  try {
    await guardarRegistro("productos", producto);

    const indice = productos.findIndex(p => String(p.id) === String(producto.id));

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
  const producto = productos.find(p => String(p.id) === String(id));
  if (!producto) return;

  document.getElementById("productoId").value = producto.id;
  document.getElementById("nombreProducto").value = producto.nombre || "";
  document.getElementById("descripcionProducto").value = producto.descripcion || "";
  document.getElementById("precioCUP").value = producto.precioCUP || 0;
  document.getElementById("precioUSD").value = producto.precioUSD || 0;
  document.getElementById("tituloFormularioProducto").textContent = "Editar producto";

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
  if (titulo) titulo.textContent = "Agregar producto";
}

async function eliminarProducto(id) {
  const producto = productos.find(p => String(p.id) === String(id));
  if (!producto) return;

  if (!confirm(`¿Eliminar el producto "${producto.nombre}"?`)) return;

  try {
    await eliminarRegistro("productos", id);
    productos = productos.filter(p => String(p.id) !== String(id));
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
  const fecha = fechaLocal(ahora);

  pantalla.innerHTML = `
    <div class="encabezado-pantalla">
      <h2>Caja de ventas</h2>
      <p>Registra las operaciones de venta.</p>
    </div>

    <div class="tarjeta">
      <h3>Moneda de venta</h3>

      <div class="selector-moneda">
        <button
          class="${monedaVenta === "CUP" ? "activo" : ""}"
          onclick="cambiarMonedaVenta('CUP')">
          CUP
        </button>

        <button
          class="${monedaVenta === "USD" ? "activo" : ""}"
          onclick="cambiarMonedaVenta('USD')">
          USD
        </button>
      </div>
    </div>

    <div class="tarjeta">
      <h3>Datos de la venta</h3>

      <label for="fechaVenta">Fecha y hora</label>
      <input
        type="datetime-local"
        id="fechaVenta"
        value="${fecha}T${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}">

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
      <h3>Productos disponibles</h3>

      <input
        type="search"
        id="buscarProductoCaja"
        placeholder="Buscar producto..."
        oninput="dibujarProductosCaja()">

      <div id="productosCaja"></div>
    </div>

    <div class="tarjeta">
      <h3>Carrito de venta</h3>
      <div id="carritoVenta"></div>
      <div id="resumenVenta"></div>

      <button class="boton-principal" onclick="registrarVenta()">
        Registrar venta
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
    contenedor.innerHTML = "<p>No se encontraron productos.</p>";
    return;
  }

  contenedor.innerHTML = lista.map(producto => {
    const precio = precioProducto(producto, monedaVenta);

    return `
      <div class="producto-item">
        <div>
          <strong>${escapar(producto.nombre)}</strong>
          <p>${formato(precio)} ${monedaVenta}</p>
        </div>

        <button onclick="cambiarCantidad('${producto.id}', 1)">
          Agregar
        </button>
      </div>
    `;
  }).join("");
}

function cambiarCantidad(id, cambio) {
  const producto = productos.find(p => String(p.id) === String(id));
  if (!producto) return;

  let linea = carrito.find(p => String(p.id) === String(id));

  if (!linea && cambio > 0) {
    linea = {
      id: producto.id,
      nombre: producto.nombre,
      cantidad: 0,
      precioCUP: Number(producto.precioCUP || 0),
      precioUSD: Number(producto.precioUSD || 0)
    };

    carrito.push(linea);
  }

  if (!linea) return;

  linea.cantidad += cambio;

  if (linea.cantidad <= 0) {
    carrito = carrito.filter(p => String(p.id) !== String(id));
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
      subtotalCUP: precioEnCUP * item.cantidad
    };
  });

  const salarioCUP = totalCUP * porcentaje / 100;

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
    contenedorCarrito.innerHTML = "<p>El carrito está vacío.</p>";
  } else {
    contenedorCarrito.innerHTML = carrito.map(item => {
      const precio = precioProducto(item, monedaVenta);

      return `
        <div class="producto-item">
          <div>
            <strong>${escapar(item.nombre)}</strong>
            <p>${formato(precio)} ${monedaVenta} x ${item.cantidad}</p>
            <p>Subtotal: ${formato(precio * item.cantidad)} ${monedaVenta}</p>
          </div>

          <div class="acciones-producto">
            <button onclick="cambiarCantidad('${item.id}', -1)">−</button>
            <strong>${item.cantidad}</strong>
            <button onclick="cambiarCantidad('${item.id}', 1)">+</button>
          </div>
        </div>
      `;
    }).join("");
  }

  contenedorResumen.innerHTML = `
    <div class="resumen-linea">
      <span>Total de venta:</span>
      <strong>${formato(calculo.total)} ${monedaVenta}</strong>
    </div>

    <div class="resumen-linea">
      <span>Base para salario en CUP:</span>
      <strong>${formato(calculo.totalCUP)} CUP</strong>
    </div>

    <div class="resumen-linea">
      <span>Salario (${formato(calculo.porcentaje)}%):</span>
      <strong>${formato(calculo.salarioCUP)} CUP</strong>
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

  if (!fecha) {
    alert("Selecciona la fecha y hora de la venta.");
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

  if (calculo.total <= 0) {
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
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    fecha: new Date(fecha).toISOString(),
    lugarVenta,
    moneda: monedaVenta,
    productos: calculo.lineas,
    total: calculo.total,
    salario: calculo.salarioCUP,
    porcentaje: calculo.porcentaje,
    totalUSD: monedaVenta === "USD" ? calculo.total : 0,
    totalCUP: monedaVenta === "CUP" ? calculo.total : 0,
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
    <div class="encabezado-pantalla">
      <h2>Registro de ventas</h2>
      <p>Consulta, filtra y administra las ventas realizadas.</p>
    </div>

    <div class="tarjeta">
      <h3>Filtros de búsqueda</h3>

      <label for="filtroPeriodo">Período</label>
      <select id="filtroPeriodo" onchange="actualizarVisibilidadFiltros(); actualizarRegistro();">
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

      <div class="acciones-formulario">
        <button onclick="limpiarFiltrosRegistro()" class="boton-secundario">
          Limpiar filtros
        </button>

        <button onclick="exportarRegistroPDF()">
          Exportar PDF
        </button>
      </div>
    </div>

    <div class="tarjeta">
      <h3>Resumen de todas las ventas</h3>
      <div id="resumenCompletoVentas"></div>
    </div>

    <div class="tarjeta">
      <h3>Resultados del filtro</h3>
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
    (suma, venta) => suma + Number(venta.totalCUP || 0), 0
  );

  const totalUSD = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0), 0
  );

  const salarioCUP = ventas.reduce(
    (suma, venta) => suma + Number(venta.salarioCUP || venta.salario || 0), 0
  );

  const unidades = ventas.reduce((suma, venta) => {
    return suma + (venta.productos || []).reduce(
      (subtotal, producto) => subtotal + Number(producto.cantidad || 0), 0
    );
  }, 0);

  contenedor.innerHTML = `
    <div class="resumen-linea">
      <span>Operaciones registradas:</span>
      <strong>${ventas.length}</strong>
    </div>

    <div class="resumen-linea">
      <span>Unidades vendidas:</span>
      <strong>${unidades}</strong>
    </div>

    <div class="resumen-linea">
      <span>Total vendido en CUP:</span>
      <strong>${formato(totalCUP)} CUP</strong>
    </div>

    <div class="resumen-linea">
      <span>Total vendido en USD:</span>
      <strong>${formato(totalUSD)} USD</strong>
    </div>

    <div class="resumen-linea">
      <span>Salario acumulado:</span>
      <strong>${formato(salarioCUP)} CUP</strong>
    </div>
  `;
}

// ==========================================
// VISIBILIDAD DE FILTROS DE FECHA
// ==========================================

function actualizarVisibilidadFiltros() {
  const periodo = document.getElementById("filtroPeriodo")?.value || "todo";
  const contenedor = document.getElementById("filtrosFecha");

  if (!contenedor) return;

  const hoy = fechaLocal(new Date());
  const mes = mesLocal(new Date());
  const anio = new Date().getFullYear();

  if (periodo === "dia") {
    contenedor.innerHTML = `
      <label for="fechaFiltro">Seleccionar día</label>
      <input
        type="date"
        id="fechaFiltro"
        value="${hoy}"
        onchange="actualizarRegistro()">
    `;
  } else if (periodo === "mes") {
    contenedor.innerHTML = `
      <label for="mesFiltro">Seleccionar mes</label>
      <input
        type="month"
        id="mesFiltro"
        value="${mes}"
        onchange="actualizarRegistro()">
    `;
  } else if (periodo === "anio") {
    contenedor.innerHTML = `
      <label for="anioFiltro">Seleccionar año</label>
      <input
        type="number"
        id="anioFiltro"
        value="${anio}"
        min="2000"
        max="2100"
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
  const ids = [
    "filtroPeriodo",
    "filtroProducto",
    "filtroMoneda",
    "filtroLugar",
    "filtroMinimo",
    "filtroMaximo"
  ];

  ids.forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = id === "filtroPeriodo" ? "todo" : "";
  });

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

  const fechaDia = document.getElementById("fechaFiltro")?.value || "";
  const fechaMes = document.getElementById("mesFiltro")?.value || "";
  const anio = document.getElementById("anioFiltro")?.value || "";
  const desde = document.getElementById("fechaDesde")?.value || "";
  const hasta = document.getElementById("fechaHasta")?.value || "";

  let filtradas = ventas.filter(venta => {
    const fecha = new Date(venta.fecha);
    const diaVenta = fechaLocal(fecha);
    const mesVenta = mesLocal(fecha);
    const anioVenta = String(fecha.getFullYear());

    if (periodo === "dia" && fechaDia && diaVenta !== fechaDia) return false;
    if (periodo === "mes" && fechaMes && mesVenta !== fechaMes) return false;
    if (periodo === "anio" && anio && anioVenta !== String(anio)) return false;

    if (periodo === "rango") {
      if (desde && diaVenta < desde) return false;
      if (hasta && diaVenta > hasta) return false;
    }

    if (monedaFiltro && venta.moneda !== monedaFiltro) return false;

    const lugar = venta.lugarVenta || "Sin especificar";
    if (lugarFiltro && lugar !== lugarFiltro) return false;

    if (productoFiltro) {
      const contieneProducto = (venta.productos || []).some(
        producto => String(producto.id) === String(productoFiltro)
      );

      if (!contieneProducto) return false;
    }

    const importe = Number(venta.total || 0);

    if (minimo !== null && importe < minimo) return false;
    if (maximo !== null && importe > maximo) return false;

    return true;
  });

  filtradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const totalCUP = filtradas.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0), 0
  );

  const totalUSD = filtradas.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0), 0
  );

  const salarioCUP = filtradas.reduce(
    (suma, venta) => suma + Number(venta.salarioCUP || venta.salario || 0), 0
  );

  const unidades = filtradas.reduce((suma, venta) => {
    return suma + (venta.productos || []).reduce(
      (subtotal, producto) => subtotal + Number(producto.cantidad || 0), 0
    );
  }, 0);

  const resumen = `
    <div class="resumen-linea">
      <span>Operaciones:</span>
      <strong>${filtradas.length}</strong>
    </div>

    <div class="resumen-linea">
      <span>Unidades vendidas:</span>
      <strong>${unidades}</strong>
    </div>

    <div class="resumen-linea">
      <span>Total CUP:</span>
      <strong>${formato(totalCUP)} CUP</strong>
    </div>

    <div class="resumen-linea">
      <span>Total USD:</span>
      <strong>${formato(totalUSD)} USD</strong>
    </div>

    <div class="resumen-linea">
      <span>Salario:</span>
      <strong>${formato(salarioCUP)} CUP</strong>
    </div>
  `;

  if (!filtradas.length) {
    contenedor.innerHTML = `
      ${resumen}
      <p>No hay ventas que coincidan con los filtros.</p>
    `;
    return;
  }

  contenedor.innerHTML = `
    ${resumen}

    <hr>

    ${filtradas.map(venta => {
      const fecha = new Date(venta.fecha);
      const lugar = venta.lugarVenta || "Sin especificar";

      const detalleProductos = (venta.productos || []).map(producto => `
        <div class="detalle-producto-venta">
          ${escapar(producto.nombre)}
          — ${Number(producto.cantidad || 0)} unidades
          — ${formato(producto.subtotal ?? (
            Number(producto.precio || 0) * Number(producto.cantidad || 0)
          ))} ${venta.moneda}
        </div>
      `).join("");

      return `
        <div class="venta-item">
          <div class="venta-encabezado">
            <strong>${mostrarFecha(fecha)}</strong>
            <span>${venta.moneda}</span>
          </div>

          <p><strong>Lugar de venta:</strong> ${escapar(lugar)}</p>

          <div class="detalle-venta">
            ${detalleProductos}
          </div>

          <div class="resumen-linea">
            <span>Total:</span>
            <strong>${formato(venta.total)} ${venta.moneda}</strong>
          </div>

          <div class="resumen-linea">
            <span>Salario:</span>
            <strong>${formato(venta.salarioCUP || venta.salario || 0)} CUP</strong>
          </div>

          <button
            class="boton-eliminar"
            onclick="eliminarVenta('${venta.id}')">
            Eliminar venta
          </button>
        </div>
      `;
    }).join("")}
  `;
}

// ==========================================
// EXPORTAR REGISTRO A PDF
// ==========================================

function exportarRegistroPDF() {
  const contenido = document.getElementById("resultadosRegistro");

  if (!contenido || !contenido.innerHTML.trim()) {
    alert("No hay información para exportar.");
    return;
  }

  const ventana = window.open("", "_blank");

  if (!ventana) {
    alert("Permite las ventanas emergentes para exportar el PDF.");
    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Registro de ventas</title>

      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 25px;
          color: #222;
        }

        h1 {
          text-align: center;
        }

        .venta-item {
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 15px;
          break-inside: avoid;
        }

        .resumen-linea,
        .venta-encabezado {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin: 7px 0;
        }

        .detalle-producto-venta {
          margin: 5px 0;
        }

        button {
          display: none !important;
        }

        hr {
          margin: 20px 0;
        }

        @media print {
          body {
            padding: 0;
          }
        }
      </style>
    </head>

    <body>
      <h1>REGISTRO DE VENTAS</h1>
      <p>Fecha de impresión: ${new Date().toLocaleString("es")}</p>

      ${contenido.innerHTML}

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
  const venta = ventas.find(v => String(v.id) === String(id));
  if (!venta) return;

  if (!confirm("¿Estás seguro de que deseas eliminar esta venta?")) {
    return;
  }

  try {
    await eliminarRegistro("ventas", id);

    ventas = ventas.filter(v => String(v.id) !== String(id));

    mostrarResumenVentas();
    actualizarRegistro();

    alert("Venta eliminada correctamente.");
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar la venta.");
  }
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

function barraEstadistica(valor, maximo, color) {
  const porcentaje = maximo > 0
    ? Math.max(0, Math.min(100, valor / maximo * 100))
    : 0;

  return `
    <div style="
      width:100%;
      height:12px;
      background:#e8e8e8;
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

function mostrarEstadisticas() {
  const pantalla = document.getElementById("pantallaEstadisticas");
  if (!pantalla) return;

  const totalOperaciones = ventas.length;

  const totalUnidades = ventas.reduce((suma, venta) => {
    return suma + (venta.productos || []).reduce(
      (subtotal, producto) =>
        subtotal + Number(producto.cantidad || 0), 0
    );
  }, 0);

  const totalCUP = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0), 0
  );

  const totalUSD = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0), 0
  );

  const salarioCUP = ventas.reduce(
    (suma, venta) =>
      suma + Number(venta.salarioCUP || venta.salario || 0), 0
  );

  // ------------------------------------------
  // VENTAS POR LUGAR
  // ------------------------------------------

  const lugares = ["Almacén", "Tienda", "Casa", "Sin especificar"];

  const ventasPorLugar = lugares.map(lugar => ({
    nombre: lugar,
    cantidad: ventas.filter(
      venta => (venta.lugarVenta || "Sin especificar") === lugar
    ).length
  }));

  const maxLugar = Math.max(
    1,
    ...ventasPorLugar.map(item => item.cantidad)
  );

  const graficoLugares = ventasPorLugar.map(item => `
    <div style="margin:16px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <strong>${item.nombre}</strong>
        <strong>${item.cantidad} ventas</strong>
      </div>

      ${barraEstadistica(item.cantidad, maxLugar, "#ef8b24")}
    </div>
  `).join("");

  // ------------------------------------------
  // EVOLUCIÓN MENSUAL DE LOS ÚLTIMOS 6 MESES
  // ------------------------------------------

  const meses = [];

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date();
    fecha.setDate(1);
    fecha.setMonth(fecha.getMonth() - i);

    const clave = mesLocal(fecha);

    meses.push({
      clave,
      nombre: fecha.toLocaleDateString("es", {
        month: "short",
        year: "2-digit"
      }),
      cup: 0,
      usd: 0
    });
  }

  ventas.forEach(venta => {
    const fecha = new Date(venta.fecha);
    const clave = mesLocal(fecha);

    const mes = meses.find(item => item.clave === clave);
    if (!mes) return;

    mes.cup += Number(venta.totalCUP || 0);
    mes.usd += Number(venta.totalUSD || 0);
  });

  const maxCUP = Math.max(1, ...meses.map(m => m.cup));
  const maxUSD = Math.max(1, ...meses.map(m => m.usd));

  const graficoCUP = meses.map(mes => `
    <div style="margin:14px 0;">
      <div style="display:flex;justify-content:space-between;">
        <strong>${mes.nombre}</strong>
        <strong>${formato(mes.cup)} CUP</strong>
      </div>

      ${barraEstadistica(mes.cup, maxCUP, "#269b65")}
    </div>
  `).join("");

  const graficoUSD = meses.map(mes => `
    <div style="margin:14px 0;">
      <div style="display:flex;justify-content:space-between;">
        <strong>${mes.nombre}</strong>
        <strong>${formato(mes.usd)} USD</strong>
      </div>

      ${barraEstadistica(mes.usd, maxUSD, "#3979c6")}
    </div>
  `).join("");

  // ------------------------------------------
  // PRODUCTOS MÁS VENDIDOS
  // ------------------------------------------

  const rankingProductos = {};

  ventas.forEach(venta => {
    (venta.productos || []).forEach(producto => {
      const clave = String(producto.id || producto.nombre);

      if (!rankingProductos[clave]) {
        rankingProductos[clave] = {
          nombre: producto.nombre || "Producto",
          cantidad: 0
        };
      }

      rankingProductos[clave].cantidad += Number(
        producto.cantidad || 0
      );
    });
  });

  const mejoresProductos = Object.values(rankingProductos)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const maxProducto = Math.max(
    1,
    ...mejoresProductos.map(p => p.cantidad)
  );

  const graficoProductos = mejoresProductos.length
    ? mejoresProductos.map((producto, indice) => `
        <div style="margin:16px 0;">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <strong>${indice + 1}. ${escapar(producto.nombre)}</strong>
            <strong>${producto.cantidad} unidades</strong>
          </div>

          ${barraEstadistica(
            producto.cantidad,
            maxProducto,
            "#8b62bd"
          )}
        </div>
      `).join("")
    : "<p>Todavía no hay productos vendidos.</p>";

  // ------------------------------------------
  // MOSTRAR ESTADÍSTICAS
  // ------------------------------------------

  pantalla.innerHTML = `
    <div class="encabezado-pantalla">
      <h2>Estadísticas</h2>
      <p>Indicadores y comportamiento de las ventas.</p>
    </div>

    <div class="tarjeta">
      <h3>Indicadores generales</h3>

      <div class="resumen-linea">
        <span>Operaciones realizadas:</span>
        <strong>${totalOperaciones}</strong>
      </div>

      <div class="resumen-linea">
        <span>Unidades vendidas:</span>
        <strong>${totalUnidades}</strong>
      </div>

      <div class="resumen-linea">
        <span>Ventas en CUP:</span>
        <strong>${formato(totalCUP)} CUP</strong>
      </div>

      <div class="resumen-linea">
        <span>Ventas en USD:</span>
        <strong>${formato(totalUSD)} USD</strong>
      </div>

      <div class="resumen-linea">
        <span>Salario acumulado:</span>
        <strong>${formato(salarioCUP)} CUP</strong>
      </div>
    </div>

    <div class="tarjeta">
      <h3>Ventas por lugar</h3>
      <p>Cantidad de operaciones según el lugar de venta.</p>

      ${graficoLugares}
    </div>

    <div class="tarjeta">
      <h3>Evolución de ventas en CUP</h3>
      <p>Comparación de los últimos seis meses.</p>

      ${graficoCUP}
    </div>

    <div class="tarjeta">
      <h3>Evolución de ventas en USD</h3>
      <p>Comparación de los últimos seis meses.</p>

      ${graficoUSD}
    </div>

    <div class="tarjeta">
      <h3>Productos más vendidos</h3>
      <p>Clasificación según unidades vendidas.</p>

      ${graficoProductos}
    </div>

    <button
      class="boton-principal"
      onclick="navegar('inicio')">
      Volver al inicio
    </button>
  `;
}

// ==========================================
// INICIAR APLICACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", iniciarAplicacion);
