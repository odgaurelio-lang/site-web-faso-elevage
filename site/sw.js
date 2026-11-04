const CACHE_VERSION = "faso-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const APP_BASE = new URL("./", self.registration.scope);
const STATIC_FILES = [
  "index.html",
  "offline.html",
  "pages/catalogue.html",
  "pages/produit.html",
  "pages/marketplace.html",
  "manifest.webmanifest",
  "icons/mark.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "css/base.css",
  "css/client.css",
  "css/farmer-platform.css",
  "js/i18n.js",
  "js/client-shell.js",
  "js/client.js",
  "js/farmer-platform.js",
];
const CONFIG_URL = new URL("js/supabase-config.js", APP_BASE);
const PUBLIC_PAGES = [
  "index.html",
  "pages/catalogue.html",
  "pages/produit.html",
  "pages/marketplace.html",
  "pages/fermier.html",
  "pages/informations/a-propos.html",
  "pages/informations/contact.html",
  "pages/informations/faq.html",
  "pages/informations/conseils.html",
  "pages/informations/conditions.html",
  "pages/informations/confidentialite.html",
];
const PRIVATE_PAGE = /\/pages\/(?:admin|authentification|tableau-fermier)\.html$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          STATIC_FILES.map(async (file) => {
            const url = new URL(file, APP_BASE);
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Impossible de mettre en cache ${url.pathname}: HTTP ${response.status}`);
            }
            await cache.put(url, response);
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("faso-") && ![STATIC_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith(new URL("supabase/", APP_BASE).pathname)
  ) {
    return;
  }

  if (url.href === CONFIG_URL.href) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await (await caches.open(STATIC_CACHE)).put(request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? Response.error()),
    );
    return;
  }

  if (request.mode === "navigate") {
    if (PRIVATE_PAGE.test(url.pathname)) {
      return;
    }
    const relativePath = url.pathname.startsWith(APP_BASE.pathname)
      ? decodeURIComponent(url.pathname.slice(APP_BASE.pathname.length))
      : "";
    if (!PUBLIC_PAGES.includes(relativePath)) {
      return;
    }
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request, { ignoreSearch: true });
          if (cachedPage) {
            return cachedPage;
          }
          return (
            (await caches.match(new URL("offline.html", APP_BASE))) ??
            new Response("Hors connexion.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  const isStaticAsset = STATIC_FILES.some((file) => new URL(file, APP_BASE).href === url.href);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then(async (response) => {
          if (response.ok) {
            await (await caches.open(STATIC_CACHE)).put(request, response.clone());
          }
          return response;
        });
      }),
    );
  }
});
