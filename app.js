
// ==========================================
// CAJA DE VENTAS
// APP.JS COMPLETO
// CUP + USD | OFFLINE | INDEXEDDB
// SALARIO SIEMPRE CALCULADO SOBRE CUP
// ==========================================

// ==========================================
// 1. VARIABLES GENERALES
// ==========================================

let productos = [];
let carrito = [];
let ventas = [];

let productoEnEdicion = null;
let porcentajeSalario = 5;
let pantallaActual = "inicio";
let monedaVenta = "CUP";

// ==========================================
// 2. FUNCIONES GENERALES
// ==========================================

function formato(valor) {
  return Number(valor || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

function fechaLocal(fecha = new Date()) {
  const ahora = new Date(fecha);

  if (Number.isNaN(ahora.getTime())) return "";

  const zona = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );

  return zona.toISOString().slice(0, 16);
}

function fechaParaComparar(fecha) {
  const ahora = new Date(fecha);

  if (Number.isNaN(ahora.getTime())) return "";

  const zona = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );

  return zona.toISOString().slice(0, 10);
}

function mesLocal(fecha = new Date()) {
  const ahora = new Date(fecha);

  if (Number.isNaN(ahora.getTime())) return "";

  return `${ahora.getFullYear()}-${String(
    ahora.getMonth() + 1
  ).padStart(2, "0")}`;
}

function mostrarFecha(fecha) {
  const ahora = new Date(fecha);

  if (Number.isNaN(ahora.getTime())) return "Fecha no disponible";

  return ahora.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ==========================================
// 3. ADAPTAR PRODUCTOS EXISTENTES
// ==========================================

function adaptarProducto(producto) {
  const monedaAnterior = producto.moneda || "CUP";

  let precioCUP = Number(producto.precioCUP || 0);
  let precioUSD = Number(producto.precioUSD || 0);

  // Compatibilidad con productos antiguos
  // que solamente tenían el campo "precio".

  if (!precioCUP && monedaAnterior === "CUP") {
    precioCUP = Number(producto.precio || 0);
  }

  if (!precioUSD && monedaAnterior === "USD") {
    precioUSD = Number(producto.precio || 0);
  }

  return {
    ...producto,
    nombre: String(producto.nombre || "Producto"),
    precioCUP,
    precioUSD
  };
}

// ==========================================
// 4. PRECIOS DE PRODUCTOS
// ==========================================

function precioProducto(producto, moneda = monedaVenta) {
  if (!producto) return 0;

  if (moneda === "USD") {
    return Number(producto.precioUSD || 0);
  }

  return Number(producto.precioCUP || 0);
}

function precioCUPProducto(item) {
  if (!item) return 0;

  if (item.precioCUP !== undefined) {
    return Number(item.precioCUP || 0);
  }

  const idProducto = item.productoId ?? item.id;

  const producto = productos.find(p =>
    String(p.id) === String(idProducto)
  );

  return Number(producto?.precioCUP || 0);
}

// ==========================================
// 5. ADAPTAR VENTAS EXISTENTES
// ==========================================

function adaptarVenta(venta) {
  const moneda = venta.moneda || "CUP";

  const lineas = (venta.productos || []).map(item => {
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precio || 0);

    let precioCUP = Number(item.precioCUP || 0);

    if (!precioCUP) {
      precioCUP = precioCUPProducto(item);
    }

    return {
      ...item,
      productoId: item.productoId ?? item.id,
      nombre: item.nombre || "Producto",
      cantidad,
      precio,
      precioCUP,
      subtotal: Number(
        item.subtotal !== undefined
          ? item.subtotal
          : precio * cantidad
      ),
      subtotalCUP: Number(
        item.subtotalCUP !== undefined
          ? item.subtotalCUP
          : precioCUP * cantidad
      )
    };
  });

  const total = Number(venta.total || 0);

  const totalCUP = Number(
    venta.totalCUP !== undefined
      ? venta.totalCUP
      : moneda === "CUP" ? total : 0
  );

  const totalUSD = Number(
    venta.totalUSD !== undefined
      ? venta.totalUSD
      : moneda === "USD" ? total : 0
  );

  const salarioCUP = Number(
    venta.salarioCUP !== undefined
      ? venta.salarioCUP
      : venta.salario || 0
  );

  return {
    ...venta,
    moneda,
    productos: lineas,
    total,
    totalCUP,
    totalUSD,
    salarioCUP,
    salario: salarioCUP,
    porcentaje: Number(venta.porcentaje || 0),
    lugarVenta: venta.lugarVenta || "Sin especificar"
  };
}

// ==========================================
// 6. CÁLCULO DEL SALARIO SOBRE CUP
// ==========================================

function calcularSalarioLineasCUP(lineas, porcentaje) {
  const baseCUP = (lineas || []).reduce((suma, item) => {
    const subtotal = item.subtotalCUP !== undefined
      ? Number(item.subtotalCUP || 0)
      : Number(item.precioCUP || 0) *
        Number(item.cantidad || 0);

    return suma + subtotal;
  }, 0);

  return baseCUP * Number(porcentaje || 0) / 100;
}

// ==========================================
// 7. INICIAR APLICACIÓN
// ==========================================

async function iniciarAplicacion() {
  try {
    await abrirBaseDatos();

    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");

    productos = productosGuardados.map(adaptarProducto);
    ventas = ventasGuardadas.map(adaptarVenta);

    // Actualizar productos antiguos sin cambiar sus IDs.
    for (const producto of productos) {
      await guardarDato("productos", producto);
    }

    // Actualizar ventas antiguas y conservar sus datos.
    for (const venta of ventas) {
      await guardarDato("ventas", venta);
    }

    actualizarConexion();
    navegar("inicio");

  } catch (error) {
    console.error("Error al iniciar la aplicación:", error);

    alert(
      "No se pudo iniciar la base de datos. " +
      "Comprueba que IndexedDB esté disponible."
    );
  }
}

// ==========================================
// 8. ESTADO DE CONEXIÓN
// ==========================================

