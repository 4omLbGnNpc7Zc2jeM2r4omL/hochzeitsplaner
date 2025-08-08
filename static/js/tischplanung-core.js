// Tischplanung Core Module
// Zentrale Steuerung und Initialisierung

class TischplanungCore {
    constructor() {
        this.guests = [];
        this.tables = [];
        this.relationships = [];
        this.assignments = [];
        this.currentZoom = 1;
        this.selectedTable = null;
        this.selectedGuest = null;
        this.draggedGuest = null;
        this.seatingChart = null;
        this.config = {};
        this.isInitializing = false;
        this.isInitialized = false;
        this.isLoadingData = false;
    }

    async initialize() {
        // Verhindere mehrfache Initialisierung
        if (this.isInitializing || this.isInitialized) {

            return;
        }
        
        this.isInitializing = true;
        const startTime = performance.now();
        
        
        this.seatingChart = document.getElementById('seatingChart');
        
        // Module laden
        await this.loadModules();
        
        // Daten laden
        await this.loadAllData();
        
        // Event Listeners einrichten
        this.setupEventListeners();
        
        // Initial rendern
        this.render();
        
        this.isInitializing = false;
        this.isInitialized = true;
        
        const loadTime = performance.now() - startTime;

    }

    async loadModules() {
        // Dynamisches Laden der Module nur bei Bedarf
        
        
        try {
            if (!window.TischplanungEventHandlers) {
                await import('./tischplanung-events.js');

            }
            if (!window.TischplanungRenderer) {
                await import('./tischplanung-renderer.js');

            }
            if (!window.TischplanungAPI) {
                await import('./tischplanung-api.js');

            }
        } catch (error) {

        }
    }

    async loadAllData() {
        // Verhindere parallele Datenladung
        if (this.isLoadingData) {

            return;
        }
        
        this.isLoadingData = true;
        
        try {
            // Erst Basis-Daten laden
            await Promise.all([
                this.loadGuests(),
                this.loadTables(),
                this.loadRelationships(),
                this.loadConfiguration()
            ]);
            
            // Dann Zuordnungen laden (benötigt bereits geladene Gäste)
            await this.loadAssignments();
        } catch (error) {

        } finally {
            this.isLoadingData = false;
        }
    }

    async loadGuests() {
        if (!window.TischplanungAPI) return;
        this.guests = await window.TischplanungAPI.loadGuests();
    }

    async loadTables() {
        if (!window.TischplanungAPI) return;
        this.tables = await window.TischplanungAPI.loadTables();
    }

    async loadRelationships() {
        if (!window.TischplanungAPI) return;
        this.relationships = await window.TischplanungAPI.loadRelationships();
    }

    async loadConfiguration() {
        if (!window.TischplanungAPI) return;
        this.config = await window.TischplanungAPI.loadConfiguration();
    }

    async loadAssignments() {
        if (!window.TischplanungAPI) return;
        
        this.assignments = await window.TischplanungAPI.loadAssignments();
        
        // Zuordnungen auf Gäste anwenden
        if (this.assignments && Array.isArray(this.assignments) && this.assignments.length > 0) {
            let applied = 0;
            this.assignments.forEach(assignment => {
                // Prüfe beide Feldnamen-Varianten
                const guestId = assignment.guest_id || assignment.gast_id;
                const tableId = assignment.table_id || assignment.tisch_id;
                
                if (!guestId || !tableId) {
                    return;
                }
                
                const guest = this.guests.find(g => g.id === guestId);
                if (guest) {
                    guest.table_id = tableId;
                    guest.assigned_table = tableId; // Legacy Support
                    applied++;
                }
            });
        }
    }

    setupEventListeners() {
        if (!window.TischplanungEventHandlers) return;
        window.TischplanungEventHandlers.setup(this);
    }

    async render() {
        if (!window.TischplanungRenderer) return;
        await window.TischplanungRenderer.renderSeatingChart(this);
    }
}

// Globale Instanz (nur einmal erstellen)
if (!window.tischplanung) {
    window.tischplanung = new TischplanungCore();
}

// Initialisierung wenn DOM bereit ist
document.addEventListener('DOMContentLoaded', function() {
    // Nur initialisieren wenn noch nicht initialisiert
    if (!window.tischplanung.isInitialized && !window.tischplanung.isInitializing) {
        window.tischplanung.initialize();
    }
});

