/**
 * Service Worker für Hochzeitsplaner PWA
 * Verwaltet Caching, Offline-Funktionalität und Push-Notifications
 */

const STATIC_CACHE_NAME = 'hochzeitsplaner-static-v3.2.5';
const DYNAMIC_CACHE_NAME = 'hochzeitsplaner-dynamic-v3.2.5';
const API_CACHE_NAME = 'hochzeitsplaner-api-v3.2.5';

// Statische Ressourcen, die gecacht werden sollen
const STATIC_ASSETS = [
    '/',
    '/static/css/main.css',
    '/static/css/mobile.css',
    '/static/js/main.js',
    '/static/js/spotify.js',
    '/static/js/push-notifications-simple.js',
    '/static/icons/apple-touch-icon.png',
    '/static/icons/android-chrome-192x192.png',
    '/static/icons/android-chrome-512x512.png',
    '/static/icons/favicon-16x16.png',
    '/static/icons/favicon-32x32.png',
    '/static/icons/favicon.ico',
    '/static/manifest.json'
];

// URLs, die gecacht werden sollen
const CACHEABLE_PATHS = [
    '/gaesteliste',
    '/geschenkliste',
    '/aufgabenplaner',
    '/budget',
    '/tischplanung',
    '/einstellungen',
    '/gaeste_uploads'
];

// API-Endpunkte, die gecacht werden sollen
const CACHEABLE_API_PATHS = [
    '/api/guests',
    '/api/tasks',
    '/api/budget',
    '/api/gifts',
    '/api/table_planning',
    '/api/settings'
];

// Install Event - Cache statische Ressourcen
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker wird installiert...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Statische Ressourcen werden gecacht...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Statische Ressourcen erfolgreich gecacht');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Fehler beim Cachen statischer Ressourcen:', error);
            })
    );
});

// Activate Event - Alte Caches löschen
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker wird aktiviert...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME && 
                            cacheName !== API_CACHE_NAME) {
                            console.log('[SW] Alter Cache wird gelöscht:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker aktiviert und übernimmt Kontrolle');
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('[SW] Fehler bei der Aktivierung:', error);
            })
    );
});

// Fetch Event - Request-Handling mit intelligenter Cache-Strategie
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Nur GET-Requests cachen
    if (request.method !== 'GET') {
        return;
    }
    
    // Statische Assets: Cache First
    if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log('[SW] Statische Ressource aus Cache:', url.pathname);
                        return cachedResponse;
                    }
                    
                    return fetch(request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(STATIC_CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(request, responseClone);
                                    });
                            }
                            return response;
                        });
                })
                .catch(() => {
                    // Fallback für kritische statische Ressourcen
                    if (url.pathname === '/') {
                        return caches.match('/');
                    }
                    throw new Error('Ressource nicht verfügbar');
                })
        );
        return;
    }
    
    // HTML-Seiten: Network First mit Cache Fallback
    if (CACHEABLE_PATHS.some(path => url.pathname.startsWith(path))) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseClone);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    console.log('[SW] Netzwerk nicht verfügbar, lade aus Cache:', url.pathname);
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Fallback zur Hauptseite wenn spezifische Seite nicht gecacht
                            return caches.match('/');
                        });
                })
        );
        return;
    }
    
    // API-Calls: Network First mit Cache Fallback für bestimmte APIs
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Nur erfolgreiche GET-API-Calls cachen
                    if (response && response.status === 200 && 
                        CACHEABLE_API_PATHS.some(path => url.pathname.startsWith(path))) {
                        const responseClone = response.clone();
                        caches.open(API_CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseClone);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // Bei Netzwerkfehler: Cache-Fallback
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            console.log('[SW] API aus Cache geladen:', url.pathname);
                            return cachedResponse;
                        }
                        
                        // Letzter Fallback für kritische APIs
                        if (url.pathname.includes('/api/')) {
                            return new Response(
                                JSON.stringify({
                                    success: false,
                                    error: 'Offline - keine Daten verfügbar',
                                    offline: true
                                }),
                                {
                                    headers: { 'Content-Type': 'application/json' },
                                    status: 503
                                }
                            );
                        }
                        
                        throw new Error('Offline und keine Cache-Daten verfügbar');
                    });
                })
        );
        return;
    }
    
    // Für alle anderen Requests: Standard-Verhalten
    event.respondWith(fetch(request));
});

// Push-Notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push-Nachricht empfangen:', event);
    
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Neue Nachricht vom Hochzeitsplaner',
            icon: '/static/icons/android-chrome-192x192.png', // Größeres Icon für bessere Sichtbarkeit
            badge: '/static/icons/apple-touch-icon.png', // Kleines Badge-Icon
            image: data.image || null, // Optional: Großes Bild in der Notification
            tag: 'hochzeitsplaner-notification',
            renotify: true,
            requireInteraction: false,
            silent: false, // Sound abspielen
            timestamp: Date.now(),
            data: data, // Daten für Click-Handling
            actions: [
                {
                    action: 'open',
                    title: '✨ Öffnen',
                    icon: '/static/icons/favicon-32x32.png'
                },
                {
                    action: 'close',
                    title: '❌ Schließen'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Hochzeitsplaner', options)
        );
    }
});

// Notification-Click Handling
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification wurde geklickt:', event);
    
    event.notification.close();
    
    // Spezifische URLs basierend auf Notification-Typ
    let targetUrl = '/';
    if (event.notification.data) {
        const data = event.notification.data;
        if (data.url) {
            targetUrl = data.url;
        } else if (data.type === 'rsvp') {
            targetUrl = `/gaesteliste${data.guest_id ? '?highlight=' + data.guest_id : ''}`;
        } else if (data.type === 'gift') {
            targetUrl = '/geschenkliste';
        } else if (data.type === 'upload') {
            targetUrl = '/upload_approval';
        }
    }
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
                // Prüfe ob bereits ein Tab mit der App geöffnet ist
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin)) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // Andernfalls öffne neuen Tab
                return clients.openWindow(targetUrl);
            })
        );
    }
});

// Hintergrund-Sync (für zukünftige Offline-Synchronisation)
self.addEventListener('sync', (event) => {
    console.log('[SW] Hintergrund-Sync ausgelöst:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Hier könnten Offline-Änderungen synchronisiert werden
            Promise.resolve()
        );
    }
});

// Message Handler für Skip Waiting
self.addEventListener('message', (event) => {
    console.log('[SW] Message erhalten:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip Waiting angefordert');
        self.skipWaiting();
    }
});

// Fehlerbehandlung
self.addEventListener('error', (event) => {
    console.error('[SW] Service Worker Fehler:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unbehandelte Promise-Ablehnung:', event.reason);
});

console.log('[SW] Service Worker geladen und bereit');
