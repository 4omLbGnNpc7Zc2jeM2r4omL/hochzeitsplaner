/**
 * TischplanungAPI - Zentraler API-Client für Tischplanung
 */
window.TischplanungAPI = {
    // Tische verwalten
    async loadTables() {
        try {
            const data = await apiRequest('/tischplanung/tables');
            return Array.isArray(data) ? data : (data.tables || []);
        } catch (error) {
            console.error('Fehler beim Laden der Tische:', error);
            return [];
        }
    },

    async saveTable(tableData) {
        try {
            const data = await apiRequest('/tischplanung/tables', {
                method: 'POST',
                body: JSON.stringify(tableData)
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Speichern des Tisches:', error);
            return { success: false, error: error.message };
        }
    },

    async updateTable(tableId, tableData) {
        try {
            const data = await apiRequest(`/tischplanung/tables/${tableId}`, {
                method: 'PUT',
                body: JSON.stringify(tableData)
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Tisches:', error);
            return { success: false, error: error.message };
        }
    },

    async loadGuests() {
        try {
            const data = await apiRequest('/gaeste/list');
            if (data.success && data.gaeste) {
                return data.gaeste;
            }
            return [];
        } catch (error) {
            console.error('Fehler beim Laden der Gäste:', error);
            return [];
        }
    },

    async saveGuest(guestData) {
        try {
            const method = guestData.id ? 'PUT' : 'POST';
            const url = guestData.id ? `/gaeste/update/${guestData.id}` : '/gaeste/add';
            
            const data = await apiRequest(url, {
                method: method,
                body: JSON.stringify(guestData)
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Speichern des Gastes:', error);
            return { success: false, error: error.message };
        }
    },

    async deleteTable(tableId) {
        try {
            const data = await apiRequest(`/tischplanung/tables/${tableId}`, {
                method: 'DELETE'
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Löschen des Tisches:', error);
            return { success: false, error: error.message };
        }
    },

    // Zuordnungen verwalten
    async loadAssignments(tableId = null) {
        try {
            const url = tableId ? `/tischplanung/assignments?table_id=${tableId}` : '/tischplanung/assignments';
            const data = await apiRequest(url);
            
            // Prüfe ob die Antwort ein Array ist oder in einem Wrapper
            if (Array.isArray(data)) {
                return data;
            } else if (data && Array.isArray(data.assignments)) {
                return data.assignments;
            } else if (data && data.success && Array.isArray(data.data)) {
                return data.data;
            } else {
                console.warn('Unerwartete Datenstruktur bei Assignments:', data);
                return [];
            }
        } catch (error) {

            return [];
        }
    },

    async assignGuest(guestId, tableId, position = null) {
        try {
            const response = await apiRequest('/tischplanung/assign', {
                method: 'POST',
                body: JSON.stringify({
                    guest_id: guestId,
                    table_id: tableId,
                    position: position
                })
            });
            return await response.json();
        } catch (error) {

            return { success: false, error: error.message };
        }
    },

    async unassignGuest(guestId) {
        try {
            const response = await apiRequest(`/tischplanung/unassign/${guestId}`, {
                method: 'DELETE',
                });
            
            // Spezielle Behandlung für 401 (Authentication required)
            if (response.status === 401) {

                return { 
                    success: false, 
                    error: 'Authentifizierung erforderlich. Bitte erneut anmelden.' 
                };
            }
            
            // Spezielle Behandlung für 404 (Gast nicht zugeordnet)
            if (response.status === 404) {

                const data = await response.json().catch(() => ({}));
                return { 
                    success: false, 
                    error: data.error || 'Gast war keinem Tisch zugeordnet',
                    isNotAssigned: true
                };
            }
            
            // Prüfe ob Response JSON ist
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {

                const htmlText = await response.text();

                return { 
                    success: false, 
                    error: `Server-Fehler: Unerwartete Response (${response.status})` 
                };
            }
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, ...data };
            } else {
                return { success: false, error: data.error || `HTTP Error ${response.status}` };
            }
        } catch (error) {

            return { success: false, error: error.message };
        }
    },

    async clearAllAssignments() {
        try {
            const response = await apiRequest('/tischplanung/clear-all', {
                method: 'POST'
            });
            return await response.json();
        } catch (error) {

            return { success: false, error: error.message };
        }
    },

    // Beziehungen verwalten
    async loadRelationships(guestId = null) {
        try {
            const url = guestId ? `/tischplanung/relationships?guest_id=${guestId}` : '/tischplanung/relationships';
            const data = await apiRequest(url);
            return Array.isArray(data) ? data : (data.relationships || []);
        } catch (error) {
            console.error('Fehler beim Laden der Beziehungen:', error);
            return [];
        }
    },

    async saveRelationship(relationshipData) {
        try {
            const data = await apiRequest('/tischplanung/relationships', {
                method: 'POST',
                body: JSON.stringify(relationshipData)
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Speichern der Beziehung:', error);
            return { success: false, error: error.message };
        }
    },

    async updateRelationship(relationshipId, relationshipData) {
        try {
            const data = await apiRequest(`/tischplanung/relationships/${relationshipId}`, {
                method: 'PUT',
                body: JSON.stringify(relationshipData)
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Aktualisieren der Beziehung:', error);
            return { success: false, error: error.message };
        }
    },

    async deleteRelationship(relationshipId) {
        try {
            const data = await apiRequest(`/tischplanung/relationships/${relationshipId}`, {
                method: 'DELETE'
            });
            return data;
        } catch (error) {
            console.error('Fehler beim Löschen der Beziehung:', error);
            return { success: false, error: error.message };
        }
    },

    // Auto-Zuweisung
    async autoAssign(options = {}) {
        try {
            const data = await apiRequest('/tischplanung/auto-assign', {
                method: 'POST',
                body: JSON.stringify(options)
            });
            return data;
        } catch (error) {
            console.error('Fehler bei Auto-Zuweisung:', error);
            return { success: false, error: error.message };
        }
    },

    // Alle Tische löschen
    async clearAllTables() {
        try {
            const response = await apiRequest('/tischplanung/clear-all-tables', {
                method: 'DELETE',
                });
            const result = await response.json();
            return result;
        } catch (error) {

            return { success: false, error: error.message };
        }
    },

    // Neue Methoden für die Tischübersicht
    async getTableOverview() {
        try {
            // Versuche zuerst die neue API-Route
            const response = await apiRequest('/tischplanung/overview');
            if (response.ok) {
                const data = await response.json();
                return data; // Bereits im erwarteten Format
            }
            
            // Fallback: Lade Daten separat und kombiniere sie

            const assignments = await this.loadAssignments();
            const tables = await this.loadTables();
            const guests = await this.loadGuests();
            
            if (!assignments || !tables || !guests) {
                return { table_overview: [] };
            }
            
            // Gruppiere Zuordnungen nach Tischen
            const tableOverview = {};
            
            assignments.forEach(assignment => {
                // Unterstütze beide Feldnamen-Varianten
                const tableId = assignment.table_id || assignment.tisch_id;
                const guestId = assignment.guest_id || assignment.gast_id;
                
                const table = tables.find(t => t.id === tableId);
                const guest = guests.find(g => g.id === guestId);
                
                if (table && guest) {
                    if (!tableOverview[table.name]) {
                        tableOverview[table.name] = {
                            table_id: table.id,
                            table_name: table.name,
                            guests: [],
                            total_persons: 0
                        };
                    }
                    
                    const persons = guest.anzahl_essen || guest.Anzahl_Essen || 1;
                    const children = guest.kind || guest.Kind || 0;
                    
                    tableOverview[table.name].guests.push({
                        guest_id: guest.id,
                        name: `${guest.vorname || guest.Vorname || ''} ${guest.nachname || guest.Nachname || ''}`.trim(),
                        category: guest.kategorie || guest.Kategorie || 'Unbekannt',
                        side: guest.seite || guest.Seite || '',
                        persons: persons,
                        children: children
                    });
                    
                    tableOverview[table.name].total_persons += persons;
                }
            });
            
            // Konvertiere zu Array und sortiere
            const table_list = Object.values(tableOverview).sort((a, b) => a.table_name.localeCompare(b.table_name));
            
            return { table_overview: table_list };
        } catch (error) {

            return { table_overview: [] };
        }
    },

    async clearTable(tableName) {
        try {
            // Erst alle Gäste des Tisches ermitteln und entfernen
            const assignments = await this.loadAssignments();
            const tables = await this.loadTables();
            
            const table = tables.find(t => t.name === tableName);
            if (!table) {
                return { success: false, error: 'Tisch nicht gefunden' };
            }
            
            // Unterstütze beide Feldnamen-Varianten
            const tableAssignments = assignments.filter(a => {
                const tableId = a.table_id || a.tisch_id;
                return tableId === table.id;
            });
            
            let cleared = 0;
            
            for (const assignment of tableAssignments) {
                const guestId = assignment.guest_id || assignment.gast_id;
                const result = await this.unassignGuest(guestId);
                if (result.success) {
                    cleared++;
                }
            }
            
            return { 
                success: true, 
                message: `${cleared} Gäste von Tisch "${tableName}" entfernt` 
            };
        } catch (error) {

            return { success: false, error: error.message };
        }
    },

    async deleteTableByName(tableName) {
        try {
            // Erst Tisch-ID ermitteln
            const tables = await this.loadTables();
            const table = tables.find(t => t.name === tableName);
            
            if (!table) {
                return { success: false, error: 'Tisch nicht gefunden' };
            }
            
            const response = await apiRequest(`/tischplanung/tables/${table.id}`, {
                method: 'DELETE',
                });
            
            const result = await response.json();
            return { success: true, message: result.message };
        } catch (error) {

            return { success: false, error: error.message };
        }
    },

    // Konfiguration laden
    async loadConfiguration() {
        try {
            // Standard-Konfiguration zurückgeben, da noch keine Backend-API dafür existiert
            const config = {
                defaultTableSize: 8,
                maxTableSize: 16,
                minTableSize: 2,
                defaultTableShape: 'round',
                autoSave: true,
                conflictDetection: true,
                relationshipWeights: {
                    positive: 1.0,
                    neutral: 0.0,
                    negative: -1.0
                },
                tableColors: {
                    available: '#28a745',
                    full: '#dc3545',
                    selected: '#ffc107'
                }
            };
            
            return config;
        } catch (error) {

            // Fallback-Konfiguration
            return {
                defaultTableSize: 8,
                maxTableSize: 16,
                minTableSize: 2,
                defaultTableShape: 'round',
                autoSave: true,
                conflictDetection: true
            };
        }
    },

    // Statistiken laden
    async getStatistics() {
        try {
            // Lade alle benötigten Daten
            const [tables, guests, assignments, relationships] = await Promise.all([
                this.loadTables(),
                this.loadGuests(),
                this.loadAssignments(),
                this.loadRelationships()
            ]);
            
            // Berechne Statistiken
            const stats = {
                tables: {
                    total: tables.length,
                    occupied: 0,
                    empty: 0,
                    capacity: 0
                },
                guests: {
                    total: guests.length,
                    assigned: 0,
                    unassigned: 0,
                    totalPersons: 0,
                    assignedPersons: 0
                },
                assignments: {
                    total: assignments.length
                },
                relationships: {
                    total: relationships.length,
                    positive: 0,
                    negative: 0,
                    neutral: 0
                },
                efficiency: {
                    tableUtilization: 0,
                    averageTableOccupancy: 0
                }
            };
            
            // Tisch-Statistiken berechnen
            const tableAssignments = {};
            assignments.forEach(assignment => {
                if (!tableAssignments[assignment.table_id]) {
                    tableAssignments[assignment.table_id] = [];
                }
                tableAssignments[assignment.table_id].push(assignment);
            });
            
            tables.forEach(table => {
                stats.tables.capacity += table.max_personen || 8;
                const assignedToTable = tableAssignments[table.id] || [];
                if (assignedToTable.length > 0) {
                    stats.tables.occupied++;
                } else {
                    stats.tables.empty++;
                }
            });
            
            // Gäste-Statistiken berechnen
            const assignedGuestIds = new Set(assignments.map(a => a.guest_id));
            
            guests.forEach(guest => {
                const persons = guest.Anzahl_Essen || guest.anzahl_essen || guest.Anzahl_Personen || guest.anzahl_personen || 1;
                stats.guests.totalPersons += persons;
                
                if (assignedGuestIds.has(guest.id)) {
                    stats.guests.assigned++;
                    stats.guests.assignedPersons += persons;
                } else {
                    stats.guests.unassigned++;
                }
            });
            
            // Beziehungs-Statistiken berechnen
            relationships.forEach(rel => {
                const strength = rel.staerke || 0;
                if (strength > 0) {
                    stats.relationships.positive++;
                } else if (strength < 0) {
                    stats.relationships.negative++;
                } else {
                    stats.relationships.neutral++;
                }
            });
            
            // Effizienz-Statistiken berechnen
            if (stats.tables.capacity > 0) {
                stats.efficiency.tableUtilization = Math.round((stats.guests.assignedPersons / stats.tables.capacity) * 100);
            }
            
            if (stats.tables.occupied > 0) {
                stats.efficiency.averageTableOccupancy = Math.round(stats.guests.assignedPersons / stats.tables.occupied);
            }
            
            return stats;
        } catch (error) {

            return {
                tables: { total: 0, occupied: 0, empty: 0, capacity: 0 },
                guests: { total: 0, assigned: 0, unassigned: 0, totalPersons: 0, assignedPersons: 0 },
                assignments: { total: 0 },
                relationships: { total: 0, positive: 0, negative: 0, neutral: 0 },
                efficiency: { tableUtilization: 0, averageTableOccupancy: 0 }
            };
        }
    }
};

