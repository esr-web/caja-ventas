
const DB_NAME = "CajaVentasDB";
const DB_VERSION = 1;

let db;

function abrirBaseDatos() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

    solicitud.onupgradeneeded = function(event) {
      const base = event.target.result;

      if (!base.objectStoreNames.contains("productos")) {
        base.createObjectStore("productos", {
          keyPath: "id",
          autoIncrement: true
        });
      }

      if (!base.objectStoreNames.contains("ventas")) {
        const ventas = base.createObjectStore("ventas", {
          keyPath: "id",
          autoIncrement: true
        });

        ventas.createIndex("fecha", "fecha", {
          unique: false
        });
      }
    };

    solicitud.onsuccess = function(event) {
      db = event.target.result;
      resolve(db);
    };

    solicitud.onerror = function() {
      reject(solicitud.error);
    };
  });
}

function guardarDato(tabla, dato) {
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(tabla, "readwrite");
    const solicitud = transaccion.objectStore(tabla).put(dato);

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

function obtenerTodos(tabla) {
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(tabla, "readonly");
    const solicitud = transaccion.objectStore(tabla).getAll();

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

function eliminarDato(tabla, id) {
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(tabla, "readwrite");
    const solicitud = transaccion.objectStore(tabla).delete(id);

    solicitud.onsuccess = () => resolve(true);
    solicitud.onerror = () => reject(solicitud.error);
  });
}
