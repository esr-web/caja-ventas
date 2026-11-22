
// ==========================================
// CAJA - SISTEMA DE GESTIÓN DE VENTAS
// PARTE 1: CONFIGURACIÓN Y FUNCIONES BASE
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
// FECHA LOCAL
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
  if (!producto || typeof producto !== "object") {
    return null;
  }

  return {
    ...producto,
    id: producto.id,
    nombre: String(producto.nombre || ""),
    descripcion: String(producto.descripcion || ""),
    precioCUP: Number(producto.precioCUP) || 0,
    precioUSD: Number(producto.precioUSD) || 0,
    existencia: Number(producto.existencia) || 0
  };
}

// ==========================================
// ADAPTACIÓN DE VENTAS
// ==========================================

function adaptarVenta(venta) {
  if (!venta || typeof venta !== "object") {
    return null;
  }

  return {
    ...venta,
    id: venta.id,
    fecha: venta.fecha || "",
    moneda: venta.moneda || "CUP",
    total: Number(venta.total) || 0,
    totalCUP: Number(venta.totalCUP) || 0,
    salario: Number(venta.salario) || 0,
    lugarVenta: venta.lugarVenta || "Tienda",
    productos: Array.isArray(venta.productos)
      ? venta.productos
      : []
  };
}

// ==========================================
// OBTENER PRECIO SEGÚN MONEDA
// ==========================================

function precioProducto(producto, moneda = monedaVenta) {
  if (!producto) return 0;

  if (moneda === "USD") {
    return Number(producto.precioUSD) || 0;
  }

  return Number(producto.precioCUP) || 0;
}

// ==========================================
// PRECIO BASE EN CUP
// ==========================================

function precioCUPProducto(producto) {
  if (!producto) return 0;

  return Number(producto.precioCUP) || 0;
}

// ==========================================
// CÁLCULO DEL SALARIO SOBRE CUP
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
// FIN DE LA PARTE 1
// ==========================================

// ==========================================
// CAJA - PARTE 2
// BASE DE DATOS Y NAVEGACIÓN
// ==========================================

// ==========================================
// INICIAR Y CARGAR LA APLICACIÓN
// ==========================================

async function iniciarAplicacion() {
  try {
    await abrirBaseDatos();

    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");

    productos = productosGuardados
      .map(adaptarProducto)
      .filter(Boolean);

    ventas = ventasGuardadas
      .map(adaptarVenta)
      .filter(Boolean);

    // Sincronizar los datos adaptados sin cambiar sus ID.
    for (const producto of productos) {
      await guardarDato("productos", producto);
    }

    for (const venta of ventas) {
      await guardarDato("ventas", venta);
    }

    navegar("inicio");

    actualizarEstadoConexion();

  } catch (error) {
    console.error("Error al iniciar CAJA:", error);

    alert(
      "No se pudo iniciar la aplicación.\n\n" +
      "Comprueba que la base de datos esté disponible."
    );
  }
}

// ==========================================
// ESTADO DE CONEXIÓN
// ==========================================

function actualizarEstadoConexion() {
  const punto = document.getElementById("puntoConexion");

  if (!punto) return;

  if (navigator.onLine) {
    punto.style.background = "#58c985";
    punto.title = "Con conexión";
  } else {
    punto.style.background = "#f28c28";
    punto.title = "Funcionamiento sin conexión";
  }
}

window.addEventListener("online", actualizarEstadoConexion);
window.addEventListener("offline", actualizarEstadoConexion);

