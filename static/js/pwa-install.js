/**
 * PWA Installation Logic für Hochzeitsplaner
 * Diese Funktionalität ist jetzt direkt in base.html integriert
 */

console.log('💕 PWA Installation Logic ist in base.html verfügbar');

// Legacy-Kompatibilität: Falls diese Datei noch referenziert wird
window.PWAInstaller = {
    isAvailable: () => !!window.deferredPrompt,
    install: () => {
        console.log('Verwende PWA Installation aus base.html');
        const installBtn = document.querySelector('.pwa-install-btn');
        if (installBtn) {
            installBtn.click();
        }
    }
};