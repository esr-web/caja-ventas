// ==========================================
// CAJA - COPIA DE SEGURIDAD Y RESTAURACIÓN
// ==========================================

const CLAVE_RESPALDO_EFECTIVO = "caja_conteo_efectivo_v1";
const VERSION_RESPALDO = 3;

// ==========================================
// CREAR COPIA
// ==========================================

async function crearCopiaSeguridad() {
  try {
    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");

    let entradasGuardadas = [];
    try { entradasGuardadas = await obtenerTodos("entradas"); } catch (_) {}

    let conteoGuardado = {};
    try {
      conteoGuardado = JSON.parse(localStorage.getItem(CLAVE_RESPALDO_EFECTIVO) || "{}");
    } catch (_) { conteoGuardado = {}; }

    const respaldo = {
      aplicacion: "CAJA",
      version: VERSION_RESPALDO,
      fechaRespaldo: new Date().toISOString(),
      productos: productosGuardados,
      ventas: ventasGuardadas,
      entradas: entradasGuardadas,
      conteoEfectivo: conteoGuardado
    };

    const contenido = JSON.stringify(respaldo, null, 2);
    const archivo = new Blob([contenido], { type: "application/json" });
    const url = URL.createObjectURL(archivo);

    const enlace = document.createElement("a");
    const fecha = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
    enlace.href = url;
    enlace.download = `copia-caja-${fecha}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);

    alert("Copia de seguridad preparada correctamente.");
  } catch (error) {
    console.error(error);
    alert("No se pudo crear la copia.");
  }
}

// ==========================================
// MIGRACIÓN
// ==========================================

function migrarCopiaADatosActuales(datos) {
  // PRODUCTOS
  const productos = (datos.productos || []).map(p => {
    const stock = p.stock || {};

    // Variantes: si no existen, crear una a partir de precioCUP/precioUSD/precio.
    let variantes = Array.isArray(p.variantes) ? p.variantes : [];

    if (!variantes.length) {
      const pCUP = Number(p.precioCUP ?? p.precio) || 0;
      const pUSD = Number(p.precioUSD) || 0;
      if (pCUP > 0 || pUSD > 0) {
        variantes = [{
          id: "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          etiqueta: "Único",
          precioCUP: pCUP,
          precioUSD: pUSD
        }];
      }
    } else {
      variantes = variantes.map(v => ({
        id: String(v.id || ("v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))),
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

  // VENTAS
  const ventas = (datos.ventas || []).map(v => {
    const lineas = (v.productos || []).map(linea => {
      const idProducto = linea.idProducto ?? linea.productoId ?? linea.id ?? null;
      return {
        ...linea,
        idProducto,
        idVariante: linea.idVariante || null,
        etiquetaVariante: String(linea.etiquetaVariante || ""),
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

  // ENTRADAS
  const entradas = (datos.entradas || []).map(e => ({
    ...e,
    idProducto: e.idProducto ?? null,
    nombre: String(e.nombre || "Producto"),
    area: e.area === "Casa" ? "Casa" : "Tienda",
    cantidad: Number(e.cantidad) || 0,
    fecha: e.fecha || new Date().toISOString()
  }));

  return {
    ...datos,
    version: VERSION_RESPALDO,
    productos,
    ventas,
    entradas
  };
}

function validarCopiaSeguridad(datos) {
  if (!datos || typeof datos !== "object") throw new Error("Archivo inválido.");
  if (datos.aplicacion !== "CAJA") throw new Error("No es una copia de CAJA.");
  if (![1, 2, 3].includes(datos.version)) throw new Error("Versión no reconocida.");
  if (!Array.isArray(datos.productos) || !Array.isArray(datos.ventas)) {
    throw new Error("La copia está incompleta.");
  }
  if (!datos.conteoEfectivo || typeof datos.conteoEfectivo !== "object") {
    throw new Error("Falta el conteo de efectivo.");
  }
  for (const p of datos.productos) {
    if (!p || p.id === undefined || typeof p.nombre !== "string") {
      throw new Error("Productos inválidos.");
    }
  }
  for (const v of datos.ventas) {
    if (!v || v.id === undefined || !Array.isArray(v.productos)) {
      throw new Error("Ventas inválidas.");
    }
  }
  return true;
}

// ==========================================
// RESTAURAR
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

    const confirmacion = confirm(
      "¿Restaurar esta copia?\n\n" +
      "Productos: " + datos.productos.length + "\n" +
      "Ventas: " + datos.ventas.length + "\n" +
      "Entradas: " + (datos.entradas?.length || 0) + "\n\n" +
      "Los datos actuales serán sustituidos."
    );

    if (!confirmacion) return;

    await reemplazarTodos("productos", datos.productos);
    await reemplazarTodos("ventas", datos.ventas);
    await reemplazarTodos("entradas", datos.entradas || []);

    localStorage.setItem(
      CLAVE_RESPALDO_EFECTIVO,
      JSON.stringify(datos.conteoEfectivo)
    );

    alert("Restauración completada.\n\nLa app se actualizará.");
    location.reload();
  } catch (error) {
    console.error(error);
    alert("No se pudo restaurar la copia.\n\n" + error.message);
  }
}

// ==========================================
// INTERFAZ
// ==========================================

function instalarPanelRespaldo() {
  const panel = document.getElementById("panelRespaldo");
  if (!panel) return;

  panel.className = "tarjeta";
  panel.style.marginTop = "18px";

  panel.innerHTML = `
    <h3 style="margin-bottom:8px">Copias de seguridad</h3>
    <p style="font-size:13px;color:#777;margin-bottom:15px">
      Guarda tus productos, ventas, entradas y conteo de efectivo en un archivo.
    </p>

    <button type="button" class="btn-principal"
            style="width:100%;margin-bottom:10px"
            onclick="crearCopiaSeguridad()">
      ↓ GUARDAR COPIA DE SEGURIDAD
    </button>

    <button type="button" class="btn-secundario" style="width:100%"
            onclick="document.getElementById('archivoRespaldo').click()">
      ↑ RESTAURAR COPIA
    </button>

    <input id="archivoRespaldo" type="file" accept=".json,application/json"
           style="display:none"
           onchange="if(this.files.length){restaurarCopiaSeguridad(this.files[0]);this.value='';}">
  `;
}

document.addEventListener("DOMContentLoaded", instalarPanelRespaldo);