// ==========================================
// NAVEGACIÓN ENTRE PANTALLAS
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

  if (!idPantalla) {
    console.warn("Pantalla no reconocida:", nombre);
    return;
  }

  const destino = document.getElementById(idPantalla);

  if (!destino) {
    console.warn("No se encontró el elemento:", idPantalla);
    return;
  }

  document.querySelectorAll(".pantalla").forEach(pantalla => {
    pantalla.classList.remove("activa");
  });

  destino.classList.add("activa");

  pantallaActual = nombre;

  // Actualizar navegación inferior.
  document.querySelectorAll(".nav-item").forEach(boton => {
    boton.classList.remove("activo");

    const accion = boton.dataset.pantalla ||
      boton.dataset.destino ||
      "";

    if (accion === nombre) {
      boton.classList.add("activo");
    }
  });

  // Actualizar el contenido de la pantalla.
  if (nombre === "inicio") {
    actualizarInicio();
  }

  if (nombre === "caja") {
    mostrarCaja();
  }

  if (nombre === "productos") {
    mostrarProductos();
  }

  if (nombre === "registro") {
    mostrarRegistro();
  }

  if (nombre === "estadisticas") {
    mostrarEstadisticas();
  }

  if (nombre === "efectivo") {
    mostrarEfectivo();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// Alias para compatibilidad con llamadas anteriores.
function cambiarPantalla(nombre) {
  navegar(nombre);
}

function irPantalla(nombre) {
  navegar(nombre);
}

// ==========================================
// FIN DE LA PARTE 2
// ==========================================


 // ==========================================
 // CAJA - PARTE 3
 // ADMINISTRACIÓN DE PRODUCTOS
 // ==========================================

 // ==========================================
 // MOSTRAR PRODUCTOS
 // ==========================================

 function mostrarProductos() {
   dibujarCatalogo();
 }

 // ==========================================
 // DIBUJAR CATÁLOGO
 // ==========================================

 function dibujarCatalogo() {
   const lista = document.getElementById("listaCatalogo");

   if (!lista) return;

   if (!productos.length) {
     lista.innerHTML = `
       <div class="texto-vacio">
         No hay productos registrados.
       </div>
     `;
     return;
   }

   lista.innerHTML = productos.map(producto => `
     <div class="producto">
       <div class="producto-info">
         <h3>${escapar(producto.nombre)}</h3>

         <p>
           CUP: ${formato(producto.precioCUP || 0)}
         </p>

         <p>
           USD: ${formato(producto.precioUSD || 0)}
         </p>
       </div>

       <div style="
         display:flex;
         flex-direction:column;
         gap:7px
       ">
         <button
           type="button"
           class="btn-secundario"
           onclick="editarProducto(${Number(producto.id)})"
         >
           EDITAR
         </button>

         <button
           type="button"
           class="btn-secundario"
           onclick="eliminarProducto(${Number(producto.id)})"
         >
           ELIMINAR
         </button>
       </div>
     </div>
   `).join("");
 }

 // ==========================================
 // GUARDAR PRODUCTO
 // ==========================================

 async function guardarProducto() {
   const nombreInput = document.getElementById("nombreProducto");
   const precioUSDInput = document.getElementById("precioProductoUSD");
   const precioCUPInput = document.getElementById("precioProductoCUP");

   if (!nombreInput || !precioUSDInput || !precioCUPInput) {
     alert("No se encontraron los campos del producto.");
     return;
   }

   const estabaEditando = productoEnEdicion !== null;

   const nombre = nombreInput.value.trim();

   const precioUSD = Number(precioUSDInput.value);
   const precioCUP = Number(precioCUPInput.value);

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
     precioCUP
   };

   if (estabaEditando) {
     producto.id = productoEnEdicion.id;

     // Conservar otros datos que pudiera tener el producto.
     Object.assign(producto, productoEnEdicion, {
       nombre,
       precioUSD,
       precioCUP
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

     if (estabaEditando) {
       alert("Producto actualizado correctamente.");
     } else {
       alert("Producto guardado correctamente.");
     }

   } catch (error) {
     console.error("Error al guardar producto:", error);
     alert("No se pudo guardar el producto.");
   }
 }

 // ==========================================
 // EDITAR PRODUCTO
 // ==========================================

 function editarProducto(id) {
   const producto = productos.find(
     p => Number(p.id) === Number(id)
   );

   if (!producto) {
     alert("No se encontró el producto.");
     return;
   }

   productoEnEdicion = { ...producto };

   const nombreInput = document.getElementById("nombreProducto");
   const precioUSDInput = document.getElementById("precioProductoUSD");
   const precioCUPInput = document.getElementById("precioProductoCUP");

   if (nombreInput) {
     nombreInput.value = producto.nombre || "";
   }

   if (precioUSDInput) {
     precioUSDInput.value = producto.precioUSD || 0;
   }

   if (precioCUPInput) {
     precioCUPInput.value = producto.precioCUP || 0;
   }

   const botonGuardar = document.getElementById("btnGuardarProducto");
   const botonCancelar = document.getElementById("btnCancelarEdicion");

   if (botonGuardar) {
     botonGuardar.textContent = "ACTUALIZAR PRODUCTO";
   }

   if (botonCancelar) {
     botonCancelar.style.display = "block";
   }

   const formulario = document.getElementById("nombreProducto");

   if (formulario) {
     formulario.scrollIntoView({
       behavior: "smooth",
       block: "center"
     });
   }
 }

 // ==========================================
 // CANCELAR EDICIÓN
 // ==========================================

 function cancelarEdicion() {
   productoEnEdicion = null;

   const nombreInput = document.getElementById("nombreProducto");
   const precioUSDInput = document.getElementById("precioProductoUSD");
   const precioCUPInput = document.getElementById("precioProductoCUP");

   if (nombreInput) nombreInput.value = "";
   if (precioUSDInput) precioUSDInput.value = "";
   if (precioCUPInput) precioCUPInput.value = "";

   const botonGuardar = document.getElementById("btnGuardarProducto");
   const botonCancelar = document.getElementById("btnCancelarEdicion");

   if (botonGuardar) {
     botonGuardar.textContent = "GUARDAR PRODUCTO";
   }

   if (botonCancelar) {
     botonCancelar.style.display = "none";
   }
 }

 // ==========================================
 // ELIMINAR PRODUCTO
 // ==========================================

 async function eliminarProducto(id) {
   const producto = productos.find(
     p => Number(p.id) === Number(id)
   );

   if (!producto) {
     alert("No se encontró el producto.");
     return;
   }

   const confirmar = confirm(
     "¿Deseas eliminar el producto " +
     producto.nombre + "?"
   );

   if (!confirmar) return;

   try {
     await eliminarDato("productos", producto.id);

     productos = productos.filter(
       p => Number(p.id) !== Number(id)
     );

     if (
       productoEnEdicion &&
       Number(productoEnEdicion.id) === Number(id)
     ) {
       cancelarEdicion();
     }

     carrito = carrito.filter(
       linea => Number(linea.idProducto) !== Number(id)
     );

     dibujarCatalogo();
     dibujarProductosCaja();
     dibujarCarrito();

     alert("Producto eliminado correctamente.");

   } catch (error) {
     console.error("Error al eliminar producto:", error);
     alert("No se pudo eliminar el producto.");
   }
 }

 // ==========================================
 // FIN DE LA PARTE 3
 // ==========================================



// ==========================================
// CAJA - PARTE 4
// CAJA Y CARRITO DE VENTAS
// ==========================================

// ==========================================
// LUGARES DE VENTA
// ==========================================

const LUGARES_VENTA = [
  "Almacén",
  "Tienda",
  "Casa"
];

// ==========================================
// MOSTRAR CAJA
// ==========================================

function mostrarCaja() {
  const fechaInput = document.getElementById("fechaVenta");

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = fechaLocal();
  }

  const porcentajeInput = document.getElementById("porcentajeVenta");

  if (porcentajeInput) {
    porcentajeInput.value = porcentajeSalario;
  }

  const monedaSelect = document.getElementById("monedaSeleccionada");

  if (monedaSelect) {
    monedaSelect.value = monedaVenta;
  }

  dibujarProductosCaja();
  dibujarCarrito();
}

// ==========================================
// CAMBIAR MONEDA DE VENTA
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

    const nuevoPrecio = Number(
      precioProducto(producto, nuevaMoneda)
    );

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

  carrito.forEach((linea, indice) => {
    linea.precio = preciosActualizados[indice];
    linea.subtotal = linea.precio * Number(linea.cantidad);
  });

  dibujarProductosCaja();
  dibujarCarrito();
}

