// ==========================================
// CAJA - BASE DE DATOS (IndexedDB)
// ==========================================

const DB_NAME = "CajaVentasDB";
const DB_VERSION = 3;

let db;

function abrirBaseDatos() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

    solicitud.onupgradeneeded = function(event) {
      const base = event.target.result;

      if (!base.objectStoreNames.contains("productos")) {
        base.createObjectStore("productos", { keyPath: "id", autoIncrement: true });
      }

      if (!base.objectStoreNames.contains("ventas")) {
        const ventas = base.createObjectStore("ventas", { keyPath: "id", autoIncrement: true });
        ventas.createIndex("fecha", "fecha", { unique: false });
      }

      if (!base.objectStoreNames.contains("entradas")) {
        const entradas = base.createObjectStore("entradas", { keyPath: "id", autoIncrement: true });
        entradas.createIndex("fecha", "fecha", { unique: false });
        entradas.createIndex("idProducto", "idProducto", { unique: false });
      }
    };

    solicitud.onsuccess = function(event) {
      db = event.target.result;
      resolve(db);
    };

    solicitud.onerror = function() { reject(solicitud.error); };
    solicitud.onblocked = function() { reject(new Error("La base de datos está bloqueada.")); };
  });
}

function guardarDato(tabla, dato) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(tabla, "readwrite");
    const s = t.objectStore(tabla).put(dato);
    s.onsuccess = () => resolve(s.result);
    s.onerror = () => reject(s.error);
  });
}

function obtenerTodos(tabla) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(tabla, "readonly");
    const s = t.objectStore(tabla).getAll();
    s.onsuccess = () => resolve(s.result);
    s.onerror = () => reject(s.error);
  });
}

function eliminarDato(tabla, id) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(tabla, "readwrite");
    const s = t.objectStore(tabla).delete(id);
    s.onsuccess = () => resolve(true);
    s.onerror = () => reject(s.error);
  });
}

function reajustarAutoIncrement(tabla) {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(tabla, "readwrite");
      const store = t.objectStore(tabla);
      const req = store.openCursor(null, "prev");
      req.onsuccess = function(e) {
        const c = e.target.result;
        if (c) {
          try { store.autoIncrement = Number(c.key) + 1; } catch (_) {}
        }
      };
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    } catch (e) {
      console.warn(e);
      resolve(false);
    }
  });
}

function reemplazarTodos(tabla, registros) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("La base de datos no está abierta."));
    if (!Array.isArray(registros)) return reject(new Error("Datos inválidos."));

    if (!db.objectStoreNames.contains(tabla)) return resolve(true);

    try {
      const t = db.transaction(tabla, "readwrite");
      const store = t.objectStore(tabla);
      store.clear();
      registros.forEach(r => store.put(r));

      t.oncomplete = async function() {
        await reajustarAutoIncrement(tabla);
        resolve(true);
      };
      t.onerror = function() { reject(t.error); };
      t.onabort = function() { reject(t.error || new Error("Cancelado.")); };
    } catch (e) {
      reject(e);
    }
  });
}