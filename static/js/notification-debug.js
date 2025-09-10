/**
 * Debug-Tool für Push-Notifications
 * Hilft bei der Diagnose von Permission-Problemen
 */

class NotificationDebugger {
    constructor() {
        this.consoleLog = [];
    }

    /**
     * Führt umfassende Diagnose durch
     */
    async diagnose() {
        const results = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            results: {}
        };

        // Browser-Support prüfen
        results.results.browserSupport = this.checkBrowserSupport();
        
        // Aktuelle Berechtigungen prüfen
        results.results.permissions = await this.checkPermissions();
        
        // Service Worker Status
        results.results.serviceWorker = await this.checkServiceWorker();
        
        // Push Manager verfügbar
        results.results.pushManager = this.checkPushManager();
        
        // Sicherheitskontext
        results.results.securityContext = this.checkSecurityContext();
        
        // DOM-Elemente
        results.results.domElements = this.checkDOMElements();

        this.logResults(results);
        return results;
    }

    checkBrowserSupport() {
        return {
            notifications: 'Notification' in window,
            serviceWorker: 'serviceWorker' in navigator,
            pushManager: 'PushManager' in window,
            permissions: 'permissions' in navigator
        };
    }

    async checkPermissions() {
        const permissions = {
            notification: Notification.permission
        };

        // Detaillierte Permission API prüfen
        if ('permissions' in navigator) {
            try {
                const pushPermission = await navigator.permissions.query({ name: 'push', userVisibleOnly: true });
                permissions.push = pushPermission.state;
            } catch (e) {
                permissions.push = 'error: ' + e.message;
            }

            try {
                const notificationPermission = await navigator.permissions.query({ name: 'notifications' });
                permissions.notificationAPI = notificationPermission.state;
            } catch (e) {
                permissions.notificationAPI = 'error: ' + e.message;
            }
        }

        return permissions;
    }

    async checkServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return { supported: false };
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            return {
                supported: true,
                scope: registration.scope,
                active: !!registration.active,
                installing: !!registration.installing,
                waiting: !!registration.waiting,
                updatefound: registration.updatefound
            };
        } catch (error) {
            return {
                supported: true,
                error: error.message
            };
        }
    }

    checkPushManager() {
        if (!('PushManager' in window)) {
            return { supported: false };
        }

        return {
            supported: true,
            supportedContentEncodings: PushManager.supportedContentEncodings || []
        };
    }

    checkSecurityContext() {
        return {
            isSecureContext: window.isSecureContext,
            protocol: location.protocol,
            hostname: location.hostname,
            port: location.port
        };
    }

    checkDOMElements() {
        const elements = {};
        
        // Push-Notification Button
        const pushButton = document.getElementById('pushNotificationBtn');
        if (pushButton) {
            elements.pushButton = {
                exists: true,
                visible: !pushButton.hidden && pushButton.style.display !== 'none',
                disabled: pushButton.disabled,
                text: pushButton.textContent.trim()
            };
        } else {
            elements.pushButton = { exists: false };
        }

        return elements;
    }

    /**
     * Testet Permission Request direkt
     */
    async testPermissionRequest() {
        console.log('🧪 Teste Permission Request...');
        
        try {
            const permission = await Notification.requestPermission();
            console.log('✅ Permission Result:', permission);
            return { success: true, permission };
        } catch (error) {
            console.error('❌ Permission Request Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Zeigt eine Test-Benachrichtigung
     */
    async showTestNotification() {
        if (Notification.permission !== 'granted') {
            console.warn('❌ Keine Berechtigung für Test-Benachrichtigung');
            return false;
        }

        try {
            const notification = new Notification('🧪 Test-Benachrichtigung', {
                body: 'Dies ist eine Test-Benachrichtigung vom Hochzeitsplaner',
                icon: '/static/icons/icon-192x192.png',
                badge: '/static/icons/icon-72x72.png',
                tag: 'test-notification',
                requireInteraction: false
            });

            setTimeout(() => notification.close(), 5000);
            console.log('✅ Test-Benachrichtigung gesendet');
            return true;
        } catch (error) {
            console.error('❌ Fehler bei Test-Benachrichtigung:', error);
            return false;
        }
    }

    logResults(results) {
        console.group('🔍 Push-Notification Diagnose');
        console.log('📱 User Agent:', results.userAgent);
        console.log('🌐 Browser Support:', results.results.browserSupport);
        console.log('🔐 Permissions:', results.results.permissions);
        console.log('⚙️ Service Worker:', results.results.serviceWorker);
        console.log('📡 Push Manager:', results.results.pushManager);
        console.log('🔒 Security Context:', results.results.securityContext);
        console.log('🎯 DOM Elements:', results.results.domElements);
        console.groupEnd();
    }

    /**
     * Erstellt Debug-Interface
     */
    createDebugInterface() {
        // Prüfe ob Interface bereits existiert
        if (document.getElementById('notification-debug')) {
            return;
        }

        const debugPanel = document.createElement('div');
        debugPanel.id = 'notification-debug';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
            max-height: 400px;
            overflow-y: auto;
        `;

        debugPanel.innerHTML = `
            <h4 style="margin: 0 0 10px 0;">🔍 Notification Debug</h4>
            <button onclick="notificationDebugger.diagnose()" style="margin: 2px;">Diagnose</button>
            <button onclick="notificationDebugger.testPermissionRequest()" style="margin: 2px;">Test Permission</button>
            <button onclick="notificationDebugger.showTestNotification()" style="margin: 2px;">Test Notification</button>
            <button onclick="document.getElementById('notification-debug').remove()" style="margin: 2px;">Close</button>
            <div id="debug-output" style="margin-top: 10px; font-size: 10px;"></div>
        `;

        document.body.appendChild(debugPanel);
    }
}

// Globale Instanz erstellen
window.notificationDebugger = new NotificationDebugger();

// Debug-Interface automatisch DEAKTIVIERT um Duplikate zu vermeiden
// Debugging jetzt nur noch über base.html Debug Button
console.log('🔧 Notification Debug Interface deaktiviert - verwende base.html Debug Button');
