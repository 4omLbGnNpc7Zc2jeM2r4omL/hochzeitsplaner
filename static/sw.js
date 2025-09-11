/**
 * Service Worker für Hochzeitsplaner PWA
 * Ermöglicht Offline-Funktionalität und App-Installation
 */

const CACHE_NAME = 'hochzeitsplaner-v1.0.1';
const STATIC_CACHE_NAME = 'hochzeits        const options = {
            body: data.body || 'Neue Mitteilung',
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
        };.1';

// Dateien die immer gecacht werden sollen
const STATIC_FILES = [
    '/',
    '/static/css/style.css',
    '/static/css/wedding-theme.css',
    '/static/js/main.js',
    '/static/js/app.js',
    '/static/js/dashboard.js',
    '/static/js/notification-system.js',
    '/static/icons/apple-touch-icon.png',
    '/static/favicon.ico'
];

// Dateien die bei Netzwerk-Verfügbarkeit aktualisiert werden
const DYNAMIC_CACHE_URLS = [
    '/api/gaeste/list',
    '/api/budget/list',
    '/api/aufgaben/list',
    '/api/zeitplan/list'
];

// Service Worker Installation
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker wird installiert');
    
    event.waitUntil(
        Promise.all([
            // Statische Dateien cachen
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('[SW] Statische Dateien werden gecacht');
                return cache.addAll(STATIC_FILES.filter(url => url !== '/')); // Root separat behandeln
            }),
            
            // Root-Seite separat cachen (kann fehlschlagen ohne App zu brechen)
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.add('/').catch(err => {
                    console.warn('[SW] Root-Seite konnte nicht gecacht werden:', err);
                });
            })
        ]).then(() => {
            console.log('[SW] Installation abgeschlossen');
            // Aktivierung forcieren
            return self.skipWaiting();
        }).catch(err => {
            console.error('[SW] Fehler bei Installation:', err);
        })
    );
});

// Service Worker Aktivierung
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker wird aktiviert');
    
    event.waitUntil(
        // Alte Caches löschen
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        console.log('[SW] Alter Cache wird gelöscht:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Aktivierung abgeschlossen');
            // Sofortige Kontrolle über alle Clients übernehmen
            return self.clients.claim();
        })
    );
});

// Fetch-Events abfangen (Cache-First für statische Dateien, Network-First für API)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Nur GET-Requests cachen
    if (request.method !== 'GET') {
        return;
    }
    
    // Statische Dateien: Cache-First Strategie
    if (url.pathname.startsWith('/static/') || url.pathname === '/' || url.pathname === '/favicon.ico') {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('[SW] Aus Cache geladen:', url.pathname);
                    return cachedResponse;
                }
                
                // Fallback: Vom Netzwerk laden und cachen
                return fetch(request).then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(STATIC_CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                }).catch((err) => {
                    console.error('[SW] Fehler beim Laden von:', url.pathname, err);
                    // Für HTML-Seiten: Offline-Fallback
                    if (request.headers.get('accept').includes('text/html')) {
                        return new Response(
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <title>Offline - Hochzeitsplaner</title>
                                <meta charset="utf-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1">
                                <style>
                                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                    .offline { color: #666; }
                                    .heart { color: #e91e63; font-size: 2em; }
                                </style>
                            </head>
                            <body>
                                <div class="heart">💕</div>
                                <h1>Offline</h1>
                                <p class="offline">Der Hochzeitsplaner ist derzeit nicht verfügbar.</p>
                                <p>Bitte prüfen Sie Ihre Internetverbindung.</p>
                            </body>
                            </html>`,
                            { 
                                headers: { 'Content-Type': 'text/html' }
                            }
                        );
                    }
                    throw err;
                });
            })
        );
        return;
    }
    
    // API-Calls: Network-First mit Cache-Fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).then((response) => {
                // Erfolgreiche API-Antworten cachen
                if (response.status === 200 && DYNAMIC_CACHE_URLS.some(pattern => url.pathname.includes(pattern.replace('/api/', '')))) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
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

// Push-Notifications (für zukünftige Erweiterungen)
self.addEventListener('push', (event) => {
    console.log('[SW] Push-Nachricht empfangen:', event);
    
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Neue Nachricht vom Hochzeitsplaner',
            icon: '/static/icons/apple-touch-icon.png',
            badge: '/static/icons/apple-touch-icon.png',
            tag: 'hochzeitsplaner-notification',
            renotify: true,
            requireInteraction: false,
            actions: [
                {
                    action: 'open',
                    title: 'Öffnen'
                },
                {
                    action: 'close',
                    title: 'Schließen'
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