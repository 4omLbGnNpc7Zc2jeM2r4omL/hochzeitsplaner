/**
 * Push Notification Manager für Hochzeitsplaner
 * Verwaltet Web Push Notifications für Admin-Benachrichtigungen
 */

class PushNotificationManager {
    constructor() {
        this.isSupported = false;
        this.isSubscribed = false;
        this.isReady = false;
        this.registration = null;
        this.subscription = null;
        this.vapidPublicKey = null;
        this.storageKey = 'hochzeitsplaner_push_status';
        
        this.init();
    }
    
    async init() {
        // **AUSFÜHRLICHES iOS DEBUGGING**
        console.log('🔧 Push Notification Manager wird initialisiert...');
        console.log('🔧 User Agent:', navigator.userAgent);
        console.log('🔧 Service Worker Support:', 'serviceWorker' in navigator);
        console.log('🔧 Push Manager Support:', 'PushManager' in window);
        console.log('🔧 Notification Support:', 'Notification' in window);
        console.log('🔧 Location:', window.location.href);
        console.log('🔧 Protocol:', window.location.protocol);
        
        // iOS Detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        console.log('🔧 iOS Device:', isIOS);
        
        if (isIOS) {
            // iOS Version erkennen
            const iOSVersion = navigator.userAgent.match(/OS (\d+)_(\d+)/);
            if (iOSVersion) {
                const majorVersion = parseInt(iOSVersion[1]);
                const minorVersion = parseInt(iOSVersion[2]);
                console.log(`🍎 iOS Version: ${majorVersion}.${minorVersion}`);
                
                if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
                    console.error('❌ iOS Version zu alt für Web Push! Benötigt iOS 16.4+');
                    alert('⚠️ Web Push Notifications benötigen iOS 16.4 oder höher');
                    return;
                }
            }
            
            // Safari spezifische Checks
            const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
            console.log('🔧 Safari Browser:', isSafari);
            
            if (!isSafari) {
                console.warn('⚠️ Nicht Safari - Push könnte nicht funktionieren');
            }
        }
        
        // Prüfe Browser-Support - für Safari iOS weniger strikt
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;
        
        console.log('🔧 Feature Detection Details:');
        console.log('  - Service Worker:', hasServiceWorker);
        console.log('  - PushManager:', hasPushManager);
        console.log('  - Notification:', hasNotification);
        
        // Safari iOS spezielle Behandlung
        if (isIOS) {
            console.log('🍎 iOS Safari - verwende angepasste Feature Detection');
            
            // Für iOS Safari: prüfe nur Service Worker
            if (!hasServiceWorker) {
                console.error('❌ Service Worker nicht verfügbar in iOS Safari');
                alert('❌ Service Worker nicht verfügbar. Stellen Sie sicher, dass Sie Safari verwenden.');
                return;
            }
            
            // PushManager könnte erst nach Service Worker Registration verfügbar sein
            console.log('🍎 iOS Safari - Feature Detection erfolgreich');
            
        } else {
            // Für andere Browser: vollständige Prüfung
            if (!hasServiceWorker || !hasPushManager) {
                console.warn('❌ Push Notifications werden nicht unterstützt');
                alert('❌ Ihr Browser unterstützt keine Push Notifications');
                return;
            }
        }
        
        this.isSupported = true;
        
