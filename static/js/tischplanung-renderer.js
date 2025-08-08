window.TischplanungRenderer = {
    core: null,
    renderCache: new Map(),
    saveTimeout: null,

    async renderSeatingChart(coreInstance) {
        this.core = coreInstance;
        
        // Rendering in Batches für bessere Performance
        requestAnimationFrame(async () => {
            this.clearOldElements();
            await this.renderTables();
            
            requestAnimationFrame(() => {
                this.renderGuestList();
                this.updateStatistics();
            });
        });
    },

    clearOldElements() {
        // Nur notwendige Elemente entfernen
        const existingTables = this.core.seatingChart.querySelectorAll('.table-element');
        existingTables.forEach(el => {
            const tableId = el.dataset.tableId;
            if (!this.core.tables.find(t => t.id == tableId)) {
                el.remove();
                this.renderCache.delete(`table-${tableId}`);
            }
        });
    },

    async renderTables() {
        if (!this.core.tables || this.core.tables.length === 0) {
            return;
        }
        
        // Überprüfe ob Tische bereits existieren - verhindert doppeltes Rendern
        const existingTables = this.core.seatingChart.querySelectorAll('.table-element');
        const existingTableIds = Array.from(existingTables).map(el => parseInt(el.dataset.tableId));
        
        this.core.tables.forEach(table => {
            // Nur neue Tische erstellen oder bestehende bei Bedarf aktualisieren
            const existingElement = this.core.seatingChart.querySelector(`[data-table-id="${table.id}"]`);
            
            if (existingElement) {
                // Aktualisiere bestehenden Tisch ohne komplettes Neu-Rendern
                this.updateTableElement(existingElement, table);
            } else {
                // Erstelle neuen Tisch
                const tableElement = this.createTableElement(table);
                if (tableElement) {
                    this.core.seatingChart.appendChild(tableElement);
                }
            }
        });
    },

    createTableElement(table, occupancy = 0) {
        // Überprüfe ob Tisch bereits existiert
        const existingElement = this.core.seatingChart.querySelector(`[data-table-id="${table.id}"]`);
        if (existingElement) {
            // Aktualisiere bestehenden Tisch statt neuen zu erstellen
            this.updateTableElement(existingElement, table);
            return null; // Null zurückgeben da kein neues Element erstellt wird
        }
        
        // Berechne zugeordnete Gäste für diesen Tisch
        const assignedGuests = this.getAssignedGuestsForTable(table.id);
        
        // Dynamische Größenberechnung basierend auf Gästeanzahl und Namen
        const dynamicSize = this.calculateTableSize(assignedGuests, table);
        
        // Basis-Parameter
        const capacity = table.capacity || table.max_personen || 8;
        const shape = table.shape || table.form || 'round';
        const name = table.name || `Tisch ${table.id}`;
        const x = table.x || table.x_position || 100;
        const y = table.y || table.y_position || 100;
        
        // Kollisionserkennung für bessere Positionierung
        const adjustedPosition = this.avoidCollisions(x, y, dynamicSize.width, dynamicSize.height, table.id);
        
        // Tisch-Container erstellen
        const tableElement = document.createElement('div');
        tableElement.className = 'table-element';
        tableElement.dataset.tableId = table.id;
        tableElement.style.cssText = `
            position: absolute;
            left: ${adjustedPosition.x}px;
            top: ${adjustedPosition.y}px;
            width: ${dynamicSize.width}px;
            height: ${dynamicSize.height}px;
            border: 2px solid #007bff;
            border-radius: ${shape === 'round' ? '50%' : '8px'};
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
            z-index: 10;
        `;

        // Event Listeners
        this.addTableEventListeners(tableElement, table);

        // Content
        this.updateTableContent(tableElement, table);

        return tableElement;
    },

    // Neue Kollisionserkennung zur Vermeidung von Überlappungen
    avoidCollisions(x, y, width, height, currentTableId) {
        const existingTables = this.core.seatingChart.querySelectorAll('.table-element');
        const minDistance = 20; // Mindestabstand zwischen Tischen
        
        let adjustedX = x;
        let adjustedY = y;
        let hasCollision = true;
        let attempts = 0;
        const maxAttempts = 50;
        
        while (hasCollision && attempts < maxAttempts) {
            hasCollision = false;
            
            for (let existing of existingTables) {
                // Überspringe den aktuellen Tisch
                if (parseInt(existing.dataset.tableId) === currentTableId) continue;
                
                const existingRect = existing.getBoundingClientRect();
                const chartRect = this.core.seatingChart.getBoundingClientRect();
                
                // Berechne relative Position
                const existingX = existingRect.left - chartRect.left;
                const existingY = existingRect.top - chartRect.top;
                const existingWidth = existingRect.width;
                const existingHeight = existingRect.height;
                
                // Prüfe Überlappung mit Mindestabstand
                if (adjustedX < existingX + existingWidth + minDistance &&
                    adjustedX + width + minDistance > existingX &&
                    adjustedY < existingY + existingHeight + minDistance &&
                    adjustedY + height + minDistance > existingY) {
                    
                    hasCollision = true;
                    // Bewege Position um ein sicheres Stück
                    adjustedX += existingWidth + minDistance;
                    if (adjustedX + width > this.core.seatingChart.offsetWidth - 50) {
                        adjustedX = 50;
                        adjustedY += height + minDistance;
                    }
                    break;
                }
            }
            attempts++;
        }
        
        // Stelle sicher, dass der Tisch im sichtbaren Bereich bleibt
        adjustedX = Math.max(50, Math.min(adjustedX, this.core.seatingChart.offsetWidth - width - 50));
        adjustedY = Math.max(50, Math.min(adjustedY, this.core.seatingChart.offsetHeight - height - 50));
        
        return { x: adjustedX, y: adjustedY };
    },

    async updateTableElement(element, table) {
        // Hole aktuelle Gäste für diesen Tisch
        const assignedGuests = this.getAssignedGuestsForTable(table.id);
        
        // Berechne neue Größe basierend auf aktuellen Gästen
        const dynamicSize = this.calculateTableSize(assignedGuests, table);
        
        // Update Position (nur wenn sich Position geändert hat)
        const currentX = parseInt(element.style.left);
        const currentY = parseInt(element.style.top);
        const newX = table.x || table.x_position || 100;
        const newY = table.y || table.y_position || 100;
        
        if (currentX !== newX || currentY !== newY) {
            this.updateTablePosition(element, table);
        }
        
        // Update Größe (nur wenn nötig)
        const currentWidth = parseInt(element.style.width);
        const currentHeight = parseInt(element.style.height);
        
        if (currentWidth !== dynamicSize.width || currentHeight !== dynamicSize.height) {
            element.style.width = `${dynamicSize.width}px`;
            element.style.height = `${dynamicSize.height}px`;
        }
        
        // Update Content
        await this.updateTableContent(element, table);
        
        // Update Style
        this.updateTableStyle(element, table);
    },

    updateTablePosition(element, table) {
        const x = table.x || table.x_position || 100;
        const y = table.y || table.y_position || 100;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    },

    async updateTableContent(element, table) {
        const capacity = table.capacity || table.max_personen || 8;
        const name = table.name || `Tisch ${table.id}`;
        
        // Verwende die bereits geladenen Daten aus dem Core-System
        let assignedGuests = [];
        try {
            // Zuerst versuchen, die bereits geladenen Zuordnungen zu verwenden
            if (this.core && this.core.assignments && this.core.guests) {
                // Unterstütze beide Feldnamen-Varianten
                const tableAssignments = this.core.assignments.filter(a => {
                    const assignmentTableId = a.table_id || a.tisch_id;
                    return assignmentTableId === table.id;
                });
                
                assignedGuests = tableAssignments.map(assignment => {
                    const guestId = assignment.guest_id || assignment.gast_id;
                    const guest = this.core.guests.find(g => g.id === guestId);
                    if (guest) {
                        return {
                            ...guest,
                            anzahl_essen: guest.anzahl_essen || guest.Anzahl_Essen || 1,
                            name: guest.name || `${guest.vorname || guest.Vorname || ''} ${guest.nachname || guest.Nachname || ''}`.trim()
                        };
                    }
                    return null;
                }).filter(g => g !== null);
                

                }
                
                // Fallback: API-Aufruf wenn Core-Daten nicht verfügbar oder leer
                if (assignedGuests.length === 0 && window.TischplanungAPI) {
                    const allAssignments = await window.TischplanungAPI.loadAssignments();
                    const allGuests = await window.TischplanungAPI.loadGuests();
                
                if (allAssignments && allGuests) {
                    // Unterstütze beide Feldnamen-Varianten
                    const tableAssignments = allAssignments.filter(a => {
                        const assignmentTableId = a.table_id || a.tisch_id;
                        return assignmentTableId === table.id;
                    });
                    
                    assignedGuests = tableAssignments.map(assignment => {
                        const guestId = assignment.guest_id || assignment.gast_id;
                        const guest = allGuests.find(g => g.id === guestId);
                        if (guest) {
                            return {
                                ...guest,
                                anzahl_essen: guest.anzahl_essen || guest.Anzahl_Essen || 1,
                                name: guest.name || `${guest.vorname || guest.Vorname || ''} ${guest.nachname || guest.Nachname || ''}`.trim()
                            };
                        }
                        return null;
                    }).filter(g => g !== null);
                }
            }
            
            // Nur bei Problemen loggen
        } catch (error) {

            // Fallback: verwende die alte Methode
            assignedGuests = this.getAssignedGuestsForTable(table.id);
        }
        
        // Berechne anzahl_essen total für diesen Tisch
        const totalAnzahlEssen = assignedGuests.reduce((sum, guest) => {
            return sum + (guest.anzahl_essen || 1);
        }, 0);
        
        element.innerHTML = `
            <div class="table-name" style="font-weight: bold; font-size: 1.0rem; margin-bottom: 6px; color: #333; text-align: center;">
                ${name}
            </div>
            <div class="table-capacity" style="font-size: 0.85rem; color: #666; margin-bottom: 8px; text-align: center; font-weight: 500;">
                Belegt: ${totalAnzahlEssen}/${capacity}
            </div>
            <div class="table-guests" style="font-size: 0.8rem; color: #555; text-align: center; line-height: 1.3; overflow-wrap: break-word; max-height: ${assignedGuests.length > 6 ? '150px' : 'auto'}; overflow-y: ${assignedGuests.length > 6 ? 'auto' : 'visible'}; padding: 0 4px;">
                ${assignedGuests.length > 0 ? assignedGuests.map(g => {
                    const guestName = g.name || `${g.vorname || g.Vorname || ''} ${g.nachname || g.Nachname || ''}`.trim();
                    const essenInfo = (g.anzahl_essen || 1) > 1 ? ` (${g.anzahl_essen})` : '';
                    return `<div style="margin-bottom: 2px; padding: 1px 0;">${guestName}${essenInfo}</div>`;
                }).join('') : '<div style="color: #999; font-style: italic;">Leer</div>'}
            </div>
        `;
    },

    updateTableStyle(element, table) {
        const capacity = table.capacity || table.max_personen || 8;
        const assignedGuests = this.core.guests.filter(g => g.table_id === table.id);
        const isOverCapacity = assignedGuests.length > capacity;
        const isEmpty = assignedGuests.length === 0;

        let borderColor = table.farbe || '#007bff';
        let backgroundColor = 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)';

        if (isOverCapacity) {
            borderColor = '#dc3545';
            backgroundColor = 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)';
        } else if (isEmpty) {
            borderColor = '#6c757d';
            backgroundColor = 'linear-gradient(135deg, #e9ecef 0%, #f8f9fa 100%)';
        }

        element.style.borderColor = borderColor;
        element.style.background = backgroundColor;
    },

    addTableEventListeners(element, table) {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let startX = 0;
        let startY = 0;

        // Einfacher Klick - Tisch auswählen
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isDragging) {
                this.selectTable(table);
            }
        });

        // Doppelklick - Tisch bearbeiten
        element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editTable(table);
        });

        // Drag-Funktionalität für freie Positionierung
        element.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Nur linke Maustaste
                isDragging = false;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                startX = table.x || table.x_position || 100;
                startY = table.y || table.y_position || 100;
                
                element.style.cursor = 'grabbing';
                element.style.zIndex = '1000';
                
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (dragStartX !== 0) {
                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;
                
                // Mindestbewegung für Drag-Erkennung
                if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
                    isDragging = true;
                    element.classList.add('moving');
                }
                
                if (isDragging) {
                    const newX = startX + deltaX;
                    const newY = startY + deltaY;
                    
                    // Positionsgrenzen prüfen
                    const seatingChart = this.core.seatingChart;
                    const minX = 60; // Mindestabstand zum Rand
                    const minY = 60;
                    const maxX = seatingChart.offsetWidth - 180; // Tischbreite berücksichtigen
                    const maxY = seatingChart.offsetHeight - 180;
                    
                    const clampedX = Math.max(minX, Math.min(maxX, newX));
                    const clampedY = Math.max(minY, Math.min(maxY, newY));
                    
                    element.style.left = `${clampedX}px`;
                    element.style.top = `${clampedY}px`;
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (dragStartX !== 0) {
                if (isDragging) {
                    // Position speichern
                    const newX = parseInt(element.style.left);
                    const newY = parseInt(element.style.top);
                    
                    this.saveTablePosition(table, newX, newY);
                }
                
                // Reset
                isDragging = false;
                dragStartX = 0;
                dragStartY = 0;
                element.style.cursor = 'pointer';
                element.style.zIndex = '10';
                element.classList.remove('moving');
            }
        });

        // Drop-Funktionalität für Gäste
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging) {
                element.style.borderColor = '#28a745';
                element.style.transform = 'scale(1.05)';
            }
        });

        element.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            if (!isDragging) {
                this.updateTableStyle(element, table);
                element.style.transform = '';
            }
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging) {
                this.handleTableDrop(table);
                element.style.transform = '';
            }
        });
    },

    renderGuestList() {
        const guestListContainer = document.getElementById('guestList');
        const guestCountElement = document.getElementById('guestCount');
        
        if (!guestListContainer) {

            return;
        }

        // Update guest count - zeige Summe der anzahl_essen
        if (guestCountElement) {
            const totalEssenGuests = this.core.guests.reduce((sum, guest) => {
                const anzahlEssen = guest.anzahl_essen || guest.Anzahl_Essen || 0;
                return sum + anzahlEssen;
            }, 0);
            guestCountElement.textContent = totalEssenGuests;
        }

        // Render all guests (assigned and unassigned)
        guestListContainer.innerHTML = this.core.guests.map(guest => {
            const isAssigned = guest.table_id;
            const table = isAssigned ? this.core.tables.find(t => t.id === guest.table_id) : null;
            
            return `
                <div class="list-group-item guest-list-item ${isAssigned ? 'assigned' : ''}" 
                     draggable="true" data-guest-id="${guest.id}"
                     style="cursor: grab; border-left: 4px solid ${isAssigned ? '#28a745' : '#6c757d'};">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div style="font-weight: 500;">${guest.vorname || guest.name} ${guest.nachname || ''}</div>
                            <small class="text-muted">${guest.email || ''}</small>
                            ${isAssigned ? `<br><small class="text-success">Tisch: ${table ? table.name : 'Unbekannt'}</small>` : ''}
                        </div>
                        <div>
                            ${(guest.anzahl_essen || guest.Anzahl_Essen) ? `<span class="badge bg-secondary">${guest.anzahl_essen || guest.Anzahl_Essen}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Drag Events für Gäste
        guestListContainer.querySelectorAll('.guest-list-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const guestId = parseInt(item.dataset.guestId);
                this.core.draggedGuest = this.core.guests.find(g => g.id === guestId);
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });
    },

    updateStatistics() {
        const statsContainer = document.getElementById('tischplanungStats');
        
        if (!statsContainer) return;

        // Berechne Statistiken basierend auf anzahl_essen
        const totalEssenGuests = this.core.guests.reduce((sum, guest) => {
            const anzahlEssen = guest.anzahl_essen || guest.Anzahl_Essen || 0;
            return sum + anzahlEssen;
        }, 0);
        
        const assignedEssenGuests = this.core.guests.filter(g => g.table_id).reduce((sum, guest) => {
            const anzahlEssen = guest.anzahl_essen || guest.Anzahl_Essen || 0;
            return sum + anzahlEssen;
        }, 0);
        
        const totalCapacity = this.core.tables.reduce((sum, table) => sum + (table.capacity || 8), 0);

        statsContainer.innerHTML = `
            <div class="row text-center">
                <div class="col-md-3">
                    <h5>${this.core.tables.length}</h5>
                    <small>Tische</small>
                </div>
                <div class="col-md-3">
                    <h5>${assignedEssenGuests}/${totalEssenGuests}</h5>
                    <small>Zugewiesene Essensgäste</small>
                </div>
                <div class="col-md-3">
                    <h5>${totalCapacity}</h5>
                    <small>Gesamtkapazität</small>
                </div>
                <div class="col-md-3">
                    <h5 class="${assignedEssenGuests === totalEssenGuests ? 'text-success' : 'text-warning'}">
                        ${totalEssenGuests > 0 ? Math.round((assignedEssenGuests / totalEssenGuests) * 100) : 0}%
                    </h5>
                    <small>Vollständig</small>
                </div>
            </div>
        `;
    },

    selectTable(table) {
        // Remove previous selection
        this.core.seatingChart.querySelectorAll('.table-element').forEach(el => {
            el.style.transform = '';
            el.style.zIndex = '10';
        });

        // Select new table
        const tableElement = this.core.seatingChart.querySelector(`[data-table-id="${table.id}"]`);
        if (tableElement) {
            tableElement.style.transform = 'scale(1.1)';
            tableElement.style.zIndex = '20';
        }

        this.core.selectedTable = table;
        this.showTableDetails(table);
    },

    showTableDetails(table) {
        const detailsContainer = document.getElementById('tableDetails');
        if (!detailsContainer) return;

        const assignedGuests = this.core.guests.filter(g => g.table_id === table.id);

        detailsContainer.innerHTML = `
            <h6>Tisch: ${table.name}</h6>
            <p>Kapazität: ${table.capacity} Personen</p>
            <p>Belegt: ${assignedGuests.length} Personen</p>
            <div class="assigned-guests">
                <strong>Gäste:</strong>
                <ul class="list-unstyled mt-2">
                    ${assignedGuests.map(g => `<li>${g.name}</li>`).join('')}
                </ul>
            </div>
            <button class="btn btn-sm btn-outline-danger mt-2" onclick="clearTable(${table.id})">
                Tisch leeren
            </button>
        `;
    },

    handleTableDrop(table) {
        if (this.core.draggedGuest && window.TischplanungEventHandlers) {
            window.TischplanungEventHandlers.assignGuestToTable(this.core.draggedGuest, table);
        }
    },

    editTable(table) {

        
        // Entferne vorheriges Modal falls vorhanden
        const existingModal = document.getElementById('editTableModal');
        if (existingModal) {
            existingModal.remove();
        }

        const capacity = table.capacity || table.max_personen || 8;
        const name = table.name || `Tisch ${table.id}`;
        const farbe = table.farbe || '#007bff';
        const form = table.shape || table.form || 'round';

        const modalHtml = `
            <div class="modal fade" id="editTableModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-pencil me-2"></i>Tisch bearbeiten
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editTableForm">
                                <div class="mb-3">
                                    <label class="form-label">Tischname</label>
                                    <input type="text" class="form-control" id="editTableName" value="${name}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Kapazität</label>
                                    <input type="number" class="form-control" id="editTableCapacity" value="${capacity}" min="2" max="20" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Form</label>
                                    <select class="form-select" id="editTableShape">
                                        <option value="round" ${form === 'round' ? 'selected' : ''}>Rund</option>
                                        <option value="square" ${form === 'square' ? 'selected' : ''}>Quadratisch</option>
                                        <option value="rectangle" ${form === 'rectangle' ? 'selected' : ''}>Rechteckig</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Farbe</label>
                                    <div class="d-flex align-items-center">
                                        <input type="color" class="form-control form-control-color me-3" id="editTableColor" value="${farbe}" style="width: 60px;">
                                        <div class="btn-group btn-group-sm" role="group">
                                            <button type="button" class="btn btn-outline-primary" onclick="setTableColor('#007bff')">Blau</button>
                                            <button type="button" class="btn btn-outline-success" onclick="setTableColor('#28a745')">Grün</button>
                                            <button type="button" class="btn btn-outline-warning" onclick="setTableColor('#ffc107')">Gelb</button>
                                            <button type="button" class="btn btn-outline-danger" onclick="setTableColor('#dc3545')">Rot</button>
                                            <button type="button" class="btn btn-outline-info" onclick="setTableColor('#17a2b8')">Cyan</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Position</label>
                                    <div class="row">
                                        <div class="col-6">
                                            <label class="form-label form-label-sm">X</label>
                                            <input type="number" class="form-control form-control-sm" id="editTableX" value="${table.x || table.x_position || 100}">
                                        </div>
                                        <div class="col-6">
                                            <label class="form-label form-label-sm">Y</label>
                                            <input type="number" class="form-control form-control-sm" id="editTableY" value="${table.y || table.y_position || 100}">
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-danger" onclick="deleteTableConfirm(${table.id})">
                                <i class="bi bi-trash me-1"></i>Löschen
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" onclick="saveTableEdit(${table.id})">
                                <i class="bi bi-save me-1"></i>Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Globale Hilfsfunktionen
        window.setTableColor = function(color) {
            document.getElementById('editTableColor').value = color;
        };

        window.saveTableEdit = async function(tableId) {
            const name = document.getElementById('editTableName').value.trim();
            const capacity = parseInt(document.getElementById('editTableCapacity').value);
            const shape = document.getElementById('editTableShape').value;
            const farbe = document.getElementById('editTableColor').value;
            const x = parseInt(document.getElementById('editTableX').value);
            const y = parseInt(document.getElementById('editTableY').value);

            if (!name) {
                alert('Bitte einen Tischnamen eingeben');
                return;
            }

            // Loading-Indikator anzeigen
            const saveButton = document.querySelector(`[onclick="saveTableEdit(${tableId})"]`);
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i>Speichere...';
            saveButton.disabled = true;

            const updateData = {
                name: name,
                capacity: capacity,
                shape: shape,
                farbe: farbe,
                x: x,
                y: y
            };

            try {
                const result = await window.TischplanungAPI.updateTable(tableId, updateData);
                if (result.message || result.success !== false) {
                    // Modal sofort schließen
                    document.getElementById('editTableModal').remove();
                    
                    // Tisch-Element sofort aktualisieren (optimistische UI)
                    const tableElement = document.querySelector(`[data-table-id="${tableId}"]`);
                    if (tableElement) {
                        // Position aktualisieren
                        tableElement.style.left = `${x}px`;
                        tableElement.style.top = `${y}px`;
                        
                        // Farbe aktualisieren
                        tableElement.style.borderColor = farbe;
                        
                        // Shape aktualisieren
                        tableElement.style.borderRadius = shape === 'round' ? '50%' : '8px';
                        
                        // Inhalt aktualisieren
                        const nameElement = tableElement.querySelector('.table-name');
                        if (nameElement) nameElement.textContent = name;
                        
                        const capacityElement = tableElement.querySelector('.table-capacity');
                        if (capacityElement) {
                            const currentGuests = capacityElement.textContent.split('/')[0];
                            capacityElement.textContent = `${currentGuests}/${capacity}`;
                        }
                    }
                    
                    // Daten im Hintergrund synchronisieren (non-blocking)
                    setTimeout(async () => {
                        try {
                            await window.tischplanung.loadTables();
                            window.tischplanung.render();
                        } catch (error) {

                        }
                    }, 100);
                    
                    if (window.showSuccess) {
                        window.showSuccess('Tisch erfolgreich aktualisiert');
                    } else {
                        alert('Tisch erfolgreich aktualisiert');
                    }
                } else {
                    throw new Error(result.error || 'Unbekannter Fehler');
                }
            } catch (error) {
                // Button zurücksetzen bei Fehler
                saveButton.innerHTML = originalText;
                saveButton.disabled = false;
                

                if (window.showError) {
                    window.showError('Fehler beim Aktualisieren: ' + error.message);
                } else {
                    alert('Fehler beim Aktualisieren: ' + error.message);
                }
            }
        };

        window.deleteTableConfirm = async function(tableId) {
            const confirmed = confirm('Möchten Sie diesen Tisch wirklich löschen? Alle Gäste-Zuordnungen gehen verloren.');
            if (!confirmed) return;

            // Loading-Indikator anzeigen
            const deleteButton = document.querySelector(`[onclick="deleteTableConfirm(${tableId})"]`);
            const originalText = deleteButton.innerHTML;
            deleteButton.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i>Lösche...';
            deleteButton.disabled = true;

            try {
                const result = await window.TischplanungAPI.deleteTable(tableId);
                if (result.message || result.success !== false) {
                    // Modal sofort schließen
                    document.getElementById('editTableModal').remove();
                    
                    // Tisch sofort aus der Anzeige entfernen (optimistische UI)
                    const tableElement = document.querySelector(`[data-table-id="${tableId}"]`);
                    if (tableElement) {
                        tableElement.style.transition = 'all 0.3s ease';
                        tableElement.style.opacity = '0';
                        tableElement.style.transform = 'scale(0.8)';
                        setTimeout(() => tableElement.remove(), 300);
                    }
                    
                    // Cache bereinigen
                    window.TischplanungRenderer.removeTableFromCache(tableId);
                    
                    // Daten im Hintergrund aktualisieren (non-blocking)
                    setTimeout(async () => {
                        try {
                            await window.tischplanung.loadTables();
                            window.tischplanung.render();
                        } catch (error) {

                        }
                    }, 100);
                    
                    if (window.showSuccess) {
                        window.showSuccess('Tisch erfolgreich gelöscht');
                    } else {
                        alert('Tisch erfolgreich gelöscht');
                    }
                } else {
                    throw new Error(result.error || 'Unbekannter Fehler');
                }
            } catch (error) {
                // Button zurücksetzen bei Fehler
                deleteButton.innerHTML = originalText;
                deleteButton.disabled = false;
                

                if (window.showError) {
                    window.showError('Fehler beim Löschen: ' + error.message);
                } else {
                    alert('Fehler beim Löschen: ' + error.message);
                }
            }
        };

        // Modal anzeigen
        const modal = new bootstrap.Modal(document.getElementById('editTableModal'));
        modal.show();

        // Modal nach dem Schließen aus DOM entfernen
        document.getElementById('editTableModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },

    saveTablePosition(table, newX, newY) {

        
        const updateData = {
            x_position: newX,
            y_position: newY
        };

        // Lokale Daten sofort aktualisieren für bessere UX
        table.x = newX;
        table.y = newY;
        if (table.x_position !== undefined) table.x_position = newX;
        if (table.y_position !== undefined) table.y_position = newY;

        // Debouncing für API-Aufrufe - verhindert zu viele gleichzeitige Requests
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(async () => {
            try {
                if (window.TischplanungAPI) {
                    const result = await window.TischplanungAPI.updateTable(table.id, updateData);
                    if (!result.message && result.success === false) {

                        if (window.showError) {
                            window.showError('Position konnte nicht gespeichert werden: ' + result.error);
                        }
                    } else {

                    }
                } else {

                }
            } catch (error) {

                if (window.showError) {
                    window.showError('Fehler beim Speichern: ' + error.message);
                }
            }
        }, 500); // 500ms Debounce-Zeit
    },

    isTableUnchanged(table, cachedData) {
        if (!cachedData) return false;
        
        const cached = cachedData.tableData;
        return (
            cached.name === table.name &&
            cached.x_position === table.x_position &&
            cached.y_position === table.y_position &&
            cached.max_personen === table.max_personen &&
            cached.farbe === table.farbe
        );
    },

    removeTableFromCache(tableId) {
        this.renderCache.delete(`table-${tableId}`);
    },

    updateTableInCache(tableId, tableData) {
        const cacheKey = `table-${tableId}`;
        const cached = this.renderCache.get(cacheKey);
        if (cached) {
            cached.tableData = { ...tableData };
            cached.lastUpdate = Date.now();
        }
    },

    // Neue Hilfsfunktionen für verbesserte Tischdarstellung
    getAssignedGuestsForTable(tableId) {
        // Hole alle Zuordnungen für diesen Tisch
        if (!this.core || !this.core.assignments) {

            return [];
        }
        
        // Unterstütze beide Feldnamen-Varianten
        const tableAssignments = this.core.assignments.filter(a => {
            const assignmentTableId = a.table_id || a.tisch_id;
            return assignmentTableId === tableId;
        });
        
        const guests = [];
        
        tableAssignments.forEach(assignment => {
            const guestId = assignment.guest_id || assignment.gast_id;
            const guest = this.core.guests.find(g => g.id === guestId);
            if (guest) {
                // Verwende anzahl_essen für die Berechnung
                const guestData = {
                    ...guest,
                    anzahl_essen: guest.anzahl_essen || guest.Anzahl_Essen || 1,
                    name: guest.name || `${guest.vorname || guest.Vorname || ''} ${guest.nachname || guest.Nachname || ''}`.trim()
                };
                guests.push(guestData);
            }
        });
        
        return guests;
    },

    calculateTableSize(assignedGuests, table) {
        // Größere Minimale Größe für bessere Lesbarkeit
        const minWidth = 160;
        const minHeight = 140;
        
        // Berechne benötigte Größe basierend auf Gästen
        if (!assignedGuests || assignedGuests.length === 0) {
            return { width: minWidth, height: minHeight };
        }
        
        // Berechne maximale Namenslänge
        const maxNameLength = Math.max(...assignedGuests.map(g => (g.name || '').length));
        
        // Dynamische Breite basierend auf Namenslänge (großzügiger)
        const extraWidth = Math.max(0, (maxNameLength - 10) * 6); // 6px pro extra Zeichen
        
        // Dynamische Höhe basierend auf Anzahl Gäste (großzügiger)
        const guestCount = assignedGuests.length;
        const extraHeight = Math.max(0, (guestCount - 2) * 20); // 20px pro extra Gast
        
        // Berücksichtige auch die Anzahl der Personen (für "Name (2)" Anzeigen)
        const hasPersonCounts = assignedGuests.some(g => (g.anzahl_essen || 1) > 1);
        const personCountWidth = hasPersonCounts ? 30 : 0;
        
        return {
            width: Math.min(minWidth + extraWidth + personCountWidth, 400), // Maximal 400px breit
            height: Math.min(minHeight + extraHeight, 300) // Maximal 300px hoch
        };
    }
};

