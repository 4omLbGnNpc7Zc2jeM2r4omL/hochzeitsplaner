const CACHE_NAME = 'hochzeitsplaner-v2.5.11';
const urlsToCache = [
  '/',
  '/static/css/style.css',
  '/static/css/wedding-theme.css',
  '/static/js/app.js',
  '/static/js/wedding-theme.js',
  '/static/js/guest_dashboard.js',
  '/static/js/guest_zeitplan.js',
  '/static/js/openstreetmap.js',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch events
self.addEventListener('fetch', (event) => {
  // Only handle GET requests from http/https schemes
  if (event.request.method !== 'GET' || 
      (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://'))) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Additional check: Don't cache non-GET requests or unsupported schemes
            if (event.request.method !== 'GET' || 
                (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://'))) {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Additional safety check before caching
                try {
                  cache.put(event.request, responseToCache);
                } catch (error) {
                  console.log('Cache put failed:', error);
                }
              })
              .catch((error) => {
                console.log('Cache open failed:', error);
              });

            return response;
          }
        );
      })
    );
});

// Update Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle push notifications (optional for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Neue Nachricht!',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/icon-72x72.png',
    tag: 'hochzeitsplaner-notification'
  };

  event.waitUntil(
    self.registration.showNotification('Hochzeitsplaner', options)
  );
});
