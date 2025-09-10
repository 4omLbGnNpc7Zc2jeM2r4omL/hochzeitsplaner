// Service Worker Debug für iOS Safari
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
        // Debug Container erstellen (unten rechts, klein)
        this.debugContainer = document.createElement('div');
        this.debugContainer.id = 'sw-debug-overlay';
        this.debugContainer.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 350px;
            max-height: 250px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            padding: 10px;
            border-radius: 8px;
            z-index: 8000;
            overflow-y: auto;
            border: 2px solid #00ff00;
            font-weight: bold;
        `;

        // Header mit Test-Buttons
        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #ffff00;">🔧 Service Worker Debug</span>
                <div>
                    <button id="sw-test-btn" style="
                        background: #007700; 
                        color: white; 
                        border: none; 
                        padding: 3px 6px; 
                        border-radius: 3px; 
                        font-size: 9px;
                        cursor: pointer;
                        margin-right: 4px;
                    ">Test SW</button>
                    <button id="sw-force-register-btn" style="
                        background: #770000; 
                        color: white; 
                        border: none; 
                        padding: 3px 6px; 
                        border-radius: 3px; 
                        font-size: 9px;
                        cursor: pointer;
                    ">Force Reg</button>
                </div>
            </div>
        `;
        this.debugContainer.appendChild(header);

        // Log Container
        const logContainer = document.createElement('div');
        logContainer.id = 'sw-log-content';
        logContainer.style.cssText = `
            max-height: 180px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-word;
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

    async forceServiceWorkerRegistration() {
        this.log('� Force Service Worker Registration startet...');
        
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
                // Kurz warten nach dem Löschen
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Service Worker Cache löschen
            this.log('🗑️ Lösche Service Worker Caches...');
            try {
                const cacheNames = await caches.keys();
                this.log(`🔍 Gefunden: ${cacheNames.length} Caches`);
                for (const cacheName of cacheNames) {
                    this.log(`🗑️ Lösche Cache: ${cacheName}`);
                    await caches.delete(cacheName);
                }
                if (cacheNames.length > 0) {
                    this.log('✅ Alle Caches gelöscht');
                }
            } catch (cacheError) {
                this.log(`⚠️ Cache löschen fehlgeschlagen: ${cacheError.message}`);
            }

            // Frische Registrierung
            this.log('🔄 Starte frische Service Worker Registrierung...');
            
            // Service Worker Datei neu laden (Cache busting)
            const timestamp = Date.now();
            const swUrl = `/static/sw.js?v=${timestamp}`;
            this.log(`📄 SW URL mit Cache Busting: ${swUrl}`);
            
            const response = await fetch(swUrl);
            if (!response.ok) {
                throw new Error(`Service Worker Datei nicht erreichbar: ${response.status}`);
            }
            this.log('✅ Service Worker Datei verfügbar');

            // Registrierung
            const registration = await navigator.serviceWorker.register(swUrl);
            this.log('✅ Frische Service Worker Registration erstellt');
            this.log(`📂 Scope: ${registration.scope}`);
            
            // Sofortige Validierung
            const check = await navigator.serviceWorker.getRegistration();
            if (check) {
                this.log('✅ Registration sofort verfügbar');
                this.log(`📋 State: installing=${!!check.installing}, waiting=${!!check.waiting}, active=${!!check.active}`);
            } else {
                this.log('❌ Registration nicht sofort verfügbar');
            }

            // Auf Aktivierung warten
            this.log('⏳ Warte auf Service Worker Aktivierung...');
            let attempts = 0;
            const maxAttempts = 30;
            
            while (attempts < maxAttempts) {
                const currentReg = await navigator.serviceWorker.getRegistration();
                if (currentReg && currentReg.active) {
                    this.log(`✅ Service Worker aktiv nach ${attempts} Versuchen`);
                    this.log(`📋 Final State: ${currentReg.active.state}`);
                    break;
                }
                
                attempts++;
                this.log(`⏳ Versuch ${attempts}/${maxAttempts} - warte 1 Sekunde...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (attempts >= maxAttempts) {
                this.log('⚠️ Service Worker Aktivierung Timeout - aber Registration existiert');
            }

            this.log('🎉 Force Registration abgeschlossen');

        } catch (error) {
            this.log(`❌ Force Registration fehlgeschlagen: ${error.message}`);
            this.log(`🔧 Error Stack: ${error.stack || 'Kein Stack verfügbar'}`);
        }
    }

    updateDebugDisplay() {
        const logContent = document.getElementById('sw-log-content');
        if (logContent) {
            // Nur letzte 15 Einträge anzeigen
            const recentLogs = this.logEntries.slice(-15);
            logContent.textContent = recentLogs.join('\n');
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    async testServiceWorker() {
        this.log('🔍 Service Worker Test startet...');
        
        try {
            // 1. Service Worker Support prüfen
            if (!('serviceWorker' in navigator)) {
                this.log('❌ Service Worker nicht unterstützt');
                return;
            }
            this.log('✅ Service Worker API verfügbar');

            // 2. Aktuelle Registration prüfen
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                this.log('✅ Service Worker bereits registriert');
                this.log(`📂 Scope: ${registration.scope}`);
                
                if (registration.active) {
                    this.log(`📋 Aktiver SW Status: ${registration.active.state}`);
                    this.log(`📄 SW Script: ${registration.active.scriptURL}`);
                } else if (registration.installing) {
                    this.log('⏳ Service Worker wird installiert...');
                    this.log('💡 Warte auf Aktivierung...');
                    
                    // Auf Aktivierung warten
                    await new Promise((resolve) => {
                        const checkState = () => {
                            if (registration.active) {
                                this.log('✅ Service Worker aktiviert');
                                resolve();
                            } else {
                                setTimeout(checkState, 500);
                            }
                        };
                        checkState();
                        
                        // Timeout nach 10 Sekunden
                        setTimeout(resolve, 10000);
                    });
                } else if (registration.waiting) {
                    this.log('⚠️ Service Worker wartet auf Aktivierung');
                    this.log('🔄 Versuche Skip Waiting...');
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    
                    // Auf Aktivierung warten
                    await new Promise((resolve) => {
                        registration.waiting.addEventListener('statechange', (event) => {
                            if (event.target.state === 'activated') {
                                this.log('✅ Service Worker aktiviert nach Skip Waiting');
                                resolve();
                            }
                        });
                        setTimeout(resolve, 5000);
                    });
                } else {
                    this.log('❌ Service Worker in unbekanntem Zustand');
                }
            } else {
                this.log('⚠️ Kein Service Worker registriert');
                this.log('🔄 Versuche Registrierung...');
                await this.registerServiceWorker();
            }

            // 3. Service Worker Ready warten (iOS Safari Bug Workaround)
            this.log('⏳ Prüfe Service Worker Ready Status...');
            
            // iOS Safari hat einen Bug mit serviceWorker.ready - verwende alternative Methode
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
            let readyRegistration = null;
            
            if (isIOS) {
                this.log('🍎 iOS erkannt - verwende Workaround für serviceWorker.ready Bug');
                
                // Direkte Validierung ohne serviceWorker.ready
                const currentReg = await navigator.serviceWorker.getRegistration();
                if (currentReg && currentReg.active) {
                    readyRegistration = currentReg;
                    this.log('✅ Service Worker direkt als aktiv erkannt');
                } else if (currentReg && (currentReg.installing || currentReg.waiting)) {
                    // Warte kurz auf Aktivierung
                    this.log('⏳ Warte 3 Sekunden auf Service Worker Aktivierung...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    readyRegistration = await navigator.serviceWorker.getRegistration();
                    this.log(`📋 Status nach Warten: ${readyRegistration ? readyRegistration.active ? 'aktiv' : 'nicht aktiv' : 'keine Registration'}`);
                } else {
                    this.log('⚠️ Service Worker nicht verfügbar');
                }
            } else {
                // Normale serviceWorker.ready für andere Browser
                readyRegistration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((resolve) => {
                        setTimeout(() => {
                            this.log('⚠️ Service Worker Ready Timeout');
                            resolve(null);
                        }, 15000)
                    })
                ]);
            }
            
            if (readyRegistration) {
                this.log('✅ Service Worker bereit');
                
                // 4. Push Manager prüfen
                if (readyRegistration.pushManager) {
                    this.log('✅ Push Manager verfügbar');
                    
                    // Permission Status prüfen
                    try {
                        const permission = await navigator.permissions.query({name: 'notifications'});
                        this.log(`🔔 Notification Permission: ${permission.state}`);
                    } catch (permError) {
                        this.log(`⚠️ Permission Query Fehler: ${permError.message}`);
                        this.log(`🔔 Direct Notification Permission: ${Notification.permission}`);
                    }
                    
                    // Bestehende Subscription prüfen
                    try {
                        const subscription = await readyRegistration.pushManager.getSubscription();
                        if (subscription) {
                            this.log('✅ Push Subscription bereits vorhanden');
                            this.log(`🔑 Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
                        } else {
                            this.log('⚠️ Keine Push Subscription vorhanden');
                        }
                    } catch (subError) {
                        this.log(`❌ Subscription Check Fehler: ${subError.message}`);
                    }
                } else {
                    this.log('❌ Push Manager nicht verfügbar');
                }
            } else {
                this.log('❌ Service Worker Ready fehlgeschlagen');
            }

            // 5. Final Status
            const finalRegistration = await navigator.serviceWorker.getRegistration();
            if (finalRegistration && finalRegistration.active) {
                this.log('🎉 Service Worker Test erfolgreich abgeschlossen');
                this.log(`📋 Final Status: ${finalRegistration.active.state}`);
            } else {
                this.log('❌ Service Worker Test fehlgeschlagen - nicht aktiv');
                if (finalRegistration) {
                    this.log(`📋 Registration State: installing=${!!finalRegistration.installing}, waiting=${!!finalRegistration.waiting}, active=${!!finalRegistration.active}`);
                }
            }

        } catch (error) {
            this.log(`❌ Service Worker Test Fehler: ${error.message}`);
            console.error('Service Worker Test Error:', error);
        }
    }

    async registerServiceWorker() {
        this.log('📝 Registriere Service Worker...');
        
        try {
            // Service Worker Datei zuerst prüfen
            const response = await fetch('/static/sw.js');
            if (!response.ok) {
                throw new Error(`sw.js nicht erreichbar: ${response.status}`);
            }
            this.log('✅ sw.js Datei gefunden');

            // Service Worker registrieren (ohne Scope für maximale Kompatibilität)
            this.log('🔄 Starte Service Worker Registrierung...');
            const registration = await navigator.serviceWorker.register('/static/sw.js');
            this.log('✅ Service Worker registriert');
            this.log(`📂 Scope: ${registration.scope}`);
            this.log(`📋 Registration ID: ${registration.scope}`);

            // WICHTIG: Registration sofort speichern und validieren
            this.log('🔍 Validiere Registration sofort...');
            const immediateCheck = await navigator.serviceWorker.getRegistration();
            if (!immediateCheck) {
                this.log('❌ FEHLER: Registration nicht sofort verfügbar!');
                throw new Error('Service Worker Registration nicht persistent');
            }
            this.log('✅ Registration sofort verfügbar');

            // Service Worker State detailliert überwachen
            this.log(`📋 Initial State: installing=${!!registration.installing}, waiting=${!!registration.waiting}, active=${!!registration.active}`);

            // Auf Aktivierung warten - VEREINFACHT für iOS
            return new Promise((resolve, reject) => {
                const maxWaitTime = 30000; // 30 Sekunden
                const startTime = Date.now();
                
                const checkActivation = async () => {
                    try {
                        const currentReg = await navigator.serviceWorker.getRegistration();
                        if (!currentReg) {
                            this.log('❌ Registration verschwunden während Aktivierung!');
                            reject(new Error('Registration lost during activation'));
                            return;
                        }

                        const elapsed = Date.now() - startTime;
                        this.log(`� Check nach ${elapsed}ms: installing=${!!currentReg.installing}, waiting=${!!currentReg.waiting}, active=${!!currentReg.active}`);

                        if (currentReg.active) {
                            this.log(`✅ Service Worker aktiv: ${currentReg.active.state}`);
                            resolve(currentReg);
                            return;
                        }

                        if (elapsed > maxWaitTime) {
                            this.log('⚠️ Aktivierung Timeout - verwende Registration trotzdem');
                            resolve(currentReg);
                            return;
                        }

                        // Weiter warten
                        setTimeout(checkActivation, 1000);

                    } catch (error) {
                        this.log(`❌ Fehler bei Aktivierung Check: ${error.message}`);
                        reject(error);
                    }
                };

                // State Change Listener für besseres Debugging
                if (registration.installing) {
                    this.log('⏳ Service Worker installiert sich...');
                    registration.installing.addEventListener('statechange', (event) => {
                        const sw = event.target;
                        this.log(`� SW Installing State Change: ${sw.state}`);
                    });
                }

                if (registration.waiting) {
                    this.log('⚠️ Service Worker wartet - versuche Skip Waiting');
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    registration.waiting.addEventListener('statechange', (event) => {
                        const sw = event.target;
                        this.log(`📋 SW Waiting State Change: ${sw.state}`);
                    });
                }

                // Update Listener
                registration.addEventListener('updatefound', () => {
                    this.log('🔄 Service Worker Update gefunden');
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', (event) => {
                            const sw = event.target;
                            this.log(`📋 New SW State: ${sw.state}`);
                        });
                    }
                });

                // Starte Check
                checkActivation();
            });

        } catch (error) {
            this.log(`❌ Service Worker Registrierung fehlgeschlagen: ${error.message}`);
            this.log(`🔧 Fehler Details: ${error.stack || 'Kein Stack verfügbar'}`);
            throw error;
        }
    }

    // Integration mit Push Notification Banner
    async prepareForPushNotifications() {
        this.log('🔔 Bereite Push Notifications vor...');
        
        try {
            // Schritt 1: Bestehende Registration prüfen
            this.log('🔍 Prüfe bestehende Service Worker Registration...');
            let registration = await navigator.serviceWorker.getRegistration();
            
            if (registration) {
                this.log('✅ Bestehende Registration gefunden');
                this.log(`📂 Scope: ${registration.scope}`);
                this.log(`📋 State: installing=${!!registration.installing}, waiting=${!!registration.waiting}, active=${!!registration.active}`);
                
                // Prüfe ob Service Worker funktionsfähig ist
                if (registration.active) {
                    this.log('✅ Service Worker bereits aktiv');
                } else if (registration.installing) {
                    this.log('⏳ Service Worker installiert sich noch - warte kurz...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    registration = await navigator.serviceWorker.getRegistration();
                } else if (registration.waiting) {
                    this.log('⚠️ Service Worker wartet - aktiviere...');
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    registration = await navigator.serviceWorker.getRegistration();
                } else {
                    this.log('❌ Service Worker Registration ohne Worker - Neuregistrierung erforderlich');
                    registration = null;
                }
            }
            
            // Schritt 2: Neuregistrierung falls nötig
            if (!registration) {
                this.log('📝 Keine Registration gefunden - registriere neu...');
                try {
                    registration = await this.registerServiceWorker();
                    this.log('✅ Neuregistrierung erfolgreich');
                } catch (regError) {
                    this.log(`❌ Neuregistrierung fehlgeschlagen: ${regError.message}`);
                    throw regError;
                }
            }

            // Schritt 3: Finale Validierung
            this.log('🔍 Finale Registration Validierung...');
            const finalCheck = await navigator.serviceWorker.getRegistration();
            
            if (!finalCheck) {
                this.log('❌ KRITISCHER FEHLER: Keine Registration nach Vorbereitung!');
                this.log('🔧 Debugging Info:');
                this.log(`   - navigator.serviceWorker verfügbar: ${'serviceWorker' in navigator}`);
                this.log(`   - Secure Context: ${isSecureContext}`);
                this.log(`   - URL: ${window.location.href}`);
                
                throw new Error('Keine Service Worker Registration nach Vorbereitung');
            }

            this.log('✅ Registration erfolgreich validiert');
            this.log(`📂 Final Scope: ${finalCheck.scope}`);
            this.log(`📋 Final State: ${finalCheck.active ? finalCheck.active.state : 'Kein aktiver SW'}`);

            // Schritt 4: Push Manager Validierung
            if (finalCheck.pushManager) {
                this.log('✅ Push Manager verfügbar');
            } else {
                this.log('❌ Push Manager nicht verfügbar');
                throw new Error('Push Manager nicht verfügbar in Service Worker Registration');
            }

            this.log('🎉 Service Worker erfolgreich für Push Notifications vorbereitet');
            return finalCheck;

        } catch (error) {
            this.log(`❌ Push Notification Vorbereitung fehlgeschlagen: ${error.message}`);
            this.log(`🔧 Error Stack: ${error.stack || 'Kein Stack verfügbar'}`);
            
            // Zusätzliche Debugging Info bei Fehlern
            this.log('� System Debugging Info:');
            this.log(`   - User Agent: ${navigator.userAgent}`);
            this.log(`   - Service Worker Support: ${'serviceWorker' in navigator}`);
            this.log(`   - Push Manager Support: ${'PushManager' in window}`);
            this.log(`   - Notification Support: ${'Notification' in window}`);
            this.log(`   - Secure Context: ${isSecureContext}`);
            
            throw error;
        }
    }
}

// Global verfügbar machen
window.ServiceWorkerDebugger = ServiceWorkerDebugger;

// Auto-Start für Admin
document.addEventListener('DOMContentLoaded', () => {
    // Nur für Admin-Benutzer
    if (window.userRole === 'admin') {
        const swDebugger = new ServiceWorkerDebugger();
        swDebugger.createDebugInterface();
        
        // Global verfügbar machen
        window.swDebugger = swDebugger;
        
        // Nach 2 Sekunden automatischen Test starten
        setTimeout(() => {
            swDebugger.testServiceWorker();
        }, 2000);
    }
});
