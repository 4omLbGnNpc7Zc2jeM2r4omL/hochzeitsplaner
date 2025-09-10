/**
 * PWA Installation Helper
 * Zeigt detaillierte Anweisungen für verschiedene Browser
 */

class PWAInstallHelper {
    static show() {
        const modal = this.createModal();
        document.body.appendChild(modal);
        
        // Bootstrap Modal anzeigen
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Modal nach dem Schließen entfernen
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }
    
    static createModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'pwaInstallModal';
        modal.setAttribute('tabindex', '-1');
        
        const { browser, os, instructions } = this.detectBrowserAndInstructions();
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header border-0">
                        <h5 class="modal-title">
                            <i class="bi bi-phone text-primary me-2"></i>
                            App installieren
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <img src="/static/icons/icon-128x128.png" alt="App Icon" class="mb-3" style="width: 80px;">
                            <h6 class="text-muted">Hochzeitsplaner als App auf ${os} installieren</h6>
                        </div>
                        
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            <strong>Warum installieren?</strong><br>
                            • Schnellerer Zugriff vom Homescreen<br>
                            • Funktioniert auch offline<br>
                            • App-ähnliche Bedienung ohne Browser-Leiste
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <i class="bi bi-${this.getBrowserIcon(browser)} me-2"></i>
                                Anleitung für ${browser}
                            </div>
                            <div class="card-body">
                                ${instructions}
                            </div>
                        </div>
                        
                        <div class="mt-3">
                            <small class="text-muted">
                                <i class="bi bi-shield-check me-1"></i>
                                Die Installation erfolgt sicher über Ihren Browser. Keine zusätzlichen Downloads erforderlich.
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Später
                        </button>
                        <button type="button" class="btn btn-primary" onclick="PWAInstallHelper.closeAndTryInstall()">
                            <i class="bi bi-download me-1"></i>
                            Installieren
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }
    
    static detectBrowserAndInstructions() {
        const userAgent = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);
        const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent);
        const isEdge = /Edg/.test(userAgent);
        const isFirefox = /Firefox/.test(userAgent);
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
        
        let browser = 'Browser';
        let os = 'Ihrem Gerät';
        let instructions = '';
        
        if (isIOS) {
            os = 'iOS';
            if (isSafari) {
                browser = 'Safari';
                instructions = `
                    <ol class="mb-0">
                        <li class="mb-2">
                            <i class="bi bi-share text-primary me-2"></i>
                            Tippen Sie auf das <strong>Teilen-Symbol</strong> unten in der Browser-Leiste
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-plus-square text-success me-2"></i>
                            Wählen Sie <strong>"Zum Home-Bildschirm hinzufügen"</strong>
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-check-circle text-primary me-2"></i>
                            Bestätigen Sie mit <strong>"Hinzufügen"</strong>
                        </li>
                        <li>
                            <i class="bi bi-phone text-warning me-2"></i>
                            Die App erscheint nun auf Ihrem Homescreen
                        </li>
                    </ol>
                `;
            } else {
                browser = 'iOS Browser';
                instructions = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Für die beste Installation öffnen Sie diese Seite in <strong>Safari</strong>.
                    </div>
                `;
            }
        } else if (isAndroid) {
            os = 'Android';
            if (isChrome) {
                browser = 'Chrome';
                instructions = `
                    <ol class="mb-0">
                        <li class="mb-2">
                            <i class="bi bi-three-dots-vertical text-primary me-2"></i>
                            Tippen Sie auf das <strong>Menü</strong> (⋮) rechts oben
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-plus-square text-success me-2"></i>
                            Wählen Sie <strong>"App installieren"</strong> oder <strong>"Zum Startbildschirm hinzufügen"</strong>
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-check-circle text-primary me-2"></i>
                            Bestätigen Sie mit <strong>"Installieren"</strong>
                        </li>
                        <li>
                            <i class="bi bi-phone text-warning me-2"></i>
                            Die App wird auf Ihrem Homescreen installiert
                        </li>
                    </ol>
                `;
            } else {
                browser = 'Android Browser';
                instructions = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Für die beste Installation öffnen Sie diese Seite in <strong>Chrome</strong>.
                    </div>
                `;
            }
        } else {
            // Desktop
            os = 'Computer';
            if (isChrome) {
                browser = 'Chrome';
                instructions = `
                    <ol class="mb-0">
                        <li class="mb-2">
                            <i class="bi bi-download text-primary me-2"></i>
                            Klicken Sie auf das <strong>Download-Symbol</strong> in der Adressleiste
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-check-circle text-success me-2"></i>
                            Oder klicken Sie rechts unten auf <strong>"Installieren"</strong>
                        </li>
                        <li>
                            <i class="bi bi-window text-warning me-2"></i>
                            Die App wird als eigenständiges Fenster geöffnet
                        </li>
                    </ol>
                `;
            } else if (isEdge) {
                browser = 'Edge';
                instructions = `
                    <ol class="mb-0">
                        <li class="mb-2">
                            <i class="bi bi-download text-primary me-2"></i>
                            Klicken Sie auf das <strong>App-Symbol</strong> in der Adressleiste
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-check-circle text-success me-2"></i>
                            Wählen Sie <strong>"Diese App installieren"</strong>
                        </li>
                        <li>
                            <i class="bi bi-window text-warning me-2"></i>
                            Die App wird im Startmenü hinzugefügt
                        </li>
                    </ol>
                `;
            } else {
                instructions = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        Ihr Browser unterstützt möglicherweise keine App-Installation.
                        Versuchen Sie es mit <strong>Chrome</strong> oder <strong>Edge</strong>.
                    </div>
                `;
            }
        }
        
        return { browser, os, instructions };
    }
    
    static getBrowserIcon(browser) {
        const icons = {
            'Chrome': 'google',
            'Safari': 'apple',
            'Edge': 'microsoft',
            'Firefox': 'fire'
        };
        return icons[browser] || 'browser-chrome';
    }
    
    static closeAndTryInstall() {
        // Modal schließen
        const modal = bootstrap.Modal.getInstance(document.getElementById('pwaInstallModal'));
        modal.hide();
        
        // Versuche automatische Installation
        if (window.pwaManager && window.pwaManager.deferredPrompt) {
            window.pwaManager.installPWA();
        }
    }
}

// Global verfügbar machen
window.PWAInstallHelper = PWAInstallHelper;