// ==========================================
// DIBUJAR PRODUCTOS DISPONIBLES
// ==========================================

function dibujarProductosCaja() {
  const lista = document.getElementById("listaProductosCaja");

  if (!lista) return;

  const busquedaInput = document.getElementById("buscarProductoCaja");
  const busqueda = busquedaInput
    ? busquedaInput.value.trim().toLowerCase()
    : "";

  const filtrados = productos.filter(producto => {
    return String(producto.nombre || "")
      .toLowerCase()
      .includes(busqueda);
  });

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="texto-vacio">
        No hay productos disponibles.
      </div>
    `;
    return;
  }

  lista.innerHTML = filtrados.map(producto => {
    const precio = precioProducto(producto, monedaVenta);

    return `
      <div class="producto">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>

          <div class="precio">
            ${formato(precio)} ${monedaVenta}
          </div>
        </div>

        <button
          type="button"
          class="btn-principal"
          onclick="agregarAlCarrito(${Number(producto.id)})"
        >
          AGREGAR
        </button>
      </div>
    `;
  }).join("");
}

// ==========================================
// AGREGAR PRODUCTO AL CARRITO
// ==========================================

function agregarAlCarrito(id) {
  const producto = productos.find(
    p => Number(p.id) === Number(id)
  );

  if (!producto) {
    alert("No se encontró el producto.");
    return;
  }

  const precio = Number(
    precioProducto(producto, monedaVenta)
  );

  if (!Number.isFinite(precio) || precio <= 0) {
    alert(
      "El producto no tiene un precio válido en " +
      monedaVenta + "."
    );
    return;
  }

  const existente = carrito.find(
    linea => Number(linea.idProducto) === Number(id)
  );

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

// ==========================================
// CAMBIAR CANTIDAD EN EL CARRITO
// ==========================================

function cambiarCantidadCarrito(id, cambio) {
  const linea = carrito.find(
    item => Number(item.idProducto) === Number(id)
  );

  if (!linea) return;

  linea.cantidad += Number(cambio);

  if (linea.cantidad <= 0) {
    quitarDelCarrito(id);
    return;
  }

  linea.subtotal = linea.precio * linea.cantidad;

  dibujarCarrito();
}

// ==========================================
// QUITAR PRODUCTO DEL CARRITO
// ==========================================

function quitarDelCarrito(id) {
  carrito = carrito.filter(
    linea => Number(linea.idProducto) !== Number(id)
  );

  dibujarCarrito();
}

// ==========================================
// CALCULAR TOTALES DE VENTA
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
      (suma, linea) => suma + Number(linea.cantidad || 0),
      0
    )
  };
}

// ==========================================
// DIBUJAR CARRITO
// ==========================================

function dibujarCarrito() {
  const contenedor = document.getElementById("carritoVenta");
  const resumen = document.getElementById("resumenVenta");

  if (!contenedor) return;

  if (!carrito.length) {
    contenedor.innerHTML = `
      <div class="texto-vacio">
        No hay productos en la venta.
      </div>
    `;

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

        <p>
          ${formato(linea.precio)} ${monedaVenta}
          × ${linea.cantidad}
        </p>

        <strong>
          ${formato(linea.subtotal)} ${monedaVenta}
        </strong>
      </div>

      <div class="controles-cantidad">
        <button
          type="button"
          class="btn-cantidad"
          onclick="cambiarCantidadCarrito(${Number(linea.idProducto)},-1)"
        >−</button>

        <span class="cantidad">${linea.cantidad}</span>

        <button
          type="button"
          class="btn-cantidad"
          onclick="cambiarCantidadCarrito(${Number(linea.idProducto)},1)"
        >+</button>

        <button
          type="button"
          class="btn-secundario"
          onclick="quitarDelCarrito(${Number(linea.idProducto)})"
        >×</button>
      </div>
    </div>
  `).join("");

  if (resumen) {
    const totales = calcularTotalesVenta();

    resumen.innerHTML = `
      <div class="total">
        TOTAL: ${formato(totales.total)} ${monedaVenta}
      </div>

      <div class="salario">
        Base salarial: ${formato(totales.baseCUP)} CUP
      </div>

      <div class="salario">
        Salario (${porcentajeSalario}%):
        ${formato(totales.salario)} CUP
      </div>
    `;
  }
}

// ==========================================
// ACTUALIZAR PORCENTAJE DE SALARIO
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
// FIN DE LA PARTE 4
// ==========================================



// ==========================================
// CAJA - PARTE 5
// REGISTRO Y CONFIRMACIÓN DE VENTAS
// ==========================================

let guardandoVenta = false;

// ==========================================
// REGISTRAR VENTA
// ==========================================

