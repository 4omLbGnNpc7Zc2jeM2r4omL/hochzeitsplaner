/**
 * PWA Install Manager
 * Verwaltet die Installation und das Verhalten der Progressive Web App
 */

class PWAInstallManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.installBanner = null;
        
        this.init();
    }

    init() {
        // Check if app is already installed
        this.checkInstallStatus();
        
        // Register event listeners
        this.registerEventListeners();
        
        // Initialize install banner
        this.initInstallBanner();
    }

    checkInstallStatus() {
        // Check if running in standalone mode (installed as PWA)
        this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
        
        console.log('PWA installed:', this.isInstalled);
    }

    registerEventListeners() {
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBanner();
        });

        // Listen for app installed
        window.addEventListener('appinstalled', (e) => {
            console.log('PWA was installed');
            this.isInstalled = true;
            this.hideInstallBanner();
            this.deferredPrompt = null;
            
            // Show success message
            this.showInstallSuccessMessage();
        });

        // Listen for media query changes (install status)
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
            this.isInstalled = e.matches;
            if (this.isInstalled) {
                this.hideInstallBanner();
            }
        });
    }

    initInstallBanner() {
        this.installBanner = document.getElementById('pwaInstallBanner');
        
        // Hide banner if already installed
        if (this.isInstalled && this.installBanner) {
            this.installBanner.style.display = 'none';
        }

        // Check if user has previously dismissed the banner
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedTime = new Date(dismissed);
            const now = new Date();
            const daysSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60 * 24);
            
            // Show banner again after 7 days
            if (daysSinceDismissed < 7 && this.installBanner) {
                this.installBanner.style.display = 'none';
            }
        }
    }

    showInstallBanner() {
        if (this.isInstalled || !this.installBanner) return;
        
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedTime = new Date(dismissed);
            const now = new Date();
            const daysSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60 * 24);
            
            if (daysSinceDismissed < 7) return;
        }

        setTimeout(() => {
            if (this.installBanner) {
                this.installBanner.classList.add('show');
            }
        }, 3000); // Show after 3 seconds
    }

    hideInstallBanner() {
        if (this.installBanner) {
            this.installBanner.classList.remove('show');
            setTimeout(() => {
                if (this.installBanner) {
                    this.installBanner.style.display = 'none';
                }
            }, 300);
        }
    }

    async installPWA() {
        if (!this.deferredPrompt) {
            // Fallback for iOS Safari
            this.showIOSInstallInstructions();
            return;
        }

        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log(`User response to the install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
                this.dismissInstallBanner();
            }
            
            this.deferredPrompt = null;
        } catch (error) {
            console.error('Error during PWA installation:', error);
            this.showIOSInstallInstructions();
        }
    }

    dismissInstallBanner() {
        this.hideInstallBanner();
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    }

    showIOSInstallInstructions() {
        // Check if it's iOS Safari
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isIOS && isSafari) {
            this.showModal(
                'App installieren 📱',
                `
                <div class="text-center">
                    <p><strong>So installierst du die Hochzeitsplaner-App:</strong></p>
                    <ol class="text-start mt-3">
                        <li class="mb-2">
                            <i class="bi bi-share text-primary me-2"></i>
                            Tippe auf das <strong>Teilen-Symbol</strong> unten im Browser
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-plus-square text-primary me-2"></i>
                            Wähle <strong>"Zum Home-Bildschirm"</strong>
                        </li>
                        <li class="mb-2">
                            <i class="bi bi-check-circle text-success me-2"></i>
                            Tippe auf <strong>"Hinzufügen"</strong>
                        </li>
                    </ol>
                    <p class="text-muted mt-3">Die App erscheint dann auf deinem Home-Bildschirm!</p>
                </div>
                `,
                [
                    {
                        text: 'Verstanden',
                        class: 'btn-primary',
                        action: () => this.dismissInstallBanner()
                    }
                ]
            );
        } else {
            // For other browsers, show generic instructions
            this.showModal(
                'App installieren 📱',
                `
                <div class="text-center">
                    <p>Um die beste Erfahrung zu erhalten, installiere die Hochzeitsplaner-App.</p>
                    <p class="text-muted">Die Installationsoption erscheint automatisch in deinem Browser.</p>
                </div>
                `,
                [
                    {
                        text: 'OK',
                        class: 'btn-primary',
                        action: () => this.dismissInstallBanner()
                    }
                ]
            );
        }
    }

    showInstallSuccessMessage() {
        this.showModal(
            '🎉 App erfolgreich installiert!',
            `
            <div class="text-center">
                <div class="mb-3">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                </div>
                <p><strong>Die Hochzeitsplaner-App wurde erfolgreich installiert!</strong></p>
                <p class="text-muted">Du findest sie jetzt auf deinem Home-Bildschirm und kannst sie wie eine normale App verwenden.</p>
            </div>
            `,
            [
                {
                    text: 'Super!',
                    class: 'btn-success',
                    action: () => {}
                }
            ]
        );
    }

    showModal(title, content, buttons = []) {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="pwaModal" tabindex="-1" aria-labelledby="pwaModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="pwaModalLabel">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            ${buttons.map(btn => `
                                <button type="button" class="btn ${btn.class}" data-bs-dismiss="modal" onclick="pwaManager.handleModalAction(${buttons.indexOf(btn)})">
                                    ${btn.text}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('pwaModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Store button actions
        this.modalActions = buttons.map(btn => btn.action);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('pwaModal'));
        modal.show();

        // Clean up when modal is hidden
        document.getElementById('pwaModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('pwaModal').remove();
        });
    }

    handleModalAction(index) {
        if (this.modalActions && this.modalActions[index]) {
            this.modalActions[index]();
        }
    }
}

// Global functions for template usage
let pwaManager;

function installPWA() {
    if (pwaManager) {
        pwaManager.installPWA();
    }
}

function dismissInstallBanner() {
    if (pwaManager) {
        pwaManager.dismissInstallBanner();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    pwaManager = new PWAInstallManager();
});
