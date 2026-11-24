
// ==========================================
// CAJA - COPIA DE SEGURIDAD Y RESTAURACIÓN
// ==========================================

const CLAVE_RESPALDO_EFECTIVO = "caja_conteo_efectivo_v1";
const VERSION_RESPALDO = 4;

// ==========================================
// CREAR COPIA DE SEGURIDAD
// ==========================================

async function crearCopiaSeguridad() {
  try {
    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");
    const entradasGuardadas = await obtenerTodos("entradas");
    const comprasUSDGuardadas = await obtenerTodos("comprasUSD");

    let conteoGuardado = {};

    try {
      conteoGuardado = JSON.parse(
        localStorage.getItem(CLAVE_RESPALDO_EFECTIVO) || "{}"
      );
    } catch (_) {
      conteoGuardado = {};
    }

    const respaldo = {
      aplicacion: "CAJA",
      version: VERSION_RESPALDO,
      fechaRespaldo: new Date().toISOString(),
      productos: productosGuardados,
      ventas: ventasGuardadas,
      entradas: entradasGuardadas,
      comprasUSD: comprasUSDGuardadas,
      conteoEfectivo: conteoGuardado
    };

    const contenido = JSON.stringify(respaldo, null, 2);
    const archivo = new Blob([contenido], {
      type: "application/json"
    });

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    const fecha = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .slice(0, 19);

    enlace.href = url;
    enlace.download = `copia-caja-${fecha}.json`;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);

    alert("Copia de seguridad preparada correctamente.");

  } catch (error) {
    console.error("Error al crear copia:", error);

    alert(
      "No se pudo crear la copia de seguridad.\n\n" +
      error.message
    );
  }
}

// ==========================================
// MIGRACIÓN DE COPIAS ANTERIORES
// ==========================================

function migrarCopiaADatosActuales(datos) {

  const productos = (datos.productos || []).map(p => {

    const stock = p.stock || {};

    let variantes = Array.isArray(p.variantes)
      ? p.variantes
      : [];

    if (!variantes.length) {

      const pCUP = Number(p.precioCUP ?? p.precio) || 0;
      const pUSD = Number(p.precioUSD) || 0;

      if (pCUP > 0 || pUSD > 0) {
        variantes = [{
          id: "v" + Date.now().toString(36) +
            Math.random().toString(36).slice(2, 6),
          etiqueta: "Único",
          precioCUP: pCUP,
          precioUSD: pUSD
        }];
      }

    } else {

      variantes = variantes.map(v => ({
        id: String(
          v.id ||
          ("v" + Date.now().toString(36) +
          Math.random().toString(36).slice(2, 6))
        ),
        etiqueta: String(v.etiqueta || "Único"),
        precioCUP: Number(v.precioCUP) || 0,
        precioUSD: Number(v.precioUSD) || 0
      }));

    }

    return {
      ...p,
      stock: {
        tienda: Number(stock.tienda) || 0,
        casa: Number(stock.casa) || 0
      },
      variantes
    };
  });

  const ventas = (datos.ventas || []).map(v => {

    const lineas = (v.productos || []).map(linea => {

      const idProducto =
        linea.idProducto ??
        linea.productoId ??
        linea.id ??
        null;

      return {
        ...linea,
        idProducto,
        idVariante: linea.idVariante || null,
        etiquetaVariante: String(
          linea.etiquetaVariante || ""
        ),
        nombre: String(linea.nombre || "Producto"),
        cantidad: Number(linea.cantidad) || 0,
        precio: Number(linea.precio) || 0,
        precioCUP: Number(linea.precioCUP) || 0,
        subtotal: Number(linea.subtotal) || 0
      };
    });

    return {
      ...v,
      lugarVenta: v.lugarVenta || "Sin especificar",
      productos: lineas
    };
  });

  const entradas = (datos.entradas || []).map(e => ({
    ...e,
    idProducto: e.idProducto ?? null,
    nombre: String(e.nombre || "Producto"),
    area: e.area === "Casa" ? "Casa" : "Tienda",
    cantidad: Number(e.cantidad) || 0,
    fecha: e.fecha || new Date().toISOString()
  }));

  const comprasUSD = (datos.comprasUSD || []).map(c => ({
    ...c,
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
  }));

  return {
    ...datos,
    version: VERSION_RESPALDO,
    productos,
    ventas,
    entradas,
    comprasUSD,
    conteoEfectivo:
      datos.conteoEfectivo &&
      typeof datos.conteoEfectivo === "object"
        ? datos.conteoEfectivo
        : {}
  };
}

// ==========================================
// VALIDAR COPIA DE SEGURIDAD
// ==========================================

