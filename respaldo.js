
// ==========================================
// CAJA - COPIA DE SEGURIDAD Y RESTAURACIÓN
// ==========================================

const CLAVE_RESPALDO_EFECTIVO = "caja_conteo_efectivo_v1";

async function crearCopiaSeguridad() {
  try {
    const productosGuardados = await obtenerTodos("productos");
    const ventasGuardadas = await obtenerTodos("ventas");

    const conteoGuardado = JSON.parse(
      localStorage.getItem(CLAVE_RESPALDO_EFECTIVO) || "{}"
    );

    const respaldo = {
      aplicacion: "CAJA",
      version: 1,
      fechaRespaldo: new Date().toISOString(),
      productos: productosGuardados,
      ventas: ventasGuardadas,
      conteoEfectivo: conteoGuardado
    };

    const contenido = JSON.stringify(respaldo, null, 2);

    const archivo = new Blob(
      [contenido],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    const fecha = new Date().toISOString()
      .replace(/:/g, "-")
      .slice(0, 19);

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
// VALIDAR ARCHIVO
// ==========================================

function validarCopiaSeguridad(datos) {
  if (!datos || typeof datos !== "object") {
    throw new Error("El archivo no contiene datos válidos.");
  }

  if (datos.aplicacion !== "CAJA" || datos.version !== 1) {
    throw new Error("El archivo no es una copia compatible de CAJA.");
  }

  if (
    !Array.isArray(datos.productos) ||
    !Array.isArray(datos.ventas) ||
    !datos.conteoEfectivo ||
    typeof datos.conteoEfectivo !== "object"
  ) {
    throw new Error("La copia está incompleta o dañada.");
  }

  for (const producto of datos.productos) {
    if (
      !producto ||
      producto.id === undefined ||
      typeof producto.nombre !== "string"
    ) {
      throw new Error("Hay productos con información inválida.");
    }
  }

  for (const venta of datos.ventas) {
    if (
      !venta ||
      venta.id === undefined ||
      !Array.isArray(venta.productos)
    ) {
      throw new Error("Hay ventas con información inválida.");
    }
  }

  return true;
}

// ==========================================
// RESTAURAR COPIA
// ==========================================

async function restaurarCopiaSeguridad(archivo) {
  if (!archivo) return;

  try {
    const contenido = await archivo.text();
    const datos = JSON.parse(contenido);

    validarCopiaSeguridad(datos);

    const confirmacion = confirm(
      "¿Restaurar esta copia de seguridad?\n\n" +
      "Productos: " + datos.productos.length + "\n" +
      "Ventas: " + datos.ventas.length + "\n\n" +
      "ATENCIÓN: los productos y ventas actuales serán " +
      "sustituidos por los de esta copia."
    );

    if (!confirmacion) return;

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
  const inicio = document.getElementById("pantallaInicio");

  if (!inicio || document.getElementById("panelRespaldo")) {
    return;
  }

  const panel = document.createElement("div");

  panel.id = "panelRespaldo";
  panel.className = "tarjeta";

  panel.style.marginTop = "18px";

  panel.innerHTML = `
    <h3 style="margin-bottom:8px">
      Copias de seguridad
    </h3>

    <p style="font-size:13px;color:#777;margin-bottom:15px">
      Guarda tus productos, ventas y conteo de efectivo
      en un archivo de tu teléfono.
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
      onchange="if(this.files.length){restaurarCopiaSeguridad(this.files[0]);this.value='';}"
    >
  `;

  const nota = inicio.querySelector(".nota-inicio");

  if (nota) {
    nota.insertAdjacentElement("afterend", panel);
  } else {
    inicio.appendChild(panel);
  }
}

document.addEventListener(
  "DOMContentLoaded",
  instalarPanelRespaldo
);
