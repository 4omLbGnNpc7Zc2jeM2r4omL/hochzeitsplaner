/**
 * iOS Safari Debug Helper
 * Zeigt Debug-Informationen direkt auf der Webseite an
 */

class IOSDebugHelper {
    constructor() {
        this.debugElement = null;
        this.init();
    }

    init() {
        // Debug-Container erstellen
        this.createDebugContainer();
        
        // Sofort iOS-Infos anzeigen
        this.showIOSInfo();
        
        // Push Notification Test starten
        this.testPushNotifications();
        
        // Push Notification Button Events abfangen
        this.interceptPushNotificationEvents();
    }

    createDebugContainer() {
        // Debug-Container erstellen
        this.debugElement = document.createElement('div');
        this.debugElement.id = 'ios-debug-info';
        this.debugElement.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 10px;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0,0,0,0.9);
            color: #00ff00;
            font-family: monospace;
            font-size: 10px;
            padding: 10px;
            border-radius: 5px;
            z-index: 8888;
            border: 1px solid #333;
        `;

        // Schließen-Button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '❌';
        closeBtn.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            background: #ff4444;
            color: white;
            border: none;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 8px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => this.debugElement.style.display = 'none';
        
        this.debugElement.appendChild(closeBtn);
        document.body.appendChild(this.debugElement);
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logLine = document.createElement('div');
        logLine.textContent = `[${timestamp}] ${message}`;
        logLine.style.marginBottom = '2px';
        this.debugElement.appendChild(logLine);
        
        // Auto-scroll nach unten
        this.debugElement.scrollTop = this.debugElement.scrollHeight;
        
        // Auch in normale Konsole loggen
        console.log(message);
    }

    showIOSInfo() {
        this.log('🍎 iOS Safari Debug-Informationen:');
        this.log('================================');
        
        // User Agent
        this.log(`📱 User Agent: ${navigator.userAgent}`);
        
        // iOS Detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.log(`🍎 iOS erkannt: ${isIOS ? 'JA' : 'NEIN'}`);
        
        if (isIOS) {
            // iOS Version detailliert
            const iOSVersion = navigator.userAgent.match(/OS (\d+)_(\d+)(?:_(\d+))?/);
            if (iOSVersion) {
                const majorVersion = parseInt(iOSVersion[1]);
                const minorVersion = parseInt(iOSVersion[2]);
                const patchVersion = iOSVersion[3] ? parseInt(iOSVersion[3]) : 0;
                this.log(`📱 iOS Version: ${majorVersion}.${minorVersion}.${patchVersion}`);
                
                // Detaillierte Version-Checks
                if (majorVersion < 16) {
                    this.log('❌ iOS Version ZU ALT! Web Push benötigt iOS 16.4+');
                    this.log('💡 Lösung: iOS auf mindestens 16.4 aktualisieren');
                } else if (majorVersion === 16 && minorVersion < 4) {
                    this.log(`❌ iOS 16.${minorVersion} ZU ALT! Web Push benötigt iOS 16.4+`);
                    this.log('💡 Lösung: iOS auf mindestens 16.4 aktualisieren');
                } else {
                    this.log(`✅ iOS ${majorVersion}.${minorVersion}.${patchVersion} sollte Web Push unterstützen`);
                }
                
                // Safari Version aus User Agent extrahieren
                const safariVersion = navigator.userAgent.match(/Version\/(\d+)\.(\d+)/);
                if (safariVersion) {
                    const safariMajor = parseInt(safariVersion[1]);
                    const safariMinor = parseInt(safariVersion[2]);
                    this.log(`🌐 Safari Version: ${safariMajor}.${safariMinor}`);
                    
                    if (safariMajor < 16) {
                        this.log('❌ Safari Version zu alt für Web Push!');
                    }
                }
            } else {
                this.log('⚠️ iOS Version konnte nicht ermittelt werden');
            }
            
            // iPhone Modell versuchen zu ermitteln
            if (navigator.userAgent.includes('iPhone')) {
                this.log('📱 Gerät: iPhone');
                // Zusätzliche iPhone-spezifische Checks
                this.log('💡 Web Push auf iPhone benötigt:');
                this.log('   - iOS 16.4 oder höher');
                this.log('   - Safari als Standard-Browser');
                this.log('   - Push Notifications in Safari-Einstellungen aktiviert');
            }
        }
        
        // Safari Detection
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        this.log(`🌐 Safari Browser: ${isSafari ? 'JA' : 'NEIN'}`);
        
        if (!isSafari) {
            this.log('❌ Kein Safari! Web Push auf iOS funktioniert NUR in Safari!');
            this.log('💡 Lösung: Website in Safari öffnen');
        }
        
        // Protocol Check
        this.log(`🔒 Protocol: ${window.location.protocol}`);
        this.log(`🌐 URL: ${window.location.href}`);
        this.log(`🔐 Secure Context: ${isSecureContext ? 'JA' : 'NEIN'}`);
        
        // Screen Infos für weitere Diagnose
        this.log(`📺 Screen: ${screen.width}x${screen.height}`);
        this.log(`🖼️ Viewport: ${window.innerWidth}x${window.innerHeight}`);
        
        this.log('================================');
    }

    async testPushNotifications() {
        this.log('🔧 Push Notification Test startet...');
        
        // Warte 2 Sekunden, damit Service Worker Zeit hat sich zu registrieren
        this.log('⏳ Warte 2 Sekunden auf Service Worker...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            // Service Worker Check
            const hasServiceWorker = 'serviceWorker' in navigator;
            this.log(`⚙️ Service Worker: ${hasServiceWorker ? '✅ Verfügbar' : '❌ Nicht verfügbar'}`);
            
            // PushManager Check (initial)
            const hasPushManager = 'PushManager' in window;
            this.log(`📬 PushManager (initial): ${hasPushManager ? '✅ Verfügbar' : '❌ Nicht verfügbar'}`);
            
            // Notification Check
            const hasNotification = 'Notification' in window;
            this.log(`🔔 Notification API: ${hasNotification ? '✅ Verfügbar' : '❌ Nicht verfügbar'}`);
            
            if (!hasServiceWorker) {
                this.log('❌ Service Worker nicht verfügbar - Push Notifications unmöglich');
                return;
            }
            
            // WICHTIG: Auf iOS müssen sowohl PushManager als auch Notification API verfügbar sein
            if (!hasPushManager && !hasNotification) {
                this.log('🍎 DIAGNOSE: Keine Push APIs verfügbar');
                this.log('📊 Mögliche Ursachen:');
                this.log('   1️⃣ iOS Version zu alt (< 16.4)');
                this.log('   2️⃣ Safari-Einstellungen: Push deaktiviert');
                this.log('   3️⃣ Nicht in Safari geöffnet');
                this.log('   4️⃣ Website nicht als Lesezeichen/Home Screen hinzugefügt');
                this.log('');
                this.log('💡 LÖSUNG VERSUCHEN:');
                this.log('   1️⃣ Prüfen: Einstellungen → Safari → Erweitert');
                this.log('   2️⃣ "Entwickler-Funktionen" aktivieren');
                this.log('   3️⃣ Website zu Home Screen hinzufügen');
                this.log('   4️⃣ Als PWA installieren (Share → Zum Home-Bildschirm)');
                return;
            }
            
            // Service Worker Registration
            this.log('🔄 Registriere Service Worker...');
            
            try {
                // Prüfe ob Service Worker bereits registriert ist
                const existingRegistration = await navigator.serviceWorker.getRegistration();
                this.log(`🔍 Vorhandene SW Registration: ${existingRegistration ? 'JA' : 'NEIN'}`);
                
                if (existingRegistration) {
                    this.log(`📋 SW State: ${existingRegistration.active ? existingRegistration.active.state : 'Kein aktiver SW'}`);
                    this.log(`📂 SW Script URL: ${existingRegistration.active ? existingRegistration.active.scriptURL : 'Unbekannt'}`);
                }
                
                // Versuche Service Worker zu registrieren falls nicht vorhanden
                if (!existingRegistration) {
                    this.log('📝 Registriere neuen Service Worker...');
                    try {
                        // KORREKTUR: Scope muss im gleichen Pfad oder unterhalb des SW Scripts sein
                        const newRegistration = await navigator.serviceWorker.register('/static/sw.js', {
                            scope: '/static/'  // Scope auf /static/ setzen statt /
                        });
                        this.log('✅ Service Worker neu registriert');
                        this.log(`📂 Scope: ${newRegistration.scope}`);
                        
                        // Alternativ: Registrierung ohne expliziten Scope
                        // scope wird automatisch auf den Ordner des SW Scripts gesetzt
                    } catch (regError) {
                        this.log(`❌ Service Worker Registrierung fehlgeschlagen: ${regError.message}`);
                        
                        // Versuche ohne expliziten Scope
                        this.log('� Versuche Registration ohne expliziten Scope...');
                        try {
                            const fallbackRegistration = await navigator.serviceWorker.register('/static/sw.js');
                            this.log('✅ Service Worker mit automatischem Scope registriert');
                            this.log(`📂 Auto-Scope: ${fallbackRegistration.scope}`);
                        } catch (fallbackError) {
                            this.log(`❌ Auch Fallback-Registration fehlgeschlagen: ${fallbackError.message}`);
                            
                            // Prüfe ob sw.js erreichbar ist
                            try {
                                const response = await fetch('/static/sw.js');
                                if (response.ok) {
                                    this.log('✅ sw.js Datei ist erreichbar');
                                } else {
                                    this.log(`❌ sw.js nicht erreichbar: ${response.status} ${response.statusText}`);
                                }
                            } catch (fetchError) {
                                this.log(`❌ sw.js fetch Fehler: ${fetchError.message}`);
                            }
                            return;
                        }
                    }
                } else {
                    this.log('📋 Verwende vorhandene Service Worker Registration');
                }
                
                // Warte auf Service Worker Ready mit Timeout
                this.log('⏳ Warte auf Service Worker Ready...');
                
                let registration;
                try {
                    // Service Worker Ready mit 10 Sekunden Timeout
                    registration = await Promise.race([
                        navigator.serviceWorker.ready,
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Service Worker Ready Timeout nach 10 Sekunden')), 10000)
                        )
                    ]);
                    this.log('✅ Service Worker bereit');
                } catch (timeoutError) {
                    this.log(`❌ Service Worker Ready Timeout: ${timeoutError.message}`);
                    this.log('💡 Versuche alternative Service Worker Zugriff...');
                    
                    // Alternative: Vorhandene Registration verwenden
                    const existingReg = await navigator.serviceWorker.getRegistration();
                    if (existingReg && existingReg.active) {
                        registration = existingReg;
                        this.log('✅ Verwende existierende Service Worker Registration');
                    } else {
                        this.log('❌ Keine funktionierende Service Worker Registration gefunden');
                        this.log('💡 Lösung: Seite neu laden oder Service Worker neu installieren');
                        return;
                    }
                }
                
                // Detaillierte SW Info
                if (registration.active) {
                    this.log(`📋 Aktiver SW State: ${registration.active.state}`);
                    this.log(`📂 SW Script: ${registration.active.scriptURL}`);
                    this.log(`🌐 SW Scope: ${registration.scope}`);
                } else {
                    this.log('⚠️ Kein aktiver Service Worker gefunden');
                }
                
                // PushManager nach Registration prüfen
                const hasPushManagerAfterSW = !!registration.pushManager;
                this.log(`📬 PushManager (nach SW): ${hasPushManagerAfterSW ? '✅ Verfügbar' : '❌ Nicht verfügbar'}`);
                
                if (!hasPushManagerAfterSW) {
                    this.log('❌ PushManager nicht verfügbar nach Service Worker Registration');
                    this.log('💡 Mögliche Ursache: Service Worker nicht korrekt geladen');
                    return;
                }
                
                // Notification Permission Status prüfen
                this.log(`🔔 Aktuelle Permission: ${Notification.permission}`);
                
                if (Notification.permission === 'default') {
                    this.log('🔔 Frage nach Notification Permission...');
                    
                    // iOS spezielle Behandlung für Permission Request
                    this.log('🍎 iOS: Starte Permission Request (User Gesture erforderlich)...');
                    
                    try {
                        const permission = await Notification.requestPermission();
                        this.log(`🔔 Permission Ergebnis: ${permission}`);
                        
                        if (permission === 'granted') {
                            this.log('✅ Permission erhalten!');
                        } else if (permission === 'denied') {
                            this.log('❌ Permission verweigert');
                            this.log('💡 Lösung: Safari-Einstellungen → Websites → Benachrichtigungen');
                        } else {
                            this.log(`⚠️ Unerwartetes Permission-Ergebnis: ${permission}`);
                        }
                    } catch (permError) {
                        this.log(`❌ Fehler bei Permission Request: ${permError.message}`);
                        this.log('💡 Mögliche Ursache: Kein User Gesture oder Safari-Einstellungen');
                    }
                    
                } else if (Notification.permission === 'granted') {
                    this.log('✅ Permission bereits erteilt!');
                } else if (Notification.permission === 'denied') {
                    this.log('❌ Permission bereits verweigert');
                    this.log('💡 Lösung: Safari-Einstellungen → Websites → Benachrichtigungen → Diese Website');
                }
                
                // Final Status
                if (Notification.permission === 'granted') {
                    this.log('🎉 Alle Push Notification Voraussetzungen erfüllt!');
                    this.log('✅ Push Notifications sollten funktionieren');
                    
                    // Test-Subscription versuchen
                    this.log('🧪 Teste Subscription-Erstellung...');
                    try {
                        // Dummy VAPID key für Test (wird nicht verwendet)
                        const testKey = 'BMxiMgfSLdQSL-LqSFMr-mZqbhf4Z4qV4W8l4J8s_x-yE9YcGlS0Ej2A9xR8Y1dP_3X5a7uj2V3bA_ZxK8N9L2G4M';
                        const testSubscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: this.urlBase64ToUint8Array(testKey)
                        });
                        this.log('✅ Test-Subscription erfolgreich erstellt!');
                        this.log('🔧 Push Notifications sind vollständig funktionsfähig');
                        
                        // Test-Subscription wieder löschen
                        await testSubscription.unsubscribe();
                        this.log('🧹 Test-Subscription entfernt');
                        
                    } catch (subError) {
                        this.log(`⚠️ Test-Subscription fehlgeschlagen: ${subError.message}`);
                        this.log('💡 Das könnte normal sein - echter Test mit echtem VAPID Key nötig');
                    }
                    
                } else {
                    this.log(`❌ Permission nicht erteilt: ${Notification.permission}`);
                }
                
            } catch (swError) {
                this.log(`❌ Service Worker Registration Fehler: ${swError.message}`);
                this.log('💡 Mögliche Ursachen:');
                this.log('   - Service Worker-Datei nicht gefunden (/static/sw.js)');
                this.log('   - Netzwerkfehler');
                this.log('   - Safari-Sicherheitseinstellungen');
                this.log(`📊 Fehler-Details: ${swError.toString()}`);
            }
            
        } catch (error) {
            this.log(`❌ Fehler beim Push Notification Test: ${error.message}`);
            this.log(`📊 Error Details: ${error.toString()}`);
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
    
    // Intercept Push Notification Events
    interceptPushNotificationEvents() {
        this.log('🔧 Überwache Push Notification Events...');
        
        // Warte auf Push Banner und überwache Aktivieren Button
        const checkForPushButton = () => {
            const pushBtn = document.querySelector('#enablePushBtn');
            if (pushBtn && !pushBtn.dataset.debugIntercepted) {
                this.log('🔧 Push Aktivieren Button gefunden - füge Debug hinzu');
                pushBtn.dataset.debugIntercepted = 'true';
                
                // Original Click Handler überwachen
                pushBtn.addEventListener('click', (event) => {
                    this.log('🔔 PUSH AKTIVIEREN BUTTON GEKLICKT!');
                    this.log('📱 Starte detaillierte Push Activation Überwachung...');
                    
                    // Überwache alle fetch Requests
                    const originalFetch = window.fetch;
                    window.fetch = async (...args) => {
                        const url = args[0];
                        const options = args[1] || {};
                        
                        this.log(`🌐 FETCH: ${url}`);
                        this.log(`📊 METHOD: ${options.method || 'GET'}`);
                        
                        try {
                            const response = await originalFetch(...args);
                            this.log(`✅ FETCH Response: ${response.status} ${response.statusText}`);
                            
                            // Restore original fetch nach 10 Sekunden
                            setTimeout(() => {
                                window.fetch = originalFetch;
                                this.log('🔧 Fetch Monitoring beendet');
                            }, 10000);
                            
                            return response;
                        } catch (error) {
                            this.log(`❌ FETCH Error: ${error.message}`);
                            window.fetch = originalFetch;
                            throw error;
                        }
                    };
                }, true); // Capture phase
            }
        };
        
        // Prüfe alle 500ms nach Push Button
        const intervalId = setInterval(() => {
            checkForPushButton();
            
            // Nach 30 Sekunden aufhören zu suchen
            setTimeout(() => clearInterval(intervalId), 30000);
        }, 500);
    }
}

// Auto-start wenn Seite geladen
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new IOSDebugHelper();
    });
} else {
    new IOSDebugHelper();
}
