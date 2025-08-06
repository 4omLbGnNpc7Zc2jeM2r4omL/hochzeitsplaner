// Tischplanung JavaScript
// Hochzeitsplaner - Interaktive Sitzplatz-Planung

let guests = [];
let tables = [];
let relationships = [];
let currentZoom = 1;
let selectedTable = null;
let selectedGuest = null;
let draggedGuest = null;
let seatingChart;
let tischplanung_config = {}; // Globale Konfiguration für Standard-Tischgröße

// App-Einstellungen laden (insbesondere Brautpaar-Namen)
async function loadAppSettings() {
    try {
        console.log('📋 Lade App-Einstellungen für Brautpaar-Namen...');
        const response = await fetch('/api/settings/get');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.settings) {
                window.appSettings = data.settings;
                console.log('💍 Brautpaar-Namen geladen:', {
                    braut_name: data.settings.braut_name,
                    braeutigam_name: data.settings.braeutigam_name
                });
            } else {
                console.warn('⚠️ Einstellungen konnten nicht geladen werden');
                window.appSettings = {};
            }
        } else {
            console.warn('⚠️ Fehler beim Laden der Einstellungen:', response.status);
            window.appSettings = {};
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der App-Einstellungen:', error);
        window.appSettings = {};
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    const startTime = performance.now();
    console.log('🚀 Tischplanung-Initialisierung gestartet');
    
    seatingChart = document.getElementById('seatingChart');
    
    // Lade Brautpaar-Namen aus den Einstellungen für korrekte Tischbenennung
    loadAppSettings().then(() => {
        return initializeSeatingPlan();
    }).then(() => {
        const loadTime = performance.now() - startTime;

    });
    
    setupEventListeners();
    setupTouchSupport();
    setupKeyboardShortcuts();
});

// Event Listeners setup
function setupEventListeners() {
    // Drag & Drop für Gäste
    seatingChart.addEventListener('dragover', handleDragOver);
    seatingChart.addEventListener('drop', handleDrop);
    
    // Zoom mit Mausrad
    seatingChart.addEventListener('wheel', handleZoom);
    
    // Tisch-Bewegung (Pan)
    let isPanning = false;
    let startX, startY;
    
    seatingChart.addEventListener('mousedown', function(e) {
        if (e.target === seatingChart) {
            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            seatingChart.style.cursor = 'grabbing';
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isPanning) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            // Pan-Logik hier implementieren
        }
    });
    
    document.addEventListener('mouseup', function() {
        isPanning = false;
        seatingChart.style.cursor = 'move';
    });
}

// Initialisierung der Sitzplanung
async function initializeSeatingPlan() {
    console.log('🚀 Initialisiere Sitzplanung...');
    
    showLoading(true);
    try {
        console.log('⏰ Lade wichtige Daten...');
        
        // Wichtige Daten zuerst laden
        await Promise.all([
            loadGuests(),
            loadTables(),
            loadConfiguration()
        ]);
        
        console.log('🖼️ Rendere UI-Komponenten...');
        renderSeatingChart();
        renderGuestList();
        updateStatistics();
        
        // Debug: Prüfe ob wichtige DOM-Elemente existieren
        console.log('🔍 Debug - DOM-Elemente prüfen:');
        console.log('- statisticsContent:', !!document.getElementById('statisticsContent'));
        console.log('- tableOverviewModal:', !!document.getElementById('tableOverviewModal'));
        console.log('- tableOverviewContent:', !!document.getElementById('tableOverviewContent'));
        console.log('- guestList:', !!document.getElementById('guestList'));
        console.log('- seatingChart:', !!document.getElementById('seatingChart'));
        
        // Beziehungen im Hintergrund nachladen (nicht-blockierend)
        setTimeout(() => {
            console.log('💝 Lade Beziehungen nach...');
            loadRelationships().then(() => {
                console.log('💝 Beziehungen nachgeladen');
                renderGuestList(); // UI mit Beziehungsindikatoren aktualisieren
            });
        }, 100);
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Tischplanung:', error);
        showAlert('Fehler beim Laden der Daten', 'danger');
    } finally {
        showLoading(false);
        console.log('✅ Tischplanung-Initialisierung abgeschlossen');
    }
}

// Daten laden
async function loadGuests() {
    try {

        
        const response = await fetch('/api/gaeste/list');
        console.log('📡 API Response Status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📦 Erhaltene Daten:', data);
        
        if (!data.success) {
            throw new Error(data.error || 'Unbekannter Fehler beim Laden der Gäste');
        }
        
        // Gäste-Array aus der API-Antwort extrahieren
        const guestList = data.gaeste || [];
        console.log('👥 Rohe Gästeliste:', guestList.length, 'Einträge');
        
        // Alle Gäste laden, aber NUR die mit anzahl_essen > 0 für die Tischplanung
        const allGuests = guestList.map(guest => ({
            ...guest,
            anzahl_essen: guest.anzahl_essen || guest.Anzahl_Essen || 0, // Kein Standardwert von 1!
            assigned_table: null,
            conflicts: []
        }));
        
        // Nur Gäste mit anzahl_essen > 0 für die Tischplanung anzeigen
        guests = allGuests.filter(guest => {
            const essenAnzahl = guest.anzahl_essen || 0;
            return essenAnzahl > 0;
        });
        
        console.log(`🍽️ ${guests.length} von ${allGuests.length} Gästen haben anzahl_essen > 0`);
        if (guests.length > 0) {
            console.log('👤 Beispiel-Gast für Tischplanung:', guests[0]);
        }
        
        // Debug: Zeige Gäste mit anzahl_essen = 0
        const noFoodGuests = allGuests.filter(g => (g.anzahl_essen || 0) === 0);
        if (noFoodGuests.length > 0) {
            console.log(`ℹ️ ${noFoodGuests.length} Gäste haben anzahl_essen = 0 und werden nicht in der Tischplanung angezeigt:`, 
                noFoodGuests.map(g => `${g.Vorname} ${g.Nachname}`));
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Gäste:', error);
        guests = []; // Fallback auf leere Liste
        
        // Verwende window.alert als Fallback falls showAlert nicht verfügbar
        const alertFunction = window.showAlert || window.alert;
        alertFunction('Fehler beim Laden der Gäste: ' + error.message);
    }
}

async function loadTables() {
    try {
        console.log('🏗️ Lade Tische vom Backend...');
        const response = await fetch('/api/tischplanung/tables');
        if (!response.ok) {
            console.warn('⚠️ Tische-API nicht verfügbar, verwende leere Liste');
            tables = [];
            return;
        }
        
        const data = await response.json();
        console.log('📦 Tische-Daten erhalten:', data);
        
        // Konvertiere API-Format zu Frontend-Format
        if (Array.isArray(data)) {
            tables = data.map(table => ({
                id: table.id,
                name: table.name,
                max_personen: table.capacity || table.max_personen || 8,
                x_position: table.x || table.x_position || 100,
                y_position: table.y || table.y_position || 100,
                farbe: table.farbe || table.color || '#007bff',
                form: table.shape || 'round'
            }));
        } else if (data.tables && Array.isArray(data.tables)) {
            tables = data.tables.map(table => ({
                id: table.id,
                name: table.name,
                max_personen: table.capacity || table.max_personen || 8,
                x_position: table.x || table.x_position || 100,
                y_position: table.y || table.y_position || 100,
                farbe: table.farbe || table.color || '#007bff',
                form: table.shape || 'round'
            }));
        } else {
            console.warn('⚠️ Unerwartetes Datenformat für Tische:', data);
            tables = [];
        }
        
        console.log(`🏗️ ${tables.length} Tische geladen und konvertiert`);
        
        // Lade auch bestehende Zuordnungen und aktualisiere Gäste-Objekte
        await loadExistingAssignments();
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Tische:', error);
        tables = [];
    }
}

async function loadExistingAssignments() {
    try {
        console.log('📋 Lade bestehende Zuordnungen...');
        const response = await fetch('/api/tischplanung/assignments');
        if (!response.ok) {
            console.warn('⚠️ Zuordnungs-API nicht verfügbar');
            return;
        }
        
        const assignments = await response.json();
        console.log('📦 Zuordnungen erhalten:', assignments);
        
        // Aktualisiere Gäste mit Zuordnungen
        if (Array.isArray(assignments)) {
            assignments.forEach(assignment => {
                // Handle both possible field names
                const guestId = assignment.gast_id || assignment.guest_id;
                const tableId = assignment.tisch_id || assignment.table_id;
                
                const guest = guests.find(g => g.id === guestId);
                if (guest && tableId) {
                    guest.assigned_table = tableId;
                }
            });
            
            console.log(`📋 ${assignments.length} Zuordnungen auf Gäste angewendet`);
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Zuordnungen:', error);
    }
}

async function loadRelationships() {
    try {
        // Nur laden wenn noch keine Beziehungen vorhanden
        if (relationships.length === 0) {
            const response = await fetch('/api/tischplanung/relationships');
            if (response.ok) {
                relationships = await response.json();
            }
        }
    } catch (error) {
        console.warn('Beziehungen konnten nicht geladen werden:', error);
        relationships = [];
    }
}

// Beziehungen forciert neu laden (nur bei Änderungen)
async function reloadRelationships() {
    try {
        const response = await fetch('/api/tischplanung/relationships');
        if (response.ok) {
            relationships = await response.json();
        }
    } catch (error) {
        console.warn('Beziehungen konnten nicht neu geladen werden:', error);
    }
}

async function loadConfiguration() {
    try {
        const response = await fetch('/api/tischplanung/config');
        if (response.ok) {
            tischplanung_config = await response.json();
            document.getElementById('defaultTableSize').value = tischplanung_config.standard_tisch_groesse || 8;
        }
    } catch (error) {
        console.log('Konfiguration nicht verfügbar, verwende Standardwerte');
        tischplanung_config = { standard_tisch_groesse: 8 };
    }
}

// Hilfsfunktion um Standard-Tischgröße zu erhalten
function getStandardTableSize() {
    console.log('🔧 getStandardTableSize() - Config:', tischplanung_config);
    const standardSize = tischplanung_config.standard_tisch_groesse || 10; // Geändert von 8 auf 10
    console.log('📏 Standard-Tischgröße:', standardSize);
    return standardSize;
}

// Sitzplan rendern
function renderSeatingChart() {
    const currentSelection = selectedTableId;
    
    // Bestehende Tische merken für Stabilität
    const existingTables = {};
    document.querySelectorAll('.table-element').forEach(el => {
        const tableId = el.dataset.tableId;
        if (tableId) {
            existingTables[tableId] = {
                element: el,
                position: { x: el.style.left, y: el.style.top }
            };
        }
    });
    
    // Nur neue/geänderte Tische neu rendern
    tables.forEach(table => {
        const existingElement = existingTables[table.id];
        
        if (existingElement) {
            // Bestehenden Tisch aktualisieren statt neu erstellen
            updateExistingTableElement(existingElement.element, table);
            delete existingTables[table.id]; // Markieren als verarbeitet
        } else {
            // Neuen Tisch erstellen
            const tableElement = createTableElement(table);
            seatingChart.appendChild(tableElement);
        }
    });
    
    // Entfernte Tische löschen
    Object.values(existingTables).forEach(({ element }) => {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    
    // Selektion wiederherstellen
    if (currentSelection) {
        selectTable(currentSelection);
    }
    
    updateMinimap();
}

// Bestehenden Tisch aktualisieren ohne Position zu verlieren
function updateExistingTableElement(element, table) {
    // Nur Position aktualisieren wenn sie sich geändert hat
    const currentX = parseInt(element.style.left) || 0;
    const currentY = parseInt(element.style.top) || 0;
    
    if (currentX !== (table.x_position || 0) || currentY !== (table.y_position || 0)) {
        element.style.left = `${table.x_position || 0}px`;
        element.style.top = `${table.y_position || 0}px`;
    }
    
    // Farbe aktualisieren
    element.style.borderColor = table.farbe || '#007bff';
    
    // Zugewiesene Gäste zählen
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    const occupancy = assignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
    const maxPersons = table.max_personen || getStandardTableSize();
    
    // Status-Klassen aktualisieren
    element.classList.remove('empty', 'full');
    if (occupancy === 0) {
        element.classList.add('empty');
    } else if (occupancy >= maxPersons) {
        element.classList.add('full');
    }
    
    // Inhalt aktualisieren
    const tableName = element.querySelector('.table-name');
    const tableOccupancy = element.querySelector('.table-occupancy');
    
    if (tableName) tableName.textContent = table.name || generateTableName(table.id - 1);
    if (tableOccupancy) tableOccupancy.textContent = `${occupancy}/${maxPersons} Essen`;
    
    // Gäste-Vorschau aktualisieren
    const guestPreview = element.children[2]; // Drittes Element
    if (guestPreview) {
        if (assignedGuests.length > 0) {
            const previewNames = assignedGuests.slice(0, 3).map(g => g.vorname || 'Unbekannt');
            guestPreview.innerHTML = previewNames.join(', ') + 
                (assignedGuests.length > 3 ? `<br>+${assignedGuests.length - 3} weitere` : '');
            guestPreview.style.fontSize = '10px';
        } else {
            guestPreview.innerHTML = '';
        }
    }
}

// Tisch-Element erstellen
function createTableElement(table) {
    const element = document.createElement('div');
    element.className = 'table-element';
    element.id = `table-${table.id}`;
    element.dataset.tableId = table.id; // Eindeutige Referenz für Stabilität
    element.style.left = `${table.x_position || 0}px`;
    element.style.top = `${table.y_position || 0}px`;
    element.style.borderColor = table.farbe || '#007bff';
    
    // Zugewiesene Gäste zählen
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    const occupancy = assignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
    const maxPersons = table.max_personen || getStandardTableSize();
    
    // Status-Klassen zurücksetzen und neu setzen
    element.classList.remove('empty', 'full', 'selected');
    if (occupancy === 0) {
        element.classList.add('empty');
    } else if (occupancy >= maxPersons) {
        element.classList.add('full');
    }
    
    // Stabilere HTML-Aktualisierung
    const tableName = document.createElement('div');
    tableName.className = 'table-name';
    tableName.textContent = getCorrectTableName(table);
    
    const tableOccupancy = document.createElement('div');
    tableOccupancy.className = 'table-occupancy';
    tableOccupancy.textContent = `${occupancy}/${maxPersons} Essen`;
    
    const guestPreview = document.createElement('div');
    guestPreview.style.fontSize = '10px';
    guestPreview.style.marginTop = '2px';
    guestPreview.style.lineHeight = '1.2';
    if (assignedGuests.length > 0) {
        const previewNames = assignedGuests.slice(0, 3).map(g => g.vorname || 'Unbekannt');
        guestPreview.innerHTML = previewNames.join(', ') + 
            (assignedGuests.length > 3 ? `<br>+${assignedGuests.length - 3} weitere` : '');
    }
    
    // Element zusammenbauen
    element.innerHTML = '';
    element.appendChild(tableName);
    element.appendChild(tableOccupancy);
    element.appendChild(guestPreview);
    
    // Event Listeners
    element.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTable(table.id);
    });
    element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showTableDetails(table.id);
    });
    element.addEventListener('dragover', handleTableDragOver);
    element.addEventListener('drop', (e) => handleTableDrop(e, table.id));
    
    // Drag für Tisch-Bewegung
    makeDraggable(element, table);
    
    return element;
}