// =====================================================
// GLOBALE FUNKTIONEN FÜR TEMPLATE-KOMPATIBILITÄT
// =====================================================

// Globale Funktionen für onclick-Handler in der HTML-Template
window.showRelationshipsOverview = async function() {

    
    try {
        // Sicherstellen, dass Tischplanung initialisiert ist
        if (!window.tischplanung) {

            await window.initTischplanung();
        }
        
        // Aktuelle Beziehungen und Gäste laden

        await window.tischplanung.loadRelationships();
        await window.tischplanung.loadGuests();
        
        const relationships = window.tischplanung.relationships || [];
        const guests = window.tischplanung.guests || [];
        

        
        // Entferne vorhandenes Modal, falls vorhanden
        const existingModal = document.getElementById('relationshipsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Modal für Beziehungen-Übersicht erstellen
        const modalHtml = `
            <div class="modal fade modal-wedding" id="relationshipsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                            <h5 class="modal-title">
                                <i class="bi bi-heart me-2"></i>Beziehungen verwalten
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <div class="card card-wedding">
                                        <div class="card-header card-wedding">
                                            <h6 class="mb-0 text-wedding"><i class="bi bi-list me-2"></i>Bestehende Beziehungen (${relationships.length})</h6>
                                        </div>
                                        <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                                            <div id="relationshipsList">
                                                ${relationships.length > 0 ? generateRelationshipsList(relationships, guests) : '<div class="text-muted text-center py-3">Keine Beziehungen definiert</div>'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card card-wedding">
                                        <div class="card-header card-wedding">
                                            <h6 class="mb-0 text-wedding"><i class="bi bi-plus-circle me-2"></i>Neue Beziehung hinzufügen</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="addRelationshipForm">
                                                ${generateAddRelationshipForm(guests)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                            <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x me-2"></i>Schließen
                            </button>
                            <button type="button" class="btn btn-wedding-primary" onclick="refreshRelationships()">
                                <i class="bi bi-arrow-clockwise me-2"></i>Aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Modal HTML einfügen
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Modal anzeigen
        const modal = new bootstrap.Modal(document.getElementById('relationshipsModal'));
        modal.show();
        

        
    } catch (error) {

        alert('Fehler beim Laden der Beziehungen: ' + error.message);
    }
};

// Sicherstellen, dass unsere Implementierung die Template-Funktion überschreibt
document.addEventListener('DOMContentLoaded', function() {
    // Override jede bestehende showRelationshipsOverview Funktion
    setTimeout(() => {
        window.showRelationshipsOverview = async function() {

            
            try {
                // Sicherstellen, dass Tischplanung initialisiert ist
                if (!window.tischplanung) {

                    window.tischplanung = new TischplanungCore();
                    await window.tischplanung.initialize();
                }
                
                // Aktuelle Beziehungen und Gäste laden

                await window.tischplanung.loadRelationships();
                await window.tischplanung.loadGuests();
                
                const relationships = window.tischplanung.relationships || [];
                const guests = window.tischplanung.guests || [];
                

                
                // Entferne vorhandenes Modal, falls vorhanden
                const existingModal = document.getElementById('relationshipsModal');
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Modal für Beziehungen-Übersicht erstellen
                const modalHtml = `
                    <div class="modal fade modal-wedding" id="relationshipsModal" tabindex="-1">
                        <div class="modal-dialog modal-xl">
                            <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                                <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                                    <h5 class="modal-title">
                                        <i class="bi bi-heart me-2"></i>Beziehungen verwalten
                                    </h5>
                                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="row mb-3">
                                        <div class="col-md-6">
                                            <div class="card card-wedding">
                                                <div class="card-header card-wedding">
                                                    <h6 class="mb-0 text-wedding"><i class="bi bi-list me-2"></i>Bestehende Beziehungen (${relationships.length})</h6>
                                                </div>
                                                <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                                                    <div id="relationshipsList">
                                                        ${relationships.length > 0 ? generateRelationshipsList(relationships, guests) : '<div class="text-muted text-center py-3">Keine Beziehungen definiert</div>'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="card card-wedding">
                                                <div class="card-header card-wedding">
                                                    <h6 class="mb-0 text-wedding"><i class="bi bi-plus-circle me-2"></i>Neue Beziehung hinzufügen</h6>
                                                </div>
                                                <div class="card-body">
                                                    <div id="addRelationshipForm">
                                                        ${generateAddRelationshipForm(guests)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                                    <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">
                                        <i class="bi bi-x me-2"></i>Schließen
                                    </button>
                                    <button type="button" class="btn btn-wedding-primary" onclick="refreshRelationships()">
                                        <i class="bi bi-arrow-clockwise me-2"></i>Aktualisieren
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Modal HTML einfügen
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                // Modal anzeigen
                const modal = new bootstrap.Modal(document.getElementById('relationshipsModal'));
                modal.show();
                
                // Beziehungen-Modal erfolgreich angezeigt
                
            } catch (error) {

                alert('Fehler beim Laden der Beziehungen: ' + error.message);
            }
        };
    }, 100); // Warten bis Template-Scripts geladen sind
});

