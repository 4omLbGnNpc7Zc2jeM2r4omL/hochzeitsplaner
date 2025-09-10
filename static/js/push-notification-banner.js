/**
 * Push Notification Banner
 * Zeigt einmalig ein Banner an, wenn Push Notifications nicht aktiviert sind
 */

class PushNotificationBanner {
    constructor() {
        this.storageKey = 'pushNotificationBannerDismissed';
        this.init();
    }

    async init() {
        console.log('🔧 Push Banner initialisiert, User Role:', window.userRole);
        
        // Nur für Admins anzeigen
        if (!this.isAdmin()) {
            console.log('❌ Nicht Admin - Banner wird nicht angezeigt');
            return;
        }

        console.log('✅ Admin erkannt - prüfe Banner-Status');

        // Prüfe ob Banner bereits dismissed wurde
        if (this.wasBannerDismissed()) {
            console.log('📱 Push Banner bereits ausgeblendet für 24h');
            return;
        }

        console.log('🔧 Prüfe ob Banner benötigt wird...');

        // Prüfe Push Notification Status
        const needsBanner = await this.checkIfBannerNeeded();
        console.log('🔧 Banner benötigt:', needsBanner);
        
        if (needsBanner) {
            console.log('✅ Zeige Push Banner an');
            this.showBanner();
        } else {
            console.log('❌ Banner nicht benötigt - Push bereits aktiv');
        }
    }

    isAdmin() {
        // Prüfe verschiedene Wege um Admin-Status zu ermitteln
        const isAdminByRole = window.userRole === 'admin';
        const isAdminByPath = window.location.pathname.includes('admin');
        const isAdminByContainer = !!document.getElementById('pushBannerContainer');
        
        console.log('🔍 Admin Check:', {
            userRole: window.userRole,
            byRole: isAdminByRole,
            byPath: isAdminByPath,
            byContainer: isAdminByContainer
        });
        
        return isAdminByRole || isAdminByPath || isAdminByContainer;
    }

