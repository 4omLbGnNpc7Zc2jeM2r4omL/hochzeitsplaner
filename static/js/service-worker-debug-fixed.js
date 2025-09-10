// Service Worker Debug für iOS Safari - Korrigierte Version
class ServiceWorkerDebugger {
    constructor() {
        this.debugContainer = null;
        this.logEntries = [];
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.logEntries.push(logMessage);
        console.log(logMessage);
        
        if (this.debugContainer) {
            this.updateDebugDisplay();
        }
    }

    createDebugInterface() {
        // Alle alten Debug-Container entfernen
        const oldContainers = document.querySelectorAll('#ios-debug-overlay, #sw-debug-overlay, #ios-debug-container');
        oldContainers.forEach(container => {
            console.log('🗑️ Entferne alten Debug-Container:', container.id);
            container.remove();
        });

        // Debug Container erstellen (unten rechts, größer)
        this.debugContainer = document.createElement('div');
        this.debugContainer.id = 'sw-debug-overlay';
        this.debugContainer.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 420px;
            max-height: 350px;
            background: rgba(0, 0, 0, 0.95);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 0;
            border-radius: 8px;
            z-index: 9500;
            overflow: hidden;
            border: 2px solid #00ff00;
            font-weight: bold;
            display: flex;
            flex-direction: column;
        `;

        // Sticky Header mit Test-Buttons (bleibt immer sichtbar)
        const header = document.createElement('div');
        header.style.cssText = `
            background: rgba(0, 0, 0, 0.98);
            padding: 8px;
            border-bottom: 1px solid #00ff00;
            flex-shrink: 0;
            position: sticky;
            top: 0;
            z-index: 9501;
        `;
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #ffff00; font-size: 11px;">🔧 Service Worker Debug</span>
                <div style="display: flex; gap: 4px;">
                    <button id="sw-test-btn" style="
                        background: #007700; 
                        color: white; 
                        border: none; 
                        padding: 4px 8px; 
                        border-radius: 4px; 
                        font-size: 10px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Test SW</button>
                    <button id="sw-force-register-btn" style="
                        background: #cc3300; 
                        color: white; 
                        border: none; 
                        padding: 4px 8px; 
                        border-radius: 4px; 
                        font-size: 10px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Force Reg</button>
                    <button id="push-test-btn" style="
                        background: #0066cc; 
                        color: white; 
                        border: none; 
                        padding: 4px 8px; 
                        border-radius: 4px; 
                        font-size: 10px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Push Test</button>
                    <button id="sw-clear-log-btn" style="
                        background: #666666; 
                        color: white; 
                        border: none; 
                        padding: 4px 8px; 
                        border-radius: 4px; 
                        font-size: 10px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Clear</button>
                </div>
            </div>
        `;
        this.debugContainer.appendChild(header);

        // Scrollable Log Container
        const logContainer = document.createElement('div');
        logContainer.id = 'sw-log-content';
        logContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 9px;
            line-height: 1.2;
        `;
        this.debugContainer.appendChild(logContainer);

        document.body.appendChild(this.debugContainer);

        // Event Listeners
        document.getElementById('sw-test-btn').addEventListener('click', () => {
            this.testServiceWorker();
        });

        document.getElementById('sw-force-register-btn').addEventListener('click', () => {
            this.forceServiceWorkerRegistration();
        });

        document.getElementById('push-test-btn').addEventListener('click', () => {
            this.testPushNotifications();
        });

        document.getElementById('sw-clear-log-btn').addEventListener('click', () => {
            this.clearLog();
        });

        this.log('🚀 Service Worker Debugger gestartet');
        this.updateDebugDisplay();
    }

    updateDebugDisplay() {
        const logContent = document.getElementById('sw-log-content');
        if (logContent) {
            // Nur letzte 20 Einträge anzeigen für bessere Performance
            const recentLogs = this.logEntries.slice(-20);
            logContent.textContent = recentLogs.join('\n');
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    clearLog() {
        this.logEntries = [];
        this.updateDebugDisplay();
        this.log('🧹 Log gelöscht');
    }

    async forceServiceWorkerRegistration() {
        this.log('🔥 Force Service Worker Registration startet...');
        
        try {
            // Alle bestehenden Registrations löschen
            this.log('🗑️ Lösche alle bestehenden Service Worker Registrations...');
            const registrations = await navigator.serviceWorker.getRegistrations();
            this.log(`🔍 Gefunden: ${registrations.length} bestehende Registrations`);
            
            for (const registration of registrations) {
                this.log(`🗑️ Lösche Registration: ${registration.scope}`);
                await registration.unregister();
            }
            
            if (registrations.length > 0) {
                this.log('✅ Alle alten Registrations gelöscht');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // WICHTIG: Service Worker im Root registrieren für vollen Site-Scope
            this.log('🔄 Starte frische Service Worker Registrierung (ROOT SCOPE)...');
            const timestamp = Date.now();
            const swUrl = `/sw.js?v=${timestamp}`;  // Service Worker aus Root-Ordner
            this.log(`📄 SW URL: ${swUrl}`);
            
            const response = await fetch(swUrl);
            if (!response.ok) {
                throw new Error(`Service Worker Datei nicht erreichbar: ${response.status}`);
            }
            this.log('✅ Service Worker Datei verfügbar');

            // Registrierung OHNE Scope = automatisch Root-Scope
            const registration = await navigator.serviceWorker.register(swUrl);
            this.log('✅ Frische Service Worker Registration erstellt');
            this.log(`📂 Scope: ${registration.scope}`);
            
            // Warte kurz und validiere nochmal
            this.log('⏳ Warte 2 Sekunden und validiere...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const check = await navigator.serviceWorker.getRegistration();
            if (check) {
                this.log('✅ Registration nach Wartezeit verfügbar');
                this.log(`📂 Validierter Scope: ${check.scope}`);
                this.log(`📋 State: installing=${!!check.installing}, waiting=${!!check.waiting}, active=${!!check.active}`);
            } else {
                this.log('❌ Registration noch nicht verfügbar nach Wartezeit');
                
                // Debugging: Alle verfügbaren Registrations anzeigen
                const allRegs = await navigator.serviceWorker.getRegistrations();
                this.log(`🔍 Alle Registrations: ${allRegs.length}`);
                allRegs.forEach((reg, index) => {
                    this.log(`   ${index + 1}. Scope: ${reg.scope}`);
                });
            }

            this.log('🎉 Force Registration abgeschlossen');

        } catch (error) {
            this.log(`❌ Force Registration fehlgeschlagen: ${error.message}`);
            this.log(`🔧 Stack: ${error.stack || 'Kein Stack verfügbar'}`);
        }
    }

    async testServiceWorker() {
        this.log('🔍 Service Worker Test startet...');
        
        try {
            // Service Worker Support prüfen
            if (!('serviceWorker' in navigator)) {
                this.log('❌ Service Worker nicht unterstützt');
                return;
            }
            this.log('✅ Service Worker API verfügbar');

            // Aktuelle Registration prüfen
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                this.log('✅ Service Worker bereits registriert');
                this.log(`📂 Scope: ${registration.scope}`);
                
                if (registration.active) {
                    this.log(`📋 Aktiver SW Status: ${registration.active.state}`);
                } else {
                    this.log('⚠️ Service Worker nicht aktiv');
                }
            } else {
                this.log('⚠️ Kein Service Worker registriert');
                this.log('💡 Versuche "Force Reg" Button');
                return;
            }

            // Push Manager prüfen
            if (registration.pushManager) {
                this.log('✅ Push Manager verfügbar');
                
                // Permission prüfen
                this.log(`🔔 Notification Permission: ${Notification.permission}`);
                
                // Subscription prüfen
                try {
                    const subscription = await registration.pushManager.getSubscription();
                    if (subscription) {
                        this.log('✅ Push Subscription vorhanden');
                    } else {
                        this.log('⚠️ Keine Push Subscription');
                    }
                } catch (subError) {
                    this.log(`❌ Subscription Check Fehler: ${subError.message}`);
                }
            } else {
                this.log('❌ Push Manager nicht verfügbar');
            }

        } catch (error) {
            this.log(`❌ Test Fehler: ${error.message}`);
        }
    }

    // Test Push Notifications mit Debug-Output
    async testPushNotifications() {
        this.log('🔔 === PUSH NOTIFICATION TEST START ===');
        
        try {
            // Schritt 1: Permission prüfen
            this.log('🔔 Schritt 1: Berechtigung prüfen...');
            this.log(`🔔 Notification.permission: ${Notification.permission}`);
            
            if (Notification.permission === 'default') {
                this.log('🔔 Fordere Berechtigung an...');
                const permission = await Notification.requestPermission();
                this.log(`🔔 Berechtigung erhalten: ${permission}`);
                if (permission !== 'granted') {
                    throw new Error(`Berechtigung nicht erteilt: ${permission}`);
                }
            } else if (Notification.permission === 'denied') {
                throw new Error('Benachrichtigungen wurden blockiert');
            }

            // Schritt 2: Service Worker vorbereiten
            this.log('🔔 Schritt 2: Service Worker vorbereiten...');
            const registration = await this.prepareForPushNotifications();
            this.log('🔔 Service Worker bereit');

            // Schritt 3: VAPID Key laden
            this.log('🔔 Schritt 3: VAPID Schlüssel laden...');
            const vapidResponse = await fetch('/api/push/vapid-key');
            
            if (!vapidResponse.ok) {
                const errorText = await vapidResponse.text();
                this.log(`❌ VAPID Fehler: ${errorText}`);
                throw new Error(`VAPID Key Fehler: ${vapidResponse.status} - ${errorText}`);
            }
            
            const vapidData = await vapidResponse.json();
            if (!vapidData.publicKey) {
                this.log('❌ VAPID Public Key nicht verfügbar');
                throw new Error('VAPID Public Key nicht verfügbar');
            }

            // Debug VAPID Key Details
            this.log(`🔑 VAPID Key erhalten: ${vapidData.publicKey.substring(0, 30)}...`);
            this.log(`🔑 Key Länge: ${vapidData.publicKey.length} Zeichen`);

            // Schritt 4: Key konvertieren
            this.log('🔔 Schritt 4: VAPID Key konvertieren...');
            const applicationServerKey = this.urlBase64ToUint8Array(vapidData.publicKey);
            this.log(`🔑 Key konvertiert zu ${applicationServerKey.length} Bytes`);
            this.log(`🔑 Erste 8 Bytes: [${Array.from(applicationServerKey.slice(0, 8)).join(', ')}]`);

            // Schritt 5: Push Subscription erstellen
            this.log('🔔 Schritt 5: Push Subscription erstellen...');
            
            try {
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });
                
                this.log('✅ Push Subscription erfolgreich erstellt!');
                this.log(`📧 Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
                
                // Schritt 6: An Server senden
                this.log('🔔 Schritt 6: An Server senden...');
                const saveResponse = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription: subscription.toJSON() })
                });

                if (saveResponse.ok) {
                    this.log('✅ Subscription erfolgreich gespeichert!');
                } else {
                    const errorText = await saveResponse.text();
                    this.log(`⚠️ Server Fehler: ${errorText}`);
                }

            } catch (subscriptionError) {
                this.log(`❌ Push Subscription Fehler: ${subscriptionError.name}`);
                this.log(`❌ Fehler Details: ${subscriptionError.message}`);
                throw subscriptionError;
            }

        } catch (error) {
            this.log(`❌ Push Test fehlgeschlagen: ${error.message}`);
        }
        
        this.log('🔔 === PUSH NOTIFICATION TEST ENDE ===');
    }

    // VAPID Key Konvertierung mit Debug-Output
    urlBase64ToUint8Array(base64String) {
        try {
            // Entferne alle Leerzeichen und Zeilenumbrüche
            const cleanBase64 = base64String.trim().replace(/\s/g, '');
            this.log(`🔧 Original Key (bereinigt): ${cleanBase64.length} Zeichen`);
            
            // Füge Padding hinzu falls nötig
            const padding = '='.repeat((4 - cleanBase64.length % 4) % 4);
            const paddedBase64 = cleanBase64 + padding;
            this.log(`🔧 Nach Padding: ${paddedBase64.length} Zeichen (Padding: ${padding.length})`);
            
            // Konvertiere von base64url zu base64
            const base64 = paddedBase64.replace(/-/g, '+').replace(/_/g, '/');
            this.log(`🔧 Base64URL -> Base64 konvertiert`);
            
            // Dekodiere zu Uint8Array
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            
            this.log(`🔧 Dekodiert zu ${outputArray.length} Bytes`);
            this.log(`🔧 Erste 4 Bytes: [${Array.from(outputArray.slice(0, 4)).join(', ')}]`);
            
            // Validiere P-256 Key Format
            if (outputArray.length === 65 && outputArray[0] === 0x04) {
                this.log('✅ Korrekte P-256 uncompressed public key (65 Bytes mit 0x04)');
            } else if (outputArray.length === 64) {
                this.log('🔧 64-Byte Key erkannt, füge 0x04 Prefix hinzu...');
                const prefixedArray = new Uint8Array(65);
                prefixedArray[0] = 0x04;
                prefixedArray.set(outputArray, 1);
                this.log('✅ 0x04 Prefix hinzugefügt - jetzt 65 Bytes');
                return prefixedArray;
            } else {
                this.log(`⚠️ Unerwartete Key-Länge: ${outputArray.length} Bytes`);
            }
            
            return outputArray;
            
        } catch (error) {
            this.log(`❌ Key-Konvertierung fehlgeschlagen: ${error.message}`);
            throw new Error(`VAPID Key Konvertierung fehlgeschlagen: ${error.message}`);
        }
    }

    // Integration mit Push Notification Banner
    async prepareForPushNotifications() {
        this.log('🔔 Bereite Push Notifications vor...');
        
        try {
            // Bestehende Registration prüfen
            let registration = await navigator.serviceWorker.getRegistration();
            
            if (!registration) {
                this.log('📝 Keine Registration - starte Neuregistrierung...');
                registration = await this.registerServiceWorker();
            } else {
                this.log('✅ Registration gefunden');
                this.log(`📂 Scope: ${registration.scope}`);
            }

            // Finale Validierung
            const finalCheck = await navigator.serviceWorker.getRegistration();
            if (!finalCheck) {
                throw new Error('Keine Service Worker Registration nach Vorbereitung');
            }

            this.log('✅ Service Worker bereit für Push Notifications');
            return finalCheck;

        } catch (error) {
            this.log(`❌ Push Vorbereitung fehlgeschlagen: ${error.message}`);
            throw error;
        }
    }

    async registerServiceWorker() {
        this.log('📝 Registriere Service Worker...');
        
        try {
            // Service Worker Datei prüfen (ROOT SCOPE)
            const response = await fetch('/sw.js');
            if (!response.ok) {
                throw new Error(`sw.js nicht erreichbar: ${response.status}`);
            }
            this.log('✅ sw.js Datei gefunden (Root)');

            // Registrierung OHNE Scope = automatisch Root-Scope
            const registration = await navigator.serviceWorker.register('/sw.js');
            this.log('✅ Service Worker registriert');
            this.log(`📂 Scope: ${registration.scope}`);

            // Validierung
            const check = await navigator.serviceWorker.getRegistration();
            if (!check) {
                throw new Error('Registration nicht persistent');
            }
            this.log('✅ Registration validiert');

            return registration;

        } catch (error) {
            this.log(`❌ Registrierung fehlgeschlagen: ${error.message}`);
            throw error;
        }
    }
}

