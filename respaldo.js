// ==========================================
// CAJA - COPIA DE SEGURIDAD Y RESTAURACIÓN
// ==========================================

const CLAVE_RESPALDO_EFECTIVO = "caja_conteo_efectivo_v1";
const VERSION_RESPALDO = 4;

// ==========================================
// CREAR COPIA
// ==========================================

async function crearCopiaSeguridad() {
  try {
    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");

    let entradasGuardadas = [];
    try { entradasGuardadas = await obtenerTodos("entradas"); } catch (_) {}

    let comprasUSDGuardadas = [];
    try { comprasUSDGuardadas = await obtenerTodos("comprasUSD"); } catch (_) {}

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
      comprasUSD: comprasUSDGuardadas,
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
  const productos = (datos.productos || []).map(p => {
    const stock = p.stock || {};
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
        precio: Number(linea.precio)