    wasBannerDismissed() {
        try {
            const dismissed = localStorage.getItem(this.storageKey);
            if (dismissed) {
                const dismissedData = JSON.parse(dismissed);
                // Banner für 24 Stunden ausblenden
                const dismissedTime = new Date(dismissedData.timestamp);
                const now = new Date();
                const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
                
                if (hoursSinceDismissed < 24) {
                    return true;
                }
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Prüfen des Banner Status:', error);
        }
        return false;
    }

    async checkIfBannerNeeded() {
        try {
            console.log('🔧 Prüfe Browser Support...');
            
            // Prüfe Browser Support
            const hasServiceWorker = 'serviceWorker' in navigator;
            const hasPushManager = 'PushManager' in window;
            const hasNotification = 'Notification' in window;
            
            console.log('🔧 Browser Support:', {
                serviceWorker: hasServiceWorker,
                pushManager: hasPushManager,
                notification: hasNotification
            });

            if (!hasServiceWorker || !hasPushManager || !hasNotification) {
                console.log('❌ Browser unterstützt keine Push Notifications');
                return false; // Browser unterstützt keine Push Notifications
            }

            console.log('🔧 Aktuelle Permission:', Notification.permission);

            // Prüfe aktuelle Permission
            if (Notification.permission === 'denied') {
                console.log('❌ Push Notifications wurden verweigert');
                return false; // Benutzer hat Push Notifications verweigert
            }

            if (Notification.permission === 'granted') {
                console.log('✅ Permission erteilt - prüfe aktive Subscription...');
                // Prüfe ob aktive Subscription existiert
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration && registration.pushManager) {
                        const subscription = await registration.pushManager.getSubscription();
                        console.log('🔧 Aktive Subscription gefunden:', !!subscription);
                        if (subscription) {
                            return false; // Push Notifications bereits aktiv
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Fehler beim Prüfen der Subscription:', error);
                }
                return true; // Permission da, aber keine Subscription
            }

            // Permission ist 'default' - Banner zeigen
            console.log('🔧 Permission ist default - Banner wird benötigt');
            return true;
            
        } catch (error) {
            console.error('❌ Fehler beim Prüfen des Push Status:', error);
            return true; // Im Fehlerfall Banner anzeigen
        }
    }

    showBanner() {
        // Banner HTML erstellen
        const banner = document.createElement('div');
        banner.id = 'pushNotificationBanner';
        banner.className = 'alert alert-info alert-dismissible fade show position-fixed w-100';
        banner.style.cssText = `
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            margin: 0;
            border-radius: 0;
            background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
            border: none;
            color: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        banner.innerHTML = `
            <div class="container-fluid">
                <div class="row align-items-center">
                    <div class="col-auto">
                        <i class="bi bi-bell fs-4"></i>
                    </div>
                    <div class="col">
                        <strong>🔔 Push-Benachrichtigungen aktivieren</strong>
                        <div class="small">
                            Erhalten Sie sofort Benachrichtigungen über neue RSVP-Antworten und wichtige Updates.
                        </div>
                    </div>
                    <div class="col-auto">
                        <button type="button" class="btn btn-light btn-sm me-2" id="enablePushBtn">
                            <i class="bi bi-bell-fill me-1"></i>
                            Aktivieren
                        </button>
                        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="alert" aria-label="Close">
                            <i class="bi bi-x"></i>
                            <span class="d-none d-sm-inline">Später</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Banner zur Seite hinzufügen
        document.body.insertBefore(banner, document.body.firstChild);

        // Body Padding hinzufügen damit Inhalt nicht verdeckt wird
        document.body.style.paddingTop = banner.offsetHeight + 'px';

        // Event Listeners
        this.setupBannerEvents(banner);

        console.log('📱 Push Notification Banner angezeigt');
    }

    setupBannerEvents(banner) {
        // "Aktivieren" Button
        const enableBtn = banner.querySelector('#enablePushBtn');
        if (enableBtn) {
            enableBtn.addEventListener('click', async () => {
                console.log('🔔 Aktivieren Button geklickt');
                
                // Button Status ändern
                const originalContent = enableBtn.innerHTML;
                enableBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Aktiviere...';
                enableBtn.disabled = true;

                try {
                    // Timeout nach 30 Sekunden
                    const success = await Promise.race([
                        this.enablePushNotifications(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout nach 30 Sekunden')), 30000)
                        )
                    ]);
                    
                    console.log('🔔 Push Activation Ergebnis:', success);
                    
                    if (success) {
                        console.log('✅ Push Notifications erfolgreich aktiviert');
                        this.hideBanner(banner, '✅ Push-Benachrichtigungen aktiviert!');
                    } else {
                        console.log('❌ Push Activation fehlgeschlagen');
                        enableBtn.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Fehler';
                        enableBtn.className = 'btn btn-warning btn-sm me-2';
                        
                        // Nach 3 Sekunden Button zurücksetzen
                        setTimeout(() => {
                            enableBtn.innerHTML = originalContent;
                            enableBtn.className = 'btn btn-light btn-sm me-2';
                            enableBtn.disabled = false;
                        }, 3000);
                    }
                } catch (error) {
                    console.error('❌ Exception in Push Activation:', error);
                    enableBtn.innerHTML = '<i class="bi bi-x-circle me-1"></i>Fehler';
                    enableBtn.className = 'btn btn-danger btn-sm me-2';
                    
                    // Nach 3 Sekunden Button zurücksetzen
                    setTimeout(() => {
                        enableBtn.innerHTML = originalContent;
                        enableBtn.className = 'btn btn-light btn-sm me-2';
                        enableBtn.disabled = false;
                    }, 3000);
                }
            });
        }

        // "Später" Button / Dismiss
        const dismissBtn = banner.querySelector('[data-bs-dismiss="alert"]');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                console.log('⏰ Banner dismissed durch Benutzer');
                this.dismissBanner();
                this.hideBanner(banner);
            });
        }

        // Auto-dismiss nach 30 Sekunden
        setTimeout(() => {
            if (document.contains(banner)) {
                console.log('⏰ Banner auto-dismissed nach 30 Sekunden');
                this.dismissBanner();
                this.hideBanner(banner);
            }
        }, 30000);
    }

    async enablePushNotifications() {
        try {
            // Service Worker Debugger verwenden falls verfügbar
            const swDebugger = window.swDebugger;
            if (swDebugger) {
                swDebugger.log('🔔 Push Notification Aktivierung über Banner gestartet');
            }
            
            // Visual Debug für iPhone
            this.showVisualStatus('🔔 Starte Push Activation...');
            
            console.log('🔔 Starte Push Notification Aktivierung...');

            // 1. Permission anfragen
            this.showVisualStatus('🔔 Schritt 1: Permission prüfen...');
            console.log('🔔 Schritt 1: Permission prüfen/anfragen');
            if (Notification.permission === 'default') {
                console.log('🔔 Fordere Permission an...');
                const permission = await Notification.requestPermission();
                console.log('🔔 Permission Ergebnis:', permission);
                
                if (swDebugger) {
                    swDebugger.log(`🔔 Permission angefordert: ${permission}`);
                }
                
                if (permission !== 'granted') {
                    console.log('❌ Permission nicht erteilt:', permission);
                    this.showVisualStatus('❌ Permission verweigert');
                    if (swDebugger) {
                        swDebugger.log(`❌ Permission verweigert: ${permission}`);
                    }
                    alert('❌ Push-Benachrichtigungen wurden nicht erlaubt');
                    return false;
                }
            } else if (Notification.permission === 'denied') {
                console.log('❌ Permission verweigert');
                this.showVisualStatus('❌ Permission bereits verweigert');
                if (swDebugger) {
                    swDebugger.log('❌ Permission bereits verweigert');
                }
                alert('❌ Push-Benachrichtigungen wurden blockiert. Bitte in den Browser-Einstellungen aktivieren.');
                return false;
            }
            console.log('✅ Permission erfolgreich: granted');
            this.showVisualStatus('✅ Permission erhalten');

            // 2. Service Worker mit Debugger vorbereiten
            this.showVisualStatus('🔔 Schritt 2: Service Worker...');
            console.log('🔔 Schritt 2: Service Worker vorbereiten');
            
            let registration;
            if (swDebugger) {
                registration = await swDebugger.prepareForPushNotifications();
            } else {
                // Fallback ohne Debugger (mit iOS Safari Workaround)
                registration = await navigator.serviceWorker.register('/sw.js');  // ROOT SCOPE
                
                // iOS Safari Bug Workaround: serviceWorker.ready hängt sich auf
                const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                if (isIOS) {
                    console.log('🍎 iOS Safari: Überspringe serviceWorker.ready Bug');
                    this.showVisualStatus('🍎 iOS Safari: Workaround aktiv');
                    // Warte kurz und prüfe direkt die Registration
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    registration = await navigator.serviceWorker.getRegistration();
                } else {
                    await navigator.serviceWorker.ready;
                }
            }
            
            console.log('✅ Service Worker bereit:', registration.scope);
            this.showVisualStatus('✅ Service Worker bereit');

            // 3. VAPID Key laden
            this.showVisualStatus('🔔 Schritt 3: VAPID Key laden...');
            console.log('🔔 Schritt 3: VAPID Key laden');
            const response = await fetch('/api/push/vapid-key');
            console.log('🔔 VAPID Response Status:', response.status);
            
            if (swDebugger) {
                swDebugger.log(`🔑 VAPID API aufgerufen: ${response.status}`);
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔔 VAPID Fehler Details:', errorText);
                if (swDebugger) {
                    swDebugger.log(`❌ VAPID Fehler: ${response.status} - ${errorText}`);
                }
                throw new Error(`VAPID Key Fehler: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('✅ VAPID Key geladen');
            this.showVisualStatus('✅ VAPID Key geladen');
            
            if (swDebugger) {
                swDebugger.log(`✅ VAPID Key erhalten: ${data.publicKey.substring(0, 20)}...`);
            }

            // 4. Subscription erstellen
            this.showVisualStatus('🔔 Schritt 4: Subscription erstellen...');
            console.log('🔔 Schritt 4: Push Subscription erstellen');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(data.publicKey)
            });
            console.log('✅ Subscription erstellt:', subscription.endpoint.substring(0, 50) + '...');
            this.showVisualStatus('✅ Subscription erstellt');
            
            if (swDebugger) {
                swDebugger.log(`✅ Push Subscription erstellt: ${subscription.endpoint.substring(0, 50)}...`);
            }

            // 5. Subscription speichern
            this.showVisualStatus('🔔 Schritt 5: An Server senden...');
            console.log('🔔 Schritt 5: Subscription an Server senden');
            const saveResponse = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });
            
            console.log('🔔 Save Response Status:', saveResponse.status);

            if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                console.error('🔔 Subscribe Fehler Details:', errorText);
                if (swDebugger) {
                    swDebugger.log(`❌ Subscribe Fehler: ${saveResponse.status} - ${errorText}`);
                }
                throw new Error(`Subscription Fehler: ${saveResponse.status} ${saveResponse.statusText} - ${errorText}`);
            }

            console.log('✅ Subscription erfolgreich gespeichert');
                this.showVisualStatus('✅ Erfolgreich gespeichert');
                
                // 6. Test-Notification senden
                console.log('🔔 Schritt 6: Test-Notification senden');
                this.showVisualStatus('🔔 Sende Test-Notification...');
                setTimeout(() => {
                    fetch('/api/push/test', { method: 'POST' })
                        .then(response => {
                            console.log('🧪 Test-Notification Response:', response.status);
                            this.showVisualStatus('🧪 Test-Notification gesendet');
                        })
                        .catch(error => {
                            console.warn('⚠️ Test-Notification Fehler:', error);
                            this.showVisualStatus('⚠️ Test-Notification Fehler');
                        });
                }, 2000);
                
                console.log('🎉 Push Notifications vollständig aktiviert!');
                this.showVisualStatus('🎉 Push Notifications aktiviert!');
                return true;
            } else {
                const errorText = await saveResponse.text();
                throw new Error(`Server Fehler: ${saveResponse.status} - ${errorText}`);
            }

        } catch (error) {
            console.error('❌ Push Notification Aktivierung fehlgeschlagen:', error);
            this.showVisualStatus(`❌ Fehler: ${error.message}`);
            
            // Detaillierte Fehlermeldung
            let errorMessage = 'Unbekannter Fehler';
            if (error.message.includes('VAPID')) {
                errorMessage = 'VAPID Key konnte nicht geladen werden';
            } else if (error.message.includes('Server')) {
                errorMessage = 'Server-Verbindungsfehler';
            } else if (error.message.includes('subscribe')) {
                errorMessage = 'Push-Subscription konnte nicht erstellt werden';
            } else {
                errorMessage = error.message;
            }
            
            alert(`❌ Fehler: ${errorMessage}`);
            return false;
        }
    }
    
    // Visual Status für iPhone Debug
    showVisualStatus(message) {
        // Suche nach iOS Debug Container
        const debugContainer = document.getElementById('ios-debug-info');
        if (debugContainer) {
            const statusLine = document.createElement('div');
            statusLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            statusLine.style.color = message.includes('❌') ? '#ff4444' : 
                                   message.includes('✅') ? '#44ff44' : '#00ff00';
            debugContainer.appendChild(statusLine);
            debugContainer.scrollTop = debugContainer.scrollHeight;
        }
        
        // Auch als kurzes Alert für wichtige Status
        if (message.includes('❌') || message.includes('🎉')) {
            setTimeout(() => {
                // Kurze Anzeige ohne Alert zu nervig zu machen
                console.log('📱 STATUS:', message);
            }, 100);
        }
    }

    dismissBanner() {
        // Banner als dismissed markieren
        try {
            const dismissData = {
                timestamp: new Date().toISOString(),
                dismissed: true
            };
            localStorage.setItem(this.storageKey, JSON.stringify(dismissData));
        } catch (error) {
            console.warn('⚠️ Fehler beim Speichern des Banner Status:', error);
        }
    }

    hideBanner(banner, successMessage = null) {
        // Success Message anzeigen falls gewünscht
        if (successMessage) {
            banner.className = 'alert alert-success alert-dismissible fade show position-fixed w-100';
            banner.innerHTML = `
                <div class="container-fluid">
                    <div class="text-center">
                        <i class="bi bi-check-circle fs-4 me-2"></i>
                        ${successMessage}
                    </div>
                </div>
            `;
            
            setTimeout(() => {
                this.removeBanner(banner);
            }, 3000);
        } else {
            this.removeBanner(banner);
        }
    }

    removeBanner(banner) {
        // Banner ausblenden
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-100%)';
        banner.style.transition = 'all 0.3s ease';

        setTimeout(() => {
            if (banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
            // Body Padding entfernen
            document.body.style.paddingTop = '';
        }, 300);
    }

    // Hilfsfunktion für VAPID Key
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Banner initialisieren wenn Seite geladen
document.addEventListener('DOMContentLoaded', () => {
    new PushNotificationBanner();
});