// Global verfügbar machen
window.ServiceWorkerDebugger = ServiceWorkerDebugger;

// Auto-Start für Admin
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Service Worker Debug Script geladen');
    console.log('🔧 userRole:', window.userRole);
    console.log('🔧 userRole Admin Check:', window.userRole === 'admin');
    
    // Nur für Admin-Benutzer
    if (window.userRole === 'admin') {
        console.log('✅ Admin erkannt - starte Debug Interface');
        
        // NEUER SICHTBARER DEBUG BANNER
        createVisibleDebugBanner();
        
        const swDebugger = new ServiceWorkerDebugger();
        swDebugger.createDebugInterface();
        swDebugger.log('🚀 Service Worker Debugger gestartet für Admin');
        swDebugger.log(`🔧 User Agent: ${navigator.userAgent.substring(0, 50)}...`);
        
        // Global verfügbar machen
        window.swDebugger = swDebugger;
        
        // Nach 2 Sekunden automatischen Test starten
        setTimeout(() => {
            swDebugger.log('🔧 Starte automatischen Service Worker Test...');
            swDebugger.testServiceWorker();
        }, 2000);
    } else {
        console.log('⚠️ Kein Admin - Debug Interface nicht gestartet');
        console.log('⚠️ Aktueller userRole:', window.userRole);
    }
});