// Hilfsfunktionen für Beziehungen-Verwaltung
function generateRelationshipsList(relationships, guests) {
    if (!relationships || relationships.length === 0) {
        return '<div class="text-muted text-center py-3">Keine Beziehungen definiert</div>';
    }
    
    // Hochzeitspaar-Namen ermitteln
    let weddingCoupleName = window.WEDDING_COUPLE_NAME || window.weddingCoupleName;
    if (!weddingCoupleName || weddingCoupleName === " & " || weddingCoupleName.trim() === "&" || weddingCoupleName === "Braut & Bräutigam") {
        if (window.BRIDE_NAME && window.GROOM_NAME) {
            weddingCoupleName = `${window.BRIDE_NAME} & ${window.GROOM_NAME}`;
        } else if (window.BRAUT_NAME && window.BRAEUTIGAM_NAME) {
            weddingCoupleName = `${window.BRAUT_NAME} & ${window.BRAEUTIGAM_NAME}`;
        } else {
            weddingCoupleName = 'Brautpaar';
        }
    }
    
    return relationships.map(rel => {
        // Gast 1 ermitteln
        let guest1;
        if (rel.gast_id_1 === -1) {
            guest1 = { vorname: '💒', nachname: weddingCoupleName };
        } else {
            guest1 = guests.find(g => g.id === rel.gast_id_1) || { vorname: 'Unbekannt', nachname: '' };
        }
        
        // Gast 2 ermitteln
        let guest2;
        if (rel.gast_id_2 === -1) {
            guest2 = { vorname: '💒', nachname: weddingCoupleName };
        } else {
            guest2 = guests.find(g => g.id === rel.gast_id_2) || { vorname: 'Unbekannt', nachname: '' };
        }
        
        const strengthColor = rel.staerke > 0 ? 'success' : rel.staerke < 0 ? 'danger' : 'secondary';
        const strengthIcon = rel.staerke > 0 ? 'bi-heart-fill' : rel.staerke < 0 ? 'bi-heart-break' : 'bi-heart';
        
        return `
            <div class="border rounded p-3 mb-2 bg-light">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1">
                        <strong>${guest1.vorname} ${guest1.nachname}</strong>
                        <span class="mx-2">↔</span>
                        <strong>${guest2.vorname} ${guest2.nachname}</strong>
                        <br>
                        <small class="text-muted">${rel.beziehungstyp || 'Nicht angegeben'}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-${strengthColor}">
                            <i class="bi ${strengthIcon} me-1"></i>
                            ${rel.staerke}
                        </span>
                        <br>
                        <button class="btn btn-sm btn-outline-danger mt-1" onclick="deleteRelationship(${rel.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function generateAddRelationshipForm(guests) {
    // Hochzeitspaar-Namen ermitteln
    let weddingCoupleName = window.WEDDING_COUPLE_NAME || window.weddingCoupleName;
    if (!weddingCoupleName || weddingCoupleName === " & " || weddingCoupleName.trim() === "&" || weddingCoupleName === "Braut & Bräutigam") {
        // Fallback: Namen aus verschiedenen Quellen zusammensetzen
        if (window.BRIDE_NAME && window.GROOM_NAME) {
            weddingCoupleName = `${window.BRIDE_NAME} & ${window.GROOM_NAME}`;
        } else if (window.BRAUT_NAME && window.BRAEUTIGAM_NAME) {
            weddingCoupleName = `${window.BRAUT_NAME} & ${window.BRAEUTIGAM_NAME}`;
        } else {
            weddingCoupleName = 'Brautpaar';
        }
    }
    
    const guestOptions = guests.map(guest => 
        `<option value="${guest.id}">${guest.vorname} ${guest.nachname}</option>`
    ).join('');
    
    return `
        <form id="relationshipForm" onsubmit="addRelationship(event)">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Gast 1:</label>
                    <select class="form-select" id="guest1Select" required>
                        <option value="">Gast auswählen...</option>
                        <option value="brautpaar" style="font-weight: bold; color: #d63384;">💒 ${weddingCoupleName}</option>
                        ${guestOptions}
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Gast 2:</label>
                    <select class="form-select" id="guest2Select" required>
                        <option value="">Gast auswählen...</option>
                        <option value="brautpaar" style="font-weight: bold; color: #d63384;">💒 ${weddingCoupleName}</option>
                        ${guestOptions}
                    </select>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Beziehungstyp:</label>
                    <select class="form-select" id="relationshipType" required>
                        <option value="">Typ auswählen...</option>
                        <optgroup label="👨‍👩‍👧‍👦 Familie & Partner">
                            <option value="trauzeugen">👰‍♀️ Trauzeugen</option>
                            <option value="familie">👨‍👩‍👧‍👦 Familie</option>
                            <option value="verwandte">👥 Verwandte</option>
                            <option value="partner">💑 Partner</option>
                        </optgroup>
                        <optgroup label="😊 Freunde">
                            <option value="beste_freunde">💯 Beste Freunde</option>
                            <option value="freunde">😊 Freunde</option>
                            <option value="studienfreunde">🎓 Studienfreunde</option>
                        </optgroup>
                        <optgroup label="💼 Beruf & Hobby">
                            <option value="kollegen">💼 Kollegen</option>
                            <option value="ehemalige_kollegen">📋 Ehemalige Kollegen</option>
                            <option value="geschaeftlich">🤝 Geschäftlich</option>
                            <option value="sportverein">⚽ Sportverein</option>
                            <option value="hobby">🎨 Hobby-Partner</option>
                        </optgroup>
                        <optgroup label="🏠 Nachbarschaft & Bekannte">
                            <option value="nachbarn">🏠 Nachbarn</option>
                            <option value="bekannte">👋 Bekannte</option>
                            <option value="neutral">😐 Neutral</option>
                        </optgroup>
                        <optgroup label="😤 Problematisch">
                            <option value="ex_partner">💔 Ex-Partner</option>
                            <option value="spinnen_sich_nicht">😤 Spinnen sich nicht</option>
                            <option value="konflikt">⚡ Konflikt</option>
                        </optgroup>
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Stärke:</label>
                    <select class="form-select" id="relationshipStrength" required>
                        <option value="">Stärke auswählen...</option>
                        <option value="2">+2 (Sehr positive Beziehung)</option>
                        <option value="1">+1 (Positive Beziehung)</option>
                        <option value="0">0 (Neutrale Beziehung)</option>
                        <option value="-1">-1 (Leicht negative Beziehung)</option>
                        <option value="-2">-2 (Sehr negative Beziehung)</option>
                    </select>
                </div>
            </div>
            <div class="text-center">
                <button type="submit" class="btn btn-success">
                    <i class="bi bi-plus-circle me-2"></i>Beziehung hinzufügen
                </button>
            </div>
        </form>
    `;
}

// Funktionen für Beziehungs-Management
async function addRelationship(event) {
    event.preventDefault();
    
    const guest1Value = document.getElementById('guest1Select').value;
    const guest2Value = document.getElementById('guest2Select').value;
    const relationshipType = document.getElementById('relationshipType').value;
    const strength = parseInt(document.getElementById('relationshipStrength').value);
    
    // Konvertiere "brautpaar" zu -1 (spezielle ID für Brautpaar)
    const guest1Id = guest1Value === 'brautpaar' ? -1 : parseInt(guest1Value);
    const guest2Id = guest2Value === 'brautpaar' ? -1 : parseInt(guest2Value);
    
    if (guest1Id === guest2Id) {
        alert('Ein Gast kann keine Beziehung zu sich selbst haben!');
        return;
    }
    
    try {
        // Sicherstellen, dass TischplanungAPI geladen ist
        if (!window.TischplanungAPI) {

            await import('./tischplanung-api.js');
        }
        
        const result = await window.TischplanungAPI.saveRelationship({
            gast_id_1: guest1Id,
            gast_id_2: guest2Id,
            beziehungstyp: relationshipType,
            staerke: strength
        });
        
        if (result.success) {
            await refreshRelationships();
            // Formular zurücksetzen
            const form = document.getElementById('relationshipForm');
            if (form && typeof form.reset === 'function') {
                form.reset();
            } else {
                // Manueller Reset wenn form.reset nicht funktioniert
                document.getElementById('guest1Select').value = '';
                document.getElementById('guest2Select').value = '';
                document.getElementById('relationshipType').value = '';
                document.getElementById('relationshipStrength').value = '';
            }
        } else {
            alert('Fehler beim Hinzufügen der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
        }
    } catch (error) {

        alert('Fehler beim Hinzufügen der Beziehung: ' + error.message);
    }
}

async function deleteRelationship(relationshipId) {
    if (!confirm('Möchten Sie diese Beziehung wirklich löschen?')) {
        return;
    }
    
    try {
        // Sicherstellen, dass TischplanungAPI geladen ist
        if (!window.TischplanungAPI) {

            await import('./tischplanung-api.js');
        }
        
        const result = await window.TischplanungAPI.deleteRelationship(relationshipId);
        
        if (result.success) {
            await refreshRelationships();
        } else {
            alert('Fehler beim Löschen der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
        }
    } catch (error) {

        alert('Fehler beim Löschen der Beziehung: ' + error.message);
    }
}

async function refreshRelationships() {
    try {
        // Sicherstellen, dass Tischplanung verfügbar ist
        if (!window.tischplanung) {

            window.tischplanung = new TischplanungCore();
            await window.tischplanung.initialize();
        }
        
        await window.tischplanung.loadRelationships();
        await window.tischplanung.loadGuests();
        
        const relationships = window.tischplanung.relationships || [];
        const guests = window.tischplanung.guests || [];
        
        // Beziehungsliste aktualisieren
        const relationshipsList = document.getElementById('relationshipsList');
        if (relationshipsList) {
            relationshipsList.innerHTML = relationships.length > 0 ? 
                generateRelationshipsList(relationships, guests) : 
                '<div class="text-muted text-center py-3">Keine Beziehungen definiert</div>';
        }
        
        // Anzahl in Header aktualisieren
        const headerElement = document.querySelector('#relationshipsModal .card-header h6');
        if (headerElement) {
            headerElement.innerHTML = `<i class="bi bi-list me-2"></i>Bestehende Beziehungen (${relationships.length})`;
        }
    } catch (error) {

        alert('Fehler beim Aktualisieren der Beziehungen: ' + error.message);
    }
}

window.showStatistics = function() {

    
    // Sicherstellen, dass alle Daten geladen sind
    if (!window.tischplanung || !window.tischplanung.tables || !window.tischplanung.guests) {

        
        // Falls die Initialisierung noch läuft, warten wir kurz und versuchen es erneut
        setTimeout(() => {
            if (window.tischplanung && window.tischplanung.tables && window.tischplanung.guests) {
                window.showStatistics();
            } else {

                // Fallback-Daten setzen
                window.tischplanung = window.tischplanung || {};
                window.tischplanung.tables = window.tischplanung.tables || [];
                window.tischplanung.guests = window.tischplanung.guests || [];
                window.showStatistics(); // Rekursiver Aufruf mit leeren Daten
            }
        }, 1000);
        return;
    }
    
    // Statistiken berechnen - basierend auf anzahl_essen, nicht auf Gäste-Einträge
    const totalPersons = window.tischplanung.guests.reduce((sum, guest) => sum + (guest.anzahl_essen || guest.Anzahl_Essen || 0), 0);
    const assignedPersons = window.tischplanung.guests.filter(g => g.table_id).reduce((sum, guest) => sum + (guest.anzahl_essen || guest.Anzahl_Essen || 0), 0);
    const unassignedPersons = totalPersons - assignedPersons;
    
    // Zusätzlich Gäste-Einträge für weitere Statistiken
    const totalGuests = window.tischplanung.guests.length;
    const assignedGuests = window.tischplanung.guests.filter(g => g.table_id).length;
    const unassignedGuests = totalGuests - assignedGuests;
    const totalTables = window.tischplanung.tables.length;
    const usedTables = window.tischplanung.tables.filter(t => 
        window.tischplanung.guests.some(g => g.table_id === t.id)
    ).length;
    
    // Konflikte berechnen
    let conflicts = 0;
    const conflictDetails = [];
    
    window.tischplanung.relationships.forEach(rel => {
        if (rel.type === 'negative') {
            const guest1 = window.tischplanung.guests.find(g => g.id === rel.guest1_id);
            const guest2 = window.tischplanung.guests.find(g => g.id === rel.guest2_id);
            
            if (guest1 && guest2 && guest1.table_id && guest2.table_id && guest1.table_id === guest2.table_id) {
                conflicts++;
                const table = window.tischplanung.tables.find(t => t.id === guest1.table_id);
                conflictDetails.push({
                    guest1: guest1.name,
                    guest2: guest2.name,
                    table: table ? table.name : 'Unbekannt',
                    type: rel.relationship_type || 'Konflikt'
                });
            }
        }
    });
    
    // Modal für Statistiken erstellen
    const modalHtml = `
        <div class="modal fade modal-wedding" id="statisticsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                        <h5 class="modal-title">
                            <i class="bi bi-graph-up me-2"></i>Tischplanung-Statistiken
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card mb-3 card-wedding">
                                    <div class="card-header">
                                        <h6 class="mb-0 text-wedding">👥 Gäste-Übersicht</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="row text-center">
                                            <div class="col-4">
                                                <h4 class="text-wedding">${totalPersons}</h4>
                                                <small class="text-wedding">Gesamt</small>
                                            </div>
                                            <div class="col-4">
                                                <h4 class="text-wedding">${assignedPersons}</h4>
                                                <small>Zugeordnet</small>
                                            </div>
                                            <div class="col-4">
                                                <h4 class="text-wedding">${unassignedPersons}</h4>
                                                <small>Offen</small>
                                            </div>
                                        </div>
                                        <div class="progress mt-2">
                                            <div class="progress-bar" style="background: linear-gradient(135deg, #d4af37, #f4e4bc); width: ${totalPersons > 0 ? (assignedPersons/totalPersons)*100 : 0}%"></div>
                                        </div>
                                        <small class="text-muted">${totalPersons > 0 ? Math.round((assignedPersons/totalPersons)*100) : 0}% zugeordnet</small>
                                    </div>
                                </div>
                                
                                <div class="card mb-3 card-wedding">
                                    <div class="card-header">
                                        <h6 class="mb-0 text-wedding">🍽️ Tisch-Übersicht</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="row text-center">
                                            <div class="col-6">
                                                <h4 class="text-wedding">${totalTables}</h4>
                                                <small class="text-wedding">Gesamt</small>
                                            </div>
                                            <div class="col-6">
                                                <h4 class="text-wedding">${usedTables}</h4>
                                                <small class="text-wedding">Belegt</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="card mb-3 card-wedding">
                                    <div class="card-header ${conflicts > 0 ? '' : ''}">
                                        <h6 class="mb-0 ${conflicts > 0 ? 'text-danger' : 'text-wedding'}">⚠️ Konflikte</h6>
                                    </div>
                                    <div class="card-body">
                                        <h4 class="text-center ${conflicts > 0 ? 'text-danger' : 'text-wedding'}">${conflicts}</h4>
                                        <p class="text-center mb-0">${conflicts > 0 ? 'Konflikte gefunden' : 'Keine Konflikte'}</p>
                                        
                                        ${conflicts > 0 ? `
                                            <hr>
                                            <div class="conflict-details">
                                                <h6>Konflikt-Details:</h6>
                                                ${conflictDetails.map(conflict => `
                                                    <div class="alert p-2 mb-2" style="background: linear-gradient(135deg, #8b7355, #a68660); color: white; border: 1px solid #6d5a44;">
                                                        <strong>${conflict.guest1}</strong> & <strong>${conflict.guest2}</strong><br>
                                                        <small>Tisch: ${conflict.table} | Typ: ${conflict.type}</small>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Schließen</button>
                        ${conflicts > 0 ? '<button type="button" class="btn btn-wedding-secondary" onclick="highlightConflicts()">Konflikte markieren</button>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Modal HTML einfügen
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('statisticsModal'));
    modal.show();
    
    // Modal nach dem Schließen aus DOM entfernen
    document.getElementById('statisticsModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
};

window.clearAllTables = async function() {

    
    let confirmed;
    if (window.showConfirm) {
        confirmed = await window.showConfirm(
            'Alle Zuordnungen zurücksetzen',
            'Möchten Sie wirklich alle Tischzuordnungen zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.'
        );
    } else {
        confirmed = confirm('Möchten Sie wirklich alle Tischzuordnungen zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.');
    }
    
    if (!confirmed) {
        return;
    }
    
    if (window.TischplanungAPI && window.TischplanungAPI.clearAllAssignments) {
        window.TischplanungAPI.clearAllAssignments().then(result => {
            if (result.success) {
                // Nur Gäste neu laden (nicht alle Daten)
                window.tischplanung.loadGuests().then(() => {
                    window.tischplanung.render();

                });
            } else {
                if (window.showError) {
                    window.showError('Fehler beim Zurücksetzen der Zuordnungen: ' + (result.message || 'Unbekannter Fehler'));
                } else {
                    alert('Fehler beim Zurücksetzen der Zuordnungen: ' + (result.message || 'Unbekannter Fehler'));
                }
            }
        }).catch(error => {

            if (window.showError) {
                window.showError('Fehler beim Zurücksetzen der Zuordnungen.');
            } else {
                alert('Fehler beim Zurücksetzen der Zuordnungen.');
            }
        });
    } else {

        if (window.showError) {
            window.showError('API nicht verfügbar. Bitte Seite neu laden.');
        } else {
            alert('API nicht verfügbar. Bitte Seite neu laden.');
        }
    }
};

// Hilfsfunktionen
window.deleteRelationship = function(relationshipId) {
    if (!confirm('Möchten Sie diese Beziehung wirklich löschen?')) {
        return;
    }
    
    if (window.TischplanungAPI && window.TischplanungAPI.deleteRelationship) {
        window.TischplanungAPI.deleteRelationship(relationshipId).then(result => {
            if (result.success) {
                // Nur Beziehungen neu laden
                window.tischplanung.loadRelationships().then(() => {
                    // Modal schließen und neu öffnen um aktualisierte Daten zu zeigen
                    const modal = bootstrap.Modal.getInstance(document.getElementById('relationshipsModal'));
                    if (modal) {
                        modal.hide();
                        setTimeout(() => window.showRelationshipsOverview(), 300);
                    }
                });
            }
        });
    }
};

window.highlightConflicts = function() {

    
    // Modal schließen
    const modal = bootstrap.Modal.getInstance(document.getElementById('statisticsModal'));
    if (modal) {
        modal.hide();
    }
    
    // Alle Tische normal färben
    document.querySelectorAll('.table-element').forEach(table => {
        table.style.borderColor = '#007bff';
        table.style.backgroundColor = '#ffffff';
    });
    
    // Konflikte finden und markieren
    let conflictCount = 0;
    window.tischplanung.relationships.forEach(rel => {
        if (rel.type === 'negative') {
            const guest1 = window.tischplanung.guests.find(g => g.id === rel.guest1_id);
            const guest2 = window.tischplanung.guests.find(g => g.id === rel.guest2_id);
            
            if (guest1 && guest2 && guest1.table_id && guest2.table_id && guest1.table_id === guest2.table_id) {
                // Tisch mit Konflikt rot markieren
                const tableElement = document.querySelector(`[data-table-id="${guest1.table_id}"]`);
                if (tableElement) {
                    tableElement.style.borderColor = '#dc3545';
                    tableElement.style.backgroundColor = '#ffe6e6';
                    conflictCount++;
                }
            }
        }
    });
    
    if (conflictCount === 0) {
        if (window.showSuccess) {
            window.showSuccess('Keine Konflikte gefunden! 🎉');
        } else {
            alert('Keine Konflikte gefunden! 🎉');
        }
    } else {
        if (window.showInfo) {
            window.showInfo(`${conflictCount} konfliktbehaftete Tische wurden rot markiert.`);
        } else {
            alert(`${conflictCount} konfliktbehaftete Tische wurden rot markiert.`);
        }
    }
};

