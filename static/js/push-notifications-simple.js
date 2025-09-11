/**
 * Push Notification Manager für Hochzeitsplaner (Vereinfachte Version)
 * Lädt VAPID Key sofort, Service Worker asynchron
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
        // console.log('🚀 VEREINFACHTER Push Notification Manager startet...');
        // console.log('🔧 VERSION: 2025-09-11-SIMPLE-1');
        
        // Feature Detection
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;
        
        // console.log('🔧 Service Worker Support:', hasServiceWorker);
        // console.log('🔧 Push Manager Support:', hasPushManager);
        // console.log('🔧 Notification Support:', hasNotification);
        
        if (!hasServiceWorker || !hasPushManager || !hasNotification) {
            console.error('❌ Browser unterstützt Push Notifications nicht');
            this.isSupported = false;
            return;
        }
        
        this.isSupported = true;
        
        try {
            // VAPID Key laden (wichtigster Teil)
            // console.log('🔧 Lade VAPID Key...');
            await this.loadVapidKey();
            
            if (!this.vapidPublicKey) {
                console.error('❌ VAPID Key konnte nicht geladen werden');
                this.isSupported = false;
            } else {
                // console.log('✅ VAPID Key erfolgreich geladen');
                // console.log('🔧 Key Length:', this.vapidPublicKey.length);
            }
            
        } catch (error) {
            console.error('❌ Fehler beim Laden des VAPID Keys:', error);
            this.isSupported = false;
        }
        
        // Manager als ready markieren
        this.isReady = true;
        // console.log('✅ Push Notification Manager bereit, VAPID Key:', !!this.vapidPublicKey);
        
        // Service Worker asynchron laden (blockiert nicht)
        this.loadServiceWorkerAsync();
    }
    
    async loadServiceWorkerAsync() {
        // console.log('🔄 Service Worker wird asynchron geladen...');
        try {
            // Warte bis Service Worker verfügbar ist
            let attempts = 0;
            while (attempts < 50) { // 5 Sekunden max
                if (navigator.serviceWorker.controller) {
                    this.registration = await navigator.serviceWorker.ready;
                    // console.log('✅ Service Worker nachträglich geladen');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            // console.warn('⚠️ Service Worker nicht verfügbar nach 5 Sekunden');
        } catch (error) {
            // console.warn('⚠️ Service Worker konnte nicht geladen werden:', error);
        }
    }
    
    async loadVapidKey() {
        try {
            // console.log('🔧 Lade VAPID Key von Server...');
            const response = await fetch('/api/push/vapid-key');
            // console.log('🔧 VAPID Key Response Status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                // console.log('🔧 Response Data:', data);
                
                if (!data.publicKey) {
                    console.error('❌ VAPID Public Key nicht in Response gefunden');
                    return;
                }
                
                this.vapidPublicKey = data.publicKey;
                // console.log('✅ VAPID Public Key geladen');
                // console.log('🔧 Key Sample:', data.publicKey.substring(0, 30) + '...');
                
            } else {
                console.error('❌ VAPID Key API Fehler, Status:', response.status);
                const errorText = await response.text();
                console.error('❌ Error Response:', errorText);
            }
        } catch (error) {
            console.error('❌ Netzwerk-Fehler beim Laden des VAPID Keys:', error);
        }
    }
    
    async toggleSubscription() {
        // console.log('🔔 toggleSubscription aufgerufen, aktueller Status:', this.isSubscribed);
        
        if (!this.isSupported || !this.vapidPublicKey) {
            alert('❌ Push Notifications nicht verfügbar - VAPID Key fehlt');
            return;
        }
        
        // Safari/iOS Erkennung für bessere Fehlermeldungen
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isSafari) {
            console.log('🍎 Safari/iOS erkannt - verwende iOS-optimierte Push-Notification Behandlung');
        }
        
        // console.log('🔔 Berechtigung wird angefragt...');
        
        try {
            // SOFORT Berechtigung anfragen
            const permission = await Notification.requestPermission();
            // console.log('🔔 Berechtigung Antwort:', permission);
            
            if (permission !== 'granted') {
                alert('❌ Push Notifications wurden abgelehnt');
                return;
            }
            
            // console.log('✅ Berechtigung erhalten, teste Service Worker...');
            
            // Verschiedene Service Worker Strategien versuchen
            let registration = null;
            
            // Strategie 1: getRegistrations
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                // console.log('🔧 Gefundene Registrierungen:', registrations.length);
                if (registrations.length > 0) {
                    registration = registrations[0];
                    // console.log('✅ Service Worker über getRegistrations gefunden');
                }
            } catch (error) {
                // console.warn('⚠️ getRegistrations fehlgeschlagen:', error);
            }
            
            // Strategie 2: navigator.serviceWorker.ready (mit kurzem Timeout)
            if (!registration) {
                try {
                    const readyPromise = navigator.serviceWorker.ready;
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 3000)
                    );
                    
                    registration = await Promise.race([readyPromise, timeoutPromise]);
                    // console.log('✅ Service Worker über ready gefunden');
                } catch (error) {
                    // console.warn('⚠️ serviceWorker.ready fehlgeschlagen:', error);
                }
            }
            
            if (!registration) {
                throw new Error('Service Worker nicht verfügbar. Bitte Seite neu laden.');
            }
            
            // console.log('🔔 Erstelle Push Subscription...');
            
            let subscription;
            try {
                const vapidKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
                
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: vapidKey
                });
                
                // console.log('✅ Push Subscription erstellt:', subscription.endpoint);
                
            } catch (subscriptionError) {
                console.error('❌ Subscription Fehler:', subscriptionError);
                
                if (isSafari && subscriptionError.message.includes('applicationServerKey')) {
                    alert('❌ Safari Push-Notification Fehler:\nDer VAPID Public Key ist nicht im korrekten P-256 Format.\n\nBitte kontaktieren Sie den Administrator.');
                } else {
                    alert('❌ Push Subscription fehlgeschlagen:\n' + subscriptionError.message);
                }
                return;
            }
            
            // An Server senden
            // console.log('📡 Sende Subscription an Server...');
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Fehler ${response.status}: ${errorText}`);
            }
            
            this.subscription = subscription;
            this.isSubscribed = true;
            
            console.log('✅ Push Notifications erfolgreich aktiviert!');
            alert('✅ Push Notifications aktiviert!');
            
        } catch (error) {
            console.error('❌ Push Notification Fehler:', error);
            alert(`❌ Fehler beim Aktivieren: ${error.message}`);
        }
    }
    
    async waitForServiceWorker() {
        console.log('⏳ Warte explizit auf Service Worker...');
        
        try {
            // Direkter Ansatz: navigator.serviceWorker.ready verwenden
            console.log('🔄 Verwende navigator.serviceWorker.ready...');
            this.registration = await navigator.serviceWorker.ready;
            console.log('✅ Service Worker über ready verfügbar');
            return;
        } catch (error) {
            console.error('❌ navigator.serviceWorker.ready fehlgeschlagen:', error);
        }
        
        // Fallback: Warte auf Registration
        console.log('🔄 Fallback: Warte auf Service Worker Registration...');
        for (let attempt = 0; attempt < 50; attempt++) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
                this.registration = registrations[0];
                console.log('✅ Service Worker über getRegistrations verfügbar');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.error('❌ Service Worker nicht verfügbar nach allen Versuchen');
    }
    
    async subscribe() {
        console.log('🔔 Starte Push Notification Subscription...');
        
        // Berechtigung anfragen
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Push Notifications wurden abgelehnt');
        }
        
        console.log('✅ Push Notification Berechtigung erhalten');
        
        // VAPID Key in Uint8Array konvertieren
        const vapidKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
        
        // Push Subscription erstellen
        const subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey
        });
        
        console.log('✅ Push Subscription erstellt:', subscription);
        
        // Subscription an Server senden
        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subscription: subscription.toJSON()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server Fehler: ${response.status}`);
        }
        
        this.subscription = subscription;
        this.isSubscribed = true;
        console.log('✅ Push Notifications erfolgreich aktiviert!');
        alert('✅ Push Notifications aktiviert!');
    }
    
    async unsubscribe() {
        console.log('🔔 Deaktiviere Push Notifications...');
        
        if (this.subscription) {
            await this.subscription.unsubscribe();
            this.subscription = null;
        }
        
        this.isSubscribed = false;
        console.log('✅ Push Notifications deaktiviert');
        alert('✅ Push Notifications deaktiviert');
    }
    
    urlBase64ToUint8Array(base64String) {
        // console.log('🔧 Konvertiere VAPID Key, Original Length:', base64String.length);
        
        try {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding)
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            
            const rawData = window.atob(base64);
            // console.log('🔧 Raw Data Length:', rawData.length);
            
            const fullArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                fullArray[i] = rawData.charCodeAt(i);
            }
            
            // console.log('🔧 Full Array Length:', fullArray.length);
            
            // Server liefert bereits das richtige Format je nach Browser
            // Keine weitere Konvertierung nötig
            if (fullArray.length === 65 && fullArray[0] === 0x04) {
                // console.log('✅ Raw P-256 Format (Safari/iOS)');
                return fullArray;
            } else if (fullArray.length === 91) {
                // console.log('✅ DER Format - extrahiere P-256 Key');
                return fullArray.slice(-65); // Letzten 65 Bytes extrahieren
            } else {
                // console.log('✅ Andere Länge, verwende wie geliefert:', fullArray.length);
                return fullArray;
            }
            
        } catch (error) {
            console.error('❌ VAPID Key Konvertierung fehlgeschlagen:', error);
            throw error;
        }
    }
}

// Manager global verfügbar machen
// console.log('🔔 Push Notification Manager wird erstellt...');
window.pushNotificationManager = new PushNotificationManager();
window.PushNotificationManager = PushNotificationManager;
// console.log('✅ Push Notification Manager global verfügbar');