// SICHTBARER DEBUG BANNER FUNKTION
function createVisibleDebugBanner() {
    // Entferne alten Banner
    const oldBanner = document.getElementById('visible-push-debug');
    if (oldBanner) oldBanner.remove();

    // Erstelle sichtbaren Debug Banner (oben)
    const banner = document.createElement('div');
    banner.id = 'visible-push-debug';
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
        border-bottom: 3px solid #0f0;
    `;

    banner.innerHTML = `
        <div style="text-align: center; margin-bottom: 10px; background: #111; padding: 5px; border-radius: 4px;">
            <strong style="color: #ff0;">🔔 PUSH NOTIFICATION DEBUGGER 🔔</strong><br>
            <button id="visible-push-test" style="background: #0066cc; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 2px; font-weight: bold;">🔔 PUSH TEST</button>
            <button id="visible-debug-clear" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 2px;">Clear</button>
            <button id="visible-debug-close" style="background: #c00; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 2px;">Close</button>
        </div>
        <div id="visible-debug-log" style="white-space: pre-wrap; word-break: break-all; color: #0f0; background: #111; padding: 8px; border-radius: 4px; min-height: 100px;"></div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);
    document.body.style.paddingTop = banner.offsetHeight + 'px';

    // Event Listeners
    document.getElementById('visible-push-test').addEventListener('click', () => {
        visiblePushTest();
    });

    document.getElementById('visible-debug-clear').addEventListener('click', () => {
        document.getElementById('visible-debug-log').textContent = '';
    });

    document.getElementById('visible-debug-close').addEventListener('click', () => {
        banner.remove();
        document.body.style.paddingTop = '0';
    });

    // Initial Log
    const logContainer = document.getElementById('visible-debug-log');
    logContainer.textContent = `[${new Date().toLocaleTimeString()}] 🚀 Sichtbarer Push Debugger gestartet\n`;
    logContainer.textContent += `[${new Date().toLocaleTimeString()}] 👤 User Role: ${window.userRole}\n`;
    logContainer.textContent += `[${new Date().toLocaleTimeString()}] 📱 User Agent: ${navigator.userAgent.substring(0, 60)}...\n`;
}