function validarCopiaSeguridad(datos) {

  if (!datos || typeof datos !== "object") {
    throw new Error("Archivo inválido.");
  }

  if (datos.aplicacion !== "CAJA") {
    throw new Error("No es una copia de CAJA.");
  }

  if (![1, 2, 3, 4].includes(datos.version)) {
    throw new Error("Versión no reconocida.");
  }

  if (
    !Array.isArray(datos.productos) ||
    !Array.isArray(datos.ventas)
  ) {
    throw new Error("La copia está incompleta.");
  }

  if (
    datos.entradas !== undefined &&
    !Array.isArray(datos.entradas)
  ) {
    throw new Error("Las entradas del inventario son inválidas.");
  }

  if (
    datos.comprasUSD !== undefined &&
    !Array.isArray(datos.comprasUSD)
  ) {
    throw new Error("Las compras USD son inválidas.");
  }

  if (
    datos.conteoEfectivo !== undefined &&
    (
      !datos.conteoEfectivo ||
      typeof datos.conteoEfectivo !== "object" ||
      Array.isArray(datos.conteoEfectivo)
    )
  ) {
    throw new Error("El conteo de efectivo es inválido.");
  }

  for (const p of datos.productos) {

    if (
      !p ||
      p.id === undefined ||
      typeof p.nombre !== "string"
    ) {
      throw new Error("Se encontraron productos inválidos.");
    }
  }

  for (const v of datos.ventas) {

    if (
      !v ||
      v.id === undefined ||
      !Array.isArray(v.productos)
    ) {
      throw new Error("Se encontraron ventas inválidas.");
    }
  }

  for (const e of (datos.entradas || [])) {

    if (
      !e ||
      e.id === undefined ||
      !Number.isFinite(Number(e.cantidad))
    ) {
      throw new Error("Se encontraron entradas inválidas.");
    }
  }

  for (const c of (datos.comprasUSD || [])) {

    if (
      !c ||
      c.id === undefined ||
      !Number.isFinite(Number(c.cantidadUSD))
    ) {
      throw new Error("Se encontraron compras USD inválidas.");
    }
  }

  return true;
}

// ==========================================
// RESTAURAR COPIA DE SEGURIDAD
// ==========================================

async function restaurarCopiaSeguridad(archivo) {

  if (!archivo) return;

  try {

    const contenido = await archivo.text();

    let datos = JSON.parse(contenido);

    validarCopiaSeguridad(datos);

    if (datos.version < VERSION_RESPALDO) {
      datos = migrarCopiaADatosActuales(datos);
    }

    // Normalizar las tablas opcionales de copias antiguas.

    datos.entradas = datos.entradas || [];
    datos.comprasUSD = datos.comprasUSD || [];

    datos.conteoEfectivo =
      datos.conteoEfectivo || {};

    const confirmacion = confirm(
      "¿Restaurar esta copia?\n\n" +
      "Productos: " + datos.productos.length + "\n" +
      "Ventas: " + datos.ventas.length + "\n" +
      "Entradas: " + datos.entradas.length + "\n" +
      "Compras USD: " + datos.comprasUSD.length + "\n\n" +
      "Los datos actuales serán sustituidos."
    );

    if (!confirmacion) return;

    // Todas las tablas se sustituyen en una sola transacción.

    await reemplazarVariasTablas({
      productos: datos.productos,
      ventas: datos.ventas,
      entradas: datos.entradas,
      comprasUSD: datos.comprasUSD
    });

    // El conteo de efectivo se actualiza después
    // de confirmar la restauración de IndexedDB.

    localStorage.setItem(
      CLAVE_RESPALDO_EFECTIVO,
      JSON.stringify(datos.conteoEfectivo)
    );

    alert(
      "Restauración completada.\n\n" +
      "La aplicación se actualizará."
    );

    location.reload();

  } catch (error) {

    console.error("Error al restaurar copia:", error);

    alert(
      "No se pudo restaurar la copia.\n\n" +
      error.message
    );
  }
}

// ==========================================
// INTERFAZ DE COPIAS DE SEGURIDAD
// ==========================================

function instalarPanelRespaldo() {

  const panel = document.getElementById("panelRespaldo");

  if (!panel) return;

  panel.className = "tarjeta";
  panel.style.marginTop = "18px";

  panel.innerHTML = `
    <h3 style="margin-bottom:8px">
      Copias de seguridad
    </h3>

    <p style="font-size:13px;color:#777;margin-bottom:15px">
      Guarda tus productos, ventas, entradas,
      compras USD y conteo de efectivo.
    </p>

    <button
      type="button"
      class="btn-principal"
      style="width:100%;margin-bottom:10px"
      onclick="crearCopiaSeguridad()"
    >
      ↓ GUARDAR COPIA DE SEGURIDAD
    </button>

    <button
      type="button"
      class="btn-secundario"
      style="width:100%"
      onclick="document.getElementById('archivoRespaldo').click()"
    >
      ↑ RESTAURAR COPIA
    </button>

    <input
      id="archivoRespaldo"
      type="file"
      accept=".json,application/json"
      style="display:none"
      onchange="
        if(this.files.length){
          restaurarCopiaSeguridad(this.files[0]);
          this.value='';
        }
      "
    >
  `;
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  instalarPanelRespaldo
);
