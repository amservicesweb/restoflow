// ===== SUPERNOVA PWA SERVICE WORKER =====
const CACHE_NAME = 'supernova-v1';

// Fichiers à mettre en cache pour le mode hors-ligne
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
];

// ===== INSTALL — mise en cache des assets statiques =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // On met en cache les fichiers locaux en priorité
      // Les CDN sont cachés à la volée (certains peuvent bloquer)
      return cache.addAll(['/index.html']).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE — nettoyage des anciens caches =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH — stratégie Network First avec fallback cache =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requêtes Supabase → toujours réseau (données temps réel)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si pas de réseau, retourner une réponse JSON vide propre
        return new Response(JSON.stringify({ data: [], error: { message: 'Offline' } }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // CDN (supabase-js, xlsx, jspdf) → Cache First
  if (url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App shell (index.html, assets) → Network First, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