// SICHTBARE PUSH TEST FUNKTION
async function visiblePushTest() {
    const logContainer = document.getElementById('visible-debug-log');
    
    function vlog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(message);
        logContainer.textContent += logMessage;
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    vlog('🔔 === PUSH TEST START ===');
    
    try {
        // 1. Permission prüfen
        vlog(`🔔 Notification.permission: ${Notification.permission}`);
        
        if (Notification.permission === 'default') {
            vlog('🔔 Fordere Berechtigung an...');
            const permission = await Notification.requestPermission();
            vlog(`🔔 Berechtigung erhalten: ${permission}`);
            if (permission !== 'granted') {
                throw new Error(`Berechtigung verweigert: ${permission}`);
            }
        } else if (Notification.permission === 'denied') {
            throw new Error('Benachrichtigungen sind blockiert');
        }

        // 2. Service Worker
        vlog('🔔 Service Worker prüfen...');
        let registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration) {
            vlog('📝 Registriere Service Worker...');
            registration = await navigator.serviceWorker.register('/sw.js');
            vlog('✅ Service Worker registriert');
        } else {
            vlog('✅ Service Worker gefunden');
        }

        // WICHTIG: Warten bis Service Worker aktiv ist
        vlog('⏳ Warte auf aktiven Service Worker...');
        
        if (registration.installing) {
            vlog('📦 Service Worker wird installiert...');
            await new Promise(resolve => {
                registration.installing.addEventListener('statechange', function() {
                    if (this.state === 'installed') {
                        vlog('✅ Service Worker installiert');
                        resolve();
                    }
                });
            });
        }

        if (registration.waiting) {
            vlog('⏳ Service Worker wartet...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            await new Promise(resolve => {
                registration.addEventListener('controllerchange', () => {
                    vlog('✅ Service Worker Controller gewechselt');
                    resolve();
                });
            });
        }

        // Finale Überprüfung: Service Worker ready
        vlog('🔍 Warte auf Service Worker Ready...');
        await navigator.serviceWorker.ready;
        
        // iOS Safari spezielle Behandlung
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (isIOS) {
            vlog('📱 iOS erkannt - zusätzliche Wartezeit...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Finale Validierung
        const finalRegistration = await navigator.serviceWorker.getRegistration();
        if (!finalRegistration || !finalRegistration.active) {
            throw new Error('Service Worker nicht aktiv nach Vorbereitung');
        }
        
        vlog('✅ Service Worker ist AKTIV und bereit');
        vlog(`📂 Scope: ${finalRegistration.scope}`);
        vlog(`🔧 State: ${finalRegistration.active.state}`);
        
        // Update registration variable
        registration = finalRegistration;

        // 3. VAPID Key laden
        vlog('🔑 VAPID Key laden...');
        const response = await fetch('/api/push/vapid-key');
        
        if (!response.ok) {
            const errorText = await response.text();
            vlog(`❌ VAPID Fehler: ${response.status} - ${errorText}`);
            throw new Error(`VAPID Error: ${response.status}`);
        }
        
        const data = await response.json();
        vlog(`🔑 VAPID Key erhalten: ${data.publicKey.substring(0, 30)}...`);
        vlog(`🔑 Key Länge: ${data.publicKey.length} Zeichen`);

        // 4. Key konvertieren
        vlog('🔧 Key konvertieren...');
        const applicationServerKey = visibleUrlBase64ToUint8Array(data.publicKey, vlog);
        vlog(`🔧 Konvertiert zu ${applicationServerKey.length} Bytes`);
        vlog(`🔧 Erste 8 Bytes: [${Array.from(applicationServerKey.slice(0, 8)).join(', ')}]`);

        // 5. Subscription erstellen
        vlog('📧 Push Subscription erstellen...');
        
        try {
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            
            vlog('✅ SUBSCRIPTION ERFOLGREICH!');
            vlog(`📧 Endpoint: ${subscription.endpoint.substring(0, 60)}...`);
            
        } catch (subError) {
            vlog(`❌ Subscription Fehler: ${subError.name}`);
            vlog(`❌ Details: ${subError.message}`);
            throw subError;
        }

    } catch (error) {
        vlog(`❌ TEST FEHLGESCHLAGEN: ${error.message}`);
    }
    
    vlog('🔔 === PUSH TEST ENDE ===');
}