function registrarVenta() {
  if (!carrito.length) {
    alert("Agrega productos antes de registrar la venta.");
    return;
  }

  const fechaInput = document.getElementById("fechaVenta");

  const lugarInput =
    document.getElementById("lugarVenta") ||
    document.getElementById("lugarVentaSeleccionado");

  const fecha = fechaInput
    ? fechaInput.value
    : fechaLocal();

  const lugar = lugarInput
    ? lugarInput.value
    : "Tienda";

  if (!fecha) {
    alert("Selecciona la fecha de la venta.");
    return;
  }

  if (!LUGARES_VENTA.includes(lugar)) {
    alert("Selecciona un lugar de venta válido.");
    return;
  }

  const totales = calcularTotalesVenta();

  const confirmacion = confirm(
    "¿Confirmar esta venta?\n\n" +
    "Productos: " + totales.cantidadProductos + "\n" +
    "Total: " + formato(totales.total) + " " + monedaVenta + "\n" +
    "Lugar: " + lugar + "\n" +
    "Salario: " + formato(totales.salario) + " CUP"
  );

  if (!confirmacion) return;

  confirmarVenta();
}

// ==========================================
// CONFIRMAR Y GUARDAR VENTA
// ==========================================

async function confirmarVenta() {
  if (guardandoVenta) return;

  if (!carrito.length) {
    alert("No hay productos para registrar.");
    return;
  }

  const fechaInput = document.getElementById("fechaVenta");

  const lugarInput =
    document.getElementById("lugarVenta") ||
    document.getElementById("lugarVentaSeleccionado");

  const fecha = fechaInput
    ? fechaInput.value
    : fechaLocal();

  const lugar = lugarInput
    ? lugarInput.value
    : "Tienda";

  if (!fecha) {
    alert("Selecciona la fecha de la venta.");
    return;
  }

  if (!LUGARES_VENTA.includes(lugar)) {
    alert("Selecciona un lugar de venta válido.");
    return;
  }

  const totales = calcularTotalesVenta();

  if (
    !Number.isFinite(totales.total) ||
    totales.total <= 0
  ) {
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

      const precioCUP = producto
        ? precioCUPProducto(producto)
        : 0;

      const subtotalCUP = cantidad * precioCUP;

      const baseCUP = monedaVenta === "CUP"
        ? subtotal
        : subtotalCUP;

      const salarioLinea =
        baseCUP * Number(porcentajeSalario) / 100;

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

      // Solo registra importe vendido en CUP.
      totalCUP: monedaVenta === "CUP"
        ? totales.total
        : 0,

      // Base salarial expresada siempre en CUP.
      baseCUP: totales.baseCUP,

      porcentajeSalario,
      salario: totales.salario
    };

    const id = await guardarDato("ventas", venta);

    venta.id = id;

    ventas.push(adaptarVenta(venta));

    // Limpiar carrito únicamente después de guardar.
    carrito = [];

    dibujarCarrito();
    dibujarProductosCaja();

    alert(
      "Venta registrada correctamente.\n\n" +
      "Total: " + formato(venta.total) + " " + venta.moneda + "\n" +
      "Lugar: " + venta.lugarVenta + "\n" +
      "Salario generado: " + formato(venta.salario) + " CUP"
    );

    // Actualizar los datos de inicio.
    actualizarInicio();

  } catch (error) {
    console.error("Error al registrar venta:", error);

    alert(
      "No se pudo registrar la venta.\n\n" +
      "Los productos permanecen en el carrito."
    );

  } finally {
    guardandoVenta = false;
  }
}

// ==========================================
// CANCELAR VENTA
// ==========================================

function cancelarVenta() {
  if (!carrito.length) return;

  const confirmar = confirm(
    "¿Deseas cancelar esta venta y vaciar el carrito?"
  );

  if (!confirmar) return;

  carrito = [];

  dibujarCarrito();
  dibujarProductosCaja();
}

// ==========================================
// FIN DE LA PARTE 5
// ==========================================


// ==========================================
// CAJA - PARTE 6
// HISTORIAL Y FILTROS DE VENTAS
// ==========================================

// ==========================================
// MOSTRAR REGISTRO DE VENTAS
// ==========================================

function mostrarRegistro() {
  cargarOpcionesFiltroProductos();
  dibujarRegistro();
}

// ==========================================
// CARGAR PRODUCTOS EN EL FILTRO
// ==========================================

function cargarOpcionesFiltroProductos() {
  const campo = document.getElementById("filtroProducto");

  if (!campo) return;

  const seleccionActual = campo.value;

  campo.innerHTML = `
    <option value="">Todos los productos</option>
    ${productos.map(producto => `
      <option value="${Number(producto.id)}">
        ${escapar(producto.nombre)}
      </option>
    `).join("")}
  `;

  campo.value = seleccionActual;
}

// ==========================================
// OBTENER VALOR DE UN FILTRO
// ==========================================

function valorFiltro(id) {
  const campo = document.getElementById(id);

  return campo ? campo.value.trim() : "";
}

// ==========================================
// APLICAR FILTROS
// ==========================================

