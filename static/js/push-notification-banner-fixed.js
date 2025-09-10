// Push Notification Banner für iOS Safari - Korrigierte Version
class PushNotificationBanner {
    constructor() {
        this.storageKey = 'pushBannerDismissed';
    }

    init() {
        if (this.isAdmin() && !this.wasBannerDismissed() && this.needsBanner()) {
            this.showBanner();
        }
    }

    isAdmin() {
        // Mehrere Methoden um Admin-Status zu erkennen
        const isAdminByRole = window.userRole === 'admin';
        const isAdminByPath = window.location.pathname.includes('admin');
        const isAdminByContainer = document.querySelector('.admin-container') !== null;
        
        return isAdminByRole || isAdminByPath || isAdminByContainer;
    }

    wasBannerDismissed() {
        try {
            const dismissed = localStorage.getItem(this.storageKey);
            if (dismissed) {
                const dismissedData = JSON.parse(dismissed);
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

    needsBanner() {
        // Prüfe Browser Support
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;

        if (!hasServiceWorker || !hasPushManager || !hasNotification) {
            return false;
        }

        // Prüfe Permission Status
        if (Notification.permission === 'granted') {
            return false; // Banner nicht nötig wenn bereits erlaubt
        }

        return true;
    }

    showBanner() {
        const banner = document.createElement('div');
        banner.id = 'push-notification-banner';
        banner.className = 'alert alert-info alert-dismissible fade show';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9000;
            margin: 0;
            border-radius: 0;
            border: none;
            background: linear-gradient(135deg, #007bff, #0056b3);
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
                        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="alert">
                            <i class="bi bi-x"></i>
                            <span class="d-none d-sm-inline">Später</span>
                        </button>
                    </div>
                </div>
                <div class="row mt-2" id="push-status-row" style="display: none;">
                    <div class="col">
                        <div id="push-status" class="small"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.paddingTop = banner.offsetHeight + 'px';

        this.setupBannerEvents(banner);
    }

    setupBannerEvents(banner) {
        const enableBtn = banner.querySelector('#enablePushBtn');
        const closeBtn = banner.querySelector('[data-bs-dismiss="alert"]');

        if (enableBtn) {
            enableBtn.addEventListener('click', async () => {
                const originalContent = enableBtn.innerHTML;
                enableBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Aktiviere...';
                enableBtn.disabled = true;

                try {
                    await this.enablePushNotifications();
                    this.hideBanner(banner, '✅ Push Notifications aktiviert!');
                } catch (error) {
                    console.error('Push Notification Fehler:', error);
                    this.showStatus(`❌ Fehler: ${error.message}`, 'danger');
                    
                    // Button zurücksetzen
                    enableBtn.innerHTML = originalContent;
                    enableBtn.disabled = false;
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.dismissBanner();
                this.hideBanner(banner);
            });
        }
    }

    async enablePushNotifications() {
        try {
            // Schritt 1: Permission anfragen
            this.showStatus('🔔 Schritt 1: Berechtigung anfragen...', 'info');
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    throw new Error(`Berechtigung nicht erteilt: ${permission}`);
                }
            } else if (Notification.permission === 'denied') {
                throw new Error('Benachrichtigungen wurden blockiert. Bitte in Browser-Einstellungen aktivieren.');
            }

            // Schritt 2: Service Worker vorbereiten und aktivieren
            this.showStatus('🔧 Schritt 2: Service Worker vorbereiten...', 'info');
            
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                this.showStatus('📝 Service Worker registrieren...', 'info');
                registration = await navigator.serviceWorker.register('/sw.js');
            }

            // Einfache Ready-Wartung für iOS Safari
            this.showStatus('⏳ Service Worker bereit machen...', 'info');
            await navigator.serviceWorker.ready;
            
            // iOS: Kurze Wartezeit
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Finale Registration holen
            registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                throw new Error('Service Worker Registration fehlgeschlagen');
            }

            this.showStatus('✅ Service Worker bereit', 'info');

            // Schritt 3: VAPID Key laden
            this.showStatus('🔑 Schritt 3: VAPID Schlüssel laden...', 'info');
            const vapidResponse = await fetch('/api/push/vapid-key');
            
            if (!vapidResponse.ok) {
                const errorText = await vapidResponse.text();
                throw new Error(`VAPID Key Fehler: ${vapidResponse.status} - ${errorText}`);
            }
            
            const vapidData = await vapidResponse.json();
            if (!vapidData.publicKey) {
                throw new Error('VAPID Public Key nicht verfügbar');
            }

            // Schritt 4: Push Subscription erstellen
            this.showStatus('📧 Schritt 4: Push Subscription erstellen...', 'info');
            
            const applicationServerKey = this.urlBase64ToUint8Array(vapidData.publicKey);
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            // Schritt 5: Subscription an Server senden
            this.showStatus('📤 Schritt 5: An Server senden...', 'info');
            
            // Debug: Zeige Subscription-Struktur
            console.log('📧 Subscription Object:', subscription);
            console.log('📧 Subscription JSON:', subscription.toJSON());
            
            const subscriptionJson = subscription.toJSON();
            console.log('📧 Sending to server:', JSON.stringify(subscriptionJson, null, 2));
            
            const saveResponse = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscriptionJson })
            });

            if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                throw new Error(`Subscription Fehler: ${saveResponse.status} - ${errorText}`);
            }

            // Schritt 6: Test-Benachrichtigung
            this.showStatus('🧪 Schritt 6: Test-Benachrichtigung...', 'info');
            setTimeout(async () => {
                try {
                    const testResponse = await fetch('/api/push/test', { method: 'POST' });
                    if (testResponse.ok) {
                        this.showStatus('✅ Test-Benachrichtigung gesendet!', 'success');
                    }
                } catch (testError) {
                    console.warn('Test-Notification Fehler:', testError);
                }
            }, 1000);

            this.showStatus('🎉 Push Notifications erfolgreich aktiviert!', 'success');
            return true;

        } catch (error) {
            console.error('Push Notification Aktivierung fehlgeschlagen:', error);
            throw error; // Fehler an setupBannerEvents weiterleiten
        }
    }

    showStatus(message, type = 'info') {
        const statusRow = document.getElementById('push-status-row');
        const statusDiv = document.getElementById('push-status');
        
        if (statusRow && statusDiv) {
            statusRow.style.display = 'block';
            statusDiv.textContent = message;
            statusDiv.className = `small text-${type === 'danger' ? 'warning' : type === 'success' ? 'success' : 'light'}`;
        }
        
        console.log(`📱 ${message}`);
    }

    dismissBanner() {
        const dismissedData = {
            timestamp: new Date().toISOString(),
            dismissed: true
        };
        localStorage.setItem(this.storageKey, JSON.stringify(dismissedData));
    }

    hideBanner(banner, successMessage = null) {
        if (successMessage) {
            this.showStatus(successMessage, 'success');
            setTimeout(() => this.removeBanner(banner), 3000);
        } else {
            this.removeBanner(banner);
        }
    }

    removeBanner(banner) {
        if (banner && banner.parentNode) {
            banner.style.transition = 'opacity 0.3s ease-out';
            banner.style.opacity = '0';
            
            setTimeout(() => {
                banner.remove();
                document.body.style.paddingTop = '0';
            }, 300);
        }
    }

    urlBase64ToUint8Array(base64String) {
        try {
            // Bereinige und formatiere den Key
            const cleanBase64 = base64String.trim().replace(/\s/g, '');
            const padding = '='.repeat((4 - cleanBase64.length % 4) % 4);
            const paddedBase64 = cleanBase64 + padding;
            const base64 = paddedBase64.replace(/-/g, '+').replace(/_/g, '/');
            
            // Dekodiere zu Uint8Array
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            
            // P-256 Format validieren und korrigieren
            if (outputArray.length === 64) {
                // 64-Byte Key: 0x04 Prefix hinzufügen für uncompressed format
                const prefixedArray = new Uint8Array(65);
                prefixedArray[0] = 0x04;
                prefixedArray.set(outputArray, 1);
                return prefixedArray;
            } else if (outputArray.length === 65 && outputArray[0] === 0x04) {
                // Bereits korrekte uncompressed P-256 key
                return outputArray;
            } else {
                // Andere Länge: unverändert zurückgeben
                return outputArray;
            }
            
        } catch (error) {
            throw new Error(`VAPID Key Konvertierung fehlgeschlagen: ${error.message}`);
        }
    }
}

// Auto-Start
document.addEventListener('DOMContentLoaded', () => {
    if (window.userRole === 'admin') {
        const banner = new PushNotificationBanner();
        banner.init();
    }
});
