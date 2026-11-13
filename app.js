
// ==========================================
// CAJA DE VENTAS - APLICACIÓN PRINCIPAL
// ==========================================

let productos = [];
let carrito = [];
let ventas = [];
let productoEnEdicion = null;

let porcentajeSalario = 5;
let pantallaActual = "inicio";

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

// ==========================================
// INICIO Y BASE DE DATOS
// ==========================================

async function iniciarAplicacion() {
  try {
    await abrirBaseDatos();

    productos = await obtenerTodos("productos");
    ventas = await obtenerTodos("ventas");

    actualizarConexion();
    navegar("inicio");

  } catch (error) {
    alert("No se pudo abrir la base de datos del teléfono.");
    console.error(error);
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
    registro: "pantallaRegistro"
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
    registro: "navRegistro"
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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// SECCIÓN PRODUCTOS
// ==========================================

function mostrarProductos() {
  const pantalla = document.getElementById("pantallaProductos");

  pantalla.innerHTML = `
    <span class="etiqueta">CATÁLOGO</span>
    <h2 class="titulo-seccion">Productos</h2>

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">
        ${productoEnEdicion === null ? "Agregar producto" : "Editar producto"}
      </h3>

      <label for="nombreProducto">Nombre del producto</label>
      <input
        id="nombreProducto"
        type="text"
        placeholder="Ej. Arroz"
        value="${
          productoEnEdicion !== null
            ? escapar(productos.find(p => p.id === productoEnEdicion)?.nombre || "")
            : ""
        }"
      >

      <label for="precioProducto">Precio unitario (CUP)</label>
      <input
        id="precioProducto"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="0.00"
        value="${
          productoEnEdicion !== null
            ? productos.find(p => p.id === productoEnEdicion)?.precio || ""
            : ""
        }"
      >

      <button class="btn-principal" onclick="guardarProducto()">
        ${productoEnEdicion === null ? "+ AGREGAR PRODUCTO" : "GUARDAR CAMBIOS"}
      </button>

      ${
        productoEnEdicion !== null
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
        <div class="precio">${formato(producto.precio)} CUP</div>
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
  const precio = Number(document.getElementById("precioProducto").value);

  if (!nombre) {
    alert("Escribe el nombre del producto.");
    return;
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    alert("Introduce un precio válido mayor que cero.");
    return;
  }

  try {
    if (productoEnEdicion !== null) {
      const producto = productos.find(p => p.id === productoEnEdicion);
      if (!producto) return;

      producto.nombre = nombre;
      producto.precio = precio;

      await guardarDato("productos", producto);

      // Actualizar los precios y nombres del producto
      // en el carrito si todavía no se ha registrado la venta.
      carrito.forEach(item => {
        if (item.productoId === producto.id) {
          item.nombre = nombre;
          item.precio = precio;
        }
      });

      productoEnEdicion = null;
      alert("Producto actualizado correctamente.");

    } else {
      const nuevo = { nombre, precio };
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

  if (!confirm(`¿Eliminar el producto "${producto.nombre}" del catálogo?`)) {
    return;
  }

  try {
    await eliminarDato("productos", id);

    productos = productos.filter(p => p.id !== id);
    carrito = carrito.filter(p => p.productoId !== id);

    if (productoEnEdicion === id) productoEnEdicion = null;

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
        min="0" max="100" step="0.01" value="${porcentajeSalario}"
        oninput="actualizarResumen()">
    </div>

    <div id="resumenVenta" class="resumen"></div>
  `;

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
    lista.innerHTML = `<p class="texto-vacio">No se encontraron productos.</p>`;
    return;
  }

  lista.innerHTML = disponibles.map(producto => {
    const cantidad = carrito.find(
      item => item.productoId === producto.id
    )?.cantidad || 0;

    return `
      <div class="producto">
        <div class="producto-info">
          <h3>${escapar(producto.nombre)}</h3>
          <div class="precio">${formato(producto.precio)} CUP</div>
        </div>

        <div class="controles-cantidad">
          <button class="btn-cantidad"
            onclick="cambiarCantidad(${producto.id},-1)">−</button>

          <span class="cantidad">${cantidad}</span>

          <button class="btn-cantidad"
            onclick="cambiarCantidad(${producto.id},1)">+</button>
        </div>
      </div>
    `;
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
    carrito = carrito.filter(p => p.productoId !== id);
  }

  dibujarProductosCaja();
  actualizarResumen();
}

function calcularVenta() {
  const total = carrito.reduce(
    (suma, item) => suma + item.precio * item.cantidad,
    0
  );

  const porcentaje = Number(
    document.getElementById("porcentajeVenta")?.value ?? porcentajeSalario
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

    <p style="margin-top:15px;color:#cccccc">Productos seleccionados</p>
    <p style="font-size:16px;font-weight:bold;margin-top:5px">
      ${carrito.reduce((s, p) => s + p.cantidad, 0)} unidades
    </p>

    <p style="margin-top:15px;color:#cccccc">Total de la venta</p>
    <div class="total">${formato(calculo.total)} CUP</div>

    <p style="margin-top:15px">Comisión: ${formato(calculo.porcentaje)} %</p>

    <p style="margin-top:15px;color:#cccccc">Salario generado</p>
    <div class="salario">${formato(calculo.salario)} CUP</div>

    <button class="btn-vendido"
      onclick="registrarVenta()">
      ✓ CONFIRMAR VENTA
    </button>
  `;
}

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
    ventas.push(venta);

    porcentajeSalario = calculo.porcentaje;
    carrito = [];

    alert(
      "¡Venta registrada correctamente!\n\n" +
      "Total: " + formato(venta.total) + " CUP\n" +
      "Salario: " + formato(venta.salario) + " CUP"
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

    <div class="tarjeta">
      <h3 style="margin-bottom:15px">Filtrar registros</h3>

      <label for="filtroPeriodo">Período de consulta</label>
      <select id="filtroPeriodo" onchange="actualizarVisibilidadFiltros();actualizarRegistro()">
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
          value="${new Date().toISOString().slice(0,7)}"
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

      <label for="precioMinimo">Importe mínimo de la venta (CUP)</label>
      <input id="precioMinimo" type="number"
        min="0" step="0.01" placeholder="Sin mínimo"
        oninput="actualizarRegistro()">

      <label for="precioMaximo">Importe máximo de la venta (CUP)</label>
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

function actualizarVisibilidadFiltros() {
  const periodo = document.getElementById("filtroPeriodo")?.value || "todo";

  const controles = {
    dia: "filtroDia",
    mes: "filtroMes",
    anio: "filtroAnio",
    rango: "filtroRango"
  };

  Object.entries(controles).forEach(([tipo, id]) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.style.display = periodo === tipo ? "block" : "none";
    }
  });
}

function limpiarFiltrosRegistro() {
  document.getElementById("filtroPeriodo").value = "todo";
  document.getElementById("filtroProducto").value = "";
  document.getElementById("precioMinimo").value = "";
  document.getElementById("precioMaximo").value = "";
  document.getElementById("fechaFiltro").value = fechaParaComparar(new Date());
  document.getElementById("mesFiltro").value = new Date().toISOString().slice(0, 7);
  document.getElementById("anioFiltro").value = new Date().getFullYear();
  document.getElementById("fechaDesde").value = "";
  document.getElementById("fechaHasta").value = "";

  actualizarVisibilidadFiltros();
  actualizarRegistro();
}

function actualizarRegistro() {
  const contenedor = document.getElementById("resultadosRegistro");
  if (!contenedor) return;

  const periodo = document.getElementById("filtroPeriodo")?.value || "todo";
  const fechaDia = document.getElementById("fechaFiltro")?.value || "";
  const mes = document.getElementById("mesFiltro")?.value || "";
  const anio = document.getElementById("anioFiltro")?.value || "";
  const desde = document.getElementById("fechaDesde")?.value || "";
  const hasta = document.getElementById("fechaHasta")?.value || "";

  const productoId = document.getElementById("filtroProducto")?.value || "";
  const minimoTexto = document.getElementById("precioMinimo")?.value ?? "";
  const maximoTexto = document.getElementById("precioMaximo")?.value ?? "";

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
    contenedor.innerHTML = `<div class="tarjeta texto-vacio">Selecciona un día.</div>`;
    return;
  }

  if (periodo === "mes" && !mes) {
    contenedor.innerHTML = `<div class="tarjeta texto-vacio">Selecciona un mes.</div>`;
    return;
  }

  if (periodo === "anio" && !anio) {
    contenedor.innerHTML = `<div class="tarjeta texto-vacio">Selecciona un año.</div>`;
    return;
  }

  if (periodo === "rango" && desde && hasta && desde > hasta) {
    contenedor.innerHTML = `<div class="tarjeta texto-vacio">La fecha inicial no puede ser posterior a la final.</div>`;
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

    const totalVenta = Number(venta.total || 0);

    // El rango de precios se aplica al total de cada operación.
    if (minimo !== null && totalVenta < minimo) return;
    if (maximo !== null && totalVenta > maximo) return;

    let lineas = (venta.productos || []).map(item => ({
      ...item,
      subtotal: Number(item.precio || 0) * Number(item.cantidad || 0)
    }));

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

    const salarioVisible = productoId !== ""
      ? totalVisible * Number(venta.porcentaje || 0) / 100
      : Number(venta.salario || 0);

    resultados.push({
      ...venta,
      lineasVisibles: lineas,
      totalVisible,
      salarioVisible
    });
  });

  resultados.sort((a, b) =>
    new Date(b.fecha) - new Date(a.fecha)
  );

  const totalVendido = resultados.reduce(
    (suma, venta) => suma + venta.totalVisible,
    0
  );

  const totalSalario = resultados.reduce(
    (suma, venta) => suma + venta.salarioVisible,
    0
  );

  const unidades = resultados.reduce(
    (suma, venta) => suma + venta.lineasVisibles.reduce(
      (s, item) => s + Number(item.cantidad || 0), 0
    ),
    0
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
        TOTAL VENDIDO
      </div>

      <div style="font-size:27px;font-weight:bold;margin:6px 0 17px">
        ${formato(totalVendido)} CUP
      </div>

      <div style="color:#cccccc;font-size:12px">
        SALARIO GENERADO
      </div>

      <div style="font-size:23px;font-weight:bold;color:#75df9a;margin:6px 0 17px">
        ${formato(totalSalario)} CUP
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
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
                  <div>
                    <strong>Venta #${venta.id}</strong>
                    <div style="font-size:11px;color:#777;margin-top:5px">
                      ${mostrarFecha(venta.fecha)}
                    </div>
                  </div>

                  <div style="text-align:right">
                    <strong style="color:#16834a">
                      ${formato(venta.totalVisible)} CUP
                    </strong>
                    <div style="font-size:11px;color:#777;margin-top:5px">
                      ${formato(venta.salarioVisible)} CUP salario
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
                            ${item.cantidad} × ${formato(item.precio)} CUP
                          </div>
                        </div>
                        <strong>${formato(item.subtotal)} CUP</strong>
                      </div>
                    `).join("")}

                    <div style="font-size:12px;margin-top:12px">
                      Comisión: ${formato(venta.porcentaje)} %
                    </div>

                    <div style="font-weight:bold;margin-top:5px">
                      Salario: ${formato(venta.salarioVisible)} CUP
                    </div>
                  </div>
                </details>
              </div>
            `).join("")
      }
    </div>
  `;
}

// ==========================================
// ARRANQUE
// ==========================================

document.addEventListener("DOMContentLoaded", iniciarAplicacion);
