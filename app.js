
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
    const guardado = localStorage.getItem(CLAVE_CONTEO_EFECTIVO);
    const datos = guardado ? JSON.parse(guardado) : {};

    const resultado = {};

    DENOMINACIONES.forEach(denominacion => {
      const cantidad = Number(datos[denominacion] || 0);

      resultado[denominacion] =
        Number.isFinite(cantidad) && cantidad >= 0
          ? Math.floor(cantidad)
          : 0;
    });

    return resultado;

  } catch (error) {
    console.error("Error al recuperar el conteo:", error);

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
  return DENOMINACIONES.reduce((total, denominacion) => {
    return total +
      denominacion * Number(conteoEfectivo[denominacion] || 0);
  }, 0);
}

function actualizarCantidadBilletes(denominacion, valor) {
  const cantidad = Number(valor);

  if (
    !Number.isFinite(cantidad) ||
    cantidad < 0 ||
    !Number.isInteger(cantidad)
  ) {
    return;
  }

  conteoEfectivo[denominacion] = cantidad;

  guardarConteoEfectivo();

  const importe = denominacion * cantidad;

  const resultado = document.getElementById(
    `importeBillete${denominacion}`
  );

  if (resultado) {
    resultado.textContent = formato(importe) + " CUP";
  }

  const total = document.getElementById("totalConteoEfectivo");

  if (total) {
    total.textContent = formato(calcularTotalEfectivo()) + " CUP";
  }
}

function limpiarConteoEfectivo() {
  if (!confirm(
    "¿Deseas borrar todas las cantidades del conteo de efectivo?\n\n" +
    "Esta acción no se puede deshacer."
  )) {
    return;
  }

  DENOMINACIONES.forEach(denominacion => {
    conteoEfectivo[denominacion] = 0;
  });

  guardarConteoEfectivo();
  mostrarConteoEfectivo();

  alert("El conteo de efectivo ha sido limpiado.");
}

