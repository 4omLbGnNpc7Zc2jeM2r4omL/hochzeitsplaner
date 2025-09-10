// Einfacher Push Notification Debugger - direkt sichtbar
class SimplePushDebugger {
    constructor() {
        this.createDebugBanner();
    }

    createDebugBanner() {
        // Entferne alte Banner
        const oldBanner = document.getElementById('simple-push-debug');
        if (oldBanner) oldBanner.remove();

        // Erstelle Debug Banner (oben, immer sichtbar)
        const banner = document.createElement('div');
        banner.id = 'simple-push-debug';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #000;
            color: #0f0;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            z-index: 10000;
            max-height: 300px;
            overflow-y: auto;
            border-bottom: 2px solid #0f0;
        `;

        banner.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
                <button id="push-debug-test" style="background: #0066cc; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 2px;">🔔 Push Test</button>
                <button id="push-debug-clear" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 2px;">Clear</button>
                <button id="push-debug-close" style="background: #c00; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 2px;">Close</button>
            </div>
            <div id="push-debug-log" style="white-space: pre-wrap; word-break: break-all;"></div>
        `;

        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.paddingTop = banner.offsetHeight + 'px';

        // Event Listeners
        document.getElementById('push-debug-test').addEventListener('click', () => {
            this.testPushNotifications();
        });

        document.getElementById('push-debug-clear').addEventListener('click', () => {
            document.getElementById('push-debug-log').textContent = '';
        });

        document.getElementById('push-debug-close').addEventListener('click', () => {
            banner.remove();
            document.body.style.paddingTop = '0';
        });

        this.logContainer = document.getElementById('push-debug-log');
        this.log('🚀 Push Debug gestartet');
        this.log(`👤 User Role: ${window.userRole}`);
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(message);
        
        if (this.logContainer) {
            this.logContainer.textContent += logMessage;
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }

    async testPushNotifications() {
        this.log('🔔 === PUSH TEST START ===');
        
        try {
            // 1. Permission prüfen
            this.log(`🔔 Notification.permission: ${Notification.permission}`);
            
            if (Notification.permission === 'default') {
                this.log('🔔 Fordere Berechtigung an...');
                const permission = await Notification.requestPermission();
                this.log(`🔔 Berechtigung: ${permission}`);
                if (permission !== 'granted') {
                    throw new Error(`Berechtigung verweigert: ${permission}`);
                }
            } else if (Notification.permission === 'denied') {
                throw new Error('Benachrichtigungen blockiert');
            }

            // 2. Service Worker
            this.log('🔔 Service Worker prüfen...');
            let registration = await navigator.serviceWorker.getRegistration();
            
            if (!registration) {
                this.log('📝 Registriere Service Worker...');
                registration = await navigator.serviceWorker.register('/sw.js');
                this.log('✅ Service Worker registriert');
            } else {
                this.log('✅ Service Worker gefunden');
            }

            // 3. VAPID Key laden
            this.log('🔑 VAPID Key laden...');
            const response = await fetch('/api/push/vapid-key');
            
            if (!response.ok) {
                const errorText = await response.text();
                this.log(`❌ VAPID Fehler: ${response.status} - ${errorText}`);
                throw new Error(`VAPID Error: ${response.status}`);
            }
            
            const data = await response.json();
            this.log(`🔑 VAPID Key erhalten: ${data.publicKey.substring(0, 30)}...`);
            this.log(`🔑 Key Länge: ${data.publicKey.length} Zeichen`);

            // 4. Key konvertieren
            this.log('🔧 Key konvertieren...');
            const applicationServerKey = this.urlBase64ToUint8Array(data.publicKey);
            this.log(`🔧 Konvertiert zu ${applicationServerKey.length} Bytes`);
            this.log(`🔧 Erste 8 Bytes: [${Array.from(applicationServerKey.slice(0, 8)).join(', ')}]`);

            // 5. Subscription erstellen
            this.log('📧 Push Subscription erstellen...');
            
            try {
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });
                
                this.log('✅ Subscription erfolgreich!');
                this.log(`📧 Endpoint: ${subscription.endpoint.substring(0, 60)}...`);
                
            } catch (subError) {
                this.log(`❌ Subscription Fehler: ${subError.name}`);
                this.log(`❌ Details: ${subError.message}`);
                throw subError;
            }

        } catch (error) {
            this.log(`❌ Test fehlgeschlagen: ${error.message}`);
        }
        
        this.log('🔔 === PUSH TEST ENDE ===');
    }

    urlBase64ToUint8Array(base64String) {
        try {
            const cleanBase64 = base64String.trim().replace(/\s/g, '');
            this.log(`🔧 Bereinigte Key-Länge: ${cleanBase64.length}`);
            
            const padding = '='.repeat((4 - cleanBase64.length % 4) % 4);
            const paddedBase64 = cleanBase64 + padding;
            this.log(`🔧 Padding hinzugefügt: ${padding.length} Zeichen`);
            
            const base64 = paddedBase64.replace(/-/g, '+').replace(/_/g, '/');
            this.log('🔧 Base64URL -> Base64 konvertiert');
            
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            
            this.log(`🔧 Dekodiert: ${outputArray.length} Bytes`);
            
            if (outputArray.length === 64) {
                this.log('🔧 64-Byte Key, füge 0x04 Prefix hinzu...');
                const prefixedArray = new Uint8Array(65);
                prefixedArray[0] = 0x04;
                prefixedArray.set(outputArray, 1);
                this.log('✅ 0x04 Prefix hinzugefügt');
                return prefixedArray;
            } else if (outputArray.length === 65 && outputArray[0] === 0x04) {
                this.log('✅ Bereits korrekte P-256 uncompressed key');
                return outputArray;
            } else {
                this.log(`⚠️ Unerwartete Länge: ${outputArray.length} Bytes`);
                return outputArray;
            }
            
        } catch (error) {
            this.log(`❌ Konvertierung fehlgeschlagen: ${error.message}`);
            throw error;
        }
    }
}

// Auto-Start für Admins
document.addEventListener('DOMContentLoaded', () => {
    if (window.userRole === 'admin') {
        console.log('🚀 Starte Simple Push Debugger');
        window.simplePushDebugger = new SimplePushDebugger();
    }
});
