/**
 * PWA Installation Manager
 * Verwaltet die Installation der Progressive Web App
 */

class PWAInstallManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstallable = false;
        this.isInstalled = false;
        
        this.init();
    }
    
    init() {
        // Check if already installed
        this.checkInstallStatus();
        
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('🎯 PWA: beforeinstallprompt event empfangen');
            
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            
            // Save the event so it can be triggered later
            this.deferredPrompt = e;
            this.isInstallable = true;
            
            // Update UI
            this.updateInstallUI();
            
            // Debug-Info
            console.log('💾 PWA: Install Prompt gespeichert, Button wird angezeigt');
        });
        
        // Listen for successful installation
        window.addEventListener('appinstalled', (e) => {
            console.log('✅ PWA: App wurde erfolgreich installiert');
            this.isInstalled = true;
            this.isInstallable = false;
            this.deferredPrompt = null;
            this.updateInstallUI();
            
            // Show success message
            this.showInstallMessage('✅ App erfolgreich installiert!', 'success');
        });
        
        // Force check for installability after a delay (Chrome-Workaround)
        setTimeout(() => {
            this.forceInstallabilityCheck();
        }, 2000);
        
        // Check for iOS Safari
        this.checkIOSInstall();
        
        // Update UI initially
        this.updateInstallUI();
    }
    
    /**
     * Force-Check für PWA Installierbarkeit (Chrome-Workaround)
     */
    forceInstallabilityCheck() {
        // Wenn kein beforeinstallprompt Event empfangen wurde
        if (!this.deferredPrompt && !this.isInstalled) {
            console.log('🔍 PWA: Forciere Installierbarkeits-Check...');
            
            // Check if all PWA criteria are met
            const hasManifest = document.querySelector('link[rel="manifest"]');
            const hasServiceWorker = 'serviceWorker' in navigator;
            const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
            
            console.log('📋 PWA Kriterien:', {
                manifest: !!hasManifest,
                serviceWorker: hasServiceWorker,
                https: isHTTPS,
                userAgent: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
            });
            
            // Fallback für Chrome - Button trotzdem anzeigen
            if (hasManifest && hasServiceWorker && isHTTPS && navigator.userAgent.includes('Chrome')) {
                console.log('⚠️ PWA: Chrome detected, showing install button anyway');
                this.isInstallable = true;
                this.updateInstallUI();
            }
        }
    }
    
    checkInstallStatus() {
        // Check if running in standalone mode
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('PWA: App läuft im Standalone-Modus');
        }
        
        // Check if launched from home screen (iOS)
        if (window.navigator.standalone === true) {
            this.isInstalled = true;
            console.log('PWA: App läuft von iOS Homescreen');
        }
    }
    
    checkIOSInstall() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isInStandaloneMode = ('standalone' in window.navigator) && window.navigator.standalone;
        
        console.log('PWA: iOS Check', { isIOS, isInStandaloneMode });
        
        if (isIOS && !isInStandaloneMode) {
            // Set installable for iOS devices
            this.isInstallable = true;
            console.log('PWA: iOS device detected - showing install option');
        }
        
        // Also check for other mobile browsers
        const isAndroid = /Android/.test(navigator.userAgent);
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        
        if ((isAndroid || isMobile) && !this.isInstalled) {
            // Make installable for mobile devices
            this.isInstallable = true;
            console.log('PWA: Mobile device detected - showing install option');
        }
    }
    
    async installPWA() {
        if (!this.deferredPrompt) {
            console.log('⚠️ PWA: Kein Install-Prompt verfügbar, zeige Browser-Anweisungen');
            this.showBrowserInstructions();
            return false;
        }
        
        try {
            console.log('🚀 PWA: Starte Installation...');
            
            // Show the install prompt
            await this.deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const result = await this.deferredPrompt.userChoice;
            
            console.log('👤 PWA: Benutzer-Entscheidung:', result.outcome);
            
            if (result.outcome === 'accepted') {
                console.log('✅ PWA: Installation akzeptiert');
                this.showInstallMessage('📱 App wird installiert...', 'info');
            } else {
                console.log('❌ PWA: Installation abgelehnt');
                this.showInstallMessage('ℹ️ Installation abgebrochen', 'warning');
            }
            
            // Reset the prompt
            this.deferredPrompt = null;
            this.isInstallable = false;
            this.updateInstallUI();
            
            return result.outcome === 'accepted';
            
        } catch (error) {
            console.error('❌ PWA Installation Error:', error);
            this.showInstallMessage('❌ Fehler bei der Installation', 'error');
            
            // Fallback: Show manual instructions
            this.showBrowserInstructions();
            return false;
        }
    }
    
    showIOSInstallPrompt() {
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) {
            installBtn.innerHTML = '📱 Zur Startseite hinzufügen';
            installBtn.onclick = () => this.showIOSInstructions();
            installBtn.style.display = 'inline-block';
        }
    }
    
    showIOSInstructions() {
        const instructions = `
            <div class="alert alert-info">
                <h6><i class="bi bi-phone me-2"></i>App installieren (iOS Safari)</h6>
                <ol class="mb-0">
                    <li>Tippe auf das <i class="bi bi-share"></i> Teilen-Symbol unten</li>
                    <li>Wähle "Zum Home-Bildschirm hinzufügen"</li>
                    <li>Bestätige mit "Hinzufügen"</li>
                </ol>
            </div>
        `;
        
        this.showInstallMessage(instructions, 'info', 8000);
    }
    
    updateInstallUI() {
        const installBtn = document.getElementById('pwaInstallBtn');
        const installStatus = document.getElementById('pwaInstallStatus');
        
        console.log('PWA: updateInstallUI called', {
            isInstalled: this.isInstalled,
            isInstallable: this.isInstallable,
            hasInstallBtn: !!installBtn,
            hasStatus: !!installStatus
        });
        
        if (installBtn) {
            if (this.isInstalled) {
                installBtn.style.display = 'none';
                console.log('PWA: Hiding install button - app already installed');
            } else if (this.isInstallable) {
                installBtn.innerHTML = '<i class="bi bi-phone me-1"></i><span class="d-none d-sm-inline">App installieren</span><span class="d-sm-none">App</span>';
                installBtn.onclick = () => this.installPWA();
                installBtn.className = 'btn btn-success btn-sm d-flex align-items-center';
                installBtn.style.display = 'inline-flex';
                console.log('PWA: Showing install button - installation available');
            } else {
                // Show install button anyway for manual instructions
                installBtn.innerHTML = '<i class="bi bi-phone me-1"></i><span class="d-none d-sm-inline">App installieren</span><span class="d-sm-none">App</span>';
                installBtn.onclick = () => this.showBrowserInstructions();
                installBtn.className = 'btn btn-outline-primary btn-sm d-flex align-items-center';
                installBtn.style.display = 'inline-flex';
                console.log('PWA: Showing manual install button');
            }
        } else {
            console.warn('PWA: Install button element not found (#pwaInstallBtn)');
        }
        
        if (installStatus) {
            if (this.isInstalled) {
                installStatus.innerHTML = '<i class="bi bi-check-circle text-success"></i> App installiert';
            } else if (this.isInstallable) {
                installStatus.innerHTML = '<i class="bi bi-download text-primary"></i> Installation verfügbar';
            } else {
                installStatus.innerHTML = '<i class="bi bi-info-circle text-muted"></i> Browser-App';
            }
        }
    }
    
    showBrowserInstructions() {
        console.log('PWA: Showing browser instructions');
        
        // Use the detailed install helper if available
        if (window.PWAInstallHelper) {
            PWAInstallHelper.show();
            return;
        }
        
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isEdge = /Edg/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        let instructions = '';
        
        if (isIOS && isSafari) {
            this.showIOSInstructions();
            return;
        } else if (isChrome || isEdge) {
            instructions = `
                <div class="alert alert-info">
                    <h6><i class="bi bi-browser-chrome me-2"></i>App installieren</h6>
                    <p class="mb-2">Klicke auf das <i class="bi bi-three-dots-vertical"></i> Menü und wähle:</p>
                    <p class="mb-0"><strong>"App installieren"</strong> oder <strong>"Hochzeitsplaner installieren"</strong></p>
                </div>
            `;
        } else if (isFirefox) {
            instructions = `
                <div class="alert alert-info">
                    <h6><i class="bi bi-browser-firefox me-2"></i>Lesezeichen erstellen</h6>
                    <p class="mb-0">Firefox: Erstelle ein Lesezeichen für schnellen Zugriff zur Hochzeitsplaner-App.</p>
                </div>
            `;
        } else {
            instructions = `
                <div class="alert alert-info">
                    <h6><i class="bi bi-bookmark me-2"></i>Lesezeichen erstellen</h6>
                    <p class="mb-0">Erstelle ein Lesezeichen für schnellen Zugriff auf die Hochzeitsplaner-App.</p>
                </div>
            `;
        }
        
        this.showInstallMessage(instructions, 'info', 6000);
    }
    
    showInstallMessage(message, type = 'info', duration = 4000) {
        // Use existing notification system if available
        if (typeof showDashboardToast === 'function') {
            showDashboardToast(message, type);
        } else if (typeof notificationSystem !== 'undefined') {
            notificationSystem.show(message, type, duration);
        } else {
            // Fallback: create temporary notification
            const notification = document.createElement('div');
            notification.className = `alert alert-${type} alert-dismissible fade show`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            notification.innerHTML = `
                ${message}
                <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remove after duration
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    }
}

// Global verfügbar machen
window.PWAInstallManager = PWAInstallManager;

// Auto-Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    window.pwaInstallManager = new PWAInstallManager();
    console.log('PWA Install Manager initialisiert');
});