        try {
            // Service Worker registrieren
            this.registration = await navigator.serviceWorker.ready;
            console.log('✅ Service Worker bereit für Push Notifications');
            
            // Für iOS Safari: PushManager Verfügbarkeit nach SW Registration prüfen
            if (isIOS) {
                console.log('🍎 iOS Safari - prüfe PushManager nach SW Registration');
                
                if (!this.registration.pushManager) {
                    console.error('❌ PushManager nicht verfügbar nach Service Worker Registration');
                    alert('❌ Push Notifications sind in diesem Safari nicht verfügbar');
                    return;
                }
                
                console.log('✅ iOS Safari - PushManager verfügbar');
            }
            
            // Gespeicherten Status laden
            this.loadStoredStatus();
            
            // Aktuelle Subscription prüfen
            this.subscription = await this.registration.pushManager.getSubscription();
            
            // Status abgleichen
            if (this.subscription && !this.isSubscribed) {
                this.isSubscribed = true;
                this.saveStatus();
            } else if (!this.subscription && this.isSubscribed) {
                this.isSubscribed = false;
                this.saveStatus();
            }
            
            // VAPID Public Key laden
            await this.loadVapidKey();
            
            // UI aktualisieren
            this.updateUI();
            
            // Initialisierung abgeschlossen
            this.isReady = true;
            console.log('✅ Push Notification Manager erfolgreich initialisiert');
            
        } catch (error) {
            console.error('❌ Fehler beim Initialisieren der Push Notifications:', error);
            
            // Spezifische Fehlerbehandlung für iOS
            if (isIOS) {
                console.error('🍎 iOS Safari Fehler Details:', error.message);
                alert(`🍎 iOS Safari Push Notification Fehler: ${error.message}`);
            }
            
            this.isReady = true; // Auch bei Fehlern als bereit markieren
        }
    }
    
    /**
     * Lädt gespeicherten Push-Status aus localStorage
     */
    loadStoredStatus() {
        try {
            const storedStatus = localStorage.getItem(this.storageKey);
            if (storedStatus) {
                const status = JSON.parse(storedStatus);
                this.isSubscribed = status.isSubscribed || false;
                console.log('📱 Push-Status wiederhergestellt:', this.isSubscribed ? 'aktiviert' : 'deaktiviert');
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden des gespeicherten Push-Status:', error);
            this.clearStoredStatus();
        }
    }
    
    /**
     * Speichert Push-Status in localStorage
     */
    saveStatus() {
        try {
            const status = {
                isSubscribed: this.isSubscribed,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(status));
            console.log('💾 Push-Status gespeichert:', this.isSubscribed ? 'aktiviert' : 'deaktiviert');
        } catch (error) {
            console.warn('⚠️ Fehler beim Speichern des Push-Status:', error);
        }
    }
    
    /**
     * Löscht gespeicherten Status
     */
    clearStoredStatus() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('🗑️ Push-Status gelöscht');
        } catch (error) {
            console.warn('⚠️ Fehler beim Löschen des gespeicherten Status:', error);
        }
    }
    
    async loadVapidKey() {
        try {
            console.log('🔧 Lade VAPID Key von Server...');
            const response = await fetch('/api/push/vapid-key');
            console.log('🔧 VAPID Key Response Status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                this.vapidPublicKey = data.publicKey;
                console.log('✅ VAPID Public Key geladen');
                console.log('🔧 Key Length:', data.publicKey.length);
                console.log('🔧 Key Sample:', data.publicKey.substring(0, 30) + '...');
                
                // Test VAPID Key Format
                try {
                    const testArray = this.urlBase64ToUint8Array(this.vapidPublicKey);
                    console.log('✅ VAPID Key Format-Test erfolgreich, Array Length:', testArray.length);
                    
                    // Chrome erwartet 65 Bytes für P-256 ECDSA Keys
                    if (testArray.length !== 65) {
                        console.warn('⚠️ VAPID Key ungewöhnliche Länge:', testArray.length, '(erwartet: 65)');
                    }
                } catch (error) {
                    console.error('❌ VAPID Key Format-Test fehlgeschlagen:', error);
                }
                
            } else {
                console.error('❌ VAPID Public Key konnte nicht geladen werden, Status:', response.status);
                const errorText = await response.text();
                console.error('❌ Error Response:', errorText);
            }
        } catch (error) {
            console.error('❌ Fehler beim Laden des VAPID Public Keys:', error);
        }
    }
    
    async subscribe() {
        if (!this.isSupported || !this.vapidPublicKey) {
            console.error('Push Notifications nicht verfügbar oder VAPID Key fehlt');
            this.showNotification('❌ Push-Benachrichtigungen werden nicht unterstützt', 'error');
            return false;
        }

        try {
            // **BROWSER DETECTION**
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
            const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
            
            console.log('🔧 Browser Detection:');
            console.log('  - iOS:', isIOS);
            console.log('  - Chrome:', isChrome);
            console.log('  - Secure Context:', isSecure);
            console.log('  - User Activation:', navigator.userActivation ? navigator.userActivation.hasBeenActive : 'undefined');
            
            // **CHROME SPECIFIC CHECKS**
            if (isChrome) {
                console.log('🔧 Chrome erkannt - führe spezifische Checks durch...');
                
                if (!isSecure) {
                    console.error('❌ Chrome benötigt HTTPS für Push Notifications!');
                    this.showNotification('❌ Push-Benachrichtigungen benötigen HTTPS in Chrome', 'error');
                    return false;
                }
                
                // User Activation Check für Chrome
                if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
                    console.warn('⚠️ Chrome: Keine User Activation erkannt');
                }
                
                // Check if site is in PWA mode
                const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                console.log('🔧 Chrome PWA Mode:', isPWA);
            }
            
            // **iOS SPECIFIC CHECKS**
            if (isIOS) {
                console.log('🍎 iOS Safari erkannt');
                console.log('🔒 Secure Context (HTTPS):', isSecure);
                console.log('🌐 Location:', location.href);
                
                if (!isSecure) {
                    console.error('❌ iOS Safari benötigt HTTPS für Push Notifications!');
                    this.showNotification('❌ Push-Benachrichtigungen benötigen HTTPS auf iOS Safari', 'error');
                    return false;
                }
            }
            
            // Prüfe aktuelle Berechtigung
            let permission = Notification.permission;
            console.log('🔔 Aktuelle Notification Permission:', permission);
            
            if (permission === 'denied') {
                console.warn('❌ Push Notification Berechtigung wurde verweigert');
                if (isChrome) {
                    this.showNotification('❌ Push-Benachrichtigungen wurden blockiert. Klicken Sie auf das 🔒-Symbol in der Adressleiste und aktivieren Sie Benachrichtigungen.', 'error');
                } else {
                    this.showNotification('❌ Push-Benachrichtigungen wurden blockiert. Bitte in den Browser-Einstellungen aktivieren.', 'error');
                }
                return false;
            }
            
            // Berechtigung anfordern wenn noch nicht gesetzt
            if (permission === 'default') {
                console.log('🔔 Frage nach Push-Notification Berechtigung...');
                
                // **CHROME SPEZIFISCHE BEHANDLUNG**
                if (isChrome) {
                    console.log('🔧 Chrome: Versuche Notification.requestPermission()...');
                    
                    // User Activation für Chrome prüfen
                    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
                        console.error('❌ Chrome: Keine User Activation - Permission Request wird fehlschlagen');
                        this.showNotification('❌ Bitte klicken Sie direkt auf den Button, um Push-Benachrichtigungen zu aktivieren', 'warning');
                        return false;
                    }
                }
                
                // **iOS SPEZIFISCHE BEHANDLUNG**
                if (isIOS) {
                    console.log('🍎 iOS: Versuche Notification.requestPermission()...');
                    // iOS benötigt manchmal user gesture context
                    if (!navigator.userActivation || !navigator.userActivation.hasBeenActive) {
                        console.warn('⚠️ iOS: Keine User Activation - könnte fehlschlagen');
                    }
                }
                
                permission = await Notification.requestPermission();
                console.log('🔔 Permission Ergebnis:', permission);
                
                if (isChrome && permission !== 'granted') {
                    console.error('❌ Chrome: Permission nicht erhalten');
                    this.showNotification('❌ Chrome: Permission wurde verweigert. Versuchen Sie es erneut oder prüfen Sie die Browser-Einstellungen.', 'error');
                    return false;
                }
                
                if (isIOS) {
                    console.log('🍎 iOS Permission Ergebnis:', permission);
                    if (permission !== 'granted') {
                        console.error('❌ iOS Safari: Permission nicht erhalten');
                        this.showNotification('❌ Push-Benachrichtigungen wurden nicht erlaubt auf iOS', 'error');
                        return false;
                    }
                }
            }
            
            if (permission !== 'granted') {
                console.warn('❌ Push Notification Berechtigung verweigert:', permission);
                this.showNotification('❌ Push-Benachrichtigungen wurden nicht erlaubt', 'warning');
                return false;
            }
            
            console.log('✅ Push-Notification Berechtigung erhalten, erstelle Subscription...');
            
            // **SUBSCRIPTION DEBUGGING**
            console.log('🔧 VAPID Public Key:', this.vapidPublicKey ? `Vorhanden (${this.vapidPublicKey.substring(0, 20)}...)` : 'FEHLT');
            console.log('🔧 Registration:', this.registration ? 'OK' : 'FEHLT');
            console.log('🔧 PushManager:', this.registration?.pushManager ? 'OK' : 'FEHLT');
            
            // Subscription erstellen
            console.log('🔧 Versuche pushManager.subscribe...');
            
            // **VAPID KEY VALIDATION FÜR CHROME**
            let applicationServerKey;
            try {
                applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
                console.log('✅ VAPID Key erfolgreich konvertiert:', applicationServerKey.length, 'bytes');
            } catch (error) {
                console.error('❌ VAPID Key Konvertierung fehlgeschlagen:', error);
                this.showNotification('❌ VAPID Key Format-Fehler', 'error');
                return false;
            }
            
            const subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            
            console.log('✅ Subscription erstellt:', subscription);
            console.log('🔧 Subscription Details:', {
                endpoint: subscription.endpoint,
                keys: subscription.toJSON().keys
            });
            
            // **SERVER REQUEST DEBUGGING**
            console.log('🔧 Sende Subscription an Server...');
            const subscriptionData = subscription.toJSON();
            console.log('🔧 Request Data:', subscriptionData);
            
            // Subscription an Server senden
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(subscriptionData)
            });
            
            console.log('🔧 Server Response Status:', response.status);
            console.log('🔧 Server Response OK:', response.ok);
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('✅ Server Response:', responseData);
                
                this.subscription = subscription;
                this.isSubscribed = true;
                this.saveStatus(); // Status speichern
                this.updateUI();
                
                // Success-Benachrichtigung
                this.showNotification('✅ Push-Benachrichtigungen aktiviert', 'success');
                console.log('Push Notifications erfolgreich aktiviert');
                return true;
            } else {
                const error = await response.json();
                console.error('Fehler beim Speichern der Subscription:', error);
                this.showNotification('❌ Fehler beim Aktivieren der Push-Benachrichtigungen', 'error');
                return false;
            }
            
        } catch (error) {
            console.error('Fehler beim Abonnieren der Push Notifications:', error);
            this.showNotification('❌ Fehler beim Aktivieren der Push-Benachrichtigungen: ' + error.message, 'error');
            return false;
        }
    }
    
    async unsubscribe() {
        if (!this.subscription) {
            return true;
        }
        
        try {
            await this.subscription.unsubscribe();
            this.subscription = null;
            this.isSubscribed = false;
            this.saveStatus(); // Status speichern
            this.updateUI();
            
            this.showNotification('✅ Push-Benachrichtigungen deaktiviert', 'success');
            console.log('Push Notifications deaktiviert');
            return true;
            
        } catch (error) {
            console.error('Fehler beim Deaktivieren der Push Notifications:', error);
            this.showNotification('❌ Fehler beim Deaktivieren der Push-Benachrichtigungen', 'error');
            return false;
        }
    }
    
    /**
     * Toggle-Funktion für Push Notifications
     * Wird von einstellungen.html erwartet
     */
    async toggleSubscription() {
        console.log('🔔 toggleSubscription aufgerufen, aktueller Status:', this.isSubscribed);
        console.log('🔧 Manager bereit:', this.isReady);
        console.log('🔧 Unterstützt:', this.isSupported);
        console.log('🔧 VAPID Key vorhanden:', !!this.vapidPublicKey);
        
        // Warten bis Manager bereit ist
        if (!this.isReady) {
            console.log('⏳ Warte auf Manager-Initialisierung...');
            let attempts = 0;
            const maxAttempts = 50; // 5 Sekunden Maximum
            
            while (!this.isReady && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!this.isReady) {
                console.error('❌ Manager-Initialisierung Timeout');
                this.showNotification('❌ Push Notification System nicht bereit', 'error');
                return false;
            }
        }
        
        try {
            if (this.isSubscribed) {
                console.log('🔕 Deaktiviere Push Notifications...');
                const success = await this.unsubscribe();
                if (success) {
                    console.log('✅ Push Notifications erfolgreich deaktiviert');
                    return true;
                }
            } else {
                console.log('🔔 Aktiviere Push Notifications...');
                const success = await this.subscribe();
                if (success) {
                    console.log('✅ Push Notifications erfolgreich aktiviert');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('❌ Fehler beim Toggle der Push Notifications:', error);
            this.showNotification('❌ Fehler beim Ändern der Push-Benachrichtigungen: ' + error.message, 'error');
            return false;
        }
    }
    
    async sendTestNotification() {
        try {
            const response = await fetch('/api/push/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                this.showNotification('✅ Test-Benachrichtigung gesendet', 'success');
            } else {
                const error = await response.json();
                console.error('Fehler beim Senden der Test-Notification:', error);
                this.showNotification('❌ Test-Benachrichtigung fehlgeschlagen', 'error');
            }
            
        } catch (error) {
            console.error('Fehler beim Senden der Test-Notification:', error);
            this.showNotification('❌ Test-Benachrichtigung fehlgeschlagen', 'error');
        }
    }
    
    updateUI() {
        // Benachrichtigungs-Button Status
        const notificationBtn = document.getElementById('pushNotificationBtn');
        const notificationStatus = document.getElementById('pushNotificationStatus');
        const testBtn = document.getElementById('testPushBtn');
        
        if (notificationBtn) {
            if (!this.isSupported) {
                notificationBtn.textContent = 'Nicht unterstützt';
                notificationBtn.disabled = true;
                notificationBtn.className = 'btn btn-secondary btn-sm';
            } else if (this.isSubscribed) {
                notificationBtn.textContent = '🔔 Benachrichtigungen aktiv';
                notificationBtn.className = 'btn btn-success btn-sm';
                notificationBtn.onclick = () => this.unsubscribe();
            } else {
                notificationBtn.textContent = '🔕 Benachrichtigungen aktivieren';
                notificationBtn.className = 'btn btn-outline-primary btn-sm';
                notificationBtn.onclick = () => this.subscribe();
            }
        }
        
        if (notificationStatus) {
            if (this.isSubscribed) {
                notificationStatus.innerHTML = '<i class="bi bi-check-circle text-success"></i> Push-Benachrichtigungen aktiv';
            } else {
                notificationStatus.innerHTML = '<i class="bi bi-x-circle text-muted"></i> Push-Benachrichtigungen inaktiv';
            }
        }
        
        if (testBtn) {
            testBtn.style.display = this.isSubscribed ? 'inline-block' : 'none';
            testBtn.onclick = () => this.sendTestNotification();
        }
    }
    
    showNotification(message, type = 'info') {
        // Verwende das bestehende Notification-System falls verfügbar
        if (typeof showDashboardToast === 'function') {
            showDashboardToast(message, type);
        } else if (typeof notificationSystem !== 'undefined') {
            notificationSystem.show(message, type);
        } else {
            // Fallback: einfaches Alert
            alert(message);
        }
    }
    
    // Hilfsfunktion: VAPID Key von Base64 zu Uint8Array konvertieren
    urlBase64ToUint8Array(base64String) {
        try {
            // Debugging für Chrome
            console.log('🔧 VAPID Key Konvertierung - Input:', base64String.substring(0, 20) + '...');
            
            // URL-safe Base64 padding hinzufügen
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding)
                .replace(/-/g, '+')  // Korrigiert: \\ entfernt
                .replace(/_/g, '/');
            
            console.log('🔧 Nach Padding/Replace:', base64.substring(0, 20) + '...');
            
            const rawData = window.atob(base64);
            console.log('🔧 Raw Data Length:', rawData.length);
            
            const outputArray = new Uint8Array(rawData.length);
            
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            
            console.log('🔧 Output Array Length:', outputArray.length);
            console.log('🔧 Output Array Sample:', Array.from(outputArray.slice(0, 10)));
            
            return outputArray;
        } catch (error) {
            console.error('❌ VAPID Key Konvertierung fehlgeschlagen:', error);
            console.error('❌ Input war:', base64String);
            throw error;
        }
    }
}

