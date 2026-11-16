
const CACHE_NAME = "caja-ventas-v6";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./database.js",
  "./app.js",
  "./respaldo.js",
  "./manifest.json",
  "./icono.png"
];

// INSTALACIÓN
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(
        nombres
          .filter(nombre =>
            nombre.startsWith("caja-ventas-") &&
            nombre !== CACHE_NAME
          )
          .map(nombre => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// FUNCIONAMIENTO ONLINE Y OFFLINE
self.addEventListener("fetch", event => {
  const solicitud = event.request;

  if (solicitud.method !== "GET") return;

  const url = new URL(solicitud.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(solicitud)
      .then(respuesta => {
        if (
          respuesta &&
          respuesta.status === 200 &&
          respuesta.type === "basic"
        ) {
          const copia = respuesta.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(solicitud, copia);
          });
        }

        return respuesta;
      })
      .catch(() => {
        return caches.match(solicitud)
          .then(respuestaGuardada => {
            if (respuestaGuardada) {
              return respuestaGuardada;
            }

            if (solicitud.mode === "navigate") {
              return caches.match("./index.html");
            }

            return new Response(
              "Recurso no disponible sin conexión.",
              {
                status: 503,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8"
                }
              }
            );
          });
      })
  );
});