function obtenerVentasFiltradas() {
  const periodo = valorFiltro("filtroPeriodo");
  const producto = valorFiltro("filtroProducto");
  const moneda = valorFiltro("filtroMoneda");
  const lugar = valorFiltro("filtroLugar");
  const minimo = valorFiltro("filtroMinimo");
  const maximo = valorFiltro("filtroMaximo");

  const hoy = fechaLocal();
  const mesActual = mesLocal();

  return ventas.filter(venta => {
    const fecha = fechaParaComparar(venta.fecha);

    // Filtro por período.
    if (periodo === "hoy" && fecha !== hoy) return false;

    if (periodo === "mes" && !fecha.startsWith(mesActual)) {
      return false;
    }

    if (periodo === "anio") {
      if (!fecha.startsWith(String(new Date().getFullYear()))) {
        return false;
      }
    }

    if (periodo === "semana") {
      const fechaVenta = new Date(fecha + "T12:00:00");
      const inicioSemana = new Date();
      inicioSemana.setHours(12, 0, 0, 0);

      const diaSemana = (inicioSemana.getDay() + 6) % 7;

      inicioSemana.setDate(inicioSemana.getDate() - diaSemana);

      if (
        !fecha ||
        fechaVenta < inicioSemana ||
        fechaVenta > new Date()
      ) {
        return false;
      }
    }

    // Filtro por producto.
    if (producto) {
      const idProducto = Number(producto);

      const contieneProducto = venta.productos.some(linea => {
        const id = linea.idProducto ?? linea.id;

        return Number(id) === idProducto;
      });

      if (!contieneProducto) return false;
    }

    // Filtro por moneda.
    if (moneda && venta.moneda !== moneda) {
      return false;
    }

    // Filtro por lugar de venta.
    if (lugar && venta.lugarVenta !== lugar) {
      return false;
    }

    // Filtro por importe.
    const importe = Number(venta.total) || 0;

    if (minimo !== "" && importe < Number(minimo)) {
      return false;
    }

    if (maximo !== "" && importe > Number(maximo)) {
      return false;
    }

    return true;
  });
}

// ==========================================
// DIBUJAR HISTORIAL
// ==========================================

function dibujarRegistro() {
  const contenedor = document.getElementById("listaRegistro");

  if (!contenedor) return;

  const filtradas = obtenerVentasFiltradas()
    .slice()
    .sort((a, b) => {
      const fechaA = a.fechaRegistro || a.fecha || "";
      const fechaB = b.fechaRegistro || b.fecha || "";

      return String(fechaB).localeCompare(String(fechaA));
    });

  if (filtradas.length === 0) {
    contenedor.innerHTML = `
      <div class="texto-vacio">
        No hay ventas que coincidan con los filtros.
      </div>
    `;

    actualizarResumenRegistro([]);
    return;
  }

  contenedor.innerHTML = filtradas.map(venta => {
    const lineas = venta.productos.map(linea => `
      <div style="font-size:12px;color:#666;margin-top:5px">
        ${escapar(linea.nombre || "Producto")}
        × ${Number(linea.cantidad) || 0}
      </div>
    `).join("");

    return `
      <div class="tarjeta">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>
            <h3>Venta #${Number(venta.id)}</h3>

            <small style="color:#777">
              ${mostrarFecha(venta.fecha)}
            </small>
          </div>

          <strong class="precio">
            ${formato(venta.total)} ${escapar(venta.moneda)}
          </strong>
        </div>

        <div style="margin-top:10px;font-size:13px">
          <strong>Lugar:</strong>
          ${escapar(venta.lugarVenta || "Tienda")}
        </div>

        <div style="margin-top:5px;font-size:13px">
          <strong>Moneda:</strong>
          ${escapar(venta.moneda)}
        </div>

        ${lineas}

        <div style="margin-top:12px;font-size:13px">
          <strong>Salario:</strong>
          ${formato(venta.salario)} CUP
        </div>

        <button
          type="button"
          class="btn-peligro"
          style="margin-top:12px;width:100%"
          onclick="eliminarVenta(${Number(venta.id)})"
        >
          Eliminar venta
        </button>
      </div>
    `;
  }).join("");

  actualizarResumenRegistro(filtradas);
}

// ==========================================
// RESUMEN DEL REGISTRO
// ==========================================

function actualizarResumenRegistro(lista) {
  const contenedor = document.getElementById("resumenRegistro");

  if (!contenedor) return;

  const cantidad = lista.length;

  const totalCUP = lista
    .filter(venta => venta.moneda === "CUP")
    .reduce((suma, venta) => suma + venta.total, 0);

  const totalUSD = lista
    .filter(venta => venta.moneda === "USD")
    .reduce((suma, venta) => suma + venta.total, 0);

  const salario = lista.reduce(
    (suma, venta) => suma + (Number(venta.salario) || 0),
    0
  );

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3>Resumen de operaciones</h3>

      <p style="margin-top:10px">
        Operaciones: <strong>${cantidad}</strong>
      </p>

      <p style="margin-top:7px">
        Ventas CUP:
        <strong>${formato(totalCUP)} CUP</strong>
      </p>

      <p style="margin-top:7px">
        Ventas USD:
        <strong>${formato(totalUSD)} USD</strong>
      </p>

      <p style="margin-top:7px">
        Salarios:
        <strong>${formato(salario)} CUP</strong>
      </p>
    </div>
  `;
}

// ==========================================
// ACTUALIZAR FILTROS
// ==========================================

function aplicarFiltrosRegistro() {
  dibujarRegistro();
}

function filtrarRegistro() {
  dibujarRegistro();
}

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

    if (campo) campo.value = "";
  });

  dibujarRegistro();
}

// ==========================================
// ELIMINAR VENTA
// ==========================================

async function eliminarVenta(id) {
  const venta = ventas.find(
    elemento => Number(elemento.id) === Number(id)
  );

  if (!venta) {
    alert("No se encontró la venta.");
    return;
  }

  const confirmar = confirm(
    `¿Eliminar la venta #${venta.id}?\n\n` +
    "Esta acción no se puede deshacer."
  );

  if (!confirmar) return;

  try {
    await eliminarDato("ventas", venta.id);

    ventas = await obtenerTodos("ventas");

    ventas = ventas
      .map(adaptarVenta)
      .filter(Boolean);

    dibujarRegistro();

    alert("Venta eliminada correctamente.");

  } catch (error) {
    console.error("Error al eliminar venta:", error);
    alert("No se pudo eliminar la venta.");
  }
}

// ==========================================
// FIN DE LA PARTE 6
// ==========================================

// ==========================================
// CAJA - PARTE 7
// EXPORTAR REGISTRO A PDF
// ==========================================

