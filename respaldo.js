// ==========================================
// CAJA - COPIA DE SEGURIDAD Y RESTAURACIÓN
// ==========================================

const CLAVE_RESPALDO_EFECTIVO = "caja_conteo_efectivo_v1";
const VERSION_RESPALDO = 2;

// ==========================================
// CREAR COPIA
// ==========================================

async function crearCopiaSeguridad() {
  try {
    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");

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

    alert(
      "Copia de seguridad preparada correctamente.\n\n" +
      "Comprueba que el archivo se haya guardado en Descargas."
    );

  } catch (error) {
    console.error(error);
    alert("No se pudo crear la copia de seguridad.");
  }
}

// ==========================================
// MIGRAR COPIA V1 → V2
// ==========================================

function migrarCopiaV1aV2(datos) {
  // Añadir stock a productos.
  const productos = (datos.productos || []).map(p => {
    const stock = p.stock || {};
    return {
      ...p,
      precioCUP: Number(p.precioCUP ?? p.precio) || 0,
      precioUSD: Number(p.precioUSD) || 0,
      stock: {
        tienda: Number(stock.tienda) || 0,
        casa: Number(stock.casa) || 0
      }
    };
  });

  // Normalizar ventas viejas.
  const ventas = (datos.ventas || []).map(v => {
    const productosVenta = (v.productos || []).map(linea => {
      const idProducto = linea.idProducto ?? linea.productoId ?? linea.id ?? null;
      return {
        ...linea,
        idProducto,
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
      productos: productosVenta
    };
  });

  return {
    ...datos,
    version: VERSION_RESPALDO,
    productos,
    ventas
  };
}

// ==========================================
// VALIDAR
// ==========================================

function validarCopiaSeguridad(datos) {
  if (!datos || typeof datos !== "object") {
    throw new Error("El archivo no contiene datos válidos.");
  }

  if (datos.aplicacion !== "CAJA") {
    throw new Error("El archivo no es una copia compatible de CAJA.");
  }

  if (datos.version !== 1 && datos.version !== 2) {
    throw new Error("Versión de copia no reconocida.");
  }

  if (!Array.isArray(datos.productos) || !Array.isArray(datos.ventas)) {
    throw new Error("La copia está incompleta o dañada.");
  }

  if (!datos.conteoEfectivo || typeof datos.conteoEfectivo !== "object") {
    throw new Error("Falta el conteo de efectivo en la copia.");
  }

  for (const producto of datos.productos) {
    if (!producto || producto.id === undefined || typeof producto.nombre !== "string") {
      throw new Error("Hay productos con información inválida.");
    }
  }

  for (const venta of datos.ventas) {
    if (!venta || venta.id === undefined || !Array.isArray(venta.productos)) {
      throw new Error("Hay ventas con información inválida.");
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

    // Migrar si es v1.
    if (datos.version === 1) {
      datos = migrarCopiaV1aV2(datos);
    }

    const confirmacion = confirm(
      "¿Restaurar esta copia de seguridad?\n\n" +
      "Productos: " + datos.productos.length + "\n" +
      "Ventas: " + datos.ventas.length + "\n\n" +
      "ATENCIÓN: los productos y ventas actuales serán sustituidos."
    );

    if (!confirmacion) return;

    // Aviso por si la copia tiene ventas con lugar "Sin especificar".
    const sinLugar = datos.ventas.filter(v => v.lugarVenta === "Sin especificar").length;
    if (sinLugar > 0) {
      if (!confirm(
        `Hay ${sinLugar} ventas antiguas sin área asignada.\n\n` +
        "Se restaurarán como están (no afectan al stock).\n¿Continuar?"
      )) return;
    }

    await reemplazarTodos("productos", datos.productos);
    await reemplazarTodos("ventas", datos.ventas);

    localStorage.setItem(
      CLAVE_RESPALDO_EFECTIVO,
      JSON.stringify(datos.conteoEfectivo)
    );

    alert(
      "Restauración completada.\n\n" +
      "La aplicación se actualizará para mostrar los datos recuperados."
    );

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
      Guarda tus productos, ventas y conteo de efectivo en un archivo.
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