/**
 * Touch-Drag-Drop System für Mobile Geräte
 * Ermöglicht Drag & Drop auf Touch-Geräten durch Touch-Events
 */

class TouchDragDrop {
    constructor() {
        this.isDragging = false;
        this.draggedElement = null;
        this.draggedGuestId = null;
        this.startX = 0;
        this.startY = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.placeholder = null;
        this.dropZones = [];
        this.currentDropZone = null;
        
        // Bind methods
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        
        this.setupTouchEvents();
    }
    
    setupTouchEvents() {

        
        // Event-Delegation für dynamische Elemente
        document.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    }
    
    handleTouchStart(e) {
        const draggableElement = e.target.closest('.draggable-guest');
        if (!draggableElement) return;
        
        // Verhindere Scrolling während Drag
        e.preventDefault();
        
        this.isDragging = true;
        this.draggedElement = draggableElement;
        this.draggedGuestId = parseInt(draggableElement.dataset.guestId);
        
        const touch = e.touches[0];
        const rect = draggableElement.getBoundingClientRect();
        
        this.startX = touch.clientX;
        this.startY = touch.clientY;
        this.offsetX = touch.clientX - rect.left;
        this.offsetY = touch.clientY - rect.top;
        
        // Placeholder erstellen
        this.createPlaceholder();
        
        // Element für Drag vorbereiten
        this.prepareDragElement();
        
        // Drop-Zonen aktivieren
        this.activateDropZones();
        

        
        // Debug: Drop-Zonen-Status protokollieren
        const dropZones = document.querySelectorAll('.table-drop-zone');

        dropZones.forEach((zone, index) => {

        });
    }
    
    handleTouchMove(e) {
        if (!this.isDragging || !this.draggedElement) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.startX;
        const deltaY = touch.clientY - this.startY;
        
        // Element bewegen
        this.draggedElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        // Aktuelle Drop-Zone finden
        this.updateDropZone(touch.clientX, touch.clientY);
        
        // Auto-Scroll implementieren
        this.handleAutoScroll(touch.clientY);
    }
    
    handleTouchEnd(e) {
        if (!this.isDragging || !this.draggedElement) return;
        
        e.preventDefault();
        
        const touch = e.changedTouches[0];
        
        // Drop-Zone am Ende der Bewegung prüfen
        const finalDropZone = this.getDropZoneAt(touch.clientX, touch.clientY);
        


        
        if (finalDropZone && this.draggedGuestId) {
            // Drop ausführen

            this.executeDrop(finalDropZone);
        } else {

        }
        
        // Cleanup
        this.cleanup();
        

    }
    
    createPlaceholder() {
        this.placeholder = this.draggedElement.cloneNode(true);
        this.placeholder.style.opacity = '0.3';
        this.placeholder.style.pointerEvents = 'none';
        this.placeholder.classList.add('drag-placeholder');
        
        // Placeholder an der ursprünglichen Position einfügen
        this.draggedElement.parentNode.insertBefore(this.placeholder, this.draggedElement.nextSibling);
    }
    
    prepareDragElement() {
        this.draggedElement.style.position = 'fixed';
        this.draggedElement.style.zIndex = '9999';
        this.draggedElement.style.pointerEvents = 'none';
        this.draggedElement.style.opacity = '0.8';
        this.draggedElement.style.transform = 'translate(0px, 0px)';
        this.draggedElement.classList.add('touch-dragging');
        
        // Breite fixieren um Layout-Sprünge zu vermeiden
        const rect = this.draggedElement.getBoundingClientRect();
        this.draggedElement.style.width = rect.width + 'px';
    }
    
    activateDropZones() {
        this.dropZones = Array.from(document.querySelectorAll('.table-drop-zone'));
        

        this.dropZones.forEach((zone, index) => {

        });
        
        this.dropZones.forEach(zone => {
            zone.style.backgroundColor = '#e8f5e8';
            zone.style.borderColor = '#28a745';
            zone.style.borderStyle = 'dashed';
            zone.style.borderWidth = '2px';
            zone.classList.add('drop-zone-active');
        });
    }
    
