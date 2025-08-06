// Tischplanung Event Handlers Module
// Event-Behandlung und Benutzerinteraktionen

window.TischplanungEventHandlers = {
    core: null,

    setup(coreInstance) {
        this.core = coreInstance;
        this.setupDragAndDrop();
        this.setupZoom();
        this.setupPanning();
        this.setupTouchSupport();
        this.setupKeyboardShortcuts();
    },

    setupDragAndDrop() {
        if (!this.core.seatingChart) return;

        this.core.seatingChart.addEventListener('dragover', this.handleDragOver.bind(this));
        this.core.seatingChart.addEventListener('drop', this.handleDrop.bind(this));
    },

    setupZoom() {
        if (!this.core.seatingChart) return;
        this.core.seatingChart.addEventListener('wheel', this.handleZoom.bind(this));
    },

    setupPanning() {
        if (!this.core.seatingChart) return;

        let isPanning = false;
        let startX, startY;

        this.core.seatingChart.addEventListener('mousedown', (e) => {
            if (e.target === this.core.seatingChart) {
                isPanning = true;
                startX = e.clientX;
                startY = e.clientY;
                this.core.seatingChart.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                this.updateChartPosition(deltaX, deltaY);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                this.core.seatingChart.style.cursor = 'default';
            }
        });
    },

    setupTouchSupport() {
        if (!this.core.seatingChart) return;

        let lastTouchDistance = 0;
        let touchStartX = 0;
        let touchStartY = 0;

        this.core.seatingChart.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Pinch-to-Zoom Start
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                lastTouchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
            } else if (e.touches.length === 1) {
                // Pan Start
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        });

        this.core.seatingChart.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                // Pinch-to-Zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                
                if (lastTouchDistance > 0) {
                    const scale = currentDistance / lastTouchDistance;
                    this.updateZoom(scale > 1 ? 0.1 : -0.1);
                }
                lastTouchDistance = currentDistance;
            } else if (e.touches.length === 1) {
                // Pan
                const deltaX = e.touches[0].clientX - touchStartX;
                const deltaY = e.touches[0].clientY - touchStartY;
                this.updateChartPosition(deltaX, deltaY);
            }
        });
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    this.updateZoom(0.1);
                    break;
                case '-':
                    e.preventDefault();
                    this.updateZoom(-0.1);
                    break;
                case '0':
                    e.preventDefault();
                    this.resetZoom();
                    break;
                case 'Escape':
                    this.clearSelection();
                    break;
            }
        });
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },

    handleDrop(e) {
        e.preventDefault();
        
        if (!this.core.draggedGuest) return;

        const rect = this.core.seatingChart.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.core.currentZoom;
        const y = (e.clientY - rect.top) / this.core.currentZoom;

        // Finde nächsten Tisch
        const table = this.findNearestTable(x, y);
        
        if (table && this.canAssignGuestToTable(this.core.draggedGuest, table)) {
            this.assignGuestToTable(this.core.draggedGuest, table);
        }

        this.core.draggedGuest = null;
    },

    handleZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.updateZoom(delta);
    },

    updateZoom(delta) {
        const newZoom = Math.max(0.5, Math.min(3, this.core.currentZoom + delta));
        if (newZoom !== this.core.currentZoom) {
            this.core.currentZoom = newZoom;
            this.core.seatingChart.style.transform = `scale(${newZoom})`;
            this.updateZoomDisplay();
        }
    },

    resetZoom() {
        this.core.currentZoom = 1;
        this.core.seatingChart.style.transform = 'scale(1)';
        this.updateZoomDisplay();
    },

    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.core.currentZoom * 100)}%`;
        }
    },

    updateChartPosition(deltaX, deltaY) {
        // Implementation für Chart-Position Update
        // Vereinfacht für Performance
        const currentTransform = this.core.seatingChart.style.transform || '';
        const translateRegex = /translate\(([^,]+),([^)]+)\)/;
        const match = currentTransform.match(translateRegex);
        
        let currentX = 0, currentY = 0;
        if (match) {
            currentX = parseFloat(match[1]) || 0;
            currentY = parseFloat(match[2]) || 0;
        }

        const newX = currentX + deltaX;
        const newY = currentY + deltaY;
        
        this.core.seatingChart.style.transform = 
            currentTransform.replace(translateRegex, '') + 
            ` translate(${newX}px, ${newY}px)`;
    },

    findNearestTable(x, y) {
        let nearestTable = null;
        let minDistance = Infinity;

        for (const table of this.core.tables) {
            const distance = Math.hypot(table.x - x, table.y - y);
            if (distance < minDistance && distance < 100) { // 100px Toleranz
                minDistance = distance;
                nearestTable = table;
            }
        }

        return nearestTable;
    },

    canAssignGuestToTable(guest, table) {
        const assignedGuests = this.core.guests.filter(g => g.table_id === table.id);
        return assignedGuests.length < table.capacity;
    },

    async assignGuestToTable(guest, table) {
        try {
            const result = await window.TischplanungAPI.assignGuest(guest.id, table.id);
            if (result.success) {
                // Update lokale Daten
                guest.table_id = table.id;
                this.core.render();
                this.showSuccess(`${guest.name} wurde Tisch ${table.name} zugewiesen`);
            }
        } catch (error) {
            this.showError('Fehler bei der Zuweisung');
        }
    },

    clearSelection() {
        this.core.selectedTable = null;
        this.core.selectedGuest = null;
        this.core.render();
    },

    showSuccess(message) {
        // Einfache Toast-Nachricht

    },

    showError(message) {
        // Einfache Fehlermeldung
        console.error('❌', message);
    }
};