// Global verfügbar machen
window.PushNotificationManager = PushNotificationManager;

// Auto-Initialisierung für Admin-Bereich
document.addEventListener('DOMContentLoaded', function() {
    // Nur im Admin-Bereich initialisieren (erkennbar an bestimmten Elementen)
    if (document.querySelector('.admin-dashboard') || 
        document.querySelector('#pushNotificationBtn') ||
        document.body.classList.contains('admin-area')) {
        
        window.pushNotificationManager = new PushNotificationManager();
        console.log('🔔 Push Notification Manager initialisiert');
        
        // **BUTTON EVENT HANDLER HINZUFÜGEN**
        const pushBtn = document.getElementById('pushNotificationBtn');
        if (pushBtn) {
            console.log('🔧 Push Button gefunden - Event Handler wird hinzugefügt');
            
            pushBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                console.log('🔔 Push Notification Button geklickt!');
                
                try {
                    // **SOFORTIGE VERFÜGBARKEITS-PRÜFUNG**
                    if (!window.pushNotificationManager) {
                        console.error('❌ Push Manager nicht verfügbar');
                        alert('❌ Push Notification Manager nicht geladen');
                        return;
                    }
                    
                    // **iOS SPEZIELLE BEHANDLUNG MIT ALERT**
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    if (isIOS) {
                        console.log('🍎 iOS erkannt - starte Push Aktivierung...');
                        
                        // iOS Version Check
                        const userAgent = navigator.userAgent;
                        const match = userAgent.match(/OS (\d+)_(\d+)/);
                        if (match) {
                            const majorVersion = parseInt(match[1]);
                            const minorVersion = parseInt(match[2]);
                            console.log(`🍎 iOS Version: ${majorVersion}.${minorVersion}`);
                            
                            if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
                                alert(`❌ iOS ${majorVersion}.${minorVersion} unterstützt keine Web Push Notifications.\n\nBenötigt: iOS 16.4 oder höher`);
                                return;
                            }
                        }
                        
                        // HTTPS Check
                        if (location.protocol !== 'https:') {
                            alert('❌ Push Notifications benötigen HTTPS.\n\nVerwenden Sie: https://192.168.178.40:8443');
                            return;
                        }
                        
                        console.log('🍎 iOS Checks bestanden - versuche Push Aktivierung...');
                    }
                    
                    // Push aktivieren
                    const success = await window.pushNotificationManager.subscribe();
                    
                    if (success) {
                        console.log('✅ Push Notifications erfolgreich aktiviert');
                        alert('✅ Push-Benachrichtigungen aktiviert!');
                    } else {
                        console.error('❌ Push Aktivierung fehlgeschlagen');
                        alert('❌ Push-Benachrichtigungen konnten nicht aktiviert werden');
                    }
                    
                } catch (error) {
                    console.error('❌ Fehler beim Push Button Click:', error);
                    alert(`❌ Fehler: ${error.message}`);
                }
            });
            
            console.log('✅ Push Button Event Handler hinzugefügt');
        } else {
            console.warn('⚠️ Push Button (#pushNotificationBtn) nicht gefunden');
        }
    }
});
