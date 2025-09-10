/**
 * Direkter Push Notification Button für sofortige Permission-Anfrage
 */

class DirectPushButton {
    constructor() {
        this.init();
    }

    init() {
        // Erstelle einen direkten Push Button
        this.createDirectButton();
    }

    createDirectButton() {
        // Suche nach einem geeigneten Container
        const container = document.querySelector('.navbar-nav') || 
                         document.querySelector('nav') || 
                         document.body;

        if (!container) {
            console.error('❌ Kein Container für direkten Push Button gefunden');
            return;
        }

        // Erstelle direkten Push Button
        const directBtn = document.createElement('button');
        directBtn.id = 'directPushBtn';
        directBtn.className = 'btn btn-success btn-sm me-2';
        directBtn.innerHTML = `
            <i class="bi bi-bell"></i> 
            <span class="d-none d-sm-inline">Push aktivieren</span>
            <span class="d-sm-none">Push</span>
        `;
        directBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: #28a745;
            border: none;
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
        `;

        // Event Handler für direkte Permission-Anfrage
        directBtn.addEventListener('click', async () => {
            console.log('🔔 Direkter Push Button geklickt!');
            await this.requestPushPermission();
        });

        // Button hinzufügen
        document.body.appendChild(directBtn);
        console.log('✅ Direkter Push Button erstellt');
    }

    async requestPushPermission() {
        try {
            console.log('🔔 Starte direkte Push Permission Anfrage...');

            // 1. Prüfe Browser Support
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                alert('❌ Ihr Browser unterstützt keine Push Notifications');
                return;
            }

            // 2. Prüfe aktuelle Permission
            console.log(`🔔 Aktuelle Permission: ${Notification.permission}`);

            if (Notification.permission === 'denied') {
                alert('❌ Push Notifications wurden blockiert. Bitte in den Browser-Einstellungen aktivieren.');
                return;
            }

            // 3. Fordere Permission an falls nötig
            if (Notification.permission === 'default') {
                console.log('🔔 Fordere Push Permission an...');
                
                const permission = await Notification.requestPermission();
                console.log(`🔔 Permission Ergebnis: ${permission}`);

                if (permission !== 'granted') {
                    alert('❌ Push Notifications wurden nicht erlaubt');
                    return;
                }
            }

            // 4. Service Worker registrieren
            console.log('🔧 Registriere Service Worker...');
            const registration = await navigator.serviceWorker.register('/static/sw.js');
            await navigator.serviceWorker.ready;
            console.log('✅ Service Worker bereit');

            // 5. VAPID Key laden
            console.log('🔑 Lade VAPID Public Key...');
            const response = await fetch('/api/push/vapid-key');
            if (!response.ok) {
                throw new Error(`VAPID Key fehler: ${response.status}`);
            }
            const data = await response.json();
            const vapidKey = data.publicKey;

            // 6. Push Subscription erstellen
            console.log('📬 Erstelle Push Subscription...');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
            });

            // 7. Subscription an Server senden
            console.log('💾 Sende Subscription an Server...');
            const saveResponse = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON()
                })
            });

            if (saveResponse.ok) {
                console.log('✅ Push Notifications erfolgreich aktiviert!');
                alert('🎉 Push Notifications wurden erfolgreich aktiviert!');
                
                // Button aktualisieren
                const btn = document.getElementById('directPushBtn');
                if (btn) {
                    btn.innerHTML = '<i class="bi bi-bell-fill"></i> Push aktiv';
                    btn.className = 'btn btn-success btn-sm me-2';
                    btn.disabled = true;
                }

                // Test-Notification senden
                setTimeout(() => {
                    this.sendTestNotification();
                }, 2000);

            } else {
                throw new Error(`Server Fehler: ${saveResponse.status}`);
            }

        } catch (error) {
            console.error('❌ Push Notification Aktivierung fehlgeschlagen:', error);
            alert(`❌ Fehler bei Push Notification Aktivierung: ${error.message}`);
        }
    }

    async sendTestNotification() {
        try {
            console.log('🧪 Sende Test-Notification...');
            const response = await fetch('/api/push/test', {
                method: 'POST'
            });

            if (response.ok) {
                console.log('✅ Test-Notification gesendet');
            } else {
                console.warn('⚠️ Test-Notification konnte nicht gesendet werden');
            }
        } catch (error) {
            console.warn('⚠️ Test-Notification Fehler:', error.message);
        }
    }

    // Hilfsfunktion für VAPID Key Konvertierung
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Direkten Push Button initialisieren
document.addEventListener('DOMContentLoaded', () => {
    // Nur für Admins
    if (document.body.dataset.userRole === 'admin' || window.location.pathname.includes('admin')) {
        new DirectPushButton();
    }
});
