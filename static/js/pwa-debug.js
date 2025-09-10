/**
 * PWA Debug Tool - Diagnose für PWA Installation Probleme
 */

class PWADebugger {
    constructor() {
        this.results = {};
        this.isChrome = navigator.userAgent.includes('Chrome');
        this.isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    }

    async diagnose() {
        console.group('🔍 PWA Installation Diagnose');
        
        this.results = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            checks: {}
        };

        // 1. Manifest Check
        this.results.checks.manifest = await this.checkManifest();
        
        // 2. Service Worker Check
        this.results.checks.serviceWorker = await this.checkServiceWorker();
        
        // 3. HTTPS Check
        this.results.checks.https = this.checkHTTPS();
        
        // 4. Icons Check
        this.results.checks.icons = await this.checkIcons();
        
        // 5. beforeinstallprompt Check
        this.results.checks.installPrompt = this.checkInstallPrompt();
        
        // 6. Display Mode Check
        this.results.checks.displayMode = this.checkDisplayMode();
        
        // 7. Browser Support Check
        this.results.checks.browserSupport = this.checkBrowserSupport();

        this.logResults();
        this.createDebugUI();
        
        console.groupEnd();
        return this.results;
    }

    async checkManifest() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            return { status: 'error', message: 'Kein Manifest-Link gefunden' };
        }

        try {
            const response = await fetch(manifestLink.href);
            if (!response.ok) {
                return { status: 'error', message: `Manifest laden fehlgeschlagen: ${response.status}` };
            }

            const manifest = await response.json();
            
            // Prüfe erforderliche Felder
            const required = ['name', 'short_name', 'start_url', 'display', 'icons'];
            const missing = required.filter(field => !manifest[field]);
            
            if (missing.length > 0) {
                return { 
                    status: 'warning', 
                    message: `Fehlende Manifest-Felder: ${missing.join(', ')}`,
                    manifest: manifest
                };
            }

            // Prüfe Icons
            const validIcons = manifest.icons?.filter(icon => 
                icon.sizes && icon.src && 
                (icon.sizes.includes('192x192') || icon.sizes.includes('512x512'))
            );

            if (!validIcons || validIcons.length < 2) {
                return {
                    status: 'warning',
                    message: 'Mindestens 192x192 und 512x512 Icons benötigt',
                    manifest: manifest
                };
            }

            return { 
                status: 'success', 
                message: 'Manifest ist vollständig',
                manifest: manifest
            };

        } catch (error) {
            return { status: 'error', message: `Manifest-Fehler: ${error.message}` };
        }
    }

    async checkServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return { status: 'error', message: 'Service Worker wird nicht unterstützt' };
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                return { status: 'error', message: 'Kein Service Worker registriert' };
            }

            return {
                status: 'success',
                message: 'Service Worker aktiv',
                scope: registration.scope,
                state: registration.active?.state
            };

        } catch (error) {
            return { status: 'error', message: `Service Worker Fehler: ${error.message}` };
        }
    }

    checkHTTPS() {
        const isSecure = window.location.protocol === 'https:' || this.isLocalhost;
        return {
            status: isSecure ? 'success' : 'error',
            message: isSecure ? 'HTTPS aktiv' : 'HTTPS erforderlich (außer localhost)',
            protocol: window.location.protocol,
            hostname: window.location.hostname
        };
    }

    async checkIcons() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            return { status: 'error', message: 'Kein Manifest für Icon-Check' };
        }

        try {
            const response = await fetch(manifestLink.href);
            const manifest = await response.json();
            
            if (!manifest.icons || manifest.icons.length === 0) {
                return { status: 'error', message: 'Keine Icons im Manifest' };
            }

            // Test Icon-Verfügbarkeit
            const iconChecks = await Promise.all(
                manifest.icons.slice(0, 3).map(async (icon) => {
                    try {
                        const iconResponse = await fetch(icon.src);
                        return {
                            src: icon.src,
                            sizes: icon.sizes,
                            available: iconResponse.ok
                        };
                    } catch {
                        return {
                            src: icon.src,
                            sizes: icon.sizes,
                            available: false
                        };
                    }
                })
            );

            const availableIcons = iconChecks.filter(icon => icon.available);
            
            return {
                status: availableIcons.length > 0 ? 'success' : 'error',
                message: `${availableIcons.length}/${iconChecks.length} Icons verfügbar`,
                icons: iconChecks
            };

        } catch (error) {
            return { status: 'error', message: `Icon-Check Fehler: ${error.message}` };
        }
    }

    checkInstallPrompt() {
        // Check if beforeinstallprompt was fired
        const pwaManager = window.pwaInstallManager;
        
        if (pwaManager && pwaManager.deferredPrompt) {
            return {
                status: 'success',
                message: 'Install Prompt verfügbar',
                hasPrompt: true
            };
        }

        if (pwaManager && pwaManager.isInstallable) {
            return {
                status: 'warning',
                message: 'Installierbar markiert, aber kein Prompt',
                hasPrompt: false
            };
        }

        return {
            status: 'warning',
            message: 'Kein Install Prompt empfangen',
            hasPrompt: false,
            tip: this.isChrome ? 'Chrome: Engagement-Score aufbauen' : 'Browser-spezifische Anforderungen prüfen'
        };
    }

    checkDisplayMode() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isIOSStandalone = window.navigator.standalone === true;

        return {
            status: isStandalone || isIOSStandalone ? 'info' : 'success',
            message: isStandalone || isIOSStandalone ? 'PWA läuft standalone' : 'PWA läuft im Browser',
            standalone: isStandalone || isIOSStandalone
        };
    }

    checkBrowserSupport() {
        const support = {
            serviceWorker: 'serviceWorker' in navigator,
            pushManager: 'PushManager' in window,
            notifications: 'Notification' in window,
            beforeInstallPrompt: 'BeforeInstallPromptEvent' in window
        };

        const supportedFeatures = Object.values(support).filter(Boolean).length;

        return {
            status: supportedFeatures >= 3 ? 'success' : 'warning',
            message: `${supportedFeatures}/4 PWA Features unterstützt`,
            features: support,
            browser: this.getBrowserInfo()
        };
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    logResults() {
        console.log('🌐 Browser:', this.getBrowserInfo());
        console.log('🔒 HTTPS:', this.results.checks.https.message);
        console.log('📄 Manifest:', this.results.checks.manifest.message);
        console.log('⚙️ Service Worker:', this.results.checks.serviceWorker.message);
        console.log('🎨 Icons:', this.results.checks.icons.message);
        console.log('📱 Install Prompt:', this.results.checks.installPrompt.message);
        console.log('🖥️ Display Mode:', this.results.checks.displayMode.message);
        console.log('🔧 Browser Support:', this.results.checks.browserSupport.message);
    }

    createDebugUI() {
        // Prüfe ob Debug-Interface bereits existiert
        if (document.getElementById('pwa-debug-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'pwa-debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10001;
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            border: 2px solid #d4af37;
        `;

        const statusIcons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };

        panel.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #d4af37;">📱 PWA Debug Panel</h4>
            <div style="margin-bottom: 10px;">
                <strong>Browser:</strong> ${this.getBrowserInfo()}<br>
                <strong>URL:</strong> ${this.isLocalhost ? 'localhost' : 'remote'}
            </div>
            ${Object.entries(this.results.checks).map(([key, check]) => `
                <div style="margin: 5px 0; padding: 5px; border-left: 3px solid ${
                    check.status === 'success' ? '#28a745' : 
                    check.status === 'warning' ? '#ffc107' : '#dc3545'
                };">
                    ${statusIcons[check.status]} <strong>${key}:</strong> ${check.message}
                    ${check.tip ? `<br><small style="color: #ffc107;">💡 ${check.tip}</small>` : ''}
                </div>
            `).join('')}
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="pwaDebugger.diagnose()" style="margin: 2px; padding: 5px 10px; background: #d4af37; border: none; border-radius: 4px; color: black;">🔄 Neu prüfen</button>
                <button onclick="document.getElementById('pwa-debug-panel').remove()" style="margin: 2px; padding: 5px 10px; background: #dc3545; border: none; border-radius: 4px; color: white;">❌ Schließen</button>
            </div>
        `;

        document.body.appendChild(panel);
    }
}

// Globale Instanz erstellen
window.pwaDebugger = new PWADebugger();

// Auto-Diagnose DEAKTIVIERT um Debug Button Duplikate zu vermeiden
// Diagnose jetzt nur noch über base.html Debug Button
console.log('🔧 PWA Auto-Diagnose deaktiviert - verwende base.html Debug Button');
