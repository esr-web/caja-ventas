
const DB_NAME = "CajaVentasDB";
const DB_VERSION = 1;

let db;

// ==========================================
// ABRIR BASE DE DATOS
// ==========================================

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

    solicitud.onblocked = function() {
      reject(new Error("La base de datos está bloqueada."));
    };
  });
}

// ==========================================
// GUARDAR REGISTRO
// ==========================================

function guardarDato(tabla, dato) {
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(tabla, "readwrite");
    const solicitud = transaccion.objectStore(tabla).put(dato);

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// ==========================================
// OBTENER TODOS LOS REGISTROS
// ==========================================

function obtenerTodos(tabla) {
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(tabla, "readonly");
    const solicitud = transaccion.objectStore(tabla).getAll();

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// ==========================================
// ELIMINAR REGISTRO
// ==========================================

function eliminarDato(tabla, id) {
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(tabla, "readwrite");
    const solicitud = transaccion.objectStore(tabla).delete(id);

    solicitud.onsuccess = () => resolve(true);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// ==========================================
// RESTAURAR REGISTROS DE UNA COPIA
// ==========================================

function reemplazarTodos(tabla, registros) {
  return new Promise((resolve, reject) => {

    if (!db) {
      reject(new Error("La base de datos no está abierta."));
      return;
    }

    if (!Array.isArray(registros)) {
      reject(new Error("Los datos recibidos no son válidos."));
      return;
    }

    try {
      const transaccion = db.transaction(tabla, "readwrite");
      const almacen = transaccion.objectStore(tabla);

      almacen.clear();

      registros.forEach(registro => {
        almacen.put(registro);
      });

      transaccion.oncomplete = function() {
        resolve(true);
      };

      transaccion.onerror = function() {
        reject(transaccion.error);
      };

      transaccion.onabort = function() {
        reject(transaccion.error || new Error("Restauración cancelada."));
      };

    } catch (error) {
      reject(error);
    }
  });
}