function mostrarConteoEfectivo() {
  const pantalla = document.getElementById("pantallaEfectivo");
  if (!pantalla) return;

  const filas = DENOMINACIONES.map(denominacion => {
    const cantidad = conteoEfectivo[denominacion] || 0;
    const importe = denominacion * cantidad;

    return `
      <div class="tarjeta" style="
        display:grid;
        grid-template-columns:1fr 100px;
        gap:12px;
        align-items:center;
        margin-bottom:10px;
      ">

        <div>
          <strong style="font-size:17px">
            ${formato(denominacion)} CUP
          </strong>

          <div style="
            font-size:12px;
            color:#777;
            margin-top:7px;
          ">
            Importe:
          </div>

          <strong
            id="importeBillete${denominacion}"
            style="color:#16834a;font-size:14px"
          >
            ${formato(importe)} CUP
          </strong>
        </div>

        <div>
          <label
            for="billete${denominacion}"
            style="font-size:11px"
          >
            Cantidad
          </label>

          <input
            id="billete${denominacion}"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            value="${cantidad}"
            oninput="actualizarCantidadBilletes(${denominacion},this.value)"
            style="
              width:100%;
              text-align:center;
              font-size:18px;
              font-weight:bold;
            "
          >
        </div>

      </div>
    `;
  }).join("");

  pantalla.innerHTML = `
    <span class="etiqueta">CONTROL DE DINERO</span>

    <h2 class="titulo-seccion">Conteo de efectivo</h2>

    <div class="tarjeta" style="
      background:#151515;
      color:white;
      margin-bottom:18px;
    ">
      <div style="
        color:#f28c28;
        font-size:11px;
        font-weight:bold;
        letter-spacing:1px;
      ">
        TOTAL DE EFECTIVO
      </div>

      <div
        id="totalConteoEfectivo"
        style="
          font-size:30px;
          font-weight:bold;
          margin-top:12px;
        "
      >
        ${formato(calcularTotalEfectivo())} CUP
      </div>

      <p style="
        color:#bbb;
        font-size:12px;
        margin-top:8px;
      ">
        Suma de todos los billetes contabilizados.
      </p>
    </div>

    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin:20px 0 13px;
    ">
      <h3>Denominación de billetes</h3>
      <span style="font-size:11px;color:#777">
        CUP
      </span>
    </div>

    ${filas}

    <div class="tarjeta" style="
      background:#151515;
      color:white;
      margin-top:18px;
    ">
      <div style="
        color:#f28c28;
        font-size:11px;
        font-weight:bold;
        letter-spacing:1px;
      ">
        TOTAL GENERAL
      </div>

      <div
        id="totalConteoEfectivo"
        style="
          font-size:30px;
          font-weight:bold;
          margin-top:10px;
        "
      >
        ${formato(calcularTotalEfectivo())} CUP
      </div>
    </div>

    <button
      class="btn-peligro"
      style="width:100%;margin:15px 0 25px"
      onclick="limpiarConteoEfectivo()"
    >
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
  if (moneda === "USD") {
    return Number(producto.precioUSD ?? 0);
  }

  return Number(producto.precioCUP ?? producto.precio ?? 0);
}

function precioCUPProducto(producto) {
  return Number(producto?.precioCUP ?? producto?.precio ?? 0);
}

function simboloMoneda(moneda) {
  return moneda === "USD" ? "USD" : "CUP";
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

  venta.productos = (venta.productos || []).map(item => {
    const precioAntiguo = Number(item.precio || 0);
    const productoCatalogo = productos.find(
      p => String(p.id) === String(item.productoId)
    );

    let precioCUP = Number(item.precioCUP || 0);

    if (precioCUP <= 0 && venta.moneda === "USD") {
      precioCUP = precioCUPProducto(productoCatalogo);
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

  const salarioCalculadoCUP = venta.productos.reduce(
    (suma, item) =>
      suma +
      Number(item.precioCUP || 0) *
      Number(item.cantidad || 0) *
      porcentaje / 100,
    0
  );

  venta.salarioCUP = salarioCalculadoCUP;
  venta.salarioUSD = 0;
  venta.salario = salarioCalculadoCUP;

  return venta;
}

// ==========================================
// CÁLCULO DEL SALARIO EN CUP
// ==========================================

function calcularSalarioLineasCUP(lineas, porcentaje) {
  return lineas.reduce((suma, item) => {
    const precioCUP = Number(item.precioCUP || 0);
    const cantidad = Number(item.cantidad || 0);

    return suma + precioCUP * cantidad * porcentaje / 100;
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
      console.warn("No se pudo solicitar almacenamiento persistente.", error);
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
    efectivo: "pantallaEfectivo"
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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// SECCIÓN PRODUCTOS
// ==========================================

function mostrarProductos() {
  const pantalla = document.getElementById("pantallaProductos");

  const productoActual = productoEnEdicion !== null
    ? productos.find(p => p.id === productoEnEdicion)
    : null;

  pantalla.innerHTML = `
    <span class="etiqueta">CATÁLOGO</span>
    <h2 class="titulo-seccion">Productos</h2>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">
        ${productoActual ? "Editar producto" : "Agregar producto"}
      </h3>

      <label for="nombreProducto">Nombre del producto</label>
      <input
        id="nombreProducto"
        type="text"
        placeholder="Ej. Arroz"
        value="${escapar(productoActual?.nombre || "")}"
      >

      <label for="precioProductoUSD">Precio unitario (USD)</label>
      <input
        id="precioProductoUSD"
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value="${productoActual?.precioUSD || ""}"
      >

      <label for="precioProductoCUP">Precio unitario (CUP)</label>
      <input
        id="precioProductoCUP"
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value="${productoActual?.precioCUP || ""}"
      >

      <p style="font-size:12px;color:#777;margin:-5px 0 14px">
        Puedes registrar un precio en una sola moneda o en ambas.
        Al menos uno debe ser mayor que cero.
      </p>

      <button class="btn-principal" onclick="guardarProducto()">
        ${productoActual ? "GUARDAR CAMBIOS" : "+ AGREGAR PRODUCTO"}
      </button>

      ${
        productoActual
          ? `<button class="btn-secundario"
              style="width:100%;margin-top:10px"
              onclick="cancelarEdicion()">Cancelar edición</button>`
          : ""
      }
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:22px 0 13px">
      <h3>Mi catálogo</h3>
      <span style="color:#777;font-size:12px">${productos.length} productos</span>
    </div>

    <div id="listaCatalogo"></div>
  `;

  dibujarCatalogo();
}

function dibujarCatalogo() {
  const lista = document.getElementById("listaCatalogo");
  if (!lista) return;

  if (productos.length === 0) {
    lista.innerHTML = `
      <div class="tarjeta texto-vacio">
        Todavía no tienes productos registrados.
        <br>Agrega el primero utilizando el formulario.
      </div>
    `;
    return;
  }

  lista.innerHTML = productos.map(producto => `
    <div class="producto">
      <div class="producto-info">
        <h3>${escapar(producto.nombre)}</h3>
        <div class="precio">${formato(producto.precioUSD)} USD</div>
        <div class="precio">${formato(producto.precioCUP)} CUP</div>
      </div>

      <button class="btn-secundario"
        onclick="editarProducto(${producto.id})"
        aria-label="Editar producto">✎</button>

      <button class="btn-peligro"
        onclick="eliminarProducto(${producto.id})"
        aria-label="Eliminar producto">×</button>
    </div>
  `).join("");
}

async function guardarProducto() {
  const nombre = document.getElementById("nombreProducto").value.trim();

  const precioUSD = Number(
    document.getElementById("precioProductoUSD").value || 0
  );

  const precioCUP = Number(
    document.getElementById("precioProductoCUP").value || 0
  );

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    return;
  }

  if (
    !Number.isFinite(precioUSD) ||
    !Number.isFinite(precioCUP) ||
    precioUSD < 0 ||
    precioCUP < 0 ||
    (precioUSD === 0 && precioCUP === 0)
  ) {
    alert("Introduce al menos un precio válido mayor que cero.");
    return;
  }

  try {
    if (productoEnEdicion !== null) {
      const producto = productos.find(
        p => p.id === productoEnEdicion
      );

      if (!producto) return;

      producto.nombre = nombre;
      producto.precioUSD = precioUSD;
      producto.precioCUP = precioCUP;
      producto.precio = precioCUP;

      await guardarDato("productos", producto);

      carrito.forEach(item => {
        if (item.productoId === producto.id) {
          item.nombre = nombre;
          item.precio = precioProducto(producto, monedaVenta);
          item.precioCUP = precioCUP;
        }
      });

      productoEnEdicion = null;
      alert("Producto actualizado correctamente.");

    } else {
      const nuevo = {
        nombre,
        precioUSD,
        precioCUP,
        precio: precioCUP
      };

      nuevo.id = await guardarDato("productos", nuevo);
      productos.push(nuevo);

      alert("Producto agregado correctamente.");
    }

    mostrarProductos();

  } catch (error) {
    alert("No se pudo guardar el producto.");
    console.error(error);
  }
}

function editarProducto(id) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  productoEnEdicion = id;
  mostrarProductos();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicion() {
  productoEnEdicion = null;
  mostrarProductos();
}

async function eliminarProducto(id) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  if (!confirm(
    `¿Eliminar "${producto.nombre}" del catálogo?\n\n` +
    "Las ventas anteriores no se eliminarán."
  )) return;

  try {
    await eliminarDato("productos", id);

    productos = productos.filter(p => p.id !== id);
    carrito = carrito.filter(p => p.productoId !== id);

    if (productoEnEdicion === id) {
      productoEnEdicion = null;
    }

    mostrarProductos();

  } catch (error) {
    alert("No se pudo eliminar el producto.");
    console.error(error);
  }
}

// ==========================================
// SECCIÓN CAJA
// ==========================================

function mostrarCaja() {
  const pantalla = document.getElementById("pantallaCaja");

  pantalla.innerHTML = `
    <span class="etiqueta">NUEVA OPERACIÓN</span>
    <h2 class="titulo-seccion">Caja de ventas</h2>

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Moneda de la venta</h3>

      <label for="monedaSeleccionada">Seleccionar moneda</label>
      <select id="monedaSeleccionada"
        onchange="cambiarMonedaVenta(this.value)">
        <option value="CUP" ${monedaVenta === "CUP" ? "selected" : ""}>CUP</option>
        <option value="USD" ${monedaVenta === "USD" ? "selected" : ""}>USD</option>
      </select>

      <p style="font-size:12px;color:#777">
        Se utilizará el precio del producto correspondiente a esta moneda.
        El salario siempre se calcula utilizando el precio CUP.
      </p>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Seleccionar productos</h3>

      <input
        id="buscarProductoCaja"
        type="search"
        placeholder="Buscar producto..."
        oninput="dibujarProductosCaja()"
      >

      <div id="listaProductosCaja"></div>
    </div>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Datos de la venta</h3>

      <label for="fechaVenta">Fecha y hora</label>
      <input id="fechaVenta" type="datetime-local"
        value="${fechaLocal()}">

      <label for="porcentajeVenta">Porcentaje de salario (%)</label>
      <input id="porcentajeVenta" type="number"
        min="0" max="100" step="0.01"
        value="${porcentajeSalario}"
        oninput="actualizarResumen()">
    </div>

    <div id="resumenVenta" class="resumen"></div>
  `;

  dibujarProductosCaja();
  actualizarResumen();
}

function cambiarMonedaVenta(moneda) {
  if (moneda !== "USD" && moneda !== "CUP") return;

  monedaVenta = moneda;

  carrito = carrito.map(item => {
    const producto = productos.find(
      p => p.id === item.productoId
    );

    if (!producto) return null;

    const precio = precioProducto(producto, moneda);

    if (precio <= 0) return null;

    return {
      ...item,
      nombre: producto.nombre,
      precio,
      precioCUP: precioCUPProducto(producto)
    };
  }).filter(Boolean);

  dibujarProductosCaja();
  actualizarResumen();
}

function dibujarProductosCaja() {
  const lista = document.getElementById("listaProductosCaja");
  if (!lista) return;

  const busqueda = (
    document.getElementById("buscarProductoCaja")?.value || ""
  ).toLowerCase().trim();

  const disponibles = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda)
  );

  if (productos.length === 0) {
    lista.innerHTML = `
      <p class="texto-vacio">
        No tienes productos registrados.
        <br>Ve a Productos para crear tu catálogo.
      </p>`;
    return;
  }

  if (disponibles.length === 0) {
    lista.innerHTML = `
      <p class="texto-vacio">No se encontraron productos.</p>`;
    return;
  }

  lista.innerHTML = disponibles.map(producto => {
    const cantidad = carrito.find(
      item => item.productoId === producto.id
    )?.cantidad || 0;

    const precio = precioProducto(producto, monedaVenta);
    const sinPrecio = precio <= 0;

    return `
      <div class="producto">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>
          <div class="precio">${formato(precio)} ${monedaVenta}</div>
          ${
            sinPrecio
              ? `<small style="color:#c52e2e">Sin precio en ${monedaVenta}</small>`
              : ""
          }
        </div>

        <div class="controles-cantidad">
          <button class="btn-cantidad"
            onclick="cambiarCantidad(${producto.id},-1)"
            ${cantidad === 0 ? "disabled" : ""}>−</button>

          <span class="cantidad">${cantidad}</span>

          <button class="btn-cantidad"
            onclick="cambiarCantidad(${producto.id},1)"
            ${sinPrecio ? "disabled" : ""}>+</button>
        </div>
      </div>
    `;
  }).join("");
}

function cambiarCantidad(id, cambio) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  const precio = precioProducto(producto, monedaVenta);

  if (cambio > 0 && precio <= 0) {
    alert(`Este producto no tiene precio en ${monedaVenta}.`);
    return;
  }

  let item = carrito.find(p => p.productoId === id);

  if (!item && cambio > 0) {
    item = {
      productoId: id,
      nombre: producto.nombre,
      precio,
      precioCUP: precioCUPProducto(producto),
      cantidad: 0
    };

    carrito.push(item);
  }

  if (!item) return;

  item.cantidad += cambio;

  if (item.cantidad <= 0) {
    carrito = carrito.filter(p => p.productoId !== id);
  }

  dibujarProductosCaja();
  actualizarResumen();
}

// ==========================================
// CÁLCULO DE LA VENTA Y DEL SALARIO
// ==========================================

function calcularVenta() {
  const total = carrito.reduce(
    (suma, item) =>
      suma + Number(item.precio || 0) * Number(item.cantidad || 0),
    0
  );

  const porcentaje = Number(
    document.getElementById("porcentajeVenta")?.value ??
    porcentajeSalario
  );

  const salarioCUP = calcularSalarioLineasCUP(
    carrito,
    porcentaje
  );

  return {
    total,
    porcentaje,
    salarioCUP
  };
}

function actualizarResumen() {
  const resumen = document.getElementById("resumenVenta");
  if (!resumen) return;

  const calculo = calcularVenta();

  resumen.innerHTML = `
    <h3>Resumen de venta</h3>

    <p style="margin-top:15px;color:#cccccc">
      Productos seleccionados
    </p>

    <p style="font-size:16px;font-weight:bold;margin-top:5px">
      ${carrito.reduce((s, p) => s + p.cantidad, 0)} unidades
    </p>

    <p style="margin-top:15px;color:#cccccc">
      Total de la venta
    </p>

    <div class="total">
      ${formato(calculo.total)} ${monedaVenta}
    </div>

    <p style="margin-top:15px">
      Comisión: ${formato(calculo.porcentaje)} %
    </p>

    <p style="margin-top:15px;color:#cccccc">
      Salario generado (calculado sobre precios CUP)
    </p>

    <div class="salario">
      ${formato(calculo.salarioCUP)} CUP
    </div>

    <button class="btn-vendido"
      onclick="registrarVenta()">
      ✓ CONFIRMAR VENTA
    </button>
  `;
}

// ==========================================
// REGISTRAR VENTA
// ==========================================

async function registrarVenta() {
  if (carrito.length === 0) {
    alert("Selecciona al menos un producto.");
    return;
  }

  const campoFecha = document.getElementById("fechaVenta");
  const fecha = campoFecha?.value;

  if (!fecha || Number.isNaN(new Date(fecha).getTime())) {
    alert("Introduce una fecha y hora válidas.");
    return;
  }

  const calculo = calcularVenta();

  if (
    !Number.isFinite(calculo.porcentaje) ||
    calculo.porcentaje < 0 ||
    calculo.porcentaje > 100
  ) {
    alert("El porcentaje debe estar entre 0 y 100.");
    return;
  }

  if (!Number.isFinite(calculo.total) || calculo.total <= 0) {
    alert("El total de la venta no es válido.");
    return;
  }

  const confirmacion =
    `¿Confirmar venta por ${formato(calculo.total)} ${monedaVenta}?\n\n` +
    `Salario generado: ${formato(calculo.salarioCUP)} CUP`;

  if (!confirm(confirmacion)) return;

  const lineas = carrito.map(item => {
    const producto = productos.find(
      p => p.id === item.productoId
    );

    return {
      productoId: item.productoId,
      nombre: item.nombre,
      precio: item.precio,
      precioUSD: monedaVenta === "USD" ? item.precio : 0,
      precioCUP: precioCUPProducto(producto),
      cantidad: item.cantidad
    };
  });

  const venta = {
    fecha: new Date(fecha).toISOString(),
    moneda: monedaVenta,
    productos: lineas,
    total: calculo.total,
    salario: calculo.salarioCUP,
    porcentaje: calculo.porcentaje,
    totalUSD: monedaVenta === "USD" ? calculo.total : 0,
    totalCUP: monedaVenta === "CUP" ? calculo.total : 0,
    salarioUSD: 0,
    salarioCUP: calculo.salarioCUP
  };

  try {
    venta.id = await guardarDato("ventas", venta);
    ventas.push(venta);

    porcentajeSalario = calculo.porcentaje;
    carrito = [];

    alert(
      "¡Venta registrada correctamente!\n\n" +
      "Total: " + formato(venta.total) + " " + venta.moneda + "\n" +
      "Salario: " + formato(venta.salarioCUP) + " CUP"
    );

    mostrarCaja();

  } catch (error) {
    alert("No se pudo guardar la venta.");
    console.error(error);
  }
}

// ==========================================
// SECCIÓN REGISTRO
// ==========================================

function mostrarRegistro() {
  const pantalla = document.getElementById("pantallaRegistro");

  const opcionesProductos = productos.map(p => `
    <option value="${p.id}">${escapar(p.nombre)}</option>
  `).join("");

  const anioActual = new Date().getFullYear();

  pantalla.innerHTML = `
    <span class="etiqueta">CONTROL Y ESTADÍSTICAS</span>
    <h2 class="titulo-seccion">Registro de ventas</h2>

    <button class="btn-principal"
      style="width:100%;margin-bottom:16px"
      onclick="mostrarResumenVentas()">
      ☷ RESUMEN DE VENTAS
    </button>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Filtrar registros</h3>

      <label for="filtroPeriodo">Período de consulta</label>
      <select id="filtroPeriodo"
        onchange="actualizarVisibilidadFiltros();actualizarRegistro()">
        <option value="todo">Todas las ventas</option>
        <option value="dia">Por día</option>
        <option value="mes">Por mes</option>
        <option value="anio">Por año</option>
        <option value="rango">Por período personalizado</option>
      </select>

      <div id="filtroDia" style="display:none">
        <label for="fechaFiltro">Seleccionar día</label>
        <input id="fechaFiltro" type="date"
          value="${fechaParaComparar(new Date())}"
          onchange="actualizarRegistro()">
      </div>

      <div id="filtroMes" style="display:none">
        <label for="mesFiltro">Seleccionar mes</label>
        <input id="mesFiltro" type="month"
          value="${mesLocal()}"
          onchange="actualizarRegistro()">
      </div>

      <div id="filtroAnio" style="display:none">
        <label for="anioFiltro">Seleccionar año</label>
        <input id="anioFiltro" type="number"
          min="2000" max="2100"
          value="${anioActual}"
          onchange="actualizarRegistro()">
      </div>

      <div id="filtroRango" style="display:none">
        <label for="fechaDesde">Desde</label>
        <input id="fechaDesde" type="date"
          onchange="actualizarRegistro()">

        <label for="fechaHasta">Hasta</label>
        <input id="fechaHasta" type="date"
          onchange="actualizarRegistro()">
      </div>

      <label for="filtroProducto">Producto</label>
      <select id="filtroProducto" onchange="actualizarRegistro()">
        <option value="">Todos los productos</option>
        ${opcionesProductos}
      </select>

      <label for="filtroMoneda">Moneda</label>
      <select id="filtroMoneda" onchange="actualizarRegistro()">
        <option value="">Todas las monedas</option>
        <option value="USD">USD</option>
        <option value="CUP">CUP</option>
      </select>

      <label for="precioMinimo">Importe mínimo de la venta</label>
      <input id="precioMinimo" type="number"
        min="0" step="0.01" placeholder="Sin mínimo"
        oninput="actualizarRegistro()">

      <label for="precioMaximo">Importe máximo de la venta</label>
      <input id="precioMaximo" type="number"
        min="0" step="0.01" placeholder="Sin máximo"
        oninput="actualizarRegistro()">

      <button class="btn-secundario"
        style="width:100%"
        onclick="limpiarFiltrosRegistro()">
        Limpiar filtros
      </button>
    </div>

    <div id="resultadosRegistro"></div>
  `;

  actualizarVisibilidadFiltros();
  actualizarRegistro();
}

// ==========================================
// RESUMEN GENERAL DE VENTAS
// ==========================================

function mostrarResumenVentas() {
  const contenedor = document.getElementById("pantallaRegistro");
  if (!contenedor) return;

  const ordenadas = [...ventas].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );

  const ventasUSD = ordenadas.filter(
    venta => (venta.moneda || "CUP") === "USD"
  );

  const ventasCUP = ordenadas.filter(
    venta => (venta.moneda || "CUP") === "CUP"
  );

  const totalUSD = ventasUSD.reduce(
    (suma, venta) => suma + Number(venta.total || 0),
    0
  );

  const totalCUP = ventasCUP.reduce(
    (suma, venta) => suma + Number(venta.total || 0),
    0
  );

  const totalUnidades = ordenadas.reduce(
    (suma, venta) =>
      suma + (venta.productos || []).reduce(
        (s, item) => s + Number(item.cantidad || 0),
        0
      ),
    0
  );

  const unidadesUSD = ventasUSD.reduce(
    (suma, venta) =>
      suma + (venta.productos || []).reduce(
        (s, item) => s + Number(item.cantidad || 0),
        0
      ),
    0
  );

  const unidadesCUP = ventasCUP.reduce(
    (suma, venta) =>
      suma + (venta.productos || []).reduce(
        (s, item) => s + Number(item.cantidad || 0),
        0
      ),
    0
  );

  contenedor.innerHTML = `
    <span class="etiqueta">INFORME GENERAL</span>
    <h2 class="titulo-seccion">Resumen de ventas</h2>

    <button class="btn-secundario"
      style="width:100%;margin-bottom:16px"
      onclick="mostrarRegistro()">
      ← VOLVER AL REGISTRO
    </button>

    <div class="tarjeta" style="background:#151515;color:white">
      <div style="font-size:11px;color:#f28c28;font-weight:bold;letter-spacing:1px">
        RESUMEN DE TODAS LAS OPERACIONES
      </div>

      <div style="margin-top:18px;color:#cccccc;font-size:12px">
        TOTAL VENDIDO EN USD
      </div>

      <div style="font-size:25px;font-weight:bold;margin:6px 0 18px">
        ${formato(totalUSD)} USD
      </div>

      <div style="border-top:1px solid #444;padding-top:15px">
        <div style="color:#cccccc;font-size:12px">
          TOTAL VENDIDO EN CUP
        </div>

        <div style="font-size:25px;font-weight:bold;margin:6px 0 18px">
          ${formato(totalCUP)} CUP
        </div>
      </div>

      <div style="border-top:1px solid #444;padding-top:15px;display:flex;justify-content:space-between;gap:10px">
        <div>
          <strong>${ordenadas.length}</strong>
          <div style="font-size:11px;color:#bbbbbb">Operaciones</div>
        </div>

        <div>
          <strong>${totalUnidades}</strong>
          <div style="font-size:11px;color:#bbbbbb">Unidades vendidas</div>
        </div>
      </div>
    </div>

    <h3 style="margin:22px 0 13px">
      Todas las operaciones (${ordenadas.length})
    </h3>

    ${
      ordenadas.length === 0
        ? `<div class="tarjeta texto-vacio">
            Todavía no hay ventas registradas.
          </div>`
        : ordenadas.map(venta => {
            const moneda = venta.moneda || "CUP";
            const lineas = venta.productos || [];

            const unidadesVenta = lineas.reduce(
              (suma, item) => suma + Number(item.cantidad || 0),
              0
            );

            const totalCalculado = lineas.reduce(
              (suma, item) => {
                const precio = moneda === "USD"
                  ? Number(item.precioUSD ?? item.precio ?? 0)
                  : Number(item.precioCUP ?? item.precio ?? 0);

                return suma + precio * Number(item.cantidad || 0);
              },
              0
            );

            return `
              <div class="tarjeta">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
                  <div>
                    <strong>Venta #${venta.id}</strong>
                    <div style="font-size:11px;color:#777;margin-top:5px">
                      ${mostrarFecha(venta.fecha)}
                    </div>
                    <div style="font-size:11px;color:#f28c28;font-weight:bold;margin-top:5px">
                      Moneda: ${moneda}
                    </div>
                  </div>

                  <div style="text-align:right">
                    <strong style="color:#16834a">
                      ${formato(venta.total ?? totalCalculado)} ${moneda}
                    </strong>
                    <div style="font-size:11px;color:#777;margin-top:5px">
                      ${unidadesVenta} unidades
                    </div>
                  </div>
                </div>

                <div style="border-top:1px solid #eeeeee;margin-top:14px;padding-top:10px">
                  ${lineas.map(item => {
                    const precio = moneda === "USD"
                      ? Number(item.precioUSD ?? item.precio ?? 0)
                      : Number(item.precioCUP ?? item.precio ?? 0);

                    const cantidad = Number(item.cantidad || 0);
                    const importe = precio * cantidad;

                    return `
                      <div style="padding:10px 0;border-bottom:1px solid #eeeeee">
                        <strong style="font-size:13px">
                          ${escapar(item.nombre || "Producto")}
                        </strong>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px;font-size:12px">
                          <div>
                            <span style="color:#777">Cantidad</span>
                            <div style="font-weight:bold">${cantidad} unidades</div>
                          </div>

                          <div>
                            <span style="color:#777">Precio unitario</span>
                            <div style="font-weight:bold">${formato(precio)} ${moneda}</div>
                          </div>

                          <div style="grid-column:1 / -1">
                            <span style="color:#777">Importe del producto</span>
                            <div style="font-weight:bold;color:#16834a">
                              ${formato(importe)} ${moneda}
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>

                <div style="display:flex;justify-content:space-between;gap:10px;margin-top:13px;font-weight:bold">
                  <span>Total de la operación</span>
                  <span>${formato(venta.total ?? totalCalculado)} ${moneda}</span>
                </div>
              </div>
            `;
          }).join("")
    }

    <div class="tarjeta">
      <h3 style="margin-bottom:12px">Totales por moneda</h3>

      <div style="display:flex;justify-content:space-between;padding:8px 0">
        <span>Ventas en USD</span>
        <strong>${formato(totalUSD)} USD</strong>
      </div>

      <div style="display:flex;justify-content:space-between;padding:8px 0">
        <span>Unidades vendidas en USD</span>
        <strong>${unidadesUSD}</strong>
      </div>

      <div style="border-top:1px solid #eee;margin:8px 0"></div>

      <div style="display:flex;justify-content:space-between;padding:8px 0">
        <span>Ventas en CUP</span>
        <strong>${formato(totalCUP)} CUP</strong>
      </div>

      <div style="display:flex;justify-content:space-between;padding:8px 0">
        <span>Unidades vendidas en CUP</span>
        <strong>${unidadesCUP}</strong>
      </div>
    </div>

    <button class="btn-secundario"
      style="width:100%;margin-bottom:20px"
      onclick="mostrarRegistro()">
      ← VOLVER AL REGISTRO
    </button>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// FILTROS DEL REGISTRO
// ==========================================

function actualizarVisibilidadFiltros() {
  const periodo =
    document.getElementById("filtroPeriodo")?.value || "todo";

  const controles = {
    dia: "filtroDia",
    mes: "filtroMes",
    anio: "filtroAnio",
    rango: "filtroRango"
  };

  Object.entries(controles).forEach(([tipo, id]) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.style.display =
        periodo === tipo ? "block" : "none";
    }
  });
}

function limpiarFiltrosRegistro() {
  document.getElementById("filtroPeriodo").value = "todo";
  document.getElementById("filtroProducto").value = "";
  document.getElementById("filtroMoneda").value = "";
  document.getElementById("precioMinimo").value = "";
  document.getElementById("precioMaximo").value = "";
  document.getElementById("fechaFiltro").value =
    fechaParaComparar(new Date());
  document.getElementById("mesFiltro").value = mesLocal();
  document.getElementById("anioFiltro").value =
    new Date().getFullYear();
  document.getElementById("fechaDesde").value = "";
  document.getElementById("fechaHasta").value = "";

  actualizarVisibilidadFiltros();
  actualizarRegistro();
}

function actualizarRegistro() {
  const contenedor = document.getElementById("resultadosRegistro");
  if (!contenedor) return;

  const periodo =
    document.getElementById("filtroPeriodo")?.value || "todo";

  const fechaDia =
    document.getElementById("fechaFiltro")?.value || "";

  const mes =
    document.getElementById("mesFiltro")?.value || "";

  const anio =
    document.getElementById("anioFiltro")?.value || "";

  const desde =
    document.getElementById("fechaDesde")?.value || "";

  const hasta =
    document.getElementById("fechaHasta")?.value || "";

  const productoId =
    document.getElementById("filtroProducto")?.value || "";

  const monedaFiltro =
    document.getElementById("filtroMoneda")?.value || "";

  const minimoTexto =
    document.getElementById("precioMinimo")?.value ?? "";

  const maximoTexto =
    document.getElementById("precioMaximo")?.value ?? "";

  const minimo = minimoTexto === "" ? null : Number(minimoTexto);
  const maximo = maximoTexto === "" ? null : Number(maximoTexto);

  if (
    (minimo !== null && (!Number.isFinite(minimo) || minimo < 0)) ||
    (maximo !== null && (!Number.isFinite(maximo) || maximo < 0)) ||
    (minimo !== null && maximo !== null && minimo > maximo)
  ) {
    contenedor.innerHTML = `
      <div class="tarjeta texto-vacio">
        Comprueba los importes mínimos y máximos.
      </div>`;
    return;
  }

  if (periodo === "dia" && !fechaDia) {
    contenedor.innerHTML =
      `<div class="tarjeta texto-vacio">Selecciona un día.</div>`;
    return;
  }

  if (periodo === "mes" && !mes) {
    contenedor.innerHTML =
      `<div class="tarjeta texto-vacio">Selecciona un mes.</div>`;
    return;
  }

  if (periodo === "anio" && !anio) {
    contenedor.innerHTML =
      `<div class="tarjeta texto-vacio">Selecciona un año.</div>`;
    return;
  }

  if (periodo === "rango" && desde && hasta && desde > hasta) {
    contenedor.innerHTML =
      `<div class="tarjeta texto-vacio">La fecha inicial no puede ser posterior a la final.</div>`;
    return;
  }

  const resultados = [];

  ventas.forEach(venta => {
    const fecha = fechaParaComparar(venta.fecha);
    if (!fecha) return;

    if (periodo === "dia" && fecha !== fechaDia) return;
    if (periodo === "mes" && fecha.slice(0, 7) !== mes) return;
    if (periodo === "anio" && fecha.slice(0, 4) !== String(anio)) return;
    if (periodo === "rango" && desde && fecha < desde) return;
    if (periodo === "rango" && hasta && fecha > hasta) return;

    const moneda = venta.moneda || "CUP";

    if (monedaFiltro && moneda !== monedaFiltro) return;

    const totalVenta = Number(venta.total || 0);

    if (minimo !== null && totalVenta < minimo) return;
    if (maximo !== null && totalVenta > maximo) return;

    let lineas = (venta.productos || []).map(item => {
      const precioVenta = moneda === "USD"
        ? Number(item.precioUSD ?? item.precio ?? 0)
        : Number(item.precioCUP ?? item.precio ?? 0);

      const precioCUP = Number(item.precioCUP || 0);
      const cantidad = Number(item.cantidad || 0);

      return {
        ...item,
        precio: precioVenta,
        precioCUP,
        cantidad,
        subtotal: precioVenta * cantidad,
        salarioCUP: precioCUP * cantidad *
          Number(venta.porcentaje || 0) / 100
      };
    });

    if (productoId !== "") {
      lineas = lineas.filter(item =>
        String(item.productoId) === String(productoId)
      );

      if (lineas.length === 0) return;
    }

    const totalVisible = lineas.reduce(
      (suma, item) => suma + item.subtotal,
      0
    );

    const salarioVisibleCUP = lineas.reduce(
      (suma, item) => suma + item.salarioCUP,
      0
    );

    const unidadesVisibles = lineas.reduce(
      (suma, item) => suma + Number(item.cantidad || 0),
      0
    );

    resultados.push({
      ...venta,
      moneda,
      lineasVisibles: lineas,
      totalVisible,
      salarioVisibleCUP,
      unidadesVisibles
    });
  });

  resultados.sort((a, b) =>
    new Date(b.fecha) - new Date(a.fecha)
  );

  const ventasUSD = resultados.filter(v => v.moneda === "USD");
  const ventasCUP = resultados.filter(v => v.moneda === "CUP");

  const totalUSD = ventasUSD.reduce(
    (suma, venta) => suma + venta.totalVisible, 0
  );

  const totalCUP = ventasCUP.reduce(
    (suma, venta) => suma + venta.totalVisible, 0
  );

  const salarioCUP = resultados.reduce(
    (suma, venta) => suma + venta.salarioVisibleCUP, 0
  );

  const unidades = resultados.reduce(
    (suma, venta) => suma + venta.unidadesVisibles, 0
  );

  const etiquetaPeriodo = {
    todo: "Todas las ventas",
    dia: "Ventas del día",
    mes: "Ventas del mes",
    anio: "Ventas del año",
    rango: "Ventas del período"
  }[periodo];

  contenedor.innerHTML = `
    <div class="tarjeta" style="background:#151515;color:white">
      <span style="font-size:11px;color:#f28c28;font-weight:bold;letter-spacing:1px">
        RESUMEN · ${etiquetaPeriodo.toUpperCase()}
      </span>

      <div style="margin-top:18px;color:#cccccc;font-size:12px">
        TOTAL VENDIDO EN USD
      </div>

      <div style="font-size:25px;font-weight:bold;margin:6px 0 18px">
        ${formato(totalUSD)} USD
      </div>

      <div style="border-top:1px solid #444;padding-top:15px">
        <div style="color:#cccccc;font-size:12px">
          TOTAL VENDIDO EN CUP
        </div>

        <div style="font-size:25px;font-weight:bold;margin:6px 0 18px">
          ${formato(totalCUP)} CUP
        </div>
      </div>

      <div style="border-top:1px solid #444;padding-top:15px">
        <div style="color:#cccccc;font-size:12px">
          SALARIO GENERADO (TODAS LAS VENTAS)
        </div>

        <div style="font-size:23px;font-weight:bold;color:#75df9a;margin:6px 0 18px">
          ${formato(salarioCUP)} CUP
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid #444;padding-top:14px">
        <div>
          <strong>${resultados.length}</strong>
          <div style="font-size:11px;color:#bbbbbb">Operaciones</div>
        </div>

        <div>
          <strong>${unidades}</strong>
          <div style="font-size:11px;color:#bbbbbb">Unidades</div>
        </div>
      </div>
    </div>

    <h3 style="margin:22px 0 13px">
      Detalle de operaciones (${resultados.length})
    </h3>

    <div id="listaVentas">
      ${
        resultados.length === 0
          ? `<div class="tarjeta texto-vacio">
              No hay ventas que coincidan con estos filtros.
            </div>`
          : resultados.map(venta => `
              <div class="tarjeta">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
                  <div>
                    <strong>Venta #${venta.id}</strong>
                    <div style="font-size:11px;color:#777;margin-top:5px">
                      ${mostrarFecha(venta.fecha)}
                    </div>
                    <div style="font-size:11px;color:#f28c28;font-weight:bold;margin-top:5px">
                      Moneda: ${venta.moneda}
                    </div>
                    <div style="font-size:12px;color:#555;margin-top:6px;font-weight:bold">
                      Cantidad vendida: ${venta.unidadesVisibles} unidades
                    </div>
                  </div>

                  <div style="text-align:right">
                    <strong style="color:#16834a">
                      ${formato(venta.totalVisible)} ${venta.moneda}
                    </strong>
                    <div style="font-size:11px;color:#777;margin-top:5px">
                      ${formato(venta.salarioVisibleCUP)} CUP salario
                    </div>
                  </div>
                </div>

                <details style="margin-top:14px;border-top:1px solid #eeeeee;padding-top:12px">
                  <summary style="font-size:13px;font-weight:bold;cursor:pointer">
                    Ver detalle de productos
                  </summary>

                  <div style="margin-top:12px">
                    ${venta.lineasVisibles.map(item => `
                      <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #eeeeee;font-size:12px">
                        <div>
                          <strong>${escapar(item.nombre)}</strong>
                          <div style="color:#777;margin-top:4px">
                            Precio unitario: ${formato(item.precio)} ${venta.moneda}
                          </div>
                          <div style="color:#f28c28;font-weight:bold;margin-top:4px">
                            Cantidad vendida: ${item.cantidad} unidades
                          </div>
                          <div style="color:#777;margin-top:3px">
                            Base salarial: ${formato(item.precioCUP)} CUP por unidad
                          </div>
                        </div>
                        <strong>${formato(item.subtotal)} ${venta.moneda}</strong>
                      </div>
                    `).join("")}

                    <div style="font-size:12px;margin-top:12px">
                      Comisión: ${formato(venta.porcentaje)} %
                    </div>

                    <div style="font-weight:bold;margin-top:5px">
                      Salario: ${formato(venta.salarioVisibleCUP)} CUP
                    </div>
                  </div>
                </details>

                <button class="btn-peligro"
                  style="width:100%;margin-top:14px"
                  onclick="eliminarVenta(${venta.id})">
                  🗑 ELIMINAR ESTA VENTA
                </button>
              </div>
            `).join("")
      }
    </div>
  `;
}

// ==========================================
// ELIMINAR VENTAS DEL REGISTRO
// ==========================================

async function eliminarVenta(id) {
  const venta = ventas.find(v => v.id === id);
  if (!venta) return;

  const seguro = confirm(
    `¿Eliminar definitivamente la venta #${id}?\n\n` +
    `Importe: ${formato(venta.total)} ${venta.moneda || "CUP"}\n` +
    `Fecha: ${mostrarFecha(venta.fecha)}\n\n` +
    "Esta operación no se puede deshacer."
  );

  if (!seguro) return;

  try {
    await eliminarDato("ventas", id);

    ventas = ventas.filter(v => v.id !== id);

    alert(`La venta #${id} fue eliminada correctamente.`);

    actualizarRegistro();

  } catch (error) {
    alert("No se pudo eliminar la venta.");
    console.error(error);
  }
}

// ==========================================
// ARRANQUE
// ==========================================

document.addEventListener("DOMContentLoaded", iniciarAplicacion);
