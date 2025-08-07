// Zentrales Notification-System für die Website
class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Container für Notifications erstellen
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show notification-item`;
        notification.style.cssText = `
            margin-bottom: 10px;
            pointer-events: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: none;
            animation: slideInRight 0.3s ease-out;
        `;

        // Icon basierend auf Typ
        const icons = {
            'success': 'bi-check-circle-fill',
            'error': 'bi-exclamation-triangle-fill',
            'warning': 'bi-exclamation-triangle-fill',
            'info': 'bi-info-circle-fill'
        };

        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi ${icons[type] || icons.info} me-2"></i>
                <div class="flex-grow-1">${message}</div>
                <button type="button" class="btn-close" aria-label="Close"></button>
            </div>
        `;

        // Close-Button funktionsfähig machen
        const closeBtn = notification.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => {
            this.hide(notification);
        });

        // Auto-hide nach duration
        if (duration > 0) {
            setTimeout(() => {
                this.hide(notification);
            }, duration);
        }

        this.container.appendChild(notification);

        // CSS Animation hinzufügen (falls noch nicht vorhanden)
        this.addAnimationCSS();

        return notification;
    }

    hide(notification) {
        notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    addAnimationCSS() {
        if (document.getElementById('notification-animations')) return;

        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Convenience-Methoden
    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }
}

// Globale Instanz erstellen
const notificationSystem = new NotificationSystem();
window.notifications = notificationSystem;

// Globale Funktionen für einfache Verwendung
window.showSuccess = (message, duration) => notificationSystem.success(message, duration);
window.showError = (message, duration) => notificationSystem.error(message, duration);
window.showWarning = (message, duration) => notificationSystem.warning(message, duration);
window.showInfo = (message, duration) => notificationSystem.info(message, duration);
    
    // Bestätigungsdialog-Funktion - schöner im Website-Container
    window.showConfirm = (title, message, confirmText = 'Bestätigen', cancelText = 'Abbrechen') => {
        return new Promise((resolve) => {
            // Verwende das schöne Notification-System für Bestätigungen
            const confirmContainer = document.createElement('div');
            confirmContainer.className = 'alert alert-warning border-0 shadow-lg notification-item';
            confirmContainer.style.cssText = `
                margin-bottom: 10px;
                pointer-events: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                border: 2px solid #ffc107;
                animation: slideInRight 0.3s ease-out;
                max-width: 400px;
                padding: 20px;
            `;

            confirmContainer.innerHTML = `
                <div class="d-flex align-items-start">
                    <i class="bi bi-question-circle-fill text-warning me-3" style="font-size: 1.5rem; margin-top: 2px;"></i>
                    <div class="flex-grow-1">
                        <h6 class="alert-heading mb-2">${title}</h6>
                        <p class="mb-3">${message}</p>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-sm btn-secondary cancel-btn">${cancelText}</button>
                            <button type="button" class="btn btn-sm btn-danger confirm-btn">${confirmText}</button>
                        </div>
                    </div>
                </div>
            `;

            // Event Listeners
            const confirmBtn = confirmContainer.querySelector('.confirm-btn');
            const cancelBtn = confirmContainer.querySelector('.cancel-btn');

            confirmBtn.addEventListener('click', () => {
                notificationSystem.hide(confirmContainer);
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                notificationSystem.hide(confirmContainer);
                resolve(false);
            });

            // Auto-Cancel nach 30 Sekunden
            setTimeout(() => {
                if (confirmContainer.parentNode) {
                    notificationSystem.hide(confirmContainer);
                    resolve(false);
                }
            }, 30000);

            notificationSystem.container.appendChild(confirmContainer);
        });
    };