function actualizarConexion() {
  const elemento = document.getElementById("estadoConexion");

  if (!elemento) return;

  elemento.textContent = navigator.onLine
    ? "En línea"
    : "Modo sin conexión";
}

window.addEventListener("online", actualizarConexion);
window.addEventListener("offline", actualizarConexion);

// ==========================================
// 9. NAVEGACIÓN ENTRE PANTALLAS
// ==========================================

function navegar(destino) {
  const pantallas = {
    inicio: "pantallaInicio",
    caja: "pantallaCaja",
    productos: "pantallaProductos",
    registro: "pantallaRegistro",
    estadisticas: "pantallaEstadisticas",
    efectivo: "pantallaEfectivo"
  };

  const idPantalla = pantallas[destino];

  if (!idPantalla) return;

  document.querySelectorAll(".pantalla").forEach(pantalla => {
    pantalla.classList.remove("activa");
  });

  const pantalla = document.getElementById(idPantalla);

  if (!pantalla) return;

  pantalla.classList.add("activa");
  pantallaActual = destino;

  if (destino === "productos") mostrarProductos();
  if (destino === "caja") mostrarCaja();
  if (destino === "registro") mostrarRegistro();
  if (destino === "estadisticas") mostrarEstadisticas();
  if (destino === "efectivo") mostrarEfectivo();
}

// ==========================================
// 10. PANTALLA DE PRODUCTOS
// ==========================================

function mostrarProductos() {
  const pantalla = document.getElementById("pantallaProductos");
  if (!pantalla) return;

  pantalla.innerHTML = `
    <span class="etiqueta">INVENTARIO</span>

    <h2 class="titulo-seccion">Productos</h2>

    <div class="tarjeta">
      <h3 id="tituloFormularioProducto">Agregar producto</h3>

      <form id="formularioProducto" onsubmit="guardarProducto(event)">

        <label for="nombreProducto">Nombre del producto</label>
        <input
          type="text"
          id="nombreProducto"
          placeholder="Nombre del producto"
          required>

        <label for="precioCUPProducto">Precio en CUP</label>
        <input
          type="number"
          id="precioCUPProducto"
          min="0"
          step="0.01"
          placeholder="0.00">

        <label for="precioUSDProducto">Precio en USD</label>
        <input
          type="number"
          id="precioUSDProducto"
          min="0"
          step="0.01"
          placeholder="0.00">

        <button type="submit" class="btn-principal" id="btnGuardarProducto">
          Guardar producto
        </button>

        <button
          type="button"
          class="btn-secundario"
          id="btnCancelarEdicion"
          style="display:none;margin-top:10px"
          onclick="cancelarEdicion()">
          Cancelar edición
        </button>

      </form>
    </div>

    <div class="tarjeta">
      <h3>Catálogo de productos</h3>

      <div id="catalogoProductos"></div>
    </div>
  `;

  dibujarCatalogo();
}

// ==========================================
// 11. MOSTRAR CATÁLOGO
// ==========================================

