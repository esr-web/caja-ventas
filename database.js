// ==========================================
// CAJA - BASE DE DATOS (IndexedDB)
// ==========================================

const DB_NAME = "CajaVentasDB";
const DB_VERSION = 5;

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

      if (!base.objectStoreNames.contains("entradas")) {
        const entradas = base.createObjectStore("entradas", {
          keyPath: "id",
          autoIncrement: true
        });

        entradas.createIndex("fecha", "fecha", {
          unique: false
        });

        entradas.createIndex("idProducto", "idProducto", {
          unique: false
        });
      }

      if (!base.objectStoreNames.contains("comprasUSD")) {
        const comprasUSD = base.createObjectStore("comprasUSD", {
          keyPath: "id",
          autoIncrement: true
        });

        comprasUSD.createIndex("fecha", "fecha", {
          unique: false
        });
      }

      if (!base.objectStoreNames.contains("pendientes")) {
        const pendientes = base.createObjectStore("pendientes", {
          keyPath: "id",
          autoIncrement: true
        });

        pendientes.createIndex("cumplida", "cumplida", {
          unique: false
        });

        pendientes.createIndex("fechaCreacion", "fechaCreacion", {
          unique: false
        });
      }
    };

    solicitud.onsuccess = function(event) {
      db = event.target.result;

      db.onversionchange = function() {
        db.close();
        db = null;
      };

      resolve(db);
    };

    solicitud.onerror = function() {
      reject(solicitud.error || new Error("No se pudo abrir la base de datos."));
    };

    solicitud.onblocked = function() {
      reject(new Error("La base de datos está bloqueada por otra ventana."));
    };
  });
}

// ==========================================
// GUARDAR UN REGISTRO
// ==========================================

function guardarDato(tabla, dato) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error("La base de datos no está abierta."));
    }

    try {
      const transaccion = db.transaction(tabla, "readwrite");
      const store = transaccion.objectStore(tabla);

      let resultado;

      const solicitud = store.put(dato);

      solicitud.onsuccess = function() {
        resultado = solicitud.result;
      };

      transaccion.oncomplete = function() {
        resolve(resultado);
      };

      transaccion.onerror = function() {
        reject(transaccion.error || new Error("No se pudo guardar el registro."));
      };

      transaccion.onabort = function() {
        reject(transaccion.error || new Error("La operación fue cancelada."));
      };

    } catch (error) {
      reject(error);
    }
  });
}

// ==========================================
// OBTENER TODOS LOS REGISTROS
// ==========================================

function obtenerTodos(tabla) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error("La base de datos no está abierta."));
    }

    try {
      const transaccion = db.transaction(tabla, "readonly");
      const store = transaccion.objectStore(tabla);
      const solicitud = store.getAll();

      solicitud.onsuccess = function() {
        resolve(solicitud.result);
      };

      solicitud.onerror = function() {
        reject(solicitud.error || new Error("No se pudieron obtener los registros."));
      };

      transaccion.onerror = function() {
        reject(transaccion.error || new Error("Error al consultar la base de datos."));
      };

    } catch (error) {
      reject(error);
    }
  });
}

// ==========================================
// ELIMINAR UN REGISTRO
// ==========================================

function eliminarDato(tabla, id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error("La base de datos no está abierta."));
    }

    try {
      const transaccion = db.transaction(tabla, "readwrite");
      const store = transaccion.objectStore(tabla);

      store.delete(id);

      transaccion.oncomplete = function() {
        resolve(true);
      };

      transaccion.onerror = function() {
        reject(transaccion.error || new Error("No se pudo eliminar el registro."));
      };

      transaccion.onabort = function() {
        reject(transaccion.error || new Error("La eliminación fue cancelada."));
      };

    } catch (error) {
      reject(error);
    }
  });
}

// ==========================================
// REEMPLAZAR VARIAS TABLAS ATÓMICAMENTE
// ==========================================

function reemplazarVariasTablas(registrosPorTabla) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error("La base de datos no está abierta."));
    }

    if (!registrosPorTabla || typeof registrosPorTabla !== "object") {
      return reject(new Error("Los datos recibidos no son válidos."));
    }

    const tablas = Object.keys(registrosPorTabla);

    if (!tablas.length) {
      return resolve(true);
    }

    for (const tabla of tablas) {
      if (!db.objectStoreNames.contains(tabla)) {
        return reject(new Error("No existe la tabla: " + tabla));
      }

      if (!Array.isArray(registrosPorTabla[tabla])) {
        return reject(new Error("Los registros de " + tabla + " no son válidos."));
      }
    }

    try {
      const transaccion = db.transaction(tablas, "readwrite");

      for (const tabla of tablas) {
        const store = transaccion.objectStore(tabla);

        store.clear();

        for (const registro of registrosPorTabla[tabla]) {
          store.put(registro);
        }
      }

      transaccion.oncomplete = function() {
        resolve(true);
      };

      transaccion.onerror = function() {
        reject(transaccion.error || new Error("No se pudo restaurar la base de datos."));
      };

      transaccion.onabort = function() {
        reject(transaccion.error || new Error("La restauración fue cancelada."));
      };

    } catch (error) {
      reject(error);
    }
  });
}

// ==========================================
// REEMPLAZAR TODOS LOS REGISTROS DE UNA TABLA
// ==========================================

function reemplazarTodos(tabla, registros) {
  return reemplazarVariasTablas({
    [tabla]: registros
  });
}

// ==========================================
// COMPATIBILIDAD CON CÓDIGO ANTERIOR
// ==========================================

function reajustarAutoIncrement(tabla) {
  return Promise.resolve(true);
}