    updateDropZone(x, y) {
        const newDropZone = this.getDropZoneAt(x, y);
        
        if (newDropZone !== this.currentDropZone) {
            // Alte Drop-Zone deaktivieren
            if (this.currentDropZone) {
                this.currentDropZone.classList.remove('drop-zone-hover');
                this.currentDropZone.style.backgroundColor = '#e8f5e8';
            }
            
            // Neue Drop-Zone aktivieren
            if (newDropZone) {
                newDropZone.classList.add('drop-zone-hover');
                newDropZone.style.backgroundColor = '#d4edda';
            }
            
            this.currentDropZone = newDropZone;
        }
    }
    
    getDropZoneAt(x, y) {
        // Element temporär verstecken um elementFromPoint zu verwenden
        this.draggedElement.style.display = 'none';
        const elementBelow = document.elementFromPoint(x, y);
        this.draggedElement.style.display = '';
        

        
        if (elementBelow) {
            const dropZone = elementBelow.closest('.table-drop-zone');
            if (dropZone) {



            } else {

            }
            return dropZone;
        }

        return null;
    }
    
    handleAutoScroll(y) {
        const modal = document.getElementById('tableOverviewModal');
        if (!modal) return;
        
        const modalBody = modal.querySelector('.modal-body');
        if (!modalBody) return;
        
        const modalRect = modalBody.getBoundingClientRect();
        const scrollThreshold = 100;
        const scrollSpeed = 10;
        
        // Nach oben scrollen
        if (y < modalRect.top + scrollThreshold) {
            modalBody.scrollTop -= scrollSpeed;
        }
        // Nach unten scrollen
        else if (y > modalRect.bottom - scrollThreshold) {
            modalBody.scrollTop += scrollSpeed;
        }
    }
    
    executeDrop(dropZone) {
        const tableId = parseInt(dropZone.dataset.tableId);
        



        
        if (tableId && this.draggedGuestId) {

            
            // Versuche verschiedene Methoden für die Tischzuordnung
            if (typeof assignGuestToTable === 'function') {

                assignGuestToTable(this.draggedGuestId, tableId).then(() => {
                    // Modal-Update nach erfolgreichem Assignment (wie in Desktop-Version)

                    setTimeout(() => {

                        if (typeof refreshTableOverviewModal === 'function') {
                            refreshTableOverviewModal();
                        } else if (typeof window.refreshTableOverviewModal === 'function') {
                            window.refreshTableOverviewModal();
                        } else {

                        }
                    }, 100);
                }).catch(error => {

                });
            } else if (typeof window.assignGuestToTable === 'function') {

                window.assignGuestToTable(this.draggedGuestId, tableId).then(() => {
                    // Modal-Update nach erfolgreichem Assignment (wie in Desktop-Version)

                    setTimeout(() => {

                        if (typeof refreshTableOverviewModal === 'function') {
                            refreshTableOverviewModal();
                        } else if (typeof window.refreshTableOverviewModal === 'function') {
                            window.refreshTableOverviewModal();
                        } else {

                        }
                    }, 100);
                }).catch(error => {

                });
            } else {
                // Fallback: Direkte API-Anfrage

                this.fallbackAssignGuest(this.draggedGuestId, tableId);
            }
        } else {

        }
    }
    