function dibujarCatalogo() {
  const contenedor = document.getElementById("catalogoProductos");
  if (!contenedor) return;

  if (!productos.length) {
    contenedor.innerHTML = `
      <p class="texto-vacio">
        Todavía no hay productos registrados.
      </p>
    `;
    return;
  }

  contenedor.innerHTML = productos.map(producto => `
    <div class="producto">

      <div class="producto-info">

        <h3>${escapar(producto.nombre)}</h3>

        <p class="precio" style="margin-top:7px">
          ${formato(producto.precioCUP)} CUP
        </p>

        <p style="font-size:13px;color:#2878c8;margin-top:4px">
          ${formato(producto.precioUSD)} USD
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

// ==========================================
// 12. GUARDAR PRODUCTO
// ==========================================

async function guardarProducto(event) {
  if (event) event.preventDefault();

  const nombre = document.getElementById("nombreProducto")?.value.trim();

  const precioCUP = Number(
    document.getElementById("precioCUPProducto")?.value || 0
  );

  const precioUSD = Number(
    document.getElementById("precioUSDProducto")?.value || 0
  );

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    return;
  }

  if (
    !Number.isFinite(precioCUP) ||
    !Number.isFinite(precioUSD) ||
    precioCUP < 0 ||
    precioUSD < 0 ||
    (precioCUP === 0 && precioUSD === 0)
  ) {
    alert("Introduce al menos un precio válido, en CUP o USD.");
    return;
  }

  const producto = {
    id: productoEnEdicion
      ? productoEnEdicion.id
      : Date.now(),

    nombre,
    precioCUP,
    precioUSD
  };

  try {
    await guardarDato("productos", producto);

    if (productoEnEdicion) {
      const indice = productos.findIndex(p =>
        String(p.id) === String(productoEnEdicion.id)
      );

      if (indice !== -1) {
        productos[indice] = adaptarProducto(producto);
      }
    } else {
      productos.push(adaptarProducto(producto));
    }

    productoEnEdicion = null;

    alert("Producto guardado correctamente.");

    mostrarProductos();

  } catch (error) {
    console.error("Error al guardar producto:", error);
    alert("No se pudo guardar el producto.");
  }
}

// ==========================================
// 13. EDITAR PRODUCTO
// ==========================================

function editarProducto(id) {
  const producto = productos.find(p =>
    String(p.id) === String(id)
  );

  if (!producto) {
    alert("No se encontró el producto.");
    return;
  }

  productoEnEdicion = producto;

  const nombre = document.getElementById("nombreProducto");
  const precioCUP = document.getElementById("precioCUPProducto");
  const precioUSD = document.getElementById("precioUSDProducto");

  if (nombre) nombre.value = producto.nombre;
  if (precioCUP) precioCUP.value = producto.precioCUP;
  if (precioUSD) precioUSD.value = producto.precioUSD;

  const titulo = document.getElementById("tituloFormularioProducto");
  const boton = document.getElementById("btnGuardarProducto");
  const cancelar = document.getElementById("btnCancelarEdicion");

  if (titulo) titulo.textContent = "Editar producto";
  if (boton) boton.textContent = "Actualizar producto";
  if (cancelar) cancelar.style.display = "block";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ==========================================
// 14. CANCELAR EDICIÓN
// ==========================================

function cancelarEdicion() {
  productoEnEdicion = null;
  mostrarProductos();
}

// ==========================================
// 15. ELIMINAR PRODUCTO
// ==========================================

async function eliminarProducto(id) {
  const producto = productos.find(p =>
    String(p.id) === String(id)
  );

  if (!producto) return;

  const confirmar = confirm(
    `¿Eliminar el producto "${producto.nombre}"?`
  );

  if (!confirmar) return;

  try {
    await eliminarDato("productos", producto.id);

    productos = productos.filter(p =>
      String(p.id) !== String(id)
    );

    carrito = carrito.filter(item =>
      String(item.id) !== String(id)
    );

    alert("Producto eliminado correctamente.");

    mostrarProductos();

  } catch (error) {
    console.error("Error al eliminar producto:", error);
    alert("No se pudo eliminar el producto.");
  }
}

// ==========================================
// 16. PANTALLA DE CAJA
// ==========================================

function mostrarCaja() {
  const pantalla = document.getElementById("pantallaCaja");
  if (!pantalla) return;

  carrito = [];

  pantalla.innerHTML = `
    <span class="etiqueta">OPERACIÓN COMERCIAL</span>

    <h2 class="titulo-seccion">Nueva venta</h2>

    <div class="tarjeta">

      <label for="fechaVenta">Fecha y hora</label>

      <input
        type="datetime-local"
        id="fechaVenta"
        value="${fechaLocal()}">

      <label for="lugarVenta">Lugar donde se realiza la venta</label>

      <select id="lugarVenta" required>
        <option value="">Seleccionar lugar...</option>
        <option value="Almacén">Almacén</option>
        <option value="Tienda">Tienda</option>
        <option value="Casa">Casa</option>
      </select>

      <label for="monedaVenta">Moneda de venta</label>

      <select
        id="monedaVenta"
        onchange="cambiarMonedaVenta(this.value)">

        <option value="CUP">CUP</option>
        <option value="USD">USD</option>
      </select>

      <label for="porcentajeVenta">Porcentaje de salario</label>

      <input
        type="number"
        id="porcentajeVenta"
        min="0"
        step="0.01"
        value="${porcentajeSalario}"
        oninput="actualizarResumen()">

    </div>

    <div class="tarjeta">

      <h3>Seleccionar productos</h3>

      <div id="productosCaja"></div>

    </div>

    <div class="tarjeta">

      <h3>Productos de la venta</h3>

      <div id="carritoVenta"></div>

      <div id="resumenVenta"></div>

      <button
        class="btn-principal"
        style="margin-top:15px"
        onclick="registrarVenta()">
        Registrar venta
      </button>

    </div>
  `;

  dibujarProductosCaja();
  actualizarResumen();
}

// ==========================================
// 17. CAMBIAR MONEDA DE VENTA
// ==========================================

function cambiarMonedaVenta(moneda) {
  if (!["CUP", "USD"].includes(moneda)) return;

  monedaVenta = moneda;

  // Mantener las cantidades seleccionadas al cambiar
  // la moneda de la operación.

  dibujarProductosCaja();
  actualizarResumen();
}

// ==========================================
// 18. MOSTRAR PRODUCTOS EN LA CAJA
// ==========================================

function dibujarProductosCaja() {
  const contenedor = document.getElementById("productosCaja");
  if (!contenedor) return;

  if (!productos.length) {
    contenedor.innerHTML = `
      <p class="texto-vacio">
        No hay productos registrados.
        Primero agrega productos en el apartado Productos.
      </p>
    `;
    return;
  }

  contenedor.innerHTML = productos.map(producto => {
    const precio = precioProducto(producto, monedaVenta);

    const itemCarrito = carrito.find(item =>
      String(item.id) === String(producto.id)
    );

    const cantidad = itemCarrito ? itemCarrito.cantidad : 0;

    return `
      <div class="producto">

        <div class="producto-info">

          <h3>${escapar(producto.nombre)}</h3>

          <p class="precio">
            ${formato(precio)} ${monedaVenta}
          </p>

        </div>

        <div class="controles-cantidad">

          <button
            class="btn-cantidad"
            onclick="cambiarCantidad('${escapar(String(producto.id))}',-1)">
            −
          </button>

          <span class="cantidad">${cantidad}</span>

          <button
            class="btn-cantidad"
            onclick="cambiarCantidad('${escapar(String(producto.id))}',1)">
            +
          </button>

        </div>

      </div>
    `;
  }).join("");
}

// ==========================================
// 19. CAMBIAR CANTIDAD DEL CARRITO
// ==========================================

function cambiarCantidad(id, cambio) {
  const producto = productos.find(p =>
    String(p.id) === String(id)
  );

  if (!producto) return;

  let item = carrito.find(p =>
    String(p.id) === String(id)
  );

  if (!item && cambio > 0) {
    item = {
      id: producto.id,
      nombre: producto.nombre,
      precioCUP: Number(producto.precioCUP || 0),
      precioUSD: Number(producto.precioUSD || 0),
      cantidad: 0
    };

    carrito.push(item);
  }

  if (!item) return;

  item.cantidad += cambio;

  if (item.cantidad <= 0) {
    carrito = carrito.filter(p =>
      String(p.id) !== String(id)
    );
  }

  dibujarProductosCaja();
  actualizarResumen();
}

// ==========================================
// 20. CALCULAR VENTA
// ==========================================

function calcularVenta() {
  const porcentajeInput = document.getElementById("porcentajeVenta");

  const porcentaje = porcentajeInput
    ? Number(porcentajeInput.value)
    : porcentajeSalario;

  let total = 0;
  let totalCUP = 0;

  const lineas = carrito.map(item => {
    const cantidad = Number(item.cantidad || 0);

    const precio = precioProducto(item, monedaVenta);

    const precioCUP = Number(item.precioCUP || 0);
    const precioUSD = Number(item.precioUSD || 0);

    const subtotal = precio * cantidad;
    const subtotalCUP = precioCUP * cantidad;

    total += subtotal;
    totalCUP += subtotalCUP;

    return {
      id: item.id,
      productoId: item.id,
      nombre: item.nombre,
      cantidad,
      precio,
      precioCUP,
      precioUSD,
      subtotal,
      subtotalCUP,
      moneda: monedaVenta
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

// ==========================================
// 21. ACTUALIZAR RESUMEN DE VENTA
// ==========================================

function actualizarResumen() {
  const contenedorCarrito = document.getElementById("carritoVenta");
  const contenedorResumen = document.getElementById("resumenVenta");

  if (!contenedorCarrito || !contenedorResumen) return;

  const calculo = calcularVenta();

  if (!carrito.length) {
    contenedorCarrito.innerHTML = `
      <p class="texto-vacio">
        El carrito está vacío.
      </p>
    `;
  } else {
    contenedorCarrito.innerHTML = carrito.map(item => {
      const precio = precioProducto(item, monedaVenta);

      return `
        <div class="producto">

          <div class="producto-info">

            <h3>${escapar(item.nombre)}</h3>

            <p style="font-size:12px;color:#777;margin-top:5px">
              ${formato(precio)} ${monedaVenta}
              × ${item.cantidad}
            </p>

            <p class="precio" style="margin-top:5px">
              Subtotal:
              ${formato(precio * item.cantidad)} ${monedaVenta}
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
        <span style="color:#ddd">
          Salario (${formato(calculo.porcentaje)}%):
        </span>

        <strong class="salario">
          ${formato(calculo.salarioCUP)} CUP
        </strong>
      </div>

    </div>
  `;
}

// ==========================================
// 22. REGISTRAR VENTA
// ==========================================

async function registrarVenta() {

  // COMPROBAR CARRITO

  if (!carrito.length) {
    alert("Agrega al menos un producto al carrito.");
    return;
  }

  // COMPROBAR FECHA

  const campoFecha = document.getElementById("fechaVenta");
  const fechaTexto = campoFecha?.value;

  if (!fechaTexto) {
    alert("Selecciona la fecha y hora de la venta.");
    return;
  }

  const fecha = new Date(fechaTexto);

  if (Number.isNaN(fecha.getTime())) {
    alert("La fecha de venta no es válida.");
    return;
  }

  // COMPROBAR LUGAR

  const lugarVenta = document.getElementById("lugarVenta")?.value || "";

  if (!["Almacén", "Tienda", "Casa"].includes(lugarVenta)) {
    alert("Selecciona dónde se realizó la venta.");
    return;
  }

  // COMPROBAR PORCENTAJE

  const campoPorcentaje = document.getElementById("porcentajeVenta");

  const porcentaje = campoPorcentaje
    ? Number(campoPorcentaje.value)
    : porcentajeSalario;

  if (
    !Number.isFinite(porcentaje) ||
    porcentaje < 0
  ) {
    alert("Introduce un porcentaje de salario válido.");
    return;
  }

  porcentajeSalario = porcentaje;

  // CALCULAR IMPORTES

  const calculo = calcularVenta();

  if (
    !Number.isFinite(calculo.total) ||
    calculo.total <= 0
  ) {
    alert("El total de la venta debe ser mayor que cero.");
    return;
  }

  if (
    calculo.lineas.some(item =>
      !Number.isFinite(item.precio) ||
      item.precio <= 0
    )
  ) {
    alert(
      "Hay productos sin precio válido en la moneda seleccionada."
    );
    return;
  }

  // CONFIRMACIÓN

  const confirmar = confirm(
    "¿Deseas registrar esta venta?\n\n" +
    "Lugar: " + lugarVenta + "\n" +
    "Total: " + formato(calculo.total) + " " + monedaVenta + "\n" +
    "Base para salario: " + formato(calculo.totalCUP) + " CUP\n" +
    "Salario: " + formato(calculo.salarioCUP) + " CUP"
  );

  if (!confirmar) return;

  // CREAR REGISTRO

  const venta = {
    id: Date.now(),

    fecha: fecha.toISOString(),

    lugarVenta,

    moneda: monedaVenta,

    productos: calculo.lineas,

    total: calculo.total,

    totalCUP: monedaVenta === "CUP"
      ? calculo.total
      : 0,

    totalUSD: monedaVenta === "USD"
      ? calculo.total
      : 0,

    salario: calculo.salarioCUP,

    salarioCUP: calculo.salarioCUP,

    salarioUSD: 0,

    porcentaje: calculo.porcentaje
  };

  // GUARDAR EN INDEXEDDB

  try {

    // Esta es la función real de tu database.js.
    // No utilizar guardarRegistro().

    await guardarDato("ventas", venta);

    // Actualizar memoria de la aplicación.

    ventas.push(adaptarVenta(venta));

    // Limpiar carrito después de confirmar el guardado.

    carrito = [];

    alert("Venta registrada correctamente.");

    navegar("inicio");

  } catch (error) {

    console.error("ERROR AL REGISTRAR VENTA:", error);

    alert(
      "No se pudo registrar la venta.\n\n" +
      "Detalle: " + (error.message || "Error desconocido")
    );

  }
}

// ==========================================
// 23. PANTALLA DE REGISTRO
// ==========================================

function mostrarRegistro() {
  const pantalla = document.getElementById("pantallaRegistro");
  if (!pantalla) return;

  pantalla.innerHTML = `
    <span class="etiqueta">HISTORIAL</span>

    <h2 class="titulo-seccion">Registro de ventas</h2>

    <div class="tarjeta">

      <h3>Filtros de búsqueda</h3>

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

        ${productos.map(producto => `
          <option value="${escapar(String(producto.id))}">
            ${escapar(producto.nombre)}
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
        step="0.01"
        placeholder="Sin mínimo"
        oninput="actualizarRegistro()">

      <label for="filtroMaximo">Importe máximo</label>

      <input
        type="number"
        id="filtroMaximo"
        min="0"
        step="0.01"
        placeholder="Sin máximo"
        oninput="actualizarRegistro()">

      <button
        class="btn-secundario"
        style="width:100%;margin-top:12px"
        onclick="limpiarFiltrosRegistro()">
        Limpiar filtros
      </button>

      <button
        class="btn-principal"
        style="width:100%;margin-top:10px"
        onclick="exportarRegistroPDF()">
        Exportar PDF
      </button>

    </div>

    <div class="tarjeta">

      <h3>Resumen general</h3>

      <div id="resumenCompletoVentas"></div>

    </div>

    <div class="tarjeta">

      <h3>Resultados de búsqueda</h3>

      <div id="resultadosRegistro"></div>

    </div>
  `;

  actualizarVisibilidadFiltros();
  mostrarResumenVentas();
  actualizarRegistro();
}

// ==========================================
// 24. RESUMEN GENERAL
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

  const salario = ventas.reduce(
    (suma, venta) => suma + Number(
      venta.salarioCUP ?? venta.salario ?? 0
    ),
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
    <div style="display:flex;justify-content:space-between;margin:12px 0;gap:10px">
      <span>Operaciones registradas:</span>
      <strong>${ventas.length}</strong>
    </div>

    <div style="display:flex;justify-content:space-between;margin:12px 0;gap:10px">
      <span>Unidades vendidas:</span>
      <strong>${unidades}</strong>
    </div>

    <div style="display:flex;justify-content:space-between;margin:12px 0;gap:10px">
      <span>Total vendido en CUP:</span>
      <strong>${formato(totalCUP)} CUP</strong>
    </div>

    <div style="display:flex;justify-content:space-between;margin:12px 0;gap:10px">
      <span>Total vendido en USD:</span>
      <strong>${formato(totalUSD)} USD</strong>
    </div>

    <div style="display:flex;justify-content:space-between;margin:12px 0;gap:10px">
      <span>Salario acumulado:</span>
      <strong class="salario">${formato(salario)} CUP</strong>
    </div>
  `;
}

// ==========================================
// 25. MOSTRAR FILTROS DE FECHA
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
// 26. LIMPIAR FILTROS
// ==========================================

function limpiarFiltrosRegistro() {
  const campos = [
    "filtroPeriodo",
    "filtroProducto",
    "filtroMoneda",
    "filtroLugar",
    "filtroMinimo",
    "filtroMaximo"
  ];

  campos.forEach(id => {
    const campo = document.getElementById(id);

    if (!campo) return;

    campo.value = id === "filtroPeriodo" ? "todo" : "";
  });

  actualizarVisibilidadFiltros();
  actualizarRegistro();
}

// ==========================================
// 27. ACTUALIZAR REGISTRO
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

  // ------------------------------------------
  // FILTRO POR DÍA
  // ------------------------------------------

  if (periodo === "dia") {
    const fecha = document.getElementById("fechaFiltro")?.value;

    if (fecha) {
      lista = lista.filter(venta =>
        fechaParaComparar(venta.fecha) === fecha
      );
    }
  }

  // ------------------------------------------
  // FILTRO POR MES
  // ------------------------------------------

  if (periodo === "mes") {
    const mes = document.getElementById("mesFiltro")?.value;

    if (mes) {
      lista = lista.filter(venta =>
        mesLocal(venta.fecha) === mes
      );
    }
  }

  // ------------------------------------------
  // FILTRO POR AÑO
  // ------------------------------------------

  if (periodo === "anio") {
    const anio = document.getElementById("anioFiltro")?.value;

    if (anio) {
      lista = lista.filter(venta => {
        const fecha = new Date(venta.fecha);

        return !Number.isNaN(fecha.getTime()) &&
          String(fecha.getFullYear()) === String(anio);
      });
    }
  }

  // ------------------------------------------
  // FILTRO POR RANGO DE FECHAS
  // ------------------------------------------

  if (periodo === "rango") {
    const desde = document.getElementById("fechaDesde")?.value;
    const hasta = document.getElementById("fechaHasta")?.value;

    if (desde && hasta && desde > hasta) {
      contenedor.innerHTML = `
        <p class="texto-vacio">
          La fecha inicial no puede ser posterior a la fecha final.
        </p>
      `;
      return;
    }

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

  // ------------------------------------------
  // FILTRO POR PRODUCTO
  // ------------------------------------------

  if (productoFiltro) {
    lista = lista.filter(venta =>
      (venta.productos || []).some(producto =>
        String(producto.productoId ?? producto.id) ===
        String(productoFiltro)
      )
    );
  }

  // ------------------------------------------
  // FILTRO POR MONEDA
  // ------------------------------------------

  if (monedaFiltro) {
    lista = lista.filter(venta =>
      venta.moneda === monedaFiltro
    );
  }

  // ------------------------------------------
  // FILTRO POR LUGAR
  // ------------------------------------------

  if (lugarFiltro) {
    lista = lista.filter(venta =>
      (venta.lugarVenta || "Sin especificar") === lugarFiltro
    );
  }

  // ------------------------------------------
  // FILTRO POR IMPORTE
  // ------------------------------------------

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

  // ------------------------------------------
  // ORDENAR POR FECHA
  // ------------------------------------------

  lista.sort((a, b) =>
    new Date(b.fecha).getTime() -
    new Date(a.fecha).getTime()
  );

  // ------------------------------------------
  // SIN RESULTADOS
  // ------------------------------------------

  if (!lista.length) {
    contenedor.innerHTML = `
      <p class="texto-vacio">
        No hay ventas que coincidan con los filtros seleccionados.
      </p>
    `;
    return;
  }

  // ------------------------------------------
  // TOTALES DEL RESULTADO FILTRADO
  // ------------------------------------------

  const totalCUP = lista.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0),
    0
  );

  const totalUSD = lista.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0),
    0
  );

  const salarioTotal = lista.reduce(
    (suma, venta) => suma + Number(
      venta.salarioCUP ?? venta.salario ?? 0
    ),
    0
  );

  let html = `
    <div class="resumen" style="margin-bottom:15px">

      <p style="color:#ddd;font-size:13px">
        Ventas encontradas: ${lista.length}
      </p>

      <div style="margin-top:10px">
        <strong>Total CUP:</strong>
        ${formato(totalCUP)} CUP
      </div>

      <div style="margin-top:7px">
        <strong>Total USD:</strong>
        ${formato(totalUSD)} USD
      </div>

      <div style="margin-top:7px">
        <strong>Salario:</strong>
        <span class="salario">
          ${formato(salarioTotal)} CUP
        </span>
      </div>

    </div>
  `;

  // ------------------------------------------
  // TARJETAS DE CADA VENTA
  // ------------------------------------------

  html += lista.map(venta => {
    const moneda = venta.moneda || "CUP";
    const lugar = venta.lugarVenta || "Sin especificar";

    const salario = Number(
      venta.salarioCUP ?? venta.salario ?? 0
    );

    const productosHTML = (venta.productos || []).map(producto => {
      const cantidad = Number(producto.cantidad || 0);
      const precio = Number(producto.precio || 0);

      const subtotal = Number(
        producto.subtotal !== undefined
          ? producto.subtotal
          : cantidad * precio
      );

      return `
        <div class="producto">

          <div class="producto-info">

            <strong>${escapar(producto.nombre)}</strong>

            <p style="font-size:12px;color:#777;margin-top:5px">
              ${cantidad} unidades × ${formato(precio)} ${moneda}
            </p>

          </div>

          <strong>
            ${formato(subtotal)} ${moneda}
          </strong>

        </div>
      `;
    }).join("");

    return `
      <div class="tarjeta" style="margin-bottom:15px">

        <span class="etiqueta">VENTA REGISTRADA</span>

        <h3 style="margin-top:8px">
          ${escapar(mostrarFecha(venta.fecha))}
        </h3>

        <div style="
          background:#f5f5f5;
          padding:11px;
          border-radius:8px;
          margin:12px 0;
        ">
          <strong>Lugar de venta:</strong>
          ${escapar(lugar)}
        </div>

        <div>
          ${productosHTML}
        </div>

        <hr style="border:0;border-top:1px solid #ddd;margin:12px 0">

        <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
          <strong>Total de venta:</strong>

          <strong class="precio">
            ${formato(venta.total)} ${moneda}
          </strong>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
          <span>Porcentaje de salario:</span>
          <strong>${formato(venta.porcentaje)}%</strong>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
          <span>Salario:</span>

          <strong class="salario">
            ${formato(salario)} CUP
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
// 28. EXPORTAR REGISTRO A PDF
// ==========================================

function exportarRegistroPDF() {
  const contenedor = document.getElementById("resultadosRegistro");

  if (!contenedor || !contenedor.innerHTML.trim()) {
    alert("No hay información para exportar.");
    return;
  }

  const ventana = window.open("", "_blank");

  if (!ventana) {
    alert("El navegador bloqueó la ventana. Permite las ventanas emergentes para exportar.");
    return;
  }

  const contenido = contenedor.innerHTML;

  ventana.document.open();

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">

      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <title>Registro de ventas - CAJA</title>

      <style>
        body {
          font-family: Arial, sans-serif;
          color: #222;
          margin: 25px;
        }

        h1 {
          margin-bottom: 5px;
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
          border-bottom: 1px solid #eee;
          padding: 8px 0;
        }

        .producto-info p {
          margin: 4px 0;
        }

        .resumen {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 8px;
        }

        .etiqueta {
          font-size: 11px;
          color: #666;
        }

        .precio, .salario {
          font-weight: bold;
        }

        button {
          display: none !important;
        }

        @media print {
          body {
            margin: 10mm;
          }
        }
      </style>
    </head>

    <body>

      <h1>CAJA</h1>

      <p>Registro de ventas</p>

      <p>Fecha de exportación: ${escapar(mostrarFecha(new Date()))}</p>

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
// 29. ELIMINAR UNA VENTA
// ==========================================

async function eliminarVenta(id) {
  const venta = ventas.find(
    elemento => String(elemento.id) === String(id)
  );

  if (!venta) {
    alert("No se encontró la venta seleccionada.");
    return;
  }

  const confirmar = confirm(
    "¿Estás seguro de eliminar esta venta? Esta operación no se puede deshacer."
  );

  if (!confirmar) return;

  try {
    await eliminarDato("ventas", venta.id);

    ventas = ventas.filter(
      elemento => String(elemento.id) !== String(id)
    );

    mostrarResumenVentas();
    actualizarRegistro();

    alert("La venta fue eliminada correctamente.");

  } catch (error) {
    console.error("Error al eliminar venta:", error);

    alert(
      "No se pudo eliminar la venta. Detalles: " +
      (error.message || error)
    );
  }
}

// ==========================================
// 30. PANTALLA DE ESTADÍSTICAS
// ==========================================

function mostrarEstadisticas() {
  const pantalla = document.getElementById("pantallaEstadisticas");

  if (!pantalla) return;

  const totalCUP = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalCUP || 0),
    0
  );

  const totalUSD = ventas.reduce(
    (suma, venta) => suma + Number(venta.totalUSD || 0),
    0
  );

  const salario = ventas.reduce(
    (suma, venta) => suma + Number(
      venta.salarioCUP ?? venta.salario ?? 0
    ),
    0
  );

  const unidades = ventas.reduce((suma, venta) => {
    return suma + (venta.productos || []).reduce(
      (subtotal, producto) =>
        subtotal + Number(producto.cantidad || 0),
      0
    );
  }, 0);

  const lugares = ["Almacén", "Tienda", "Casa", "Sin especificar"];

  const ventasPorLugar = lugares.map(lugar => {
    const cantidad = ventas.filter(venta =>
      (venta.lugarVenta || "Sin especificar") === lugar
    ).length;

    return { lugar, cantidad };
  });

  // ------------------------------------------
  // ÚLTIMOS SEIS MESES
  // ------------------------------------------

  const meses = [];

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date();

    fecha.setDate(1);
    fecha.setHours(12, 0, 0, 0);
    fecha.setMonth(fecha.getMonth() - i);

    const clave =
      fecha.getFullYear() + "-" +
      String(fecha.getMonth() + 1).padStart(2, "0");

    const nombre = fecha.toLocaleDateString("es", {
      month: "short",
      year: "2-digit"
    });

    const ventasMes = ventas.filter(venta =>
      mesLocal(venta.fecha) === clave
    );

    meses.push({
      clave,
      nombre,
      cantidad: ventasMes.length,
      cup: ventasMes.reduce(
        (suma, venta) => suma + Number(venta.totalCUP || 0),
        0
      ),
      usd: ventasMes.reduce(
        (suma, venta) => suma + Number(venta.totalUSD || 0),
        0
      )
    });
  }

  const maxCUP = Math.max(1, ...meses.map(mes => mes.cup));
  const maxUSD = Math.max(1, ...meses.map(mes => mes.usd));
  const maxOperaciones = Math.max(
    1,
    ...meses.map(mes => mes.cantidad)
  );

  // ------------------------------------------
  // PRODUCTOS MÁS VENDIDOS
  // ------------------------------------------

  const productosVendidos = {};

  ventas.forEach(venta => {
    (venta.productos || []).forEach(producto => {
      const nombre = producto.nombre || "Producto sin nombre";

      if (!productosVendidos[nombre]) {
        productosVendidos[nombre] = 0;
      }

      productosVendidos[nombre] += Number(producto.cantidad || 0);
    });
  });

  const rankingProductos = Object.entries(productosVendidos)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const maxProducto = Math.max(
    1,
    ...rankingProductos.map(producto => producto.cantidad)
  );

  // ------------------------------------------
  // CONSTRUIR PANTALLA
  // ------------------------------------------

  pantalla.innerHTML = `
    <span class="etiqueta">ANÁLISIS DEL NEGOCIO</span>

    <h2 class="titulo-seccion">Estadísticas</h2>

    <div class="tarjeta">

      <h3>Resumen general</h3>

      <div class="resumen">

        <div style="margin:12px 0">
          <span>Operaciones realizadas</span>
          <h2>${ventas.length}</h2>
        </div>

        <div style="margin:12px 0">
          <span>Unidades vendidas</span>
          <h2>${unidades}</h2>
        </div>

        <div style="margin:12px 0">
          <span>Ingresos en CUP</span>
          <h2>${formato(totalCUP)} CUP</h2>
        </div>

        <div style="margin:12px 0">
          <span>Ingresos en USD</span>
          <h2>${formato(totalUSD)} USD</h2>
        </div>

        <div style="margin:12px 0">
          <span>Salario acumulado</span>
          <h2 class="salario">${formato(salario)} CUP</h2>
        </div>

      </div>

    </div>

    <div class="tarjeta">

      <h3>Ventas por lugar</h3>

      ${ventasPorLugar.map(item => {
        const porcentaje = ventas.length
          ? (item.cantidad / ventas.length) * 100
          : 0;

        return `
          <div style="margin:15px 0">

            <div style="
              display:flex;
              justify-content:space-between;
              gap:10px;
              margin-bottom:6px
            ">
              <strong>${escapar(item.lugar)}</strong>
              <strong>${item.cantidad} ventas</strong>
            </div>

            <div style="
              height:12px;
              background:#e5e5e5;
              border-radius:10px;
              overflow:hidden
            ">
              <div style="
                height:100%;
                width:${porcentaje}%;
                background:#f28c28;
                border-radius:10px
              "></div>
            </div>

            <small>${porcentaje.toFixed(1)}%</small>

          </div>
        `;
      }).join("")}

    </div>

    <div class="tarjeta">

      <h3>Operaciones de los últimos 6 meses</h3>

      ${meses.map(mes => {
        const porcentaje = (mes.cantidad / maxOperaciones) * 100;

        return `
          <div style="margin:14px 0">

            <div style="display:flex;justify-content:space-between">
              <strong>${escapar(mes.nombre)}</strong>
              <strong>${mes.cantidad} ventas</strong>
            </div>

            <div style="
              height:12px;
              background:#e5e5e5;
              border-radius:10px;
              overflow:hidden;
              margin-top:6px
            ">
              <div style="
                height:100%;
                width:${porcentaje}%;
                background:#f28c28
              "></div>
            </div>

          </div>
        `;
      }).join("")}

    </div>

    <div class="tarjeta">

      <h3>Ingresos mensuales en CUP</h3>

      ${meses.map(mes => {
        const porcentaje = (mes.cup / maxCUP) * 100;

        return `
          <div style="margin:14px 0">

            <div style="display:flex;justify-content:space-between;gap:10px">
              <strong>${escapar(mes.nombre)}</strong>
              <strong>${formato(mes.cup)} CUP</strong>
            </div>

            <div style="
              height:12px;
              background:#e5e5e5;
              border-radius:10px;
              overflow:hidden;
              margin-top:6px
            ">
              <div style="
                height:100%;
                width:${porcentaje}%;
                background:#269b63
              "></div>
            </div>

          </div>
        `;
      }).join("")}

    </div>

    <div class="tarjeta">

      <h3>Ingresos mensuales en USD</h3>

      ${meses.map(mes => {
        const porcentaje = (mes.usd / maxUSD) * 100;

        return `
          <div style="margin:14px 0">

            <div style="display:flex;justify-content:space-between;gap:10px">
              <strong>${escapar(mes.nombre)}</strong>
              <strong>${formato(mes.usd)} USD</strong>
            </div>

            <div style="
              height:12px;
              background:#e5e5e5;
              border-radius:10px;
              overflow:hidden;
              margin-top:6px
            ">
              <div style="
                height:100%;
                width:${porcentaje}%;
                background:#4285d4
              "></div>
            </div>

          </div>
        `;
      }).join("")}

    </div>

    <div class="tarjeta">

      <h3>Productos más vendidos</h3>

      ${
        rankingProductos.length
          ? rankingProductos.map((producto, indice) => {
              const porcentaje =
                (producto.cantidad / maxProducto) * 100;

              return `
                <div style="margin:15px 0">

                  <div style="
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    margin-bottom:6px
                  ">
                    <strong>${indice + 1}. ${escapar(producto.nombre)}</strong>
                    <strong>${producto.cantidad} unidades</strong>
                  </div>

                  <div style="
                    height:12px;
                    background:#e5e5e5;
                    border-radius:10px;
                    overflow:hidden
                  ">
                    <div style="
                      height:100%;
                      width:${porcentaje}%;
                      background:#f28c28
                    "></div>
                  </div>

                </div>
              `;
            }).join("")
          : `<p class="texto-vacio">Todavía no hay productos vendidos.</p>`
      }

    </div>
  `;
}


// ==========================================
// 31. CONTEO DE EFECTIVO
// ==========================================

const denominacionesEfectivo = [
  10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000
];

const CLAVE_CONTEO_EFECTIVO = "caja_conteo_efectivo_v1";

// ==========================================
// 32. LEER CONTEO GUARDADO
// ==========================================

function obtenerConteoGuardado() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_CONTEO_EFECTIVO)
    );

    // Compatibilidad con el formato anterior
    const cantidades = datos?.cantidades || datos || {};

    const resultado = {};

    denominacionesEfectivo.forEach(valor => {
      const cantidad = cantidades[valor];

      resultado[valor] = Math.max(
        0,
        Number(cantidad) || 0
      );
    });

    return resultado;

  } catch (error) {
    console.error("Error leyendo conteo:", error);

    return {};
  }
}

