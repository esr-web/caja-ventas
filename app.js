
let productos = [];
let carrito = [];
let porcentajeSalario = 5;

const formato = valor =>
  Number(valor || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function fechaLocal() {
  const ahora = new Date();
  const zona = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );
  return zona.toISOString().slice(0, 16);
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, letra => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[letra]);
}

async function iniciarAplicacion() {
  try {
    await abrirBaseDatos();
    productos = await obtenerTodos("productos");
    mostrarCaja();
    actualizarConexion();
  } catch (error) {
    alert("No se pudo abrir la base de datos del teléfono.");
    console.error(error);
  }
}

function actualizarConexion() {
  const indicador = document.getElementById("estadoConexion");
  if (indicador) {
    indicador.textContent = navigator.onLine
      ? "● Aplicación lista"
      : "● Funcionando sin Internet";
    indicador.style.color = navigator.onLine ? "#77d99a" : "#ffbd59";
  }
}

window.addEventListener("online", actualizarConexion);
window.addEventListener("offline", actualizarConexion);

function mostrarCaja() {
  const pantalla = document.getElementById("pantallaCaja");

  pantalla.innerHTML = `
    <h2>Nueva venta</h2>

    <div class="tarjeta">
      <h3>Agregar producto al catálogo</h3>

      <label for="nombreProducto">Nombre del producto</label>
      <input id="nombreProducto" type="text"
        placeholder="Ej. Arroz">

      <label for="precioProducto">Precio unitario (CUP)</label>
      <input id="precioProducto" type="number"
        min="0.01" step="0.01" placeholder="0.00">

      <button onclick="agregarProducto()"
        style="background:#f28c28;color:white;width:100%">
        + Agregar producto
      </button>
    </div>

    <div class="tarjeta">
      <h3>Seleccionar productos</h3>
      <div id="listaProductos"></div>
    </div>

    <div class="tarjeta">
      <h3>Datos de la venta</h3>

      <label for="fechaVenta">Fecha y hora</label>
      <input id="fechaVenta" type="datetime-local"
        value="${fechaLocal()}">

      <label for="porcentajeVenta">Porcentaje de salario (%)</label>
      <input id="porcentajeVenta" type="number"
        min="0" max="100" step="0.01" value="5"
        oninput="actualizarResumen()">
    </div>

    <div id="resumenVenta" class="resumen"></div>
  `;

  mostrarProductos();
  actualizarResumen();
}

async function agregarProducto() {
  const nombre = document.getElementById("nombreProducto")
    .value.trim();

  const precio = Number(
    document.getElementById("precioProducto").value
  );

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    return;
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    alert("Introduce un precio válido mayor que cero.");
    return;
  }

  try {
    const nuevo = { nombre, precio };

    nuevo.id = await guardarDato("productos", nuevo);

    productos.push(nuevo);

    document.getElementById("nombreProducto").value = "";
    document.getElementById("precioProducto").value = "";

    mostrarProductos();
  } catch (error) {
    alert("No se pudo guardar el producto.");
    console.error(error);
  }
}

function mostrarProductos() {
  const lista = document.getElementById("listaProductos");

  if (!lista) return;

  if (productos.length === 0) {
    lista.innerHTML = `
      <p style="color:#777;padding:12px 0">
        Todavía no tienes productos. Agrega el primero.
      </p>`;
    return;
  }

  lista.innerHTML = productos.map(producto => {
    const cantidad = carrito.find(
      item => item.productoId === producto.id
    )?.cantidad || 0;

    return `
      <div class="tarjeta producto">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>
          <div class="precio">
            ${formato(producto.precio)} CUP
          </div>
        </div>

        <div class="controles-cantidad">
          <button class="btn-cantidad"
            onclick="cambiarCantidad(${producto.id},-1)">−</button>

          <span class="cantidad">${cantidad}</span>

          <button class="btn-cantidad"
            onclick="cambiarCantidad(${producto.id},1)">+</button>
        </div>
      </div>`;
  }).join("");
}

function cambiarCantidad(id, cambio) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  let item = carrito.find(p => p.productoId === id);

  if (!item && cambio > 0) {
    item = {
      productoId: id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 0
    };
    carrito.push(item);
  }

  if (!item) return;

  item.cantidad += cambio;

  if (item.cantidad <= 0) {
    carrito = carrito.filter(
      p => p.productoId !== id
    );
  }

  mostrarProductos();
  actualizarResumen();
}

function calcularVenta() {
  const total = carrito.reduce(
    (suma, item) => suma + item.precio * item.cantidad,
    0
  );

  const porcentaje = Number(
    document.getElementById("porcentajeVenta")?.value || 0
  );

  const salario = total * porcentaje / 100;

  return { total, porcentaje, salario };
}

function actualizarResumen() {
  const resumen = document.getElementById("resumenVenta");
  if (!resumen) return;

  const calculo = calcularVenta();

  resumen.innerHTML = `
    <h3>Resumen de venta</h3>

    <div style="margin-top:15px">
      Total vendido
    </div>

    <div class="total">
      ${formato(calculo.total)} CUP
    </div>

    <div>Comisión: ${formato(calculo.porcentaje)} %</div>

    <div style="margin-top:10px">
      Salario generado
    </div>

    <div class="salario">
      ${formato(calculo.salario)} CUP
    </div>

    <button class="btn-vendido"
      onclick="registrarVenta()">
      ✓ VENDIDO
    </button>
  `;
}

async function registrarVenta() {
  if (carrito.length === 0) {
    alert("Selecciona al menos un producto.");
    return;
  }

  const fecha = document.getElementById("fechaVenta").value;

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

  if (!confirm(
    `¿Confirmar venta por ${formato(calculo.total)} CUP?`
  )) return;

  const venta = {
    fecha: new Date(fecha).toISOString(),
    productos: carrito.map(item => ({ ...item })),
    total: calculo.total,
    porcentaje: calculo.porcentaje,
    salario: calculo.salario
  };

  try {
    venta.id = await guardarDato("ventas", venta);

    alert(
      "¡Venta registrada!\n\n" +
      "Total: " + formato(venta.total) + " CUP\n" +
      "Salario: " + formato(venta.salario) + " CUP"
    );

    carrito = [];
    mostrarCaja();
  } catch (error) {
    alert("No se pudo guardar la venta. Inténtalo nuevamente.");
    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", iniciarAplicacion);
