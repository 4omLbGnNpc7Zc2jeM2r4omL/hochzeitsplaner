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
window.notifications = new NotificationSystem();

    // Globale Funktionen für einfache Verwendung
    window.showSuccess = (message, duration) => notificationSystem.showSuccess(message, duration);
    window.showError = (message, duration) => notificationSystem.showError(message, duration);
    window.showWarning = (message, duration) => notificationSystem.showWarning(message, duration);
    window.showInfo = (message, duration) => notificationSystem.showInfo(message, duration);
    
    // Bestätigungsdialog-Funktion
    window.showConfirm = (title, message) => {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${message}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-danger confirm-btn">Bestätigen</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const bootstrapModal = new bootstrap.Modal(modal);
            
            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                bootstrapModal.hide();
                resolve(true);
            });
            
            modal.addEventListener('hidden.bs.modal', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            bootstrapModal.show();
        });
    };