// SICHTBARE KEY KONVERTIERUNG
function visibleUrlBase64ToUint8Array(base64String, vlog) {
    try {
        const cleanBase64 = base64String.trim().replace(/\s/g, '');
        vlog(`🔧 Bereinigte Key-Länge: ${cleanBase64.length}`);
        
        const padding = '='.repeat((4 - cleanBase64.length % 4) % 4);
        const paddedBase64 = cleanBase64 + padding;
        vlog(`🔧 Padding hinzugefügt: ${padding.length} Zeichen`);
        
        const base64 = paddedBase64.replace(/-/g, '+').replace(/_/g, '/');
        vlog('🔧 Base64URL -> Base64 konvertiert');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        vlog(`🔧 Dekodiert: ${outputArray.length} Bytes`);
        
        if (outputArray.length === 64) {
            vlog('🔧 64-Byte Key erkannt, füge 0x04 Prefix hinzu...');
            const prefixedArray = new Uint8Array(65);
            prefixedArray[0] = 0x04;
            prefixedArray.set(outputArray, 1);
            vlog('✅ 0x04 Prefix hinzugefügt - jetzt 65 Bytes');
            return prefixedArray;
        } else if (outputArray.length === 65 && outputArray[0] === 0x04) {
            vlog('✅ Bereits korrekte P-256 uncompressed key');
            return outputArray;
        } else {
            vlog(`⚠️ Unerwartete Länge: ${outputArray.length} Bytes`);
            return outputArray;
        }
        
    } catch (error) {
        vlog(`❌ Konvertierung fehlgeschlagen: ${error.message}`);
        throw error;
    }
}
