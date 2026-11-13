
const CACHE_NAME = "caja-ventas-v3";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./database.js",
  "./app.js",
  "./manifest.json",
  "./icono.png"
];

// INSTALACIÓN
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARCHIVOS);
    })
  );

  self.skipWaiting();
});

// ACTIVACIÓN
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(nombres => {
      return Promise.all(
        nombres
          .filter(nombre =>
            nombre.startsWith("caja-ventas-") &&
            nombre !== CACHE_NAME
          )
          .map(nombre => caches.delete(nombre))
      );
    })
  );

  self.clients.claim();
});

// FUNCIONAMIENTO SIN INTERNET
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(respuesta => {
      if (respuesta) return respuesta;

      return fetch(event.request).then(respuestaRed => {
        if (!respuestaRed || !respuestaRed.ok) {
          return respuestaRed;
        }

        const copia = respuestaRed.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copia);
        });

        return respuestaRed;

      }).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return new Response(
          "Recurso no disponible sin conexión",
          { status: 503 }
        );
      });
    })
  );
});