// Tisch bewegbar machen
function makeDraggable(element, table) {
    let isDragging = false;
    let dragStartX, dragStartY;
    let startX, startY;
    
    element.addEventListener('mousedown', function(e) {
        if (e.ctrlKey || e.metaKey) { // Nur mit Ctrl/Cmd bewegen
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            
            // Startwerte für Drag merken
            const rect = seatingChart.getBoundingClientRect();
            dragStartX = e.clientX - rect.left;
            dragStartY = e.clientY - rect.top;
            startX = table.x_position || 0;
            startY = table.y_position || 0;
            
            // Visuelles Feedback
            element.classList.add('moving');
            element.style.zIndex = '1000';
            
            // Cursor ändern
            document.body.style.cursor = 'grabbing';
            
            // Auswahl verhindern
            document.body.style.userSelect = 'none';
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            e.preventDefault();
            
            const rect = seatingChart.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            // Neue Position berechnen
            const deltaX = currentX - dragStartX;
            const deltaY = currentY - dragStartY;
            const newX = Math.max(0, Math.min(startX + deltaX, seatingChart.offsetWidth - 120));
            const newY = Math.max(0, Math.min(startY + deltaY, seatingChart.offsetHeight - 120));
            
            // Element sofort bewegen für flüssiges Drag
            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
            
            // Temporär Position in table-Objekt aktualisieren
            table.x_position = newX;
            table.y_position = newY;
        }
    });
    
    document.addEventListener('mouseup', function(e) {
        if (isDragging) {
            e.preventDefault();
            isDragging = false;
            
            // Visuelles Feedback zurücksetzen
            element.classList.remove('moving');
            element.style.zIndex = '';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Position in Datenbank speichern
            updateTablePosition(table.id, table.x_position, table.y_position);
            
            // Minimap aktualisieren
            updateMinimap();
        }
    });
    
    // Touch-Events für mobile Geräte
    element.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            // Simuliere mousedown
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                ctrlKey: true // Touch interpretieren als Ctrl+Click
            });
            element.dispatchEvent(mouseEvent);
        }
    }, { passive: false });
}

// Gästeliste rendern
function renderGuestList() {
    console.log(`📋 renderGuestList() - ${guests.length} Gäste verfügbar`);
    
    const container = document.getElementById('guestList');
    if (!container) {
        console.error('❌ guestList Container nicht gefunden!');
        return;
    }
    
    const unassignedGuests = guests.filter(g => !g.assigned_table);
    const unassignedPersons = unassignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
    
    console.log(`👥 ${unassignedGuests.length} nicht zugewiesene Gäste, ${unassignedPersons} Personen`);
    
    const guestCountElement = document.getElementById('guestCount');
    if (guestCountElement) {
        guestCountElement.textContent = `${unassignedGuests.length} (${unassignedPersons} Essen)`;
    } else {
        console.warn('⚠️ guestCount Element nicht gefunden');
    }
    
    container.innerHTML = unassignedGuests.map(guest => {
        const conflicts = getGuestConflicts(guest.id);
        const conflictClass = conflicts.length > 0 ? 'conflict' : '';
        
        return `
            <div class="list-group-item guest-list-item ${conflictClass}" 
                 data-guest-id="${guest.id}" 
                 draggable="true"
                 onclick="selectGuest(${guest.id})">
                <div class="d-flex align-items-center">
                    <div class="guest-avatar">
                        ${guest.vorname.charAt(0)}${guest.nachname ? guest.nachname.charAt(0) : ''}
                    </div>
                    <div class="flex-grow-1">
                        <strong>${guest.vorname} ${guest.nachname || ''}</strong>
                        <small class="d-block text-muted">
                            ${guest.kategorie} • ${guest.seite} • ${guest.anzahl_essen || 0} Essen
                        </small>
                        ${conflicts.length > 0 ? `<small class="text-warning">⚠️ ${conflicts.length} Konflikte</small>` : ''}
                    </div>
                    <div class="ms-auto">
                        ${getRelationshipIndicators(guest.id)}
                        <button class="btn btn-sm btn-outline-primary" onclick="editRelationships(${guest.id}); event.stopPropagation();">
                            <i class="bi bi-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Drag & Drop für Gäste
    container.querySelectorAll('.guest-list-item').forEach(item => {
        item.addEventListener('dragstart', handleGuestDragStart);
        item.addEventListener('dragend', handleGuestDragEnd);
    });
}

// Beziehungs-Indikatoren
function getRelationshipIndicators(guestId) {
    const guestRels = relationships.filter(r => 
        r.gast_id_1 === guestId || r.gast_id_2 === guestId
    );
    
    const positive = guestRels.filter(r => r.staerke > 0).length;
    const negative = guestRels.filter(r => r.staerke < 0).length;
    
    let indicators = '';
    if (positive > 0) indicators += `<span class="relationship-indicator rel-positive" title="${positive} positive Beziehungen"></span>`;
    if (negative > 0) indicators += `<span class="relationship-indicator rel-negative" title="${negative} negative Beziehungen"></span>`;
    
    return indicators;
}

// Konflikte ermitteln
function getGuestConflicts(guestId) {
    const guest = guests.find(g => g.id === guestId);
    if (!guest || !guest.assigned_table) return [];
    
    const tableGuests = guests.filter(g => g.assigned_table === guest.assigned_table && g.id !== guestId);
    const conflicts = [];
    
    tableGuests.forEach(tableGuest => {
        const relationship = getRelationship(guestId, tableGuest.id);
        if (relationship && relationship.staerke < -1) {
            conflicts.push({
                guest: tableGuest,
                relationship: relationship
            });
        }
    });
    
    return conflicts;
}

// Beziehung zwischen zwei Gästen finden
function getRelationship(guest1Id, guest2Id) {
    return relationships.find(r => 
        (r.gast_id_1 === guest1Id && r.gast_id_2 === guest2Id) ||
        (r.gast_id_1 === guest2Id && r.gast_id_2 === guest1Id)
    );
}

// Beziehungstyp mit Icon formatieren
function formatRelationshipType(type) {
    const typeMap = {
        'familie': '👨‍👩‍👧‍👦 Familie',
        'beste_freunde': '💯 Beste Freunde',
        'freunde': '😊 Freunde',
        'partner': '💑 Partner',
        'ex_partner': '💔 Ex-Partner',
        'studienfreunde': '🎓 Studienfreunde',
        'kollegen': '💼 Kollegen',
        'ehemalige_kollegen': '📋 Ehemalige Kollegen',
        'nachbarn': '🏠 Nachbarn',
        'verwandte': '👥 Verwandte',
        'sportverein': '⚽ Sportverein',
        'hobby': '🎨 Hobby-Partner',
        'geschaeftlich': '🤝 Geschäftlich',
        'bekannte': '👋 Bekannte',
        'neutral': '😐 Neutral',
        'spinnen_sich_nicht': '😤 Spinnen sich nicht',
        'konflikt': '⚡ Konflikt'
    };
    return typeMap[type] || type;
}

// Drag & Drop Handler
function handleGuestDragStart(e) {
    draggedGuest = parseInt(e.target.dataset.guestId);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleGuestDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedGuest = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleTableDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    // Fallback für Drop außerhalb von Tischen
}

function handleTableDrop(e, tableId) {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedGuest) {
        assignGuestToTable(draggedGuest, tableId);
    }
}

// Gast zu Tisch zuweisen
async function assignGuestToTable(guestId, tableId) {
    try {
        const response = await fetch('/api/tischplanung/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guest_id: guestId, table_id: tableId })
        });
        
        if (response.ok) {
            const guest = guests.find(g => g.id === guestId);
            guest.assigned_table = tableId;
            
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
            checkConflicts();
            
            showAlert(`${guest.vorname} wurde Tisch zugewiesen`, 'success');
        } else {
            const error = await response.json();
            showAlert(error.message, 'warning');
        }
    } catch (error) {
        console.error('Fehler beim Zuweisen:', error);
        showAlert('Fehler beim Zuweisen des Gastes', 'danger');
    }
}

// Tisch auswählen
function selectTable(tableId) {
    // Vorherige Auswahl entfernen
    document.querySelectorAll('.table-element').forEach(el => 
        el.classList.remove('selected')
    );
    
    // Neue Auswahl
    const element = document.getElementById(`table-${tableId}`);
    element.classList.add('selected');
    selectedTable = tableId;
    
    showTableInfo(tableId);
}

// Tisch-Info anzeigen
function showTableInfo(tableId) {
    const table = tables.find(t => t.id === tableId);
    const assignedGuests = guests.filter(g => g.assigned_table === tableId);
    
    // Info-Panel aktualisieren oder erstellen
    let infoPanel = document.getElementById('tableInfoPanel');
    if (!infoPanel) {
        infoPanel = document.createElement('div');
        infoPanel.id = 'tableInfoPanel';
        infoPanel.className = 'card mt-3';
        document.querySelector('.col-md-4').appendChild(infoPanel);
    }
    
    infoPanel.innerHTML = `
        <div class="card-header">
            <h6><i class="bi bi-table me-2"></i>${table.name}</h6>
        </div>
        <div class="card-body">
            <p><strong>Belegung:</strong> ${assignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0)}/${table.max_personen} Essen (${assignedGuests.length} Gäste)</p>
            <div class="list-group list-group-flush">
                ${assignedGuests.map(guest => `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${guest.vorname} ${guest.nachname || ''} <small class="text-muted">(${guest.anzahl_essen || 0} Essen)</small></span>
                        <button class="btn btn-sm btn-outline-danger" onclick="removeGuestFromTable(${guest.id})">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="mt-3">
                <button class="btn btn-sm btn-primary me-2" onclick="showTableDetails(${tableId})">
                    <i class="bi bi-gear me-1"></i>Bearbeiten
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="optimizeTable(${tableId})">
                    <i class="bi bi-magic me-1"></i>Optimieren
                </button>
            </div>
        </div>
    `;
}

// Gast von Tisch entfernen
async function removeGuestFromTable(guestId) {
    try {
        const response = await fetch(`/api/tischplanung/unassign/${guestId}`, {
            method: 'DELETE'
        });
        
        // Parse JSON response in allen Fällen
        const data = await response.json();
        
        if (response.ok) {
            const guest = guests.find(g => g.id === guestId);
            if (guest) {
                guest.assigned_table = null;
            }
            
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
            
            if (selectedTable) {
                showTableInfo(selectedTable);
            }
            
            showAlert(`${guest ? guest.vorname : 'Gast'} wurde vom Tisch entfernt`, 'info');
        } else {
            // Behandle spezifische Fehlerfälle
            if (response.status === 404) {
                showAlert('Gast war keinem Tisch zugeordnet', 'warning');
            } else {
                showAlert(data.error || 'Fehler beim Entfernen des Gastes', 'danger');
            }
        }
    } catch (error) {
        console.error('Fehler beim Entfernen:', error);
        showAlert('Fehler beim Entfernen des Gastes', 'danger');
    }
}

// Neuen Tisch hinzufügen
async function addNewTable() {
    const name = document.getElementById('newTableName').value.trim();
    const size = parseInt(document.getElementById('newTableSize').value);
    
    if (!name) {
        showAlert('Bitte Tischname eingeben', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/tischplanung/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                max_personen: size,
                x_position: 100 + Math.random() * 300,
                y_position: 100 + Math.random() * 200
            })
        });
        
        if (response.ok) {
            const newTable = await response.json();
            tables.push(newTable);
            
            renderSeatingChart();
            
            // Eingaben zurücksetzen
            document.getElementById('newTableName').value = '';
            document.getElementById('newTableSize').value = '8';
            
            showAlert(`Tisch "${name}" wurde hinzugefügt`, 'success');
        }
    } catch (error) {
        console.error('Fehler beim Hinzufügen des Tisches:', error);
        showAlert('Fehler beim Hinzufügen des Tisches', 'danger');
    }
}