    fallbackAssignGuest(guestId, tableId) {
        fetch('/api/tischplanung/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                guest_id: guestId,
                table_id: tableId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {

                
                // Desktop-Integration: Gast-Zuordnung in global guests Array aktualisieren
                if (typeof window.guests !== 'undefined' && Array.isArray(window.guests)) {
                    const guest = window.guests.find(g => g.id === guestId);
                    if (guest) {
                        guest.assigned_table = tableId;

                    }
                }
                
                // UI-Updates wie in Desktop-Version
                if (typeof renderSeatingChart === 'function') {
                    renderSeatingChart();
                }
                if (typeof renderGuestList === 'function') {
                    renderGuestList();
                }
                if (typeof updateStatistics === 'function') {
                    updateStatistics();
                }
                
                // Modal-Inhalt neu laden
                setTimeout(() => {

                    if (typeof refreshTableOverviewModal === 'function') {
                        refreshTableOverviewModal();
                    } else if (typeof window.refreshTableOverviewModal === 'function') {
                        window.refreshTableOverviewModal();
                    } else {

                    }
                }, 100);
                
                // Erfolgsmeldung anzeigen
                if (typeof showNotification === 'function') {
                    showNotification(`Gast erfolgreich zu Tisch ${tableId} zugeordnet`, 'success');
                } else if (typeof showAlert === 'function') {
                    showAlert(`Gast erfolgreich zu Tisch ${tableId} zugeordnet`, 'success');
                } else {

                }
            } else {

                if (typeof showNotification === 'function') {
                    showNotification(data.error || 'Fehler beim Zuordnen', 'error');
                } else if (typeof showAlert === 'function') {
                    showAlert(data.error || 'Fehler beim Zuordnen', 'danger');
                }
            }
        })
        .catch(error => {

            if (typeof showNotification === 'function') {
                showNotification('Fehler beim Zuordnen', 'error');
            }
        });
    }
    
    cleanup() {
        // Element zurücksetzen
        if (this.draggedElement) {
            this.draggedElement.style.position = '';
            this.draggedElement.style.zIndex = '';
            this.draggedElement.style.pointerEvents = '';
            this.draggedElement.style.opacity = '';
            this.draggedElement.style.transform = '';
            this.draggedElement.style.width = '';
            this.draggedElement.classList.remove('touch-dragging');
        }
        
        // Placeholder entfernen
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
        
        // Drop-Zonen zurücksetzen
        this.dropZones.forEach(zone => {
            zone.style.backgroundColor = 'white';
            zone.style.borderColor = '#d4af37';
            zone.style.borderStyle = 'solid';
            zone.style.borderWidth = '0 0 0 4px';
            zone.classList.remove('drop-zone-active', 'drop-zone-hover');
        });
        
        // Variablen zurücksetzen
        this.isDragging = false;
        this.draggedElement = null;
        this.draggedGuestId = null;
        this.placeholder = null;
        this.dropZones = [];
        this.currentDropZone = null;
    }
    
    // Public method um Touch-Drag für neue Elemente zu aktivieren
    refreshTouchElements() {
        // Wird automatisch durch Event-Delegation gehandhabt

    }
    
    // Test-Funktion für Debugging
    testDrop(guestId, tableId) {

        this.draggedGuestId = guestId;
        
        // Simuliere Drop-Zone
        const mockDropZone = { dataset: { tableId: tableId.toString() } };
        this.executeDrop(mockDropZone);
    }
}

// CSS für Touch-Drag hinzufügen
const touchDragCSS = `
.touch-dragging {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
    transform-origin: center;
    transition: none !important;
}

.drag-placeholder {
    border: 2px dashed #ccc !important;
    background-color: #f8f9fa !important;
}

.drop-zone-active {
    transition: all 0.2s ease !important;
}

.drop-zone-hover {
    transform: scale(1.02) !important;
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3) !important;
}

.draggable-guest {
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

/* Verhindere Text-Auswahl während Drag */
.touch-dragging * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
}
`;

// CSS zum DOM hinzufügen
if (!document.getElementById('touch-drag-css')) {
    const style = document.createElement('style');
    style.id = 'touch-drag-css';
    style.textContent = touchDragCSS;
    document.head.appendChild(style);
}

// Touch Drag & Drop System initialisieren
let touchDragDrop = null;

// Initialisierung wenn DOM bereit ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        touchDragDrop = new TouchDragDrop();
    });
} else {
    touchDragDrop = new TouchDragDrop();
}

// Globale Funktion für andere Scripts
window.refreshTouchDragDrop = function() {
    if (touchDragDrop) {
        touchDragDrop.refreshTouchElements();
    }
};

// Globale Funktion um Touch Drag & Drop nach Modal-Updates zu aktualisieren
window.refreshTouchDragDrop = function() {
    if (window.touchDragDrop) {

        
        // Drop-Zonen neu sammeln
        const dropZones = document.querySelectorAll('.table-drop-zone');

        dropZones.forEach((zone, index) => {

        });
        
        // Touch-System aktualisieren falls nötig
        if (window.touchDragDrop.refreshTouchElements) {
            window.touchDragDrop.refreshTouchElements();
        }
    } else {

    }
};