function exportarRegistroPDF() {
  const lista = obtenerVentasFiltradas()
    .slice()
    .sort((a, b) => {
      return String(b.fechaRegistro || b.fecha || "")
        .localeCompare(String(a.fechaRegistro || a.fecha || ""));
    });

  if (lista.length === 0) {
    alert("No hay ventas para exportar.");
    return;
  }

  const totalCUP = lista
    .filter(venta => venta.moneda === "CUP")
    .reduce((suma, venta) => suma + Number(venta.total || 0), 0);

  const totalUSD = lista
    .filter(venta => venta.moneda === "USD")
    .reduce((suma, venta) => suma + Number(venta.total || 0), 0);

  const salarioTotal = lista.reduce(
    (suma, venta) => suma + Number(venta.salario || 0),
    0
  );

  const filas = lista.map(venta => {
    const detalle = venta.productos.map(linea => {
      return `
        <div>
          ${escapar(linea.nombre)}
          × ${Number(linea.cantidad) || 0}
        </div>
      `;
    }).join("");

    return `
      <tr>
        <td>${Number(venta.id)}</td>
        <td>${escapar(mostrarFecha(venta.fecha))}</td>
        <td>${escapar(venta.lugarVenta || "Tienda")}</td>
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <title>Registro de ventas - CAJA</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #242424;
          margin: 25px;
        }

        h1 {
          margin-bottom: 5px;
          font-size: 25px;
        }

        .subtitulo {
          color: #777;
          margin-bottom: 25px;
          font-size: 13px;
        }

        .resumen {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .resumen div {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 12px;
          flex: 1;
          min-width: 140px;
        }

        .resumen strong {
          display: block;
          margin-top: 6px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }

        th {
          background: #222;
          color: white;
        }

        .numero {
          text-align: right;
          white-space: nowrap;
        }

        tr {
          page-break-inside: avoid;
        }

        .pie {
          margin-top: 25px;
          color: #777;
          font-size: 10px;
          text-align: center;
        }

        @media print {
          body {
            margin: 10mm;
          }

          .resumen div {
            break-inside: avoid;
          }
        }
      </style>
    </head>

    <body>
      <h1>CAJA | Registro de ventas</h1>

      <div class="subtitulo">
        Informe generado el ${escapar(mostrarFecha(fechaLocal()))}
      </div>

      <div class="resumen">
        <div>
          Operaciones
          <strong>${lista.length}</strong>
        </div>

        <div>
          Total vendido en CUP
          <strong>${formato(totalCUP)} CUP</strong>
        </div>

        <div>
          Total vendido en USD
          <strong>${formato(totalUSD)} USD</strong>
        </div>

        <div>
          Salario acumulado
          <strong>${formato(salarioTotal)} CUP</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>N.º</th>
            <th>Fecha</th>
            <th>Lugar</th>
            <th>Productos</th>
            <th>Moneda</th>
            <th>Total</th>
            <th>Salario</th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>

      <div class="pie">
        Sistema de gestión de ventas CAJA
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `;

  const ventana = window.open("", "_blank");

  if (!ventana) {
    alert(
      "El navegador bloqueó la ventana de impresión.\n\n" +
      "Permite las ventanas emergentes e inténtalo nuevamente."
    );
    return;
  }

  ventana.document.open();
  ventana.document.write(documento);
  ventana.document.close();
}

// ==========================================
// FIN DE LA PARTE 7
// ==========================================

// ==========================================
// CAJA - PARTE 8
// ESTADÍSTICAS Y GRÁFICOS
// ==========================================

// ==========================================
// OBTENER RESUMEN GENERAL
// ==========================================

function obtenerResumenEstadisticas() {
  const operaciones = ventas.length;

  let unidades = 0;
  let totalCUP = 0;
  let totalUSD = 0;
  let salarioTotal = 0;

  const porLugar = {
    "Almacén": 0,
    "Tienda": 0,
    "Casa": 0
  };

  const ranking = {};

  ventas.forEach(venta => {
    salarioTotal += Number(venta.salario) || 0;

    if (venta.moneda === "USD") {
      totalUSD += Number(venta.total) || 0;
    } else {
      totalCUP += Number(venta.total) || 0;
    }

    const lugar = venta.lugarVenta || "Tienda";

    if (porLugar[lugar] !== undefined) {
      porLugar[lugar] += 1;
    }

    (venta.productos || []).forEach(linea => {
      const cantidad = Number(linea.cantidad) || 0;
      const nombre = linea.nombre || "Producto";

      unidades += cantidad;

      if (!ranking[nombre]) {
        ranking[nombre] = 0;
      }

      ranking[nombre] += cantidad;
    });
  });

  return {
    operaciones,
    unidades,
    totalCUP,
    totalUSD,
    salarioTotal,
    porLugar,
    ranking
  };
}

// ==========================================
// GENERAR LOS ÚLTIMOS SEIS MESES
// ==========================================

function obtenerUltimosSeisMeses() {
  const resultado = [];
  const ahora = new Date();

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(
      ahora.getFullYear(),
      ahora.getMonth() - i,
      1
    );

    const clave = mesLocal(fecha);

    resultado.push({
      clave,
      etiqueta: fecha.toLocaleDateString("es-ES", {
        month: "short",
        year: "2-digit"
      }),
      CUP: 0,
      USD: 0
    });
  }

  ventas.forEach(venta => {
    const fecha = fechaParaComparar(venta.fecha);
    const mes = resultado.find(item => item.clave === fecha.slice(0, 7));

    if (!mes) return;

    if (venta.moneda === "USD") {
      mes.USD += Number(venta.total) || 0;
    } else {
      mes.CUP += Number(venta.total) || 0;
    }
  });

  return resultado;
}

// ==========================================
// CREAR GRÁFICO DE BARRAS
// ==========================================

function crearGraficoBarras(titulo, datos, sufijo = "") {
  if (!datos.length) {
    return `
      <div class="tarjeta">
        <h3>${escapar(titulo)}</h3>
        <p class="texto-vacio">No hay datos disponibles.</p>
      </div>
    `;
  }

  const maximo = Math.max(
    ...datos.map(item => Number(item.valor) || 0),
    1
  );

  const barras = datos.map(item => {
    const valor = Number(item.valor) || 0;
    const ancho = Math.max(0, (valor / maximo) * 100);

    return `
      <div style="margin:13px 0">
        <div style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          font-size:12px;
          margin-bottom:5px
        ">
          <strong>${escapar(item.nombre)}</strong>
          <span>${formato(valor)} ${escapar(sufijo)}</span>
        </div>

        <div style="
          width:100%;
          height:12px;
          background:#eeeeee;
          border-radius:20px;
          overflow:hidden
        ">
          <div style="
            width:${ancho}%;
            height:100%;
            background:#f28c28;
            border-radius:20px
          "></div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="tarjeta">
      <h3 style="margin-bottom:15px">
        ${escapar(titulo)}
      </h3>

      ${barras}
    </div>
  `;
}

// ==========================================
// MOSTRAR ESTADÍSTICAS
// ==========================================

function mostrarEstadisticas() {
  const pantalla = document.getElementById("pantallaEstadisticas");

  if (!pantalla) return;

  let contenedor =
    document.getElementById("contenidoEstadisticas") ||
    document.getElementById("estadisticasContenido");

  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "contenidoEstadisticas";
    pantalla.appendChild(contenedor);
  }

  const datos = obtenerResumenEstadisticas();

  const meses = obtenerUltimosSeisMeses();

  const lugares = Object.entries(datos.porLugar).map(([nombre, valor]) => ({
    nombre,
    valor
  }));

  const mejoresProductos = Object.entries(datos.ranking)
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const mesesCUP = meses.map(mes => ({
    nombre: mes.etiqueta,
    valor: mes.CUP
  }));

  const mesesUSD = meses.map(mes => ({
    nombre: mes.etiqueta,
    valor: mes.USD
  }));

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3 style="margin-bottom:15px">
        Resumen general
      </h3>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px
      ">
        <div style="background:#fff1e2;padding:14px;border-radius:12px">
          <small>Operaciones</small>
          <div style="font-size:23px;font-weight:bold">
            ${datos.operaciones}
          </div>
        </div>

        <div style="background:#fff1e2;padding:14px;border-radius:12px">
          <small>Unidades vendidas</small>
          <div style="font-size:23px;font-weight:bold">
            ${formato(datos.unidades)}
          </div>
        </div>

        <div style="background:#eaf5ee;padding:14px;border-radius:12px">
          <small>Ventas CUP</small>
          <div style="font-size:18px;font-weight:bold;color:#16834a">
            ${formato(datos.totalCUP)}
          </div>
        </div>

        <div style="background:#eaf5ee;padding:14px;border-radius:12px">
          <small>Ventas USD</small>
          <div style="font-size:18px;font-weight:bold;color:#16834a">
            ${formato(datos.totalUSD)}
          </div>
        </div>
      </div>

      <div style="
        margin-top:12px;
        padding:15px;
        background:#222;
        color:white;
        border-radius:12px
      ">
        <small>Salarios acumulados</small>

        <div style="
          font-size:24px;
          font-weight:bold;
          color:#75df9a;
          margin-top:5px
        ">
          ${formato(datos.salarioTotal)} CUP
        </div>
      </div>
    </div>

    ${crearGraficoBarras(
      "Operaciones por lugar de venta",
      lugares,
      "ventas"
    )}

    ${crearGraficoBarras(
      "Ingresos CUP - últimos seis meses",
      mesesCUP,
      "CUP"
    )}

    ${crearGraficoBarras(
      "Ingresos USD - últimos seis meses",
      mesesUSD,
      "USD"
    )}

    ${crearGraficoBarras(
      "Productos más vendidos",
      mejoresProductos,
      "unidades"
    )}

    <button
      type="button"
      class="btn-secundario"
      style="width:100%;margin-bottom:20px"
      onclick="mostrarEstadisticas()"
    >
      ACTUALIZAR ESTADÍSTICAS
    </button>
  `;
}

// ==========================================
// FIN DE LA PARTE 8
// ==========================================

// ==========================================
// CAJA - PARTE 9
// INICIO Y CONTEO DE EFECTIVO
// ==========================================

// ==========================================
// DENOMINACIONES DE EFECTIVO
// ==========================================

const denominacionesEfectivo = [
  10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000
];

let conteoEfectivo = {};

// ==========================================
// CARGAR CONTEO GUARDADO
// ==========================================

function cargarConteoEfectivo() {
  try {
    const guardado = localStorage.getItem(CLAVE_EFECTIVO);

    conteoEfectivo = guardado
      ? JSON.parse(guardado)
      : {};

    if (
      !conteoEfectivo ||
      typeof conteoEfectivo !== "object" ||
      Array.isArray(conteoEfectivo)
    ) {
      conteoEfectivo = {};
    }

  } catch (error) {
    console.error("Error al cargar conteo:", error);
    conteoEfectivo = {};
  }

  denominacionesEfectivo.forEach(valor => {
    const cantidad = Number(conteoEfectivo[valor]);

    conteoEfectivo[valor] =
      Number.isFinite(cantidad) && cantidad >= 0
        ? cantidad
        : 0;
  });
}

// ==========================================
// GUARDAR CONTEO
// ==========================================

function guardarConteoEfectivo() {
  try {
    localStorage.setItem(
      CLAVE_EFECTIVO,
      JSON.stringify(conteoEfectivo)
    );

    return true;

  } catch (error) {
    console.error("Error al guardar conteo:", error);
    alert("No se pudo guardar el conteo de efectivo.");
    return false;
  }
}

// ==========================================
// CALCULAR TOTAL DE EFECTIVO
// ==========================================

function calcularTotalEfectivo() {
  return denominacionesEfectivo.reduce((total, valor) => {
    const cantidad = Number(conteoEfectivo[valor]) || 0;

    return total + valor * cantidad;
  }, 0);
}

// ==========================================
// MOSTRAR CONTEO DE EFECTIVO
// ==========================================

function mostrarEfectivo() {
  cargarConteoEfectivo();

  const pantalla = document.getElementById("pantallaEfectivo");

  if (!pantalla) return;

  let contenedor = document.getElementById("contenidoEfectivo");

  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "contenidoEfectivo";
    pantalla.appendChild(contenedor);
  }

  const filas = denominacionesEfectivo.map(valor => `
    <div class="producto">
      <div class="producto-info">
        <h3>${formato(valor)} CUP</h3>
        <small style="color:#777">
          Subtotal:
          <strong id="subtotalEfectivo${valor}">
            ${formato(valor * conteoEfectivo[valor])} CUP
          </strong>
        </small>
      </div>

      <div style="width:100px">
        <label for="billetes${valor}">Cantidad</label>
        <input
          id="billetes${valor}"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          value="${conteoEfectivo[valor]}"
          style="margin-bottom:0"
          oninput="actualizarConteoEfectivo(${valor},this.value)"
        >
      </div>
    </div>
  `).join("");

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h3 style="margin-bottom:8px">
        Conteo de efectivo
      </h3>

      <p style="font-size:13px;color:#777">
        Introduce la cantidad de billetes de cada denominación.
        El total se calcula automáticamente.
      </p>
    </div>

    ${filas}

    <div class="resumen">
      <div>Total en efectivo</div>

      <div class="total" id="totalEfectivo">
        ${formato(calcularTotalEfectivo())} CUP
      </div>

      <p style="font-size:12px;color:#ccc">
        Conteo guardado automáticamente en este dispositivo.
      </p>
    </div>

    <button
      type="button"
      class="btn-secundario"
      style="width:100%;margin-top:15px"
      onclick="limpiarConteoEfectivo()"
    >
      LIMPIAR CONTEO
    </button>
  `;

  actualizarTotalVisualEfectivo();
}

// ==========================================
// ACTUALIZAR CANTIDAD DE BILLETES
// ==========================================

function actualizarConteoEfectivo(valor, cantidad) {
  const numero = Number(cantidad);

  if (
    cantidad === "" ||
    !Number.isFinite(numero) ||
    numero < 0 ||
    !Number.isInteger(numero)
  ) {
    conteoEfectivo[valor] = 0;
  } else {
    conteoEfectivo[valor] = numero;
  }

  guardarConteoEfectivo();

  const subtotal = document.getElementById(
    "subtotalEfectivo" + valor
  );

  if (subtotal) {
    subtotal.textContent =
      formato(valor * conteoEfectivo[valor]) + " CUP";
  }

  actualizarTotalVisualEfectivo();
}

// ==========================================
// ACTUALIZAR TOTAL VISUAL
// ==========================================

function actualizarTotalVisualEfectivo() {
  const total = document.getElementById("totalEfectivo");

  if (total) {
    total.textContent =
      formato(calcularTotalEfectivo()) + " CUP";
  }
}

// ==========================================
// LIMPIAR CONTEO
// ==========================================

function limpiarConteoEfectivo() {
  const confirmar = confirm(
    "¿Deseas poner todas las cantidades en cero?"
  );

  if (!confirmar) return;

  denominacionesEfectivo.forEach(valor => {
    conteoEfectivo[valor] = 0;
  });

  guardarConteoEfectivo();
  mostrarEfectivo();
}

// ==========================================
// TARJETA DE ESTADÍSTICAS EN INICIO
// ==========================================

function actualizarInicio() {
  const inicio = document.getElementById("pantallaInicio");

  if (!inicio) return;

  let tarjeta = document.getElementById("tarjetaEstadisticasInicio");

  if (!tarjeta) {
    tarjeta = document.createElement("button");

    tarjeta.type = "button";
    tarjeta.id = "tarjetaEstadisticasInicio";
    tarjeta.className = "tarjeta-menu";

    tarjeta.innerHTML = `
      <div class="icono-menu">📊</div>

      <div class="texto-menu">
        <h3>Estadísticas</h3>
        <p>Consulta las ventas, ingresos, salarios y productos más vendidos.</p>
      </div>

      <div class="flecha-menu">›</div>
    `;

    tarjeta.addEventListener("click", function() {
      navegar("estadisticas");
    });

    const menu = inicio.querySelector(".menu-principal");

    if (menu) {
      menu.appendChild(tarjeta);
    } else {
      inicio.appendChild(tarjeta);
    }
  }

  const resumen = obtenerResumenEstadisticas();

  const descripcion = tarjeta.querySelector(".texto-menu p");

  if (descripcion) {
    descripcion.textContent =
      `${resumen.operaciones} operaciones registradas. Consulta tus estadísticas.`;
  }
}

// ==========================================
// FIN DE LA PARTE 9
// ==========================================

// ==========================================
// CAJA - PARTE 10
// INICIALIZACIÓN FINAL
// ==========================================

// ==========================================
// INICIAR APLICACIÓN AL CARGAR
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

// ==========================================
// FIN DE LA PARTE 10
// ==========================================