// ==========================================
// 33. GUARDAR CONTEO
// ==========================================

function guardarConteoEfectivo() {
  try {
    const datos = {};

    denominacionesEfectivo.forEach(valor => {
      const campo = document.getElementById(
        "efectivo_" + valor
      );

      datos[valor] = campo
        ? Math.max(0, Number(campo.value) || 0)
        : 0;
    });

    localStorage.setItem(
      CLAVE_CONTEO_EFECTIVO,
      JSON.stringify({ cantidades: datos })
    );

  } catch (error) {
    console.error("Error guardando conteo:", error);
  }
}

// ==========================================
// 34. MOSTRAR CONTEO DE EFECTIVO
// ==========================================

function mostrarEfectivo() {
  const pantalla = document.getElementById("pantallaEfectivo");

  if (!pantalla) return;

  const guardado = obtenerConteoGuardado();

  pantalla.innerHTML = `
    <span class="etiqueta">CONTROL DE DINERO</span>

    <h2 class="titulo-seccion">Conteo de efectivo</h2>

    <div style="
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px
    ">

      ${denominacionesEfectivo.map(valor => {
        const cantidad = Number(guardado[valor] || 0);
        const subtotal = valor * cantidad;

        return `
          <div class="tarjeta" style="
            margin:0;
            padding:13px;
            text-align:center
          ">

            <h3 style="
              font-size:20px;
              margin:0 0 12px
            ">
              ${formato(valor)}
            </h3>

            <label
              for="efectivo_${valor}"
              style="
                display:block;
                font-size:12px;
                color:#777;
                margin-bottom:6px
              ">
              Cantidad de billetes
            </label>

            <input
              type="number"
              id="efectivo_${valor}"
              min="0"
              step="1"
              inputmode="numeric"
              value="${cantidad > 0 ? cantidad : ""}"
              placeholder="0"
              style="
                width:100%;
                box-sizing:border-box;
                text-align:center;
                font-size:18px;
                font-weight:bold
              "
              oninput="calcularConteoEfectivo()">

            <div style="
              font-size:12px;
              color:#777;
              margin-top:12px
            ">
              Importe
            </div>

            <strong
              id="subtotalEfectivo_${valor}"
              style="
                display:block;
                color:#269b63;
                font-size:15px;
                margin-top:4px
              ">
              ${formato(subtotal)}
            </strong>

          </div>
        `;
      }).join("")}

    </div>

    <div class="tarjeta" style="
      margin-top:16px;
      text-align:center;
      padding:22px
    ">

      <span class="etiqueta">TOTAL DE EFECTIVO</span>

      <h2
        id="totalEfectivo"
        style="
          color:#269b63;
          font-size:30px;
          margin:12px 0
        ">
        0
      </h2>

      <p style="font-size:12px;color:#777">
        Suma de todas las denominaciones
      </p>

    </div>

    <button
      class="btn-secundario"
      style="width:100%;margin-bottom:10px"
      onclick="limpiarConteoEfectivo()">
      Limpiar conteo
    </button>
  `;

  calcularConteoEfectivo();
}