// Automatische Zuweisung
async function autoAssignGuests() {
    if (!confirm('Alle aktuellen Zuweisungen werden überschrieben. Fortfahren?')) {
        return;
    }
    
    showLoading(true);
    try {
        console.log('🤖 Starte intelligente Auto-Zuordnung...');
        
        const response = await fetch('/api/tischplanung/auto-assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📦 Auto-Assignment Ergebnis:', result);
        
        if (result.success) {
            // Daten neu laden
            await Promise.all([
                loadTables(),
                loadGuests()
            ]);
            
            // UI aktualisieren
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
            
            let message = result.message || 'Intelligente Zuordnung abgeschlossen';
            if (result.optimized_tables && result.optimized_tables > 0) {
                message += `\n🔧 ${result.optimized_tables} Tischgrößen wurden automatisch optimiert.`;
            }
            
            showAlert(message, 'success');
        } else {
            showAlert(result.message || 'Fehler bei automatischer Zuweisung', 'warning');
        }
        
    } catch (error) {
        console.error('Fehler bei automatischer Zuweisung:', error);
        showAlert('Fehler bei automatischer Zuweisung: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

// Tischgrößen optimieren
async function optimizeTableSizes() {
    if (!confirm('Tischgrößen basierend auf aktueller Belegung optimieren?')) {
        return;
    }
    
    showLoading(true);
    try {
        console.log('📏 Optimiere Tischgrößen...');
        
        const response = await fetch('/api/tischplanung/optimize-table-sizes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📏 Tischgrößen-Optimierung Ergebnis:', result);
        
        if (result.success) {
            // Daten neu laden
            await loadTables();
            
            // UI aktualisieren
            renderSeatingChart();
            updateStatistics();
            
            if (result.optimized_count > 0) {
                let details = result.optimizations.map(opt => 
                    `${opt.table_name}: ${opt.old_size} → ${opt.new_size} Plätze (${opt.occupancy} belegt)`
                ).join('\n');
                
                showAlert(`${result.message}\n\nDetails:\n${details}`, 'success');
            } else {
                showAlert(result.message, 'info');
            }
        } else {
            showAlert(result.message || 'Fehler bei Tischgrößen-Optimierung', 'warning');
        }
        
    } catch (error) {
        console.error('Fehler bei Tischgrößen-Optimierung:', error);
        showAlert('Fehler bei Tischgrößen-Optimierung: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

// Intelligente Zuordnung basierend auf Beziehungen
async function performIntelligentAssignment() {
    // Alle Zuordnungen zurücksetzen
    await clearAllTables();
    
    // Gäste nach Priorität sortieren
    const sortedGuests = [...guests].sort((a, b) => {
        const aRelCount = getGuestRelationshipCount(a.id);
        const bRelCount = getGuestRelationshipCount(b.id);
        
        // Brautpaar/Ehrengäste zuerst
        if (a.kategorie === 'Brautpaar' || a.kategorie === 'Ehrengast') return -1;
        if (b.kategorie === 'Brautpaar' || b.kategorie === 'Ehrengast') return 1;
        
        // Dann nach Anzahl positiver Beziehungen
        return bRelCount - aRelCount;
    });
    
    // Gästegruppen erstellen
    const guestGroups = createGuestGroups(sortedGuests);
    console.log('Erstelle', guestGroups.length, 'Gästegruppen');
    
    // Gruppen auf Tische verteilen
    await assignGroupsToTables(guestGroups);
}

// Anzahl positiver Beziehungen für einen Gast
function getGuestRelationshipCount(guestId) {
    return relationships.filter(rel => 
        (rel.gast_id_1 === guestId || rel.gast_id_2 === guestId) && rel.staerke > 0
    ).length;
}

// Gästegruppen basierend auf Beziehungen erstellen
function createGuestGroups(guests) {
    const processed = new Set();
    const groups = [];
    
    for (const guest of guests) {
        if (processed.has(guest.id)) continue;
        
        const group = [guest];
        processed.add(guest.id);
        
        // Positive Beziehungen finden (Stärke > 0)
        const positiveRelations = relationships.filter(rel => 
            ((rel.gast_id_1 === guest.id || rel.gast_id_2 === guest.id) && rel.staerke > 0)
        );
        
        // Verwandte/Freunde zur Gruppe hinzufügen
        for (const relation of positiveRelations) {
            const relatedGuestId = relation.gast_id_1 === guest.id ? relation.gast_id_2 : relation.gast_id_1;
            const relatedGuest = guests.find(g => g.id === relatedGuestId);
            
            if (relatedGuest && !processed.has(relatedGuestId)) {
                // Gruppengrößenbegrenzung prüfen
                const currentGroupSize = group.reduce((sum, g) => sum + (g.anzahl_essen || 0), 0);
                const newGuestSize = relatedGuest.anzahl_essen || 0;
                
                if (currentGroupSize + newGuestSize <= 8) {
                    group.push(relatedGuest);
                    processed.add(relatedGuestId);
                }
            }
        }
        
        groups.push(group);
    }
    
    return groups;
}

// Gruppen intelligent auf Tische verteilen
async function assignGroupsToTables(groups) {
    // Gruppen nach Größe sortieren (größte zuerst für optimale Platznutzung)
    const sortedGroups = groups.sort((a, b) => {
        const aSize = a.reduce((sum, g) => sum + (g.anzahl_essen || 0), 0);
        const bSize = b.reduce((sum, g) => sum + (g.anzahl_essen || 0), 0);
        return bSize - aSize;
    });
    
    for (const group of sortedGroups) {
        const groupSize = group.reduce((sum, g) => sum + (g.anzahl_essen || 0), 0);
        
        // Besten verfügbaren Tisch finden
        let bestTable = findBestTableForGroup(group, groupSize);
        
        // Falls kein passender Tisch vorhanden, neuen erstellen
        if (!bestTable) {
            bestTable = await createNewTableForGroup(group, groupSize);
        }
        
        // Alle Gäste der Gruppe dem Tisch zuordnen
        for (const guest of group) {
            guest.assigned_table = bestTable.id;
            console.log(`Gast ${guest.vorname} ${guest.nachname} → ${bestTable.name}`);
        }
    }
}

// Besten Tisch für eine Gruppe finden
function findBestTableForGroup(group, groupSize) {
    let bestTable = null;
    let bestScore = -1;
    
    for (const table of tables) {
        const currentOccupancy = getCurrentTableOccupancy(table.id);
        const remainingSpace = table.max_personen - currentOccupancy;
        
        // Prüfen ob Gruppe passt
        if (remainingSpace >= groupSize) {
            let score = 0;
            
            // Bevorzuge Tische mit guter Platzausnutzung
            const utilizationAfter = (currentOccupancy + groupSize) / table.max_personen;
            score += utilizationAfter * 100; // 0-100 Punkte für Auslastung
            
            // Bevorzuge leere Tische für große Gruppen
            if (currentOccupancy === 0 && groupSize >= 4) {
                score += 50;
            }
            
            // Prüfe Beziehungskompatibilität mit bereits zugewiesenen Gästen
            const compatibilityScore = calculateTableCompatibility(group, table.id);
            score += compatibilityScore;
            
            if (score > bestScore) {
                bestScore = score;
                bestTable = table;
            }
        }
    }
    
    return bestTable;
}

// Kompatibilität einer Gruppe mit einem Tisch berechnen
function calculateTableCompatibility(group, tableId) {
    let compatibilityScore = 0;
    const assignedGuests = guests.filter(g => g.assigned_table === tableId);
    
    for (const groupGuest of group) {
        for (const assignedGuest of assignedGuests) {
            const relationship = findRelationship(groupGuest.id, assignedGuest.id);
            if (relationship) {
                // Positive Beziehungen erhöhen Score
                if (relationship.staerke > 0) {
                    compatibilityScore += relationship.staerke * 10;
                }
                // Negative Beziehungen verringern Score stark
                else if (relationship.staerke < 0) {
                    compatibilityScore += relationship.staerke * 50; // Negative Werte
                }
            }
        }
    }
    
    return compatibilityScore;
}

// Beziehung zwischen zwei Gästen finden
function findRelationship(guestId1, guestId2) {
    return relationships.find(rel => 
        (rel.gast_id_1 === guestId1 && rel.gast_id_2 === guestId2) ||
        (rel.gast_id_1 === guestId2 && rel.gast_id_2 === guestId1)
    );
}

// Hilfsfunktion für automatische Tischbenennung
function generateTableName(tableIndex = null) {
    const currentTableCount = tableIndex !== null ? tableIndex : tables.length;
    
    if (currentTableCount === 0) {
        return 'Brauttisch';
    } else {
        return `Tisch ${currentTableCount}`;
    }
}

// Korrekten Tischnamen für bestehende Tabelle ermitteln
function getCorrectTableName(table) {
    console.log('🏷️ getCorrectTableName() für Tisch:', table.id, table.name);
    
    // SPEZIELLE BRAUTTISCH-BEHANDLUNG:
    // Da das Brautpaar nicht als echte Gäste in der DB existiert,
    // sondern nur als Namen in den Einstellungen gespeichert ist,
    // prüfen wir explizit auf "Brauttisch" Namen
    if (table.name === 'Brauttisch' || table.name?.toLowerCase().includes('braut')) {
        console.log('💑 Brauttisch erkannt anhand des Namens:', table.name);
        
        // Hole Brautpaar-Namen aus den globalen Einstellungen (falls verfügbar)
        let brautpaarText = 'Brautpaar';
        if (window.appSettings?.braut_name && window.appSettings?.braeutigam_name) {
            brautpaarText = `${window.appSettings.braut_name} & ${window.appSettings.braeutigam_name}`;
            console.log(`💍 Brautpaar-Namen aus Einstellungen: ${brautpaarText}`);
        } else {
            console.log('⚠️ Brautpaar-Namen nicht in appSettings gefunden - verwende Standard');
        }
        
        // Zähle andere Gäste am Brauttisch (ohne das virtuelle Brautpaar)
        const assignedGuests = guests.filter(g => g.assigned_table === table.id);
        console.log(`👥 Brauttisch: ${assignedGuests.length} echte Gäste zugewiesen`);
        
        if (assignedGuests.length > 0) {
            return `${brautpaarText} + ${assignedGuests.length} weitere`;
        } else {
            return brautpaarText;
        }
    }
    
    // Für alle anderen Tabellen: normale Logik
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    console.log(`👥 Tisch ${table.id}: ${assignedGuests.length} Gäste zugewiesen`);
    
    if (assignedGuests.length > 0) {
        console.log('👤 Kategorien der Gäste:', assignedGuests.map(g => `${g.vorname} (${g.kategorie})`));
    }
    
    // Verwende bestehenden Namen oder generiere neuen
    if (table.name && table.name.startsWith('Tisch ')) {
        return table.name;
    }
    
    // Fallback: generiere Name basierend auf Position in der Liste
    const tableIndex = tables.findIndex(t => t.id === table.id);
    return generateTableName(tableIndex);
}

// Neuen Tisch für Gruppe erstellen
async function createNewTableForGroup(group, groupSize) {
    const standardSize = getStandardTableSize();
    const tableSize = Math.max(standardSize, Math.ceil(groupSize * 1.2)); // 20% Puffer
    
    // Prüfe ob Brautpaar in der Gruppe ist
    const hasBrautpaar = group.some(g => g.kategorie === 'Brautpaar');
    const tableName = hasBrautpaar ? 'Brauttisch' : generateTableName();
    
    // Position berechnen (Raster-Layout)
    const col = tables.length % 4;
    const row = Math.floor(tables.length / 4);
    const x = 100 + col * 180;
    const y = 100 + row * 180;
    
    const tableData = {
        name: tableName,
        max_personen: tableSize,
        x_position: x,
        y_position: y,
        farbe: '#007bff',
        beschreibung: `Automatisch erstellt für ${group.map(g => g.vorname).join(', ')}`
    };
    
    // Optimistisch zur lokalen Liste hinzufügen
    const newTable = {
        id: Date.now(), // Temporäre ID
        ...tableData
    };
    tables.push(newTable);
    
    console.log(`Neuer Tisch erstellt: ${tableName} (${tableSize} Plätze) für Gruppe von ${groupSize} Personen`);
    
    return newTable;
}

// Aktuelle Tischbelegung berechnen
function getCurrentTableOccupancy(tableId) {
    return guests
        .filter(g => g.assigned_table === tableId)
        .reduce((sum, g) => sum + (g.anzahl_essen || 0), 0);
}

// Tischzuordnungs-Übersicht laden und anzeigen
async function showTableOverview() {
    try {
        console.log('📊 Erstelle Tischzuordnungs-Übersicht...');
        
        // Erstelle Übersicht aus lokalen Daten statt API-Call
        const tableArray = tables.map(table => {
            const assignedGuests = guests.filter(g => g.assigned_table === table.id);
            const totalPersons = assignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
            
            return {
                table_name: table.name || `Tisch ${table.id}`,
                total_persons: totalPersons,
                guests: assignedGuests.map(guest => ({
                    name: `${guest.vorname} ${guest.nachname || ''}`,
                    category: guest.kategorie || 'Unbekannt',
                    side: guest.seite || '',
                    persons: guest.anzahl_essen || 1
                }))
            };
        }).filter(table => table.total_persons > 0); // Nur belegte Tische anzeigen
        
        console.log('📊 Verarbeitete Tischübersicht:', tableArray);
        displayTableOverview(tableArray);
        
    } catch (error) {
        console.error('❌ Fehler beim Erstellen der Tischübersicht:', error);
        showAlert('Fehler beim Erstellen der Tischübersicht: ' + error.message, 'danger');
    }
}

// Tischübersicht anzeigen
function displayTableOverview(tableOverview) {
    const modal = document.getElementById('tableOverviewModal');
    const content = document.getElementById('tableOverviewContent');
    
    if (!content) {
        console.error('❌ tableOverviewContent Element nicht gefunden');
        showAlert('Modal-Element für Tischübersicht nicht gefunden', 'danger');
        return;
    }
    
    console.log('🎯 displayTableOverview mit', tableOverview.length, 'Tischen');
    
    if (!tableOverview || tableOverview.length === 0) {
        content.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Noch keine Tischzuordnungen vorhanden.</div>';
    } else {
        content.innerHTML = tableOverview.map(table => {
            const tableName = table.table_name || table.name || 'Unbekannter Tisch';
            const totalPersons = table.total_persons || table.totalPersons || 0;
            const guests = table.guests || [];
            
            console.log(`🏗️ Verarbeite Tisch: ${tableName}, ${totalPersons} Personen, ${guests.length} Gäste`);
            
            return `
                <div class="card mb-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">
                            <i class="bi bi-table me-2"></i>
                            ${tableName}
                        </h6>
                        <span class="badge bg-primary">
                            ${totalPersons} Personen
                        </span>
                    </div>
                    <div class="card-body">
                        ${guests.length > 0 ? `
                            <div class="list-group list-group-flush">
                                ${guests.map(guest => {
                                    const guestName = guest.name || 'Unbekannter Gast';
                                    const category = guest.category || 'Unbekannt';
                                    const side = guest.side || '';
                                    const persons = guest.persons || 1;
                                    
                                    return `
                                        <div class="list-group-item d-flex justify-content-between align-items-center py-2">
                                            <div>
                                                <strong>${guestName}</strong>
                                                <small class="text-muted d-block">
                                                    ${category}${side ? ' • ' + side : ''} • ${persons} Essen
                                                </small>
                                            </div>
                                            <span class="badge bg-light text-dark">${persons}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <p class="text-muted mb-0"><i class="bi bi-person-x me-2"></i>Keine Gäste zugeordnet</p>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Modal anzeigen
    if (modal) {
        try {
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
            console.log('✅ Tischübersicht-Modal angezeigt');
        } catch (error) {
            console.error('❌ Fehler beim Anzeigen des Modals:', error);
            showAlert('Fehler beim Anzeigen der Übersicht', 'danger');
        }
    } else {
        console.error('❌ tableOverviewModal Element nicht gefunden');
        showAlert('Modal für Tischübersicht nicht gefunden', 'danger');
    }
}

// Statistiken aktualisieren
async function updateStatistics() {
    try {
        console.log('📊 Aktualisiere Statistiken...');
        
        // Berechne Statistiken basierend auf lokalen Daten
        const totalGuests = guests.length;
        const assignedGuests = guests.filter(g => g.assigned_table).length;
        
        const totalPersons = guests.reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
        const assignedPersons = guests.filter(g => g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
        
        const totalTables = tables.length;
        const usedTables = new Set(guests.filter(g => g.assigned_table).map(g => g.assigned_table)).size;
        
        // Konflikte berechnen (lokale Berechnung ohne API-Call)
        let conflictCount = 0;
        if (relationships.length > 0) {
            const tableGroups = {};
            guests.forEach(guest => {
                if (guest.assigned_table) {
                    if (!tableGroups[guest.assigned_table]) {
                        tableGroups[guest.assigned_table] = [];
                    }
                    tableGroups[guest.assigned_table].push(guest);
                }
            });
            
            Object.values(tableGroups).forEach(tableGuests => {
                for (let i = 0; i < tableGuests.length; i++) {
                    for (let j = i + 1; j < tableGuests.length; j++) {
                        const guest1 = tableGuests[i];
                        const guest2 = tableGuests[j];
                        
                        const relationship = relationships.find(rel => 
                            (rel.gast_id_1 === guest1.id && rel.gast_id_2 === guest2.id) ||
                            (rel.gast_id_1 === guest2.id && rel.gast_id_2 === guest1.id)
                        );
                        
                        if (relationship && relationship.staerke < -1) {
                            conflictCount++;
                        }
                    }
                }
            });
        }
        
        const statsContent = document.getElementById('statisticsContent');
        if (statsContent) {
            statsContent.innerHTML = `
                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="card border-0 bg-light">
                            <div class="card-body text-center">
                                <h3 class="text-primary mb-1">${assignedGuests}/${totalGuests}</h3>
                                <small class="text-muted">Gäste zugeordnet</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-0 bg-light">
                            <div class="card-body text-center">
                                <h3 class="text-success mb-1">${assignedPersons}/${totalPersons}</h3>
                                <small class="text-muted">Essen zugeordnet</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-0 bg-light">
                            <div class="card-body text-center">
                                <h3 class="text-info mb-1">${usedTables}/${totalTables}</h3>
                                <small class="text-muted">Tische belegt</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-0 bg-light">
                            <div class="card-body text-center">
                                <h3 class="text-${conflictCount > 0 ? 'danger' : 'success'} mb-1">${conflictCount}</h3>
                                <small class="text-muted">Konflikte</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-3">
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${totalPersons > 0 ? (assignedPersons/totalPersons)*100 : 0}%"
                             aria-valuenow="${assignedPersons}" aria-valuemin="0" aria-valuemax="${totalPersons}">
                            ${totalPersons > 0 ? Math.round((assignedPersons/totalPersons)*100) : 0}% zugeordnet
                        </div>
                    </div>
                </div>
            `;
        }
        
        console.log('📊 Statistiken aktualisiert:', {
            totalGuests, assignedGuests, totalPersons, assignedPersons,
            totalTables, usedTables, conflictCount
        });
        
    } catch (error) {
        console.error('❌ Fehler beim Aktualisieren der Statistiken:', error);
        
        // Fallback: Zeige Basis-Statistiken ohne Konflikte
        const statsContent = document.getElementById('statisticsContent');
        if (statsContent) {
            const totalPersons = guests.reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
            const assignedPersons = guests.filter(g => g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
            
            statsContent.innerHTML = `
                <div class="col-md-4">
                    <div class="text-center">
                        <h3 class="text-primary">${assignedPersons}/${totalPersons}</h3>
                        <small>Personen zugewiesen</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center">
                        <h3 class="text-info">${totalPersons > 0 ? Math.round((assignedPersons/totalPersons)*100) : 0}%</h3>
                        <small>Fortschritt</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center">
                        <h3 class="text-muted">-</h3>
                        <small>Statistiken teilweise verfügbar</small>
                    </div>
                </div>
            `;
        }
    }
}

// Vereinfachte Konflikt-Berechnung
async function calculateConflictCount() {
    try {
        let conflicts = 0;
        
        // Gruppiere Gäste nach Tischen
        const tableGroups = {};
        guests.forEach(guest => {
            if (guest.assigned_table) {
                if (!tableGroups[guest.assigned_table]) {
                    tableGroups[guest.assigned_table] = [];
                }
                tableGroups[guest.assigned_table].push(guest);
            }
        });
        
        // Prüfe Konflikte innerhalb jeder Tischgruppe
        Object.values(tableGroups).forEach(tableGuests => {
            for (let i = 0; i < tableGuests.length; i++) {
                for (let j = i + 1; j < tableGuests.length; j++) {
                    const guest1 = tableGuests[i];
                    const guest2 = tableGuests[j];
                    
                    // Finde Beziehung zwischen den Gästen
                    const relationship = relationships.find(rel => 
                        (rel.gast_id_1 === guest1.id && rel.gast_id_2 === guest2.id) ||
                        (rel.gast_id_1 === guest2.id && rel.gast_id_2 === guest1.id)
                    );
                    
                    // Negative Beziehung (< -1) ist ein Konflikt
                    if (relationship && relationship.staerke < -1) {
                        conflicts++;
                    }
                }
            }
        });
        
        return conflicts;
    } catch (error) {
        console.error('Fehler beim Zählen der Konflikte:', error);
        return 0;
    }
}

// Verbesserte Konflikt-Überprüfung
async function getConflictCount() {
    try {
        const assignments = await window.TischplanungAPI.loadAssignments();
        const relationships = await window.TischplanungAPI.loadRelationships();
        
        if (!assignments || !relationships) {
            return 0;
        }
        
        let conflicts = 0;
        
        // Gruppiere Zuordnungen nach Tischen
        const tableGroups = {};
        assignments.forEach(assignment => {
            const tableId = assignment.tisch_id || assignment.table_id;
            const guestId = assignment.gast_id || assignment.guest_id;
            
            if (!tableGroups[tableId]) {
                tableGroups[tableId] = [];
            }
            tableGroups[tableId].push(guestId);
        });
        
        // Prüfe Konflikte innerhalb jeder Tischgruppe
        Object.values(tableGroups).forEach(guestIds => {
            for (let i = 0; i < guestIds.length; i++) {
                for (let j = i + 1; j < guestIds.length; j++) {
                    const guest1Id = guestIds[i];
                    const guest2Id = guestIds[j];
                    
                    // Finde Beziehung zwischen den Gästen
                    const relationship = relationships.find(rel => 
                        (rel.gast_id_1 === guest1Id && rel.gast_id_2 === guest2Id) ||
                        (rel.gast_id_1 === guest2Id && rel.gast_id_2 === guest1Id)
                    );
                    
                    // Negative Beziehung (< -1) ist ein Konflikt
                    if (relationship && relationship.staerke < -1) {
                        conflicts++;
                    }
                }
            }
        });
        
        return conflicts;
    } catch (error) {
        console.error('Fehler beim Zählen der Konflikte:', error);
        return 0;
    }
}

// Legacy-Funktion für Kompatibilität
function checkConflicts() {
    return getConflictCount().then(count => {
        console.log(`🔍 ${count} Konflikte gefunden`);
        return count;
    });
}

// Konflikte anzeigen
function displayConflicts(conflicts) {
    const container = document.getElementById('conflictAlerts');
    
    if (conflicts.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = conflicts.map(conflict => `
        <div class="conflict-alert">
            <h6><i class="bi bi-exclamation-triangle me-2"></i>Konflikt am ${conflict.table.name}</h6>
            <p>
                <strong>${conflict.guest1.vorname} ${conflict.guest1.nachname || ''}</strong> und 
                <strong>${conflict.guest2.vorname} ${conflict.guest2.nachname || ''}</strong>
                haben eine negative Beziehung (${conflict.relationship.staerke}/3)
            </p>
            <button class="btn btn-sm btn-light" onclick="resolveConflict(${conflict.guest1.id}, ${conflict.guest2.id})">
                <i class="bi bi-arrow-repeat me-1"></i>Lösen
            </button>
        </div>
    `).join('');
}

// Zoom-Funktionen
function zoomIn() {
    currentZoom = Math.min(currentZoom + 0.2, 3);
    applyZoom();
}

function zoomOut() {
    currentZoom = Math.max(currentZoom - 0.2, 0.5);
    applyZoom();
}

function resetZoom() {
    currentZoom = 1;
    applyZoom();
}

function applyZoom() {
    seatingChart.style.transform = `scale(${currentZoom})`;
    seatingChart.style.transformOrigin = '0 0';
}

function handleZoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    currentZoom = Math.max(0.5, Math.min(3, currentZoom + delta));
    applyZoom();
}

// Minimap aktualisieren
function updateMinimap() {
    // Vereinfachte Minimap-Darstellung
    const minimap = document.getElementById('minimap');
    // Implementation für Minimap
}

// Statistiken anzeigen/ausblenden
function showStatistics() {
    const row = document.getElementById('statisticsRow');
    if (row.style.display === 'none') {
        row.style.display = 'block';
        updateStatistics();
    } else {
        row.style.display = 'none';
    }
}

// Beziehungsübersicht anzeigen
function showRelationshipsOverview() {
    const modalContent = document.getElementById('relationshipModalContent');
    
    // Beziehungen nach Typ gruppieren
    const groupedRelations = {};
    relationships.forEach(rel => {
        if (!groupedRelations[rel.beziehungstyp]) {
            groupedRelations[rel.beziehungstyp] = [];
        }
        groupedRelations[rel.beziehungstyp].push(rel);
    });
    
    const totalRelations = relationships.length;
    const positiveRelations = relationships.filter(r => r.staerke > 0).length;
    const negativeRelations = relationships.filter(r => r.staerke < 0).length;
    
    modalContent.innerHTML = `
        <div class="mb-4">
            <h5><i class="bi bi-heart-fill me-2"></i>Beziehungsübersicht</h5>
            <div class="row text-center">
                <div class="col-md-3">
                    <div class="card border-info">
                        <div class="card-body">
                            <h4 class="text-info">${totalRelations}</h4>
                            <small>Gesamt</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-success">
                        <div class="card-body">
                            <h4 class="text-success">${positiveRelations}</h4>
                            <small>Positiv</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-danger">
                        <div class="card-body">
                            <h4 class="text-danger">${negativeRelations}</h4>
                            <small>Negativ</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-warning">
                        <div class="card-body">
                            <h4 class="text-warning">${relationships.filter(r => r.staerke === 0).length}</h4>
                            <small>Neutral</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="accordion" id="relationshipAccordion">
            ${Object.keys(groupedRelations).map((type, index) => `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" 
                                type="button" data-bs-toggle="collapse" 
                                data-bs-target="#collapse${index}">
                            ${formatRelationshipType(type)} (${groupedRelations[type].length})
                        </button>
                    </h2>
                    <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                         data-bs-parent="#relationshipAccordion">
                        <div class="accordion-body">
                            ${groupedRelations[type].map(rel => {
                                const guest1 = guests.find(g => g.id === rel.gast_id_1);
                                const guest2 = guests.find(g => g.id === rel.gast_id_2);
                                const strength = rel.staerke;
                                const strengthClass = strength > 0 ? 'success' : strength < 0 ? 'danger' : 'secondary';
                                
                                return `
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <span>
                                            <strong>${guest1?.vorname || 'Unbekannt'} ${guest1?.nachname || ''}</strong> 
                                            ↔ 
                                            <strong>${guest2?.vorname || 'Unbekannt'} ${guest2?.nachname || ''}</strong>
                                        </span>
                                        <span class="badge bg-${strengthClass}">${strength > 0 ? '+' : ''}${strength}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('relationshipModal'));
    modal.show();
}
                </div>
                <div class="col-md-3">
                    <div class="card border-secondary">
                        <div class="card-body">
                            <h4 class="text-secondary">${totalRelations - positiveRelations - negativeRelations}</h4>
                            <small>Neutral</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="accordion" id="relationshipsAccordion">
            ${Object.keys(groupedRelations).map((type, index) => `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading${index}">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                            ${formatRelationshipType(type)} 
                            <span class="badge bg-primary ms-2">${groupedRelations[type].length}</span>
                        </button>
                    </h2>
                    <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                         data-bs-parent="#relationshipsAccordion">
                        <div class="accordion-body">
                            ${groupedRelations[type].map(rel => {
                                const guest1 = guests.find(g => g.id === rel.gast_id_1);
                                const guest2 = guests.find(g => g.id === rel.gast_id_2);
                                const guest1Name = guest1 ? `${guest1.vorname} ${guest1.nachname || ''}` : 'Unbekannt';
                                const guest2Name = guest2 ? `${guest2.vorname} ${guest2.nachname || ''}` : 'Unbekannt';
                                const strengthColor = rel.staerke > 0 ? 'success' : rel.staerke < 0 ? 'danger' : 'secondary';
                                
                                return `<div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                                        <div>
                                            <strong>${guest1Name}</strong> ↔ <strong>${guest2Name}</strong>
                                            ${rel.notizen ? `<br><small class="text-muted">📝 ${rel.notizen}</small>` : ''}
                                        </div>
                                        <div>
                                            <span class="badge bg-${strengthColor}">${rel.staerke}</span>
                                            <button class="btn btn-sm btn-outline-primary ms-2" 
                                                    onclick="editRelationships(${rel.gast_id_1})" 
                                                    title="Bearbeiten">
                                                <i class="bi bi-pencil"></i>
                                            </button>
                                        </div>
                                    </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        ${totalRelations === 0 ? '<div class="alert alert-info">Noch keine Beziehungen definiert. Verwenden Sie die Buttons neben den Gästen, um Beziehungen hinzuzufügen.</div>' : ''}
    `;
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('relationshipModal'));
    modal.show();
}

// Alle Tische zurücksetzen
async function clearAllTables() {
    if (!confirm('Alle Tischzuweisungen werden gelöscht. Fortfahren?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/tischplanung/clear-all', {
            method: 'POST'
        });
        
        if (response.ok) {
            guests.forEach(guest => guest.assigned_table = null);
            
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
            
            document.getElementById('conflictAlerts').innerHTML = '';
            
            showAlert('Alle Tischzuweisungen wurden zurückgesetzt', 'info');
        }
    } catch (error) {
        console.error('Fehler beim Zurücksetzen:', error);
        showAlert('Fehler beim Zurücksetzen', 'danger');
    }
}

// Sitzplan speichern
async function saveSeatingPlan() {
    showLoading(true);
    try {
        const assignments = guests
            .filter(g => g.assigned_table)
            .map(g => ({
                guest_id: g.id,
                table_id: g.assigned_table
            }));
        
        const response = await fetch('/api/tischplanung/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignments: assignments,
                tables: tables.map(t => ({
                    id: t.id,
                    x_position: t.x_position,
                    y_position: t.y_position
                }))
            })
        });
        
        if (response.ok) {
            showAlert('Sitzplan wurde gespeichert', 'success');
        } else {
            throw new Error('Speichern fehlgeschlagen');
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showAlert('Fehler beim Speichern des Sitzplans', 'danger');
    } finally {
        showLoading(false);
    }
}

// Gäste filtern
function filterGuests() {
    const seite = document.getElementById('filterSeite').value;
    const status = document.getElementById('filterStatus').value;
    
    // Filter anwenden und Liste neu rendern
    renderGuestList();
}

// Gäste suchen
function searchGuests() {
    const query = document.getElementById('guestSearch').value.toLowerCase();
    const items = document.querySelectorAll('.guest-list-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? 'block' : 'none';
    });
}

// Gäste auswählen
function selectGuest(guestId) {
    // Vorherige Auswahl entfernen
    document.querySelectorAll('.guest-list-item').forEach(el => 
        el.classList.remove('selected')
    );
    
    // Neue Auswahl
    const element = document.querySelector(`[data-guest-id="${guestId}"]`);
    if (element) {
        element.classList.add('selected');
    }
    selectedGuest = guestId;
    
    showGuestRelationships(guestId);
}

// Beziehungen eines Gastes anzeigen
function showGuestRelationships(guestId) {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    
    const relationshipForm = document.getElementById('relationshipForm');
    const content = document.getElementById('relationshipContent');
    
    const guestRelationships = relationships.filter(r => 
        r.gast_id_1 === guestId || r.gast_id_2 === guestId
    );
    
    content.innerHTML = `
        <p><strong>${guest.vorname} ${guest.nachname || ''}</strong></p>
        <div class="mb-3">
            <label class="form-label">Neue Beziehung hinzufügen</label>
            <select class="form-select form-select-sm" id="newRelationGuest">
                <option value="">Gast auswählen...</option>
                ${guests.filter(g => g.id !== guestId).map(g => 
                    `<option value="${g.id}">${g.vorname} ${g.nachname || ''}</option>`
                ).join('')}
            </select>
        </div>
        <div class="mb-3">
            <label class="form-label">Beziehungstyp</label>
            <select class="form-select form-select-sm" id="newRelationType">
                <option value="familie">👨‍👩‍👧‍👦 Familie</option>
                <option value="beste_freunde">💯 Beste Freunde</option>
                <option value="freunde">😊 Freunde</option>
                <option value="partner">💑 Partner</option>
                <option value="ex_partner">💔 Ex-Partner</option>
                <option value="studienfreunde">🎓 Studienfreunde</option>
                <option value="kollegen">💼 Kollegen</option>
                <option value="ehemalige_kollegen">📋 Ehemalige Kollegen</option>
                <option value="nachbarn">🏠 Nachbarn</option>
                <option value="verwandte">👥 Verwandte</option>
                <option value="sportverein">⚽ Sportverein</option>
                <option value="hobby">🎨 Hobby-Partner</option>
                <option value="geschaeftlich">🤝 Geschäftlich</option>
                <option value="bekannte">👋 Bekannte</option>
                <option value="neutral" selected>😐 Neutral</option>
                <option value="spinnen_sich_nicht">😤 Spinnen sich nicht</option>
                <option value="konflikt">⚡ Konflikt</option>
            </select>
        </div>
        <div class="mb-3">
            <label class="form-label">Stärke (-3 bis +3)</label>
            <input type="range" class="form-range" id="newRelationStrength" min="-3" max="3" value="0" step="1">
            <div class="d-flex justify-content-between">
                <small>Sehr negativ</small>
                <small>Neutral</small>
                <small>Sehr positiv</small>
            </div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="addNewRelationship(${guestId})">
            <i class="bi bi-plus me-1"></i>Hinzufügen
        </button>
        
        <hr>
        
        <h6>Bestehende Beziehungen</h6>
        <div class="list-group list-group-flush">
            ${guestRelationships.map(rel => {
                const otherGuestId = rel.gast_id_1 === guestId ? rel.gast_id_2 : rel.gast_id_1;
                const otherGuestName = rel.gast_id_1 === guestId ? rel.gast2_name : rel.gast1_name;
                const strengthColor = rel.staerke > 0 ? 'success' : rel.staerke < 0 ? 'danger' : 'secondary';
                
                return `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${otherGuestName}</strong><br>
                            <small class="text-muted">${formatRelationshipType(rel.beziehungstyp)}</small>
                        </div>
                        <div>
                            <span class="badge bg-${strengthColor}">${rel.staerke}</span>
                            <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteRelationship(${rel.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    relationshipForm.style.display = 'block';
}

// Neue Beziehung hinzufügen
async function addNewRelationship(guestId) {
    const otherGuestId = parseInt(document.getElementById('newRelationGuest').value);
    const relationType = document.getElementById('newRelationType').value;
    const strength = parseInt(document.getElementById('newRelationStrength').value);
    
    if (!otherGuestId) {
        showAlert('Bitte einen Gast auswählen', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/tischplanung/relationships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gast_id_1: guestId,
                gast_id_2: otherGuestId,
                beziehungstyp: relationType,
                staerke: strength
            })
        });
        
        if (response.ok) {
            await reloadRelationships();
            showGuestRelationships(guestId);
            renderGuestList();
            checkConflicts();
            showAlert('Beziehung hinzugefügt', 'success');
        } else {
            const error = await response.json();
            showAlert(error.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Hinzufügen der Beziehung:', error);
        showAlert('Fehler beim Hinzufügen der Beziehung', 'danger');
    }
}

// Beziehung löschen
async function deleteRelationship(relationshipId) {
    if (!confirm('Beziehung wirklich löschen?')) return;
    
    try {
        const response = await fetch(`/api/tischplanung/relationships/${relationshipId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadRelationships();
            if (selectedGuest) {
                showGuestRelationships(selectedGuest);
            }
            renderGuestList();
            checkConflicts();
            showAlert('Beziehung gelöscht', 'info');
        } else {
            const error = await response.json();
            showAlert(error.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Löschen der Beziehung:', error);
        showAlert('Fehler beim Löschen der Beziehung', 'danger');
    }
}

// Beziehungen bearbeiten (Modal)
function editRelationships(guestId) {
    selectedGuest = guestId;
    const guest = guests.find(g => g.id === guestId);
    
    if (!guest) return;
    
    // Modal Inhalt erstellen
    const modalContent = document.getElementById('relationshipModalContent');
    modalContent.innerHTML = `
        <div class="mb-3">
            <h6>Beziehungen für: <strong>${guest.vorname} ${guest.nachname || ''}</strong></h6>
        </div>
        
        <!-- Neue Beziehung hinzufügen -->
        <div class="card mb-3">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Neue Beziehung hinzufügen</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label">Gast auswählen</label>
                        <select class="form-select" id="relationshipGuestSelect">
                            <option value="">-- Gast auswählen --</option>
                            ${guests.filter(g => g.id !== guestId).map(g => 
                                `<option value="${g.id}">${g.vorname} ${g.nachname || ''}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Beziehungstyp</label>
                        <select class="form-select" id="relationshipTypeSelect">
                            <option value="familie">👨‍👩‍👧‍👦 Familie</option>
                            <option value="beste_freunde">💯 Beste Freunde</option>
                            <option value="freunde">😊 Freunde</option>
                            <option value="partner">💑 Partner</option>
                            <option value="ex_partner">💔 Ex-Partner</option>
                            <option value="studienfreunde">🎓 Studienfreunde</option>
                            <option value="kollegen">💼 Kollegen</option>
                            <option value="ehemalige_kollegen">📋 Ehemalige Kollegen</option>
                            <option value="nachbarn">🏠 Nachbarn</option>
                            <option value="verwandte">👥 Verwandte</option>
                            <option value="sportverein">⚽ Sportverein</option>
                            <option value="hobby">🎨 Hobby-Partner</option>
                            <option value="geschaeftlich">🤝 Geschäftlich</option>
                            <option value="bekannte">👋 Bekannte</option>
                            <option value="neutral" selected>😐 Neutral</option>
                            <option value="spinnen_sich_nicht">😤 Spinnen sich nicht</option>
                            <option value="konflikt">⚡ Konflikt</option>
                        </select>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-md-8">
                        <label class="form-label">Stärke der Beziehung</label>
                        <input type="range" class="form-range" id="relationshipStrengthRange" 
                               min="-3" max="3" value="0" step="1" 
                               oninput="updateStrengthDisplay(this.value)">
                        <div class="d-flex justify-content-between">
                            <small>-3 (sehr negativ)</small>
                            <small id="strengthDisplay">0 (neutral)</small>
                            <small>+3 (sehr positiv)</small>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Notizen (optional)</label>
                        <textarea class="form-control" id="relationshipNotes" rows="2" 
                                  placeholder="Zusätzliche Informationen..."></textarea>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-primary" onclick="addNewRelationship()">
                        <i class="bi bi-plus me-1"></i>Beziehung hinzufügen
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Bestehende Beziehungen -->
        <div class="card">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-list me-2"></i>Bestehende Beziehungen</h6>
            </div>
            <div class="card-body" id="existingRelationshipsList">
                ${getExistingRelationshipsHTML(guestId)}
            </div>
        </div>
    `;
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('relationshipModal'));
    modal.show();
}

// Hilfsfunktionen für Beziehungsmanagement
function updateStrengthDisplay(value) {
    const display = document.getElementById('strengthDisplay');
    const descriptions = {
        '-3': '-3 (sehr negativ)',
        '-2': '-2 (negativ)', 
        '-1': '-1 (leicht negativ)',
        '0': '0 (neutral)',
        '1': '+1 (leicht positiv)',
        '2': '+2 (positiv)',
        '3': '+3 (sehr positiv)'
    };
    if (display) {
        display.textContent = descriptions[value] || value;
    }
}

function getExistingRelationshipsHTML(guestId) {
    const guestRelationships = relationships.filter(r => 
        r.gast_id_1 === guestId || r.gast_id_2 === guestId
    );
    
    if (guestRelationships.length === 0) {
        return '<p class="text-muted">Noch keine Beziehungen definiert.</p>';
    }
    
    return guestRelationships.map(rel => {
        const otherGuestId = rel.gast_id_1 === guestId ? rel.gast_id_2 : rel.gast_id_1;
        const otherGuest = guests.find(g => g.id === otherGuestId);
        const otherGuestName = otherGuest ? `${otherGuest.vorname} ${otherGuest.nachname || ''}` : 'Unbekannt';
        
        const strengthColor = rel.staerke > 0 ? 'success' : rel.staerke < 0 ? 'danger' : 'secondary';
        
        return `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${otherGuestName}</strong><br>
                    <small class="text-muted">${formatRelationshipType(rel.beziehungstyp)}</small>
                    ${rel.notizen ? `<br><small class="text-info">📝 ${rel.notizen}</small>` : ''}
                </div>
                <div>
                    <span class="badge bg-${strengthColor}">${rel.staerke}</span>
                    <button class="btn btn-sm btn-outline-warning ms-2" 
                            onclick="editExistingRelationship(${rel.id})" 
                            title="Bearbeiten">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger ms-1" 
                            onclick="deleteRelationshipFromModal(${rel.id})" 
                            title="Löschen">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteRelationshipFromModal(relationshipId) {
    if (!confirm('Beziehung wirklich löschen?')) return;
    
    try {
        const response = await fetch(`/api/tischplanung/relationships/${relationshipId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadRelationships();
            renderGuestList();
            
            // Liste in Modal aktualisieren
            const existingList = document.getElementById('existingRelationshipsList');
            if (existingList) {
                existingList.innerHTML = getExistingRelationshipsHTML(selectedGuest);
            }
            
            showAlert('Beziehung gelöscht', 'success');
        } else {
            throw new Error('Fehler beim Löschen');
        }
    } catch (error) {
        console.error('Fehler beim Löschen der Beziehung:', error);
        showAlert('Fehler beim Löschen der Beziehung', 'danger');
    }
}

// Tisch-Details anzeigen
function showTableDetails(tableId) {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    
    const modal = new bootstrap.Modal(document.getElementById('tableDetailsModal'));
    const content = document.getElementById('tableDetailsContent');
    
    const assignedGuests = guests.filter(g => g.assigned_table === tableId);
    
    content.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <label class="form-label">Tischname</label>
                <input type="text" class="form-control" id="editTableName" value="${table.name}">
            </div>
            <div class="col-md-6">
                <label class="form-label">Maximale Personen</label>
                <input type="number" class="form-control" id="editTableSize" value="${table.max_personen}" min="2" max="16">
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-12">
                <label class="form-label">Beschreibung</label>
                <textarea class="form-control" id="editTableDescription">${table.beschreibung || ''}</textarea>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-6">
                <label class="form-label">Farbe</label>
                <input type="color" class="form-control form-control-color" id="editTableColor" value="${table.farbe}">
            </div>
            <div class="col-md-6">
                <label class="form-label">Belegung</label>
                <p class="form-control-plaintext">${assignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0)}/${table.max_personen} Essen (${assignedGuests.length} Gäste)</p>
            </div>
        </div>
        
        <hr>
        <h6>Zugewiesene Gäste</h6>
        <div class="list-group">
            ${assignedGuests.map(guest => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${guest.vorname} ${guest.nachname || ''}</strong>
                        <small class="d-block text-muted">${guest.anzahl_essen || 0} Essen</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeGuestFromTable(${guest.id})">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    // Table ID für späteres Speichern merken
    content.dataset.tableId = tableId;
    
    modal.show();
}

// Tisch-Details speichern
async function saveTableDetails() {
    const content = document.getElementById('tableDetailsContent');
    const tableId = parseInt(content.dataset.tableId);
    
    const tableData = {
        name: document.getElementById('editTableName').value,
        max_personen: parseInt(document.getElementById('editTableSize').value),
        beschreibung: document.getElementById('editTableDescription').value,
        farbe: document.getElementById('editTableColor').value
    };
    
    try {
        const response = await fetch(`/api/tischplanung/tables/${tableId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tableData)
        });
        
        if (response.ok) {
            await loadTables();
            renderSeatingChart();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('tableDetailsModal'));
            modal.hide();
            
            showAlert('Tisch aktualisiert', 'success');
        } else {
            const error = await response.json();
            showAlert(error.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Tisches:', error);
        showAlert('Fehler beim Aktualisieren des Tisches', 'danger');
    }
}

// Tisch löschen
async function deleteTable() {
    const content = document.getElementById('tableDetailsContent');
    const tableId = parseInt(content.dataset.tableId);
    
    if (!confirm('Tisch wirklich löschen? Alle Zuordnungen gehen verloren.')) return;
    
    try {
        const response = await fetch(`/api/tischplanung/tables/${tableId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadTables();
            renderSeatingChart();
            renderGuestList();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('tableDetailsModal'));
            modal.hide();
            
            showAlert('Tisch gelöscht', 'info');
        } else {
            const error = await response.json();
            showAlert(error.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Löschen des Tisches:', error);
        showAlert('Fehler beim Löschen des Tisches', 'danger');
    }
}

// Tischposition aktualisieren
async function updateTablePosition(tableId, x, y) {
    try {
        await fetch(`/api/tischplanung/tables/${tableId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                x_position: x,
                y_position: y
            })
        });
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Tischposition:', error);
    }
}

// Tischgrößen aktualisieren
async function updateTableSizes() {
    const newSize = parseInt(document.getElementById('defaultTableSize').value);
    
    // Konfiguration sofort speichern
    try {
        const response = await fetch('/api/tischplanung/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                standard_tisch_groesse: newSize
            })
        });
        
        if (!response.ok) {
            throw new Error('Fehler beim Speichern der Konfiguration');
        }
        

        
        // Globale Konfiguration aktualisieren
        tischplanung_config.standard_tisch_groesse = newSize;
    } catch (error) {
        console.error('❌ Fehler beim Speichern der Standard-Tischgröße:', error);
        HochzeitsplanerApp?.showAlert('Fehler beim Speichern der Standard-Tischgröße: ' + error.message, 'warning');
    }
    
    // Bestehende Tische mit Standard-Größe aktualisieren
    tables.forEach(table => {
        if (table.max_personen === getStandardTableSize()) { // Nur Standard-Tische aktualisieren
            table.max_personen = newSize;
        }
    });
    
    renderSeatingChart();
}

// Konflikte lösen
async function resolveConflict(guest1Id, guest2Id) {
    // Einfache Lösung: Einen der Gäste zu einem anderen Tisch verschieben
    const guest1 = guests.find(g => g.id === guest1Id);
    const guest2 = guests.find(g => g.id === guest2Id);
    
    if (!guest1 || !guest2) return;
    
    // Finde einen alternativen Tisch für guest2
    const availableTables = tables.filter(t => {
        const occupancy = guests.filter(g => g.assigned_table === t.id).reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
        const guest2Persons = guest2.anzahl_essen || 1;
        return (occupancy + guest2Persons) <= t.max_personen && t.id !== guest1.assigned_table;
    });
    
    if (availableTables.length > 0) {
        const newTable = availableTables[0];
        
        if (confirm(`${guest2.vorname} zu ${newTable.name} verschieben?`)) {
            await assignGuestToTable(guest2Id, newTable.id);
        }
    } else {
        showAlert('Keine verfügbaren Tische gefunden', 'warning');
    }
}

// Tisch optimieren
async function optimizeTable(tableId) {
    // Einfache Tischoptimierung basierend auf Beziehungen
    const tableGuests = guests.filter(g => g.assigned_table === tableId);
    
    if (tableGuests.length < 2) {
        showAlert('Zu wenige Gäste für Optimierung', 'info');
        return;
    }
    
    showAlert('Tischoptimierung würde hier implementiert werden', 'info');
    // Hier könnte eine komplexere Logik zur Optimierung der Sitzordnung implementiert werden
}

// Hilfsfunktionen für bessere UX
function showTooltip(element, text) {
    // Tooltip-Implementierung
}

function hideTooltip(element) {
    // Tooltip verstecken
}

// Touch-Unterstützung für mobile Geräte
function setupTouchSupport() {
    let touchStartX, touchStartY;
    
    seatingChart.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    });
    
    seatingChart.addEventListener('touchmove', function(e) {
        e.preventDefault(); // Prevent scrolling
    });
    
    seatingChart.addEventListener('touchend', function(e) {
        if (e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            // Detect tap vs swipe
            const deltaX = Math.abs(touchEndX - touchStartX);
            const deltaY = Math.abs(touchEndY - touchStartY);
            
            if (deltaX < 10 && deltaY < 10) {
                // Tap detected
                const target = document.elementFromPoint(touchEndX, touchEndY);
                if (target && target.classList.contains('table-element')) {
                    const tableId = parseInt(target.id.replace('table-', ''));
                    selectTable(tableId);
                }
            }
        }
    });
}

// Keyboard-Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 's':
                    e.preventDefault();
                    saveSeatingPlan();
                    break;
                case 'z':
                    e.preventDefault();
                    // Undo-Funktionalität
                    break;
                case 'a':
                    e.preventDefault();
                    autoAssignGuests();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            // Clear selections
            selectedTable = null;
            selectedGuest = null;
            document.querySelectorAll('.selected').forEach(el => 
                el.classList.remove('selected')
            );
        }
    });
}

// Überarbeitete Auto-Zuordnung Funktion mit vollständiger API-Integration
async function autoAssignGuests() {
    console.log('🤖 Auto-Zuordnung gestartet');
    showLoading(true);
    
    try {
        // API-Aufruf für automatische Zuordnung
        const response = await fetch('/api/tischplanung/auto-assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }

        // Erfolgreiche Zuordnung
        const message = result.message || `${result.assigned_count || 0} Gäste automatisch zugewiesen`;
        showAlert(message, 'success');
        
        // Daten neu laden um die neuen Zuordnungen anzuzeigen
        await Promise.all([
            loadTables(),
            loadGuests()
        ]);
        
        // Verwende das neue Rendering-System
        if (window.tischplanung) {
            await window.tischplanung.loadData();
            await window.tischplanung.render();
            
            // Nach Auto-Zuordnung automatisch Tische in Matrix zentrieren
            console.log('🎯 Auto-Assign abgeschlossen - Zentriere Tische kollisionsfrei in Matrix');
            centerTables(); // Direkter Aufruf für Matrix-Layout
        } else {
            // Fallback zur alten Methode
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
        }
        
        // KEIN Modal mehr - nur stille Verarbeitung für bessere UX
        // await showTableOverview(); // ENTFERNT für bessere UX
        
        console.log('✅ Auto-Zuordnung abgeschlossen ohne Modal');
        
    } catch (error) {
        console.error('❌ Fehler bei automatischer Zuweisung:', error);
        showAlert('Fehler bei automatischer Zuweisung: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

// Tisch-Zuordnungs-Übersicht anzeigen
async function showTableOverview() {
    console.log('📋 Zeige Tisch-Zuordnungs-Übersicht');
    
    try {
        showLoading(true);
        
        // Hole aktuelle Tischzuordnungen von der API
        const response = await window.TischplanungAPI.getTableOverview();
        
        if (!response || !response.table_overview || response.table_overview.length === 0) {
            showAlert('Keine Tischzuordnungen gefunden. Bitte führen Sie zuerst eine Auto-Zuordnung durch.', 'info');
            return;
        }
        
        // Konvertiere Array zu Objekt für kompatibilität
        const tableOverview = {};
        response.table_overview.forEach(table => {
            tableOverview[table.table_name] = table;
        });
        
        const tableOverviewRow = document.getElementById('tableOverviewRow');
        const tableOverviewContent = document.getElementById('tableOverviewContent');
        
        if (!tableOverviewRow || !tableOverviewContent) {
            console.error('❌ Tisch-Übersicht Elemente nicht gefunden');
            return;
        }
        
        // HTML für die Übersicht generieren
        let overviewHTML = '<div class="row">';
        
        Object.keys(tableOverview).sort().forEach(tableName => {
            const table = tableOverview[tableName];
            const tableGuests = table.guests || [];
            
            overviewHTML += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card border-0 shadow-sm" style="border-radius: 12px;">
                        <div class="card-header bg-gradient text-white text-center" 
                             style="background: linear-gradient(135deg, #007bff, #0056b3); border-radius: 12px 12px 0 0;">
                            <h6 class="mb-0 fw-bold">${tableName}</h6>
                            <small>${table.total_persons} Personen, ${tableGuests.length} Gäste</small>
                        </div>
                        <div class="card-body p-3">
                            ${tableGuests.map(guest => `
                                <div class="d-flex align-items-center mb-2">
                                    <div class="flex-shrink-0">
                                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" 
                                             style="width: 32px; height: 32px; font-size: 12px; font-weight: bold;">
                                            ${guest.name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2)}
                                        </div>
                                    </div>
                                    <div class="flex-grow-1 ms-2">
                                        <div class="fw-semibold" style="font-size: 0.9rem;">${guest.name}</div>
                                        <small class="text-muted">
                                            ${guest.category} • ${guest.side}
                                            ${guest.persons > 1 ? ` • ${guest.persons} Pers.` : ''}
                                            ${guest.children > 0 ? ` • ${guest.children} Kind${guest.children > 1 ? 'er' : ''}` : ''}
                                        </small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        
        overviewHTML += '</div>';
        
        // Zusammenfassung hinzufügen
        const totalGuests = Object.values(tableOverview).reduce((sum, table) => sum + (table.guests?.length || 0), 0);
        const totalPersons = Object.values(tableOverview).reduce((sum, table) => sum + (table.total_persons || 0), 0);
        const totalTables = Object.keys(tableOverview).length;
        
        overviewHTML += `
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card bg-light border-0">
                        <div class="card-body">
                            <h6 class="card-title mb-3">
                                <i class="bi bi-graph-up me-2"></i>Zusammenfassung
                            </h6>
                            <div class="row text-center">
                                <div class="col-md-3">
                                    <div class="h4 text-primary mb-0">${totalTables}</div>
                                    <small class="text-muted">Tische</small>
                                </div>
                                <div class="col-md-3">
                                    <div class="h4 text-success mb-0">${totalGuests}</div>
                                    <small class="text-muted">Gäste</small>
                                </div>
                                <div class="col-md-3">
                                    <div class="h4 text-info mb-0">${totalPersons}</div>
                                    <small class="text-muted">Personen</small>
                                </div>
                                <div class="col-md-3">
                                    <div class="h4 text-warning mb-0">${(totalPersons / totalTables).toFixed(1)}</div>
                                    <small class="text-muted">Ø pro Tisch</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        tableOverviewContent.innerHTML = overviewHTML;
        tableOverviewRow.style.display = 'block';
        
        // Sanft nach oben scrollen
        tableOverviewRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        showAlert('Tisch-Zuordnungs-Übersicht erfolgreich geladen', 'success');
        
    } catch (error) {
        console.error('❌ Fehler beim Anzeigen der Tisch-Übersicht:', error);
        showAlert('Fehler beim Laden der Tisch-Übersicht: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

// Tisch-Zuordnungs-Übersicht verstecken
function hideTableOverview() {
    const tableOverviewRow = document.getElementById('tableOverviewRow');
    if (tableOverviewRow) {
        tableOverviewRow.style.display = 'none';
    }
}

// Print-Funktion für Tisch-Übersicht
function printTableOverview() {
    const tableOverviewContent = document.getElementById('tableOverviewContent');
    if (!tableOverviewContent) {
        showAlert('Keine Tisch-Übersicht zum Drucken verfügbar', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Tischzuordnungs-Übersicht</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: Arial, sans-serif; }
                .card { break-inside: avoid; }
                @media print {
                    .col-md-6, .col-lg-4 { width: 48%; float: left; margin-bottom: 1rem; }
                    .row { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="container-fluid">
                <h2 class="text-center mb-4">Tischzuordnungs-Übersicht</h2>
                ${tableOverviewContent.innerHTML}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// === ENDE DER DATEI ===
// Hilfsfunktionen


// ========== FEHLENDE FUNKTIONEN HINZUGEFÜGT ==========

// Tische zentrieren - Matrix-Layout mit Kollisionserkennung
function centerTables() {
    if (!tables || tables.length === 0) {
        const alertFunction = window.showAlert || window.alert;
        alertFunction('Keine Tische zum Zentrieren vorhanden');
        return;
    }
    
    const chart = document.getElementById("seatingChart");
    if (!chart) {
        console.error("seatingChart Element nicht gefunden");
        return;
    }
    
    // Berechne optimale Matrix-Layout mit Kollisionserkennung
    const tableCount = tables.length;
    const tablesPerRow = Math.min(Math.ceil(Math.sqrt(tableCount)), 5); // Max 5 Tische pro Reihe
    const tableSize = 180; // Tischgröße (Breite/Höhe) - größer für weniger Überlappung
    const minSpacing = 220; // Mindestabstand zwischen Tischen - größer für keine Überlappung
    
    // Berechne optimalen Abstand basierend auf verfügbarem Platz
    const availableWidth = chart.offsetWidth - 100; // 50px Rand links und rechts
    const availableHeight = chart.offsetHeight - 100; // 50px Rand oben und unten
    
    const spacingX = Math.max(minSpacing, Math.floor(availableWidth / tablesPerRow));
    const rows = Math.ceil(tableCount / tablesPerRow);
    const spacingY = Math.max(minSpacing, Math.floor(availableHeight / rows));
    
    // Berechne Startposition um die Matrix zu zentrieren
    const totalWidth = (tablesPerRow - 1) * spacingX + tableSize;
    const totalHeight = (rows - 1) * spacingY + tableSize;
    const startX = Math.max(50, (chart.offsetWidth - totalWidth) / 2);
    const startY = Math.max(50, (chart.offsetHeight - totalHeight) / 2);
    
    console.log('📐 Matrix-Layout berechnet (Kollisionsfrei):', {
        tableCount: tableCount,
        tablesPerRow: tablesPerRow,
        spacing: { x: spacingX, y: spacingY },
        tableSize: tableSize,
        chartSize: { width: chart.offsetWidth, height: chart.offsetHeight },
        matrixSize: { width: totalWidth, height: totalHeight },
        startPosition: { x: startX, y: startY }
    });
    
    // Batch-Update: Sammle alle Positionen und update ohne Render zwischen den Updates
    const updatePromises = [];
    
    tables.forEach((table, index) => {
        const row = Math.floor(index / tablesPerRow);
        const col = index % tablesPerRow;
        const x = startX + col * spacingX;
        const y = startY + row * spacingY;
        
        console.log(`📍 Positioniere Tisch ${table.name} (${index + 1}/${tableCount}): Row ${row}, Col ${col} -> (${x}, ${y})`);
        
        // Update Position im DOM sofort für bessere UX
        const tableElement = document.querySelector(`[data-table-id="${table.id}"]`);
        if (tableElement) {
            tableElement.style.left = x + 'px';
            tableElement.style.top = y + 'px';
        }
        
        // API-Update sammeln für Batch-Operation
        if (window.TischplanungAPI) {
            updatePromises.push(
                window.TischplanungAPI.updateTable(table.id, { x: x, y: y })
            );
        }
    });
    
    // Alle Updates gleichzeitig ausführen ohne zusätzliches Rendern
    Promise.all(updatePromises).then(() => {
        console.log('✅ Matrix-Zentrierung abgeschlossen (kollisionsfrei)');
        // KEIN zusätzliches Rendering oder Laden - Positionen sind bereits im DOM aktualisiert
    }).catch(error => {
        console.error('❌ Fehler beim Batch-Update der Tischpositionen:', error);
    });
}

// Alle Tische zurücksetzen mit Bestätigung
function clearAllTablesConfirm() {
    if (confirm('Alle Tischzuweisungen werden unwiderruflich gelöscht. Fortfahren?')) {
        clearAllTables();
    }
}

// Global verfügbar machen - ALLE benötigten Funktionen
window.centerTables = centerTables;
window.autoAssignGuests = autoAssignGuests;
window.clearAllTablesConfirm = clearAllTablesConfirm;
window.clearAllTables = clearAllTables;

// === API DEBUGGING UTILITIES ===

// API-Aufruf mit erweiterten Logs
async function makeApiCall(endpoint, method = 'GET', data = null) {
    const fullUrl = `/api/tischplanung/${endpoint}`;
    console.log(`🌐 API-Aufruf: ${method} ${fullUrl}`, data ? `mit Daten: ${JSON.stringify(data)}` : '');
    
    try {
        const config = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        const response = await fetch(fullUrl, config);
        
        console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API-Fehler (${response.status}):`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log(`✅ API-Antwort für ${endpoint}:`, responseData);
        
        return responseData;
        
    } catch (error) {
        console.error(`💥 Netzwerk-/Parse-Fehler bei ${endpoint}:`, error);
        throw error;
    }
}

// Debug-Funktion für komplettes System-Check
function debugSystemCheck() {
    console.log('🔍 === VOLLSTÄNDIGER SYSTEM-CHECK ===');
    
    // 1. DOM-Elemente prüfen
    console.log('🏗️ DOM-Elemente:');
    const domElements = [
        'statisticsContent',
        'tableOverviewModal', 
        'tableOverviewContent',
        'guestList',
        'seatingChart'
    ];
    
    domElements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`  - ${id}: ${element ? '✅ gefunden' : '❌ fehlt'}`);
    });
    
    // 2. Datenstrukturen prüfen
    console.log('📊 Datenstrukturen:');
    console.log(`  - tables: ${tables ? `✅ ${tables.length} Tische` : '❌ nicht geladen'}`);
    console.log(`  - guests: ${guests ? `✅ ${guests.length} Gäste` : '❌ nicht geladen'}`);
    console.log(`  - relationships: ${relationships ? `✅ ${Object.keys(relationships).length} Beziehungen` : '❌ nicht geladen'}`);
    
    // 3. API-Tests durchführen
    console.log('🌐 API-Tests:');
    setTimeout(async () => {
        try {
            await makeApiCall('overview');
            console.log('  - overview: ✅ erreichbar');
        } catch (error) {
            console.log('  - overview: ❌ Fehler:', error.message);
        }
        
        try {
            await makeApiCall('tables');
            console.log('  - tables: ✅ erreichbar');
        } catch (error) {
            console.log('  - tables: ❌ Fehler:', error.message);
        }
    }, 100);
}

// Global verfügbar machen
window.makeApiCall = makeApiCall;
window.debugSystemCheck = debugSystemCheck;