// ==========================================
// 35. CALCULAR CONTEO DE EFECTIVO
// ==========================================

function calcularConteoEfectivo() {
  let total = 0;

  denominacionesEfectivo.forEach(valor => {
    const campo = document.getElementById(
      "efectivo_" + valor
    );

    const cantidad = campo
      ? Math.max(0, Math.floor(Number(campo.value) || 0))
      : 0;

    const subtotal = valor * cantidad;

    total += subtotal;

    const elementoSubtotal = document.getElementById(
      "subtotalEfectivo_" + valor
    );

    if (elementoSubtotal) {
      elementoSubtotal.textContent = formato(subtotal);
    }
  });

  const elementoTotal = document.getElementById("totalEfectivo");

  if (elementoTotal) {
    elementoTotal.textContent = formato(total);
  }

  guardarConteoEfectivo();
}

// ==========================================
// 36. LIMPIAR CONTEO DE EFECTIVO
// ==========================================

function limpiarConteoEfectivo() {
  const confirmar = confirm(
    "¿Quieres borrar todas las cantidades del conteo de efectivo?"
  );

  if (!confirmar) return;

  try {
    const datos = {};

    denominacionesEfectivo.forEach(valor => {
      datos[valor] = 0;
    });

    localStorage.setItem(
      CLAVE_CONTEO_EFECTIVO,
      JSON.stringify({ cantidades: datos })
    );

    mostrarEfectivo();

  } catch (error) {
    console.error("Error limpiando conteo:", error);
    alert("No se pudo limpiar el conteo.");
  }
}


// ==========================================
// 37. INICIAR APLICACIÓN
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  iniciarAplicacion
);
