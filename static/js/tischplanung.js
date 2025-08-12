// Tischplanung JavaScript
// Hochzeitsplaner - Interaktive Sitzplatz-Planung

let guests = [];
let allGuestsIncludingNoFood = []; // Alle Gäste (auch ohne Essen) für Beziehungsanzeige
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

        const data = await apiRequest('/settings/get');
        if (data.success && data.settings) {
            window.appSettings = data.settings;
        } else {

            window.appSettings = {};
        }
    } catch (error) {

        window.appSettings = {};
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    const startTime = performance.now();

    
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

    
    showLoading(true);
    try {

        
        // Wichtige Daten zuerst laden
        await Promise.all([
            loadGuests(),
            loadTables(),
            loadConfiguration()
        ]);
        

        renderSeatingChart();
        renderGuestList();
        updateStatistics();
        
        // Debug: Prüfe ob wichtige DOM-Elemente existieren






        
        // Beziehungen im Hintergrund nachladen (nicht-blockierend)
        setTimeout(() => {

            loadRelationships().then(() => {

                renderGuestList(); // UI mit Beziehungsindikatoren aktualisieren
            });
        }, 100);
        
    } catch (error) {

        showAlert('Fehler beim Laden der Daten', 'danger');
    } finally {
        showLoading(false);

    }
}

// Daten laden
async function loadGuests() {
    try {

        
        const data = await apiRequest('/gaeste/list');

        
        if (!data.success) {
            throw new Error(data.error || 'Unbekannter Fehler beim Laden der Gäste');
        }
        
        // Gäste-Array aus der API-Antwort extrahieren
        const guestList = data.gaeste || [];

        
        // Alle Gäste laden, aber NUR die mit anzahl_essen > 0 für die Tischplanung
        const allGuests = guestList.map(guest => ({
            ...guest,
            anzahl_essen: guest.anzahl_essen || guest.Anzahl_Essen || 0, // Kein Standardwert von 1!
            assigned_table: null,
            conflicts: []
        }));
        
        // ALLE Gäste für Beziehungsanzeige speichern
        allGuestsIncludingNoFood = [...allGuests];
        console.log(`📊 Alle Gäste gespeichert: ${allGuestsIncludingNoFood.length} Gäste für Beziehungen`);
        if (allGuestsIncludingNoFood.length > 0) {
            console.log('🔍 Erste 5 Gäste für Beziehungen:', allGuestsIncludingNoFood.slice(0, 5).map(g => `${g.vorname} ${g.nachname || g.name || ''} (ID: ${g.id}, Essen: ${g.anzahl_essen || 0})`));
        }
        console.log('📊 Vergleich:', {
            allGuestsIncludingNoFood: allGuestsIncludingNoFood.length,
            guestsWithFood: guests.length,
            totalFromAPI: allGuests.length
        });
        
        // Nur Gäste mit anzahl_essen > 0 für die Tischplanung anzeigen
        guests = allGuests.filter(guest => {
            const essenAnzahl = guest.anzahl_essen || 0;
            return essenAnzahl > 0;
        });
        
        console.log(`📊 Gäste für Tischplanung geladen: ${guests.length} von ${allGuests.length} Gästen`);

        if (guests.length > 0) {
            console.log('🍽️ Erste 3 Gäste mit Essen:', guests.slice(0, 3).map(g => `${g.name} (${g.anzahl_essen})`));
        }
        
        // Debug: Zeige Gäste mit anzahl_essen = 0
        const noFoodGuests = allGuests.filter(g => (g.anzahl_essen || 0) === 0);
        if (noFoodGuests.length > 0) {
            console.log('Gäste ohne Essen (anzahl_essen = 0):', noFoodGuests.map(g => g.name));
        }
        
    } catch (error) {

        guests = []; // Fallback auf leere Liste
        
        // Verwende window.alert als Fallback falls showAlert nicht verfügbar
        const alertFunction = window.showAlert || window.alert;
        alertFunction('Fehler beim Laden der Gäste: ' + error.message);
    }
}

async function loadTables() {
    try {
        console.log('🔄 Lade Tische von API...');
        
        const data = await apiRequest('/tischplanung/tables');
        
        console.log('📊 API Response für Tische:', data);
        
        // Konvertiere API-Format zu Frontend-Format
        if (Array.isArray(data)) {
            tables = data.map(table => {
                const convertedTable = {
                    id: table.id,
                    name: table.name,
                    max_personen: table.capacity || table.max_personen || 8,
                    x_position: table.x || table.x_position || 100,
                    y_position: table.y || table.y_position || 100,
                    farbe: table.farbe || table.color || '#007bff',
                    form: table.shape || 'round',
                    beschreibung: table.beschreibung || table.description || ''
                };
                console.log(`✅ Tisch konvertiert: ${convertedTable.name} (ID: ${convertedTable.id})`);
                return convertedTable;
            });
        } else if (data.tables && Array.isArray(data.tables)) {
            tables = data.tables.map(table => {
                const convertedTable = {
                    id: table.id,
                    name: table.name,
                    max_personen: table.capacity || table.max_personen || 8,
                    x_position: table.x || table.x_position || 100,
                    y_position: table.y || table.y_position || 100,
                    farbe: table.farbe || table.color || '#007bff',
                    form: table.shape || 'round',
                    beschreibung: table.beschreibung || table.description || ''
                };
                console.log(`✅ Tisch konvertiert: ${convertedTable.name} (ID: ${convertedTable.id})`);
                return convertedTable;
            });
        } else {
            console.warn('⚠️ Unerwartetes API-Format für Tische:', data);
            tables = [];
        }
        
        console.log(`📋 ${tables.length} Tische geladen:`, tables.map(t => `${t.name} (${t.id})`));
        
        // Stelle sicher, dass die globale Variable verfügbar ist
        window.tables = tables;
        
        console.log('🔧 Globale tables Variable gesetzt:', {
            length: window.tables.length,
            sample: window.tables.slice(0, 3)
        });
        
        // Lade auch bestehende Zuordnungen und aktualisiere Gäste-Objekte
        await loadExistingAssignments();
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Tische:', error);
        tables = [];
    }
}

async function loadExistingAssignments() {
    try {

        const assignments = await apiRequest('/tischplanung/assignments');

        
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
            

        }
        
    } catch (error) {

    }
}

async function loadRelationships() {
    try {
        // Nur laden wenn noch keine Beziehungen vorhanden
        if (relationships.length === 0) {
            relationships = await apiRequest('/tischplanung/relationships');
            console.log('🔗 Beziehungen geladen:', relationships.length, 'Beziehungen');
            if (relationships.length > 0) {
                console.log('🔗 Erste Beziehung Beispiel:', relationships[0]);
            }
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der Beziehungen:', error);
        relationships = [];
    }
}

// Beziehungen forciert neu laden (nur bei Änderungen)
async function reloadRelationships() {
    try {
        relationships = await apiRequest('/tischplanung/relationships');
    } catch (error) {

    }
}

async function loadConfiguration() {
    try {
        tischplanung_config = await apiRequest('/tischplanung/config');
        document.getElementById('defaultTableSize').value = tischplanung_config.standard_tisch_groesse || 8;
    } catch (error) {

        tischplanung_config = { standard_tisch_groesse: 8 };
    }
}

// Hilfsfunktion um Standard-Tischgröße zu erhalten
function getStandardTableSize() {

    const standardSize = tischplanung_config.standard_tisch_groesse || 10; // Geändert von 8 auf 10

    return standardSize;
}

// Sitzplan rendern
function renderSeatingChart() {

    const currentSelection = selectedTable;
    
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
        console.log(`🔄 Processing table ${table.id}`, {
            name: table.name,
            capacity: table.capacity
        });
        
        const existingElement = existingTables[table.id];
        
        console.log(`📊 Table ${table.id} status`, {
            willUpdate: !!existingElement,
            willCreate: !existingElement
        });
        
        if (existingElement) {

            try {
                // Bestehenden Tisch aktualisieren statt neu erstellen
                updateExistingTableElement(existingElement.element, table);

            } catch (error) {

            }
            
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
    
    // Zugewiesene Gäste und Belegung berechnen
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    
    // EINHEITLICHE BERECHNUNG: Verwende getTableDisplayData wie in Übersicht
    const tableData = getTableDisplayData(table);
    const totalPersons = tableData.total_persons;
    const maxPersons = tableData.max_persons;
    
    // Status-Klassen aktualisieren (basierend auf totalPersons aus einheitlicher Logik)
    element.classList.remove('empty', 'full');
    
    // NORMALE STATUS-BEWERTUNG: Brauttisch wie andere Tische bewerten
    if (totalPersons === 0) {
        element.classList.add('empty');
    } else if (totalPersons >= maxPersons) { // Vollbelegung
        element.classList.add('full');
    }
    
    // Inhalt aktualisieren
    const tableName = element.querySelector('.table-name');
    const tableOccupancy = element.querySelector('.table-occupancy');
    
    if (tableName) {
        const displayName = isBrautTisch(table) ? `💐 ${table.name || generateTableName(table.id - 1)} 💐` : (table.name || generateTableName(table.id - 1));
        tableName.textContent = displayName;

    }
    if (tableOccupancy) {
        // NORMALE ANZEIGE: Brauttisch wie andere Tische, nur mit anderen Begriffen
        const finalText = `${totalPersons}/${maxPersons} ${isBrautTisch(table) ? 'Gäste' : 'Personen'}`;
        tableOccupancy.textContent = finalText;
    } else {

        
        // FEHLENDE DOM-STRUKTUR REPARIEREN: Erstelle das tableOccupancy Element
        const newTableOccupancy = document.createElement('div');
        newTableOccupancy.className = 'table-occupancy';
        
        // NORMALE ANZEIGE: Brauttisch wie andere Tische, nur mit anderen Begriffen
        const finalText = `${totalPersons}/${maxPersons} ${isBrautTisch(table) ? 'Gäste' : 'Personen'}`;
        newTableOccupancy.textContent = finalText;

        
        // Element nach tableName einfügen
        if (tableName && tableName.nextSibling) {
            element.insertBefore(newTableOccupancy, tableName.nextSibling);
        } else if (tableName) {
            tableName.after(newTableOccupancy);
        } else {
            element.appendChild(newTableOccupancy);
        }
        

    }
    
    // Namen-Vorschau aktualisieren
    const guestPreview = element.children[2]; // Drittes Element
    if (guestPreview) {
        updateGuestPreview(guestPreview, table, assignedGuests);
    }
}

// Gäste-Vorschau für Tisch aktualisieren
function updateGuestPreview(guestPreview, table, assignedGuests) {
    const allNames = [];
    
    // Beim Brauttisch: Brautpaar zuerst hinzufügen
    if (isBrautTisch(table)) {
        const brautpaar = getBrautpaarNames();
        allNames.push(brautpaar.braut, brautpaar.braeutigam);
    }
    
    // Dann alle zugewiesenen Gäste hinzufügen (aber nicht das Brautpaar doppelt)
    assignedGuests.forEach(guest => {
        if (guest.kategorie !== 'Brautpaar') {
            allNames.push(guest.vorname || 'Unbekannt');
        }
    });
    
    if (allNames.length > 0) {
        if (allNames.length <= 4) {
            // Alle Namen anzeigen wenn wenige
            guestPreview.innerHTML = allNames.join(', ');
        } else {
            // Erste 3 Namen + "weitere" wenn viele
            guestPreview.innerHTML = allNames.slice(0, 3).join(', ') + 
                `<br>+${allNames.length - 3} weitere`;
        }
        guestPreview.style.fontSize = '9px';
        guestPreview.style.lineHeight = '1.1';
    } else {
        guestPreview.innerHTML = '';
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
    
    // Zugewiesene Gäste und Belegung berechnen
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    
    // EINHEITLICHE BERECHNUNG: Verwende getTableDisplayData wie in Übersicht
    const tableData = getTableDisplayData(table);
    const totalPersons = tableData.total_persons;
    const maxPersons = tableData.max_persons;
    
    // Status-Klassen zurücksetzen und neu setzen (basierend auf totalPersons aus einheitlicher Logik)
    element.classList.remove('empty', 'full', 'selected');
    
    // NORMALE STATUS-BEWERTUNG: Brauttisch wie andere Tische bewerten
    if (totalPersons === 0) {
        element.classList.add('empty');
    } else if (totalPersons >= maxPersons) { // Vollbelegung
        element.classList.add('full');
    }
    
    // Stabilere HTML-Aktualisierung
    const tableName = document.createElement('div');
    tableName.className = 'table-name';
    tableName.textContent = getCorrectTableName(table);
    
    const tableOccupancy = document.createElement('div');
    tableOccupancy.className = 'table-occupancy';
    
    // NORMALE ANZEIGE: Brauttisch wie andere Tische, nur mit anderen Begriffen
    const finalText = `${totalPersons}/${maxPersons} ${isBrautTisch(table) ? 'Gäste' : 'Personen'}`;
    tableOccupancy.textContent = finalText;
    
    const guestPreview = document.createElement('div');
    guestPreview.style.fontSize = '9px';
    guestPreview.style.marginTop = '2px';
    guestPreview.style.lineHeight = '1.1';
    
    // Namen-Vorschau aktualisieren
    updateGuestPreview(guestPreview, table, assignedGuests);
    
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

    
    const container = document.getElementById('guestList');
    if (!container) {

        return;
    }
    
    const unassignedGuests = guests.filter(g => !g.assigned_table);
    const unassignedPersons = unassignedGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
    

    
    const guestCountElement = document.getElementById('guestCount');
    if (guestCountElement) {
        guestCountElement.textContent = `${unassignedGuests.length} (${unassignedPersons} Essen)`;
    } else {

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
                        <small class="d-block" style="color: #8b7355;">
                            ${guest.kategorie} • ${guest.seite} • ${guest.anzahl_essen || 0} Essen
                        </small>
                        ${conflicts.length > 0 ? `<small style="color: #8b7355;">⚠️ ${conflicts.length} Konflikte</small>` : ''}
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

        
        const result = await apiRequest('/tischplanung/assign', {
            method: 'POST',
            body: JSON.stringify({ guest_id: guestId, table_id: tableId })
        });

        
        const guest = guests.find(g => g.id === guestId);
        if (guest) {
            guest.assigned_table = tableId;
        }
            
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
            checkConflicts();
            
            // Benachrichtigung für Touch-System
            if (guest) {
                showAlert(`${guest.vorname} wurde Tisch zugewiesen`, 'success');
            }
    } catch (error) {

        showAlert('Fehler beim Zuweisen des Gastes', 'danger');
    }
}

// Funktion global verfügbar machen für Touch-System
window.assignGuestToTable = assignGuestToTable;

// Tisch auswählen
function selectTable(tableId) {

    
    // Vorherige Auswahl entfernen
    document.querySelectorAll('.table-element').forEach(el => 
        el.classList.remove('selected')
    );
    
    // Neue Auswahl - mit Error-Handling
    const element = document.getElementById(`table-${tableId}`);

    
    if (element) {
        element.classList.add('selected');
        selectedTable = tableId;
        showTableInfo(tableId);
    } else {


        document.querySelectorAll('.table-element').forEach(el => {

        });
    }
}

// Tisch-Info anzeigen
function showTableInfo(tableId) {
    const table = tables.find(t => t.id === tableId);
    const assignedGuests = guests.filter(g => g.assigned_table === tableId);
    
    // EINHEITLICHE BERECHNUNG: Verwende getTableDisplayData wie in Übersicht
    const tableData = getTableDisplayData(table);
    const totalPersons = tableData.total_persons;
    
    // NORMALE ANZEIGE: Brauttisch wie andere Tische, nur mit anderen Begriffen
    const displayPersons = totalPersons;
    
    // Info-Panel aktualisieren oder erstellen
    let infoPanel = document.getElementById('tableInfoPanel');
    if (!infoPanel) {
        infoPanel = document.createElement('div');
        infoPanel.id = 'tableInfoPanel';
        infoPanel.className = 'card mt-3';
        document.querySelector('.col-md-4').appendChild(infoPanel);
    }
    
    let guestListHtml = '';
    
    // Beim Brauttisch: Brautpaar zuerst anzeigen
    if (isBrautTisch(table)) {
        const brautpaar = getBrautpaarNames();
        guestListHtml += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${brautpaar.braut} <small style="color: #8b7355;">(1 Essen) 👑</small></span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${brautpaar.braeutigam} <small style="color: #8b7355;">(1 Essen) 👑</small></span>
            </div>
        `;
    }
    
    // Dann normale Gäste hinzufügen (aber nicht das Brautpaar doppelt)
    guestListHtml += assignedGuests
        .filter(guest => guest.kategorie !== 'Brautpaar') // Brautpaar nicht doppelt anzeigen
        .map(guest => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${guest.vorname} ${guest.nachname || ''} <small style="color: #8b7355;">(${guest.anzahl_essen || 0} Essen)</small></span>
                <button class="btn btn-sm btn-outline-danger" onclick="removeGuestFromTable(${guest.id})">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
    
    infoPanel.innerHTML = `
        <div class="card-header">
            <h6><i class="bi bi-table me-2"></i>${isBrautTisch(table) ? `💐 ${table.name} 💐` : table.name}</h6>
        </div>
        <div class="card-body">
            <p><strong>Belegung:</strong> ${displayPersons}/${table.max_personen} ${isBrautTisch(table) ? 'Gäste' : 'Personen'}</p>
            <div class="list-group list-group-flush">
                ${guestListHtml}
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
        const data = await apiRequest(`/tischplanung/unassign/${guestId}`, {
            method: 'DELETE'
        });
        
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
    } catch (error) {

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
        const newTable = await apiRequest('/tischplanung/tables', {
            method: 'POST',
            body: JSON.stringify({
                name: name,
                max_personen: size,
                x_position: 100 + Math.random() * 300,
                y_position: 100 + Math.random() * 200
            })
        });
        
        tables.push(newTable);
        
        renderSeatingChart();
        
        // Eingaben zurücksetzen
        document.getElementById('newTableName').value = '';
        document.getElementById('newTableSize').value = '8';
        
        showAlert(`Tisch "${name}" wurde hinzugefügt`, 'success');
    } catch (error) {

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
        console.log('🔄 Starte automatische Zuordnung...');
        
        const result = await apiRequest('/tischplanung/auto-assign', {
            method: 'POST',
        });
        
        console.log('📊 Auto-Zuordnung Ergebnis:', result);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // Erfolg - Daten KOMPLETT neu laden
        console.log('🔄 Lade Daten neu nach Auto-Zuordnung...');
        
        await Promise.all([
            loadTables(),
            loadGuests(),
            loadExistingAssignments()
        ]);
        
        console.log('📋 Nach Neuladen:', {
            tables: tables.length,
            guests: guests.length,
            assignedGuests: guests.filter(g => g.assigned_table).length
        });
        
        // UI KOMPLETT neu rendern
        renderSeatingChart();
        renderGuestList();
        updateStatistics();
        
        let message = result.message || 'Intelligente Zuordnung abgeschlossen';
        if (result.assigned_count) {
            message = `${result.assigned_count} Gäste automatisch zugewiesen`;
        }
        if (result.created_tables && result.created_tables > 0) {
            message += `\n🆕 ${result.created_tables} neue Tische erstellt.`;
        }
        if (result.optimized_tables && result.optimized_tables > 0) {
            message += `\n🔧 ${result.optimized_tables} Tischgrößen optimiert.`;
        }
        
        showAlert(message, 'success');
        
    } catch (error) {
        console.error('❌ Fehler bei automatischer Zuweisung:', error);
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

        
        const result = await apiRequest('/tischplanung/optimize-table-sizes', {
            method: 'POST',
        });

        
        if (result.error) {
            throw new Error(result.error);
        }
        
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
        
    } catch (error) {

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

        }
    }
}

// Besten Tisch für eine Gruppe finden
function findBestTableForGroup(group, groupSize) {
    let bestTable = null;
    let bestScore = -1;
    
    for (const table of tables) {
        const currentOccupancy = calculateTableOccupancy(table);
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

    
    // Beim Brauttisch Emojis hinzufügen
    if (isBrautTisch(table)) {
        return `💐 ${table.name} 💐`;
    }
    
    // Verwende bestehenden Namen oder generiere neuen
    if (table.name && table.name.startsWith('Tisch ')) {
        return table.name;
    }
    
    // Fallback: generiere Name basierend auf Position in der Liste
    const tableIndex = tables.findIndex(t => t.id === table.id);
    return generateTableName(tableIndex);
}

// Prüfe ob ein Tisch der Brauttisch ist
function isBrautTisch(table) {
    return table.name === 'Brauttisch' || table.name?.toLowerCase().includes('braut');
}

// Hole Brautpaar-Namen für Anzeige
function getBrautpaarNames() {
    if (window.appSettings?.braut_name && window.appSettings?.braeutigam_name) {
        return {
            braut: window.appSettings.braut_name,
            braeutigam: window.appSettings.braeutigam_name,
            combined: `${window.appSettings.braut_name} & ${window.appSettings.braeutigam_name}`
        };
    }
    return {
        braut: 'Braut',
        braeutigam: 'Bräutigam', 
        combined: 'Brautpaar'
    };
}

// Zentrale Tischberechnung - EINZIGE Quelle für alle Tisch-Daten
function getTableDisplayData(table) {
    // EINHEITLICHE BERECHNUNG: Exakt wie in showTableOverview()
    const totalPersons = calculateTableOccupancy(table);
    const essenCount = calculateTableEssenCount(table);
    const maxPersons = table.max_personen || getStandardTableSize();
    
    return {
        table_name: table.name || `Tisch ${table.id}`,
        table_id: table.id,
        total_persons: totalPersons, // Aus calculateTableOccupancy() - EINZIGE Quelle!
        essen_count: essenCount,     // Für Statistiken (ohne Brautpaar)
        max_persons: maxPersons,
        is_brauttisch: isBrautTisch(table),
        display_text: `${totalPersons}/${maxPersons} ${isBrautTisch(table) ? 'Gäste' : 'Personen'}`
    };
}

// Berechne Belegung inklusive Brautpaar - EINHEITLICHE LOGIK
function calculateTableOccupancy(table) {
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    
    // EINHEITLICHE BERECHNUNG: Exakt gleiche Logik wie in der Übersicht
    const allGuests = [];
    if (isBrautTisch(table)) {
        allGuests.push(
            { persons: 1, isBrautpaar: true }, // Braut
            { persons: 1, isBrautpaar: true }  // Bräutigam
        );
    }
    
    // WICHTIG: Gäste mit Kategorie "Brautpaar" NICHT zusätzlich zählen, da bereits oben eingerechnet
    assignedGuests.forEach(guest => {
        if (guest.kategorie !== 'Brautpaar') {
            allGuests.push({ persons: guest.anzahl_essen || 1, isBrautpaar: false });
        }
    });
    
    const totalPersons = allGuests.reduce((sum, guest) => sum + guest.persons, 0);
    
    console.log(`📊 Table ${table.id} guest calculation:`, {
        assignedGuestsCount: allGuests.length,
        totalPersons: totalPersons,
        isBrautTisch: isBrautTisch(table)
    });
    
    return totalPersons;
}

// Berechne nur die anzahl_essen (ohne Brautpaar für Statistiken)
function calculateTableEssenCount(table) {
    const assignedGuests = guests.filter(g => g.assigned_table === table.id);
    
    // WICHTIG: Gäste mit Kategorie "Brautpaar" nicht mitzählen für Statistiken, 
    // da das Brautpaar separat behandelt wird
    const relevantGuests = assignedGuests.filter(guest => guest.kategorie !== 'Brautpaar');
    
    return relevantGuests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
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
    

    
    return newTable;
}

// Tischzuordnungs-Übersicht laden und anzeigen
async function showTableOverview() {
    try {

        
        // Erstelle Übersicht aus lokalen Daten statt API-Call
        const tableArray = tables.map(table => {
            // EINHEITLICHE BERECHNUNG: Verwende getTableDisplayData für Konsistenz
            return getTableDisplayData(table);
        }) // Alle Tische anzeigen (auch leere)
        .sort((a, b) => {
            // Brauttisch immer zuerst
            if (a.is_brauttisch && !b.is_brauttisch) return -1;
            if (!a.is_brauttisch && b.is_brauttisch) return 1;
            
            // Numerische Sortierung für Tische (Tisch 2, Tisch 3, ... Tisch 10)
            const getTableNumber = (tableName) => {
                const match = tableName.match(/Tisch (\d+)/);
                return match ? parseInt(match[1]) : 0;
            };
            
            const aNum = getTableNumber(a.table_name);
            const bNum = getTableNumber(b.table_name);
            
            // Wenn beide Tische nummeriert sind, numerisch sortieren
            if (aNum > 0 && bNum > 0) {
                return aNum - bNum;
            }
            
            // Fallback: alphabetisch sortieren
            return a.table_name.localeCompare(b.table_name);
        });
        

        
        // Modal anzeigen
        displayTableOverviewModal(tableArray);
        
    } catch (error) {

        showAlert('Fehler beim Erstellen der Tischübersicht: ' + error.message, 'danger');
    }
}

// Tischübersicht als Modal anzeigen
function displayTableOverviewModal(tableOverview) {

    
    // Modal HTML erstellen
    let modalHtml = `
        <div class="modal fade modal-wedding" id="tableOverviewModal" tabindex="-1" aria-labelledby="tableOverviewModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                        <h5 class="modal-title" id="tableOverviewModalLabel">
                            <i class="bi bi-table me-2"></i>Tischzuordnungs-Übersicht
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
    `;
    
    if (!tableOverview || tableOverview.length === 0) {
        modalHtml += `
            <div class="alert alert-info text-center" style="border-color: #d4af37; background-color: #fff9e6;">
                <i class="bi bi-info-circle me-2" style="color: #d4af37;"></i>
                <strong>Noch keine Tischzuordnungen vorhanden.</strong><br>
                Führen Sie zuerst eine Auto-Zuordnung durch.
            </div>
        `;
    } else {
        // Statistiken berechnen
        const totalTables = tableOverview.length;
        const totalGuests = tableOverview.reduce((sum, table) => sum + (table.essen_count || 0), 0); // Nur anzahl_essen
        const unassignedGuests = guests.filter(g => !g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
        
                        // Zusammenfassung
        modalHtml += `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card" style="border: 2px solid #d4af37; background: linear-gradient(135deg, #fff9e6, #f8f4e6);">
                        <div class="card-body text-center">
                            <h6 class="card-title mb-3" style="color: #b8941f;">
                                <i class="bi bi-graph-up me-2"></i>Zusammenfassung
                            </h6>
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="h4 mb-0" style="color: #d4af37;">${totalTables}</div>
                                    <small style="color: #8b7355;">Tische</small>
                                </div>
                                <div class="col-md-4">
                                    <div class="h4 mb-0" style="color: #d4af37;">${totalGuests}</div>
                                    <small style="color: #8b7355;">Gäste</small>
                                </div>
                                <div class="col-md-4">
                                    <div class="h4 mb-0" style="color: #8b7355;">${unassignedGuests}</div>
                                    <small style="color: #8b7355;">Noch offen</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Nicht-zugeordnete Gäste anzeigen (nur wenn vorhanden)
        const unassignedGuestsList = guests.filter(g => !g.assigned_table);
        if (unassignedGuestsList.length > 0) {
            modalHtml += `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card" style="border: 2px solid #8b7355; background: linear-gradient(135deg, #f5f3f0, #eae6e0);">
                            <div class="card-header" style="background: linear-gradient(135deg, #8b7355, #6d5a44); color: white;">
                                <h6 class="mb-0">
                                    <i class="bi bi-person-x me-2"></i>Nicht zugeordnete Gäste (${unassignedGuestsList.length})
                                    <small class="ms-2 opacity-75">Ziehen Sie Gäste auf Tische um sie zuzuordnen</small>
                                </h6>
                            </div>
                            <div class="card-body p-3" style="max-height: 200px; overflow-y: auto;">
                                <div class="row" id="modalUnassignedGuests">
                                    ${unassignedGuestsList.map(guest => `
                                        <div class="col-md-4 col-sm-6 mb-2">
                                            <div class="d-flex align-items-center p-2 rounded border draggable-guest" 
                                                 style="background: white; cursor: grab; border-color: #8b7355 !important;"
                                                 data-guest-id="${guest.id}"
                                                 draggable="true">
                                                <div class="guest-avatar me-2" style="width: 30px; height: 30px; background: #8b7355; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                                                    ${guest.vorname.charAt(0)}${guest.nachname ? guest.nachname.charAt(0) : ''}
                                                </div>
                                                <div class="flex-grow-1" style="min-width: 0;">
                                                    <div class="fw-bold text-truncate" style="font-size: 13px;">${guest.vorname} ${guest.nachname || ''}</div>
                                                    <small style="color: #8b7355;">${guest.anzahl_essen || 0} Essen</small>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Tische anzeigen
        modalHtml += '<div class="row">';
        
        tableOverview.forEach(table => {
            modalHtml += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card h-100 table-drop-zone" 
                         data-table-id="${table.table_id}"
                         style="border: 2px solid #d4af37; box-shadow: 0 4px 8px rgba(212, 175, 55, 0.2); border-left: 4px solid #d4af37; background: white;"
                         ondragover="handleModalTableDragOver(event)"
                         ondrop="handleModalTableDrop(event, ${table.table_id})">
                        <div class="card-header text-center" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                            <h6 class="mb-1 fw-bold">${table.is_brauttisch ? `💐 ${table.table_name} 💐` : table.table_name}</h6>
                            <small>${table.total_persons}/${table.max_persons} Gäste</small>
                        </div>
                        <div class="card-body p-3" style="background: #fff9e6;">
            `;
            
            if (table.total_persons > 0) {
                // Gäste dieses Tisches finden
                const tableGuests = guests.filter(g => g.assigned_table === table.table_id);
                const allGuestNames = [];
                
                // Beim Brauttisch: Brautpaar zuerst
                if (table.is_brauttisch) {
                    const brautpaar = getBrautpaarNames();
                    allGuestNames.push(`
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span style="font-size: 13px;">👑 ${brautpaar.braut}</span>
                            <small style="color: #8b7355;">1 Essen</small>
                        </div>
                    `);
                    allGuestNames.push(`
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span style="font-size: 13px;">👑 ${brautpaar.braeutigam}</span>
                            <small style="color: #8b7355;">1 Essen</small>
                        </div>
                    `);
                }
                
                // Normale Gäste hinzufügen (nicht das Brautpaar doppelt)
                tableGuests.forEach(guest => {
                    if (guest.kategorie !== 'Brautpaar') {
                        allGuestNames.push(`
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span style="font-size: 13px;">${guest.vorname} ${guest.nachname || ''}</span>
                                <div class="d-flex align-items-center">
                                    <small style="color: #8b7355;" class="me-2">${guest.anzahl_essen || 0} Essen</small>
                                    <button class="btn btn-sm btn-outline-danger py-0 px-1" 
                                            onclick="removeGuestFromTableModal(${guest.id}, ${table.table_id})"
                                            title="Gast entfernen">
                                        <i class="bi bi-x" style="font-size: 12px;"></i>
                                    </button>
                                </div>
                            </div>
                        `);
                    }
                });
                
                modalHtml += allGuestNames.join('');
            } else {
                modalHtml += '<small style="color: #8b7355;">Leer</small>';
            }
            
            modalHtml += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        modalHtml += '</div>';
    }
    
    modalHtml += `
                    </div>
                    <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle me-2"></i>Schließen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Entferne existierendes Modal
    const existingModal = document.getElementById('tableOverviewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('tableOverviewModal'));
    modal.show();
    
    // Drag & Drop Event Listeners für das Modal hinzufügen
    setupModalDragAndDrop();
    

}

// Modal-Inhalt aktualisieren ohne Modal zu schließen
function refreshTableOverviewModal() {
    const modal = document.getElementById('tableOverviewModal');
    if (!modal || !modal.classList.contains('show')) {

        return;
    }
    
    // Scroll-Position merken
    const modalBody = modal.querySelector('.modal-body');
    const scrollTop = modalBody ? modalBody.scrollTop : 0;
    


    
    // Neue Übersicht erstellen
    const tableArray = tables.map(table => {
        return getTableDisplayData(table);
    }) // Alle Tische anzeigen (auch leere)
    .sort((a, b) => {
        if (a.is_brauttisch && !b.is_brauttisch) return -1;
        if (!a.is_brauttisch && b.is_brauttisch) return 1;
        
        const getTableNumber = (tableName) => {
            const match = tableName.match(/Tisch (\d+)/);
            return match ? parseInt(match[1]) : 0;
        };
        
        const aNum = getTableNumber(a.table_name);
        const bNum = getTableNumber(b.table_name);
        
        if (aNum > 0 && bNum > 0) {
            return aNum - bNum;
        }
        
        return a.table_name.localeCompare(b.table_name);
    });
    


    
    // Modal-Body aktualisieren
    updateModalContent(tableArray);
    
    // Scroll-Position wiederherstellen
    setTimeout(() => {
        if (modalBody) {
            modalBody.scrollTop = scrollTop;

        }
    }, 50);
    

}

// Funktionen global verfügbar machen für Touch-System
window.refreshTableOverviewModal = refreshTableOverviewModal;

// Modal-Inhalt aktualisieren
function updateModalContent(tableOverview) {
    const modal = document.getElementById('tableOverviewModal');
    const modalBody = modal.querySelector('.modal-body');
    
    if (!modalBody) {

        return;
    }
    


    
    let contentHtml = '';
    
    if (!tableOverview || tableOverview.length === 0) {
        contentHtml = `
            <div class="alert alert-info text-center" style="border-color: #d4af37; background-color: #fff9e6;">
                <i class="bi bi-info-circle me-2" style="color: #d4af37;"></i>
                <strong>Noch keine Tischzuordnungen vorhanden.</strong><br>
                Führen Sie zuerst eine Auto-Zuordnung durch.
            </div>
        `;
    } else {
        // Statistiken berechnen
        const totalTables = tableOverview.length;
        const totalGuests = tableOverview.reduce((sum, table) => sum + (table.essen_count || 0), 0);
        const unassignedGuests = guests.filter(g => !g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
        

        
        // Zusammenfassung
        contentHtml += `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card" style="border: 2px solid #d4af37; background: linear-gradient(135deg, #fff9e6, #f8f4e6);">
                        <div class="card-body text-center">
                            <h6 class="card-title mb-3" style="color: #b8941f;">
                                <i class="bi bi-graph-up me-2"></i>Zusammenfassung
                            </h6>
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="h4 mb-0" style="color: #d4af37;">${totalTables}</div>
                                    <small style="color: #8b7355;">Tische</small>
                                </div>
                                <div class="col-md-4">
                                    <div class="h4 mb-0" style="color: #d4af37;">${totalGuests}</div>
                                    <small style="color: #8b7355;">Gäste</small>
                                </div>
                                <div class="col-md-4">
                                    <div class="h4 mb-0" style="color: #8b7355;">${unassignedGuests}</div>
                                    <small style="color: #8b7355;">Noch offen</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Nicht-zugeordnete Gäste anzeigen
        const unassignedGuestsList = guests.filter(g => !g.assigned_table);

        
        if (unassignedGuestsList.length > 0) {
            contentHtml += `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card" style="border: 2px solid #8b7355; background: linear-gradient(135deg, #f5f3f0, #eae6e0);">
                            <div class="card-header" style="background: linear-gradient(135deg, #8b7355, #6d5a44); color: white;">
                                <h6 class="mb-0">
                                    <i class="bi bi-person-x me-2"></i>Nicht zugeordnete Gäste (${unassignedGuestsList.length})
                                    <small class="ms-2 opacity-75">Ziehen Sie Gäste auf Tische um sie zuzuordnen</small>
                                </h6>
                            </div>
                            <div class="card-body p-3" style="max-height: 200px; overflow-y: auto;">
                                <div class="row" id="modalUnassignedGuests">
                                    ${unassignedGuestsList.map(guest => `
                                        <div class="col-md-4 col-sm-6 mb-2">
                                            <div class="d-flex align-items-center p-2 rounded border draggable-guest" 
                                                 style="background: white; cursor: grab; border-color: #8b7355 !important;"
                                                 data-guest-id="${guest.id}"
                                                 draggable="true">
                                                <div class="guest-avatar me-2" style="width: 30px; height: 30px; background: #8b7355; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                                                    ${guest.vorname.charAt(0)}${guest.nachname ? guest.nachname.charAt(0) : ''}
                                                </div>
                                                <div class="flex-grow-1" style="min-width: 0;">
                                                    <div class="fw-bold text-truncate" style="font-size: 13px;">${guest.vorname} ${guest.nachname || ''}</div>
                                                    <small style="color: #8b7355;">${guest.anzahl_essen || 0} Essen</small>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Tische anzeigen
        contentHtml += '<div class="row">';
        
        tableOverview.forEach(table => {
            const tableGuests = guests.filter(g => g.assigned_table === table.table_id);

            
            contentHtml += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card h-100 table-drop-zone" 
                         data-table-id="${table.table_id}"
                         style="border: 2px solid #d4af37; box-shadow: 0 4px 8px rgba(212, 175, 55, 0.2); border-left: 4px solid #d4af37; background: white;"
                         ondragover="handleModalTableDragOver(event)"
                         ondrop="handleModalTableDrop(event, ${table.table_id})">
                        <div class="card-header text-center" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                            <h6 class="mb-1 fw-bold">${table.is_brauttisch ? `💐 ${table.table_name} 💐` : table.table_name}</h6>
                            <small>${table.total_persons}/${table.max_persons} Gäste</small>
                        </div>
                        <div class="card-body p-3" style="background: #fff9e6;">
            `;
            
            if (table.total_persons > 0) {
                // Gäste dieses Tisches finden
                const allGuestNames = [];
                
                // Beim Brauttisch: Brautpaar zuerst
                if (table.is_brauttisch) {
                    const brautpaar = getBrautpaarNames();
                    allGuestNames.push(`👑 ${brautpaar.braut}`, `👑 ${brautpaar.braeutigam}`);
                }
                
                // Normale Gäste hinzufügen (nicht das Brautpaar doppelt)
                tableGuests.forEach(guest => {
                    if (guest.kategorie !== 'Brautpaar') {
                        allGuestNames.push(`
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span style="font-size: 13px;">${guest.vorname} ${guest.nachname || ''}</span>
                                <button class="btn btn-sm btn-outline-danger py-0 px-1" 
                                        onclick="removeGuestFromTableModal(${guest.id}, ${table.table_id})"
                                        title="Gast entfernen">
                                    <i class="bi bi-x" style="font-size: 12px;"></i>
                                </button>
                            </div>
                        `);
                    }
                });
                
                contentHtml += allGuestNames.join('');
            } else {
                contentHtml += '<small style="color: #8b7355;">Leer</small>';
            }
            
            contentHtml += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        contentHtml += '</div>';
    }
    

    modalBody.innerHTML = contentHtml;

    
    // Event Listeners neu einrichten
    setupModalDragAndDrop();
    

}

// Drag & Drop Event Listeners für das Modal einrichten
function setupModalDragAndDrop() {
    // Event Listeners für draggable Gäste im Modal
    document.querySelectorAll('.draggable-guest').forEach(guestElement => {
        // Standard Drag & Drop Events
        guestElement.addEventListener('dragstart', handleModalGuestDragStart);
        guestElement.addEventListener('dragend', handleModalGuestDragEnd);
        
        // Touch-Unterstützung durch Attribute
        guestElement.setAttribute('draggable', 'true');
        guestElement.style.touchAction = 'none'; // Verhindert Scroll während Drag
    });
    
    // Touch Drag & Drop System aktualisieren
    if (window.refreshTouchDragDrop) {
        window.refreshTouchDragDrop();
    }
    

}

// Modal Drag & Drop Handler
function handleModalGuestDragStart(e) {
    const guestId = parseInt(e.target.closest('.draggable-guest').dataset.guestId);
    draggedGuest = guestId;
    e.target.closest('.draggable-guest').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    
    // Visual feedback für Drop-Zonen
    document.querySelectorAll('.table-drop-zone').forEach(zone => {
        zone.style.backgroundColor = '#e8f5e8';
        zone.style.borderColor = '#28a745';
        zone.style.borderStyle = 'dashed';
        zone.style.borderWidth = '2px';
    });
    
    // Auto-Scroll während Drag & Drop aktivieren
    setupAutoScroll();
    

}

function handleModalGuestDragEnd(e) {
    e.target.closest('.draggable-guest').classList.remove('dragging');
    
    // Drop-Zone Styling zurücksetzen
    document.querySelectorAll('.table-drop-zone').forEach(zone => {
        zone.style.backgroundColor = 'white';
        zone.style.borderColor = '#d4af37';
        zone.style.borderStyle = 'solid';
        zone.style.borderWidth = '0 0 0 4px';
    });
    
    // Auto-Scroll deaktivieren
    clearAutoScroll();
    
    draggedGuest = null;

}

// Auto-Scroll System für Modal
let autoScrollInterval = null;
let lastMouseY = 0;

function setupAutoScroll() {
    const modal = document.getElementById('tableOverviewModal');
    if (!modal) return;
    
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;
    
    // Mouse-Move Listener für Auto-Scroll
    document.addEventListener('dragover', handleDragOverForScroll);
    

}

function clearAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
    
    document.removeEventListener('dragover', handleDragOverForScroll);

}

function handleDragOverForScroll(e) {
    if (!draggedGuest) return;
    
    const modal = document.getElementById('tableOverviewModal');
    if (!modal) return;
    
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;
    
    lastMouseY = e.clientY;
    
    // Scroll-Bereich definieren
    const modalRect = modalBody.getBoundingClientRect();
    const scrollZoneHeight = 50; // Pixel vom Rand für Auto-Scroll
    const scrollSpeed = 5; // Pixel pro Intervall
    
    // Scroll nach oben
    if (e.clientY < modalRect.top + scrollZoneHeight && modalBody.scrollTop > 0) {
        if (!autoScrollInterval) {
            autoScrollInterval = setInterval(() => {
                modalBody.scrollTop = Math.max(0, modalBody.scrollTop - scrollSpeed);
            }, 16); // ~60fps
        }
    }
    // Scroll nach unten
    else if (e.clientY > modalRect.bottom - scrollZoneHeight && 
             modalBody.scrollTop < modalBody.scrollHeight - modalBody.clientHeight) {
        if (!autoScrollInterval) {
            autoScrollInterval = setInterval(() => {
                const maxScroll = modalBody.scrollHeight - modalBody.clientHeight;
                modalBody.scrollTop = Math.min(maxScroll, modalBody.scrollTop + scrollSpeed);
            }, 16); // ~60fps
        }
    }
    // Kein Scroll nötig
    else {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }
}

function handleModalTableDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Visual feedback für aktuelle Drop-Zone
    const dropZone = e.currentTarget;
    dropZone.style.backgroundColor = '#d4edda';
    dropZone.style.borderColor = '#155724';
}

async function handleModalTableDrop(e, tableId) {
    e.preventDefault();
    
    // Drop-Zone Styling zurücksetzen
    const dropZone = e.currentTarget;
    dropZone.style.backgroundColor = '#e8f5e8';
    dropZone.style.borderColor = '#28a745';
    
    if (draggedGuest) {

        
        // WICHTIG: Gast-ID lokal speichern bevor draggedGuest durch dragEnd zurückgesetzt wird
        const guestIdToAssign = draggedGuest;
        
        try {
            // Gast zu Tisch zuweisen
            const result = await apiRequest('/tischplanung/assign', {
                method: 'POST',
                body: JSON.stringify({ guest_id: guestIdToAssign, table_id: tableId })
            });
            
            const guest = guests.find(g => g.id === guestIdToAssign);
            if (guest) {

                guest.assigned_table = tableId;
                

                
                // UI aktualisieren
                renderSeatingChart();
                renderGuestList();
                updateStatistics();
                

                
                // Modal aktualisieren ohne es zu schließen (kurze Verzögerung für UI-Update)
                setTimeout(() => {

                    refreshTableOverviewModal();
                }, 100);
                
                showAlert(`${guest.vorname} wurde zu Tisch zugewiesen`, 'success');
            }
        } catch (error) {

            showAlert('Fehler beim Zuweisen des Gastes', 'danger');
        }
    }
}

// Gast aus Modal entfernen
async function removeGuestFromTableModal(guestId, tableId) {
    try {
        const guest = guests.find(g => g.id === guestId);
        if (!guest) {

            showAlert('Gast nicht gefunden', 'warning');
            return;
        }
        
        const guestName = `${guest.vorname} ${guest.nachname || ''}`;

        
        // API-Call zum Entfernen
        const data = await apiRequest(`/tischplanung/unassign/${guestId}`, {
            method: 'DELETE'
        });
        
        // Lokale Daten aktualisieren
        guest.assigned_table = null;
        

        
        // UI aktualisieren
        renderSeatingChart();
        renderGuestList();
        updateStatistics();
        

        
        // Modal aktualisieren ohne es zu schließen (kurze Verzögerung für UI-Update)
        setTimeout(() => {

            refreshTableOverviewModal();
        }, 100);
        
        showAlert(`${guestName} wurde vom Tisch entfernt`, 'info');
        
    } catch (error) {

        showAlert('Fehler beim Entfernen des Gastes', 'danger');
    }
}

// Statistiken aktualisieren
async function updateStatistics() {
    try {

        
        // Berechne Statistiken basierend auf anzahl_essen statt Gäste-Einträge
        const totalPersons = guests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
        const assignedPersons = guests.filter(g => g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
        const unassignedPersons = totalPersons - assignedPersons;
        
        const totalGuests = guests.length; // Anzahl Gäste-Einträge für Referenz
        const assignedGuests = guests.filter(g => g.assigned_table).length;
        
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
                        <div class="card card-wedding">
                            <div class="card-body text-center">
                                <h3 class="text-wedding mb-1">${assignedGuests}/${totalGuests}</h3>
                                <small class="text-wedding">Gäste zugeordnet</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card card-wedding">
                            <div class="card-body text-center">
                                <h3 class="text-wedding mb-1">${assignedPersons}/${totalPersons}</h3>
                                <small class="text-wedding">Essen zugeordnet</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card card-wedding">
                            <div class="card-body text-center">
                                <h3 class="text-wedding mb-1">${usedTables}/${totalTables}</h3>
                                <small class="text-wedding">Tische belegt</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card card-wedding">
                            <div class="card-body text-center">
                                <h3 style="color: ${conflictCount > 0 ? '#8b7355' : '#d4af37'};" class="mb-1">${conflictCount}</h3>
                                <small class="text-wedding">Konflikte</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-3">
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar" role="progressbar" 
                             style="background: linear-gradient(135deg, #d4af37, #f4e4bc); width: ${totalPersons > 0 ? (assignedPersons/totalPersons)*100 : 0}%"
                             aria-valuenow="${assignedPersons}" aria-valuemin="0" aria-valuemax="${totalPersons}">
                            ${totalPersons > 0 ? Math.round((assignedPersons/totalPersons)*100) : 0}% zugeordnet
                        </div>
                    </div>
                </div>
            `;
        }
        
        } catch (error) {

        
        // Fallback: Zeige Basis-Statistiken ohne Konflikte
        const statsContent = document.getElementById('statisticsContent');
        if (statsContent) {
            const totalPersons = guests.reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
            const assignedPersons = guests.filter(g => g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 1), 0);
            
            statsContent.innerHTML = `
                <div class="col-md-4">
                    <div class="text-center">
                        <h3 class="text-wedding">${assignedPersons}/${totalPersons}</h3>
                        <small>Personen zugewiesen</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center">
                        <h3 class="text-wedding">${totalPersons > 0 ? Math.round((assignedPersons/totalPersons)*100) : 0}%</h3>
                        <small>Fortschritt</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="text-center">
                        <h3 style="color: #8b7355;">-</h3>
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

        return 0;
    }
}

// Legacy-Funktion für Kompatibilität
function checkConflicts() {
    return getConflictCount().then(count => {

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
    const minimap = document.getElementById('minimap');
    if (!minimap) return;
    
    // Minimap-Inhalt leeren und neu aufbauen
    minimap.innerHTML = '';
    
    // Minimap-Container erstellen
    const minimapContainer = document.createElement('div');
    minimapContainer.style.cssText = `
        position: relative;
        width: 100%;
        height: 100px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        overflow: hidden;
    `;
    
    // Vereinfachte Darstellung der Tische
    tables.forEach(table => {
        const tableElement = document.createElement('div');
        const occupiedGuests = guests.filter(g => g.assigned_table === table.id).length;
        const isEmpty = occupiedGuests === 0;
        
        tableElement.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${isEmpty ? '#dee2e6' : table.farbe || '#007bff'};
            left: ${Math.min(90, (table.x_position || 0) / 10)}%;
            top: ${Math.min(85, (table.y_position || 0) / 10)}%;
            cursor: pointer;
        `;
        
        tableElement.title = `${table.name}: ${occupiedGuests} Gäste`;
        tableElement.onclick = () => selectTable(table.id);
        
        minimapContainer.appendChild(tableElement);
    });
    
    minimap.appendChild(minimapContainer);
}

// Statistiken anzeigen/ausblenden
function showStatistics() {

    
    // Berechne Statistiken
    const totalGuests = guests.length;
    const assignedGuests = guests.filter(g => g.assigned_table).length;
    const unassignedGuests = totalGuests - assignedGuests;
    const totalEssen = guests.reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
    const assignedEssen = guests.filter(g => g.assigned_table).reduce((sum, guest) => sum + (guest.anzahl_essen || 0), 0);
    const unassignedEssen = totalEssen - assignedEssen;
    
    const totalTables = tables.length;
    const usedTables = tables.filter(table => 
        guests.some(guest => guest.assigned_table === table.id)
    ).length;
    const emptyTables = totalTables - usedTables;
    
    // Modal anzeigen
    displayStatisticsModal({
        totalGuests,
        assignedGuests,
        unassignedGuests,
        totalEssen,
        assignedEssen,
        unassignedEssen,
        totalTables,
        usedTables,
        emptyTables
    });
}

// Statistiken als Modal anzeigen
function displayStatisticsModal(stats) {

    
    const modalHtml = `
        <div class="modal fade modal-wedding" id="statisticsModal" tabindex="-1" aria-labelledby="statisticsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                        <h5 class="modal-title" id="statisticsModalLabel">
                            <i class="bi bi-graph-up me-2"></i>Tischplanung-Statistiken
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <!-- Gäste Statistiken -->
                            <div class="col-md-6 mb-4">
                                <div class="card h-100" style="border: 2px solid #d4af37; background: linear-gradient(135deg, #fff9e6, #f8f4e6);">
                                    <div class="card-header text-center" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white;">
                                        <h6 class="mb-0"><i class="bi bi-people me-2"></i>Gäste</h6>
                                    </div>
                                    <div class="card-body text-center">
                                        <div class="row">
                                            <div class="col-4">
                                                <div class="h3 mb-1" style="color: #d4af37;">${stats.assignedEssen}</div>
                                                <small style="color: #8b7355;">Zugeordnet</small>
                                            </div>
                                            <div class="col-4">
                                                <div class="h3 mb-1" style="color: #8b7355;">${stats.unassignedEssen}</div>
                                                <small style="color: #8b7355;">Noch offen</small>
                                            </div>
                                            <div class="col-4">
                                                <div class="h3 mb-1" style="color: #d4af37;">${stats.totalEssen}</div>
                                                <small style="color: #8b7355;">Gesamt</small>
                                            </div>
                                        </div>
                                        <div class="progress mt-3" style="height: 8px;">
                                            <div class="progress-bar" role="progressbar" 
                                                 style="background: linear-gradient(135deg, #d4af37, #f4e4bc); width: ${stats.totalEssen > 0 ? (stats.assignedEssen / stats.totalEssen * 100) : 0}%"
                                                 aria-valuenow="${stats.assignedEssen}" aria-valuemin="0" aria-valuemax="${stats.totalEssen}">
                                            </div>
                                        </div>
                                        <small style="color: #8b7355;" class="mt-2 d-block">
                                            ${stats.totalEssen > 0 ? Math.round(stats.assignedEssen / stats.totalEssen * 100) : 0}% zugeordnet
                                        </small>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Tisch Statistiken -->
                            <div class="col-md-6 mb-4">
                                <div class="card h-100" style="border: 2px solid #8b7355; background: linear-gradient(135deg, #f5f3f0, #eae6e0);">
                                    <div class="card-header text-center" style="background: linear-gradient(135deg, #8b7355, #6d5a44); color: white;">
                                        <h6 class="mb-0"><i class="bi bi-table me-2"></i>Tische</h6>
                                    </div>
                                    <div class="card-body text-center">
                                        <div class="row">
                                            <div class="col-4">
                                                <div class="h3 mb-1" style="color: #8b7355;">${stats.usedTables}</div>
                                                <small style="color: #8b7355;">Belegt</small>
                                            </div>
                                            <div class="col-4">
                                                <div class="h3 mb-1" style="color: #8b7355;">${stats.emptyTables}</div>
                                                <small style="color: #8b7355;">Frei</small>
                                            </div>
                                            <div class="col-4">
                                                <div class="h3 mb-1" style="color: #8b7355;">${stats.totalTables}</div>
                                                <small style="color: #8b7355;">Gesamt</small>
                                            </div>
                                        </div>
                                        <div class="progress mt-3" style="height: 8px;">
                                            <div class="progress-bar" role="progressbar" 
                                                 style="background: linear-gradient(135deg, #8b7355, #a68660); width: ${stats.totalTables > 0 ? (stats.usedTables / stats.totalTables * 100) : 0}%"
                                                 aria-valuenow="${stats.usedTables}" aria-valuemin="0" aria-valuemax="${stats.totalTables}">
                                            </div>
                                        </div>
                                        <small style="color: #8b7355;" mt-2 d-block">
                                            ${stats.totalTables > 0 ? Math.round(stats.usedTables / stats.totalTables * 100) : 0}% belegt
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Auslastung pro Tisch -->
                        <div class="row">
                            <div class="col-12">
                                <div class="card" style="border: 2px solid #d4af37; background: linear-gradient(135deg, #fff9e6, #f8f4e6);">
                                    <div class="card-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white;">
                                        <h6 class="mb-0"><i class="bi bi-bar-chart me-2"></i>Auslastung pro Tisch</h6>
                                    </div>
                                    <div class="card-body">
                                        ${generateTableUtilizationChart()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle me-2"></i>Schließen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Entferne existierendes Modal
    const existingModal = document.getElementById('statisticsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('statisticsModal'));
    modal.show();
    

}

// Hilfsfunktion für Tischauslastungsdiagramm
function generateTableUtilizationChart() {
    const tableUtilization = tables.map(table => {
        const assignedGuests = guests.filter(g => g.assigned_table === table.id);
        
        // EINHEITLICHE BERECHNUNG: Exakt gleiche Logik wie in der Übersicht
        const allGuests = [];
        if (isBrautTisch(table)) {
            allGuests.push(
                { persons: 1, isBrautpaar: true }, // Braut
                { persons: 1, isBrautpaar: true }  // Bräutigam
            );
        }
        assignedGuests.forEach(guest => {
            allGuests.push({ persons: guest.anzahl_essen || 1, isBrautpaar: false });
        });
        const assignedPersons = allGuests.reduce((sum, guest) => sum + guest.persons, 0);
        
        const maxPersons = table.max_personen || 10;
        const utilization = maxPersons > 0 ? (assignedPersons / maxPersons * 100) : 0;
        
        return {
            name: table.name || `Tisch ${table.id}`,
            assigned: assignedPersons,
            max: maxPersons,
            utilization: utilization
        };
    }).filter(table => table.assigned > 0); // Nur belegte Tische
    
    if (tableUtilization.length === 0) {
        return '<p style="color: #8b7355;" class="text-center">Noch keine Tische belegt.</p>';
    }
    
    return tableUtilization.map(table => `
        <div class="d-flex align-items-center mb-3">
            <div class="flex-shrink-0 me-3" style="width: 120px;">
                <strong style="color: #b8941f;">${table.name}</strong>
                <br><small style="color: #8b7355;">${table.assigned}/${table.max}</small>
            </div>
            <div class="flex-grow-1">
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar" 
                         role="progressbar" style="width: ${table.utilization}%; background: linear-gradient(135deg, ${table.utilization > 90 ? '#8b7355, #6d5a44' : table.utilization > 75 ? '#d4af37, #b8941f' : '#d4af37, #f4e4bc'});"
                         aria-valuenow="${table.utilization}" aria-valuemin="0" aria-valuemax="100">
                        ${Math.round(table.utilization)}%
                    </div>
                </div>
            </div>
        </div>
    `).join('');
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
                            <h4 style="color: #d4af37;">${totalRelations}</h4>
                            <small>Gesamt</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-success">
                        <div class="card-body">
                            <h4 style="color: #d4af37;">${positiveRelations}</h4>
                            <small>Positiv</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-danger">
                        <div class="card-body">
                            <h4 style="color: #8b7355;">${negativeRelations}</h4>
                            <small>Negativ</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-warning">
                        <div class="card-body">
                            <h4 style="color: #8b7355;">${relationships.filter(r => r.staerke === 0).length}</h4>
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
                                // Verwende die Namen direkt aus der Beziehung (sind bereits korrekt)
                                const guest1Name = rel.gast1_name || 'Unbekannt';
                                const guest2Name = rel.gast2_name || 'Unbekannt';
                                const strength = rel.staerke;
                                const strengthClass = strength > 0 ? 'success' : strength < 0 ? 'danger' : 'secondary';
                                
                                return `
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <span>
                                            <strong>${guest1Name}</strong> 
                                            ↔ 
                                            <strong>${guest2Name}</strong>
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

// Alle Tische zurücksetzen
async function clearAllTables() {
    if (!confirm('Alle Tischzuweisungen werden gelöscht. Fortfahren?')) {
        return;
    }
    
    try {
        const result = await apiRequest('/tischplanung/clear-all', {
            method: 'POST'
        });
        
        guests.forEach(guest => guest.assigned_table = null);
        
        renderSeatingChart();
        renderGuestList();
        updateStatistics();
        
        document.getElementById('conflictAlerts').innerHTML = '';
        
        showAlert('Alle Tischzuweisungen wurden zurückgesetzt', 'info');
    } catch (error) {

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
        
        const result = await apiRequest('/tischplanung/save', {
            method: 'POST',
            body: JSON.stringify({
                assignments: assignments,
                tables: tables.map(t => ({
                    id: t.id,
                    x_position: t.x_position,
                    y_position: t.y_position
                }))
            })
        });
        
        showAlert('Sitzplan wurde gespeichert', 'success');
    } catch (error) {

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
                ${(allGuestsIncludingNoFood || guests).filter(g => g.id !== guestId).map(g => 
                    `<option value="${g.id}">${g.vorname} ${g.nachname || g.name || ''}</option>`
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
                            <small style="color: #8b7355;">${formatRelationshipType(rel.beziehungstyp)}</small>
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
        const result = await apiRequest('/tischplanung/relationships', {
            method: 'POST',
            body: JSON.stringify({
                gast_id_1: guestId,
                gast_id_2: otherGuestId,
                beziehungstyp: relationType,
                staerke: strength
            })
        });
        
        await reloadRelationships();
        showGuestRelationships(guestId);
        renderGuestList();
        checkConflicts();
        showAlert('Beziehung hinzugefügt', 'success');
    } catch (error) {

        showAlert('Fehler beim Hinzufügen der Beziehung', 'danger');
    }
}

// deleteRelationship wird von tischplanung-relationships.js bereitgestellt
// NICHT hier definieren, um Konflikte zu vermeiden!

// Beziehungen bearbeiten (Modal)
function editRelationships(guestId) {
    selectedGuest = guestId;
    
    // Suche Gast in beiden Arrays - für Beziehungen können auch Gäste ohne Essen verwaltet werden
    let guest = allGuestsIncludingNoFood.find(g => g.id === guestId);
    if (!guest) {
        guest = guests.find(g => g.id === guestId);
    }
    
    if (!guest) {
        console.error('Gast nicht gefunden:', guestId);
        showAlert('Gast nicht gefunden', 'danger');
        return;
    }
    
    console.log('🔍 Beziehungen bearbeiten für Gast:', guest);
    
    // Debug: Verfügbare Gäste für Dropdown
    const availableGuests = (allGuestsIncludingNoFood || guests).filter(g => g.id !== guestId);
    console.log('🔍 Verfügbare Gäste für Dropdown:', {
        count: availableGuests.length,
        guests: availableGuests.slice(0, 5).map(g => `${g.vorname} ${g.nachname || g.name || ''} (ID: ${g.id})`)
    });
    
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
                            ${(allGuestsIncludingNoFood || guests).filter(g => g.id !== guestId).map(g => 
                                `<option value="${g.id}">${g.vorname} ${g.nachname || g.name || ''}</option>`
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
    console.log('🔍 getExistingRelationshipsHTML Debug:', {
        guestId: guestId,
        relationships: relationships,
        guests: guests.length,
        allGuestsIncludingNoFood: allGuestsIncludingNoFood ? allGuestsIncludingNoFood.length : 'undefined'
    });
    
    const guestRelationships = relationships.filter(r => 
        r.gast_id_1 === guestId || r.gast_id_2 === guestId
    );
    
    console.log('🔍 Gefilterte Beziehungen für Gast:', guestRelationships);
    
    if (guestRelationships.length === 0) {
        return '<p style="color: #8b7355;">Noch keine Beziehungen definiert.</p>';
    }
    
    return guestRelationships.map(rel => {
        const otherGuestId = rel.gast_id_1 === guestId ? rel.gast_id_2 : rel.gast_id_1;
        
        console.log('🔍 Verarbeite Beziehung:', {
            relationshipId: rel.id,
            otherGuestId: otherGuestId,
            relationship: rel
        });
        
        // Verbesserte Gast-Suche - PRIORITÄT: Namen aus Beziehung, dann Fallback zu Gäste-Arrays
        let otherGuestName = 'Unbekannt';
        
        // Methode 1: Verwende bereits vorhandene Namen aus der Beziehung (PRIORITY!)
        if (rel.gast_id_1 === guestId && rel.gast2_name) {
            otherGuestName = rel.gast2_name;
            console.log('🔍 Methode 1 - Verwende gast2_name aus Beziehung:', otherGuestName);
        } else if (rel.gast_id_2 === guestId && rel.gast1_name) {
            otherGuestName = rel.gast1_name;
            console.log('🔍 Methode 1 - Verwende gast1_name aus Beziehung:', otherGuestName);
        }
        
        // Methode 2: Fallback - Suche in allGuestsIncludingNoFood nur wenn kein Name in Beziehung
        if (otherGuestName === 'Unbekannt' && allGuestsIncludingNoFood && Array.isArray(allGuestsIncludingNoFood)) {
            const otherGuest = allGuestsIncludingNoFood.find(g => g.id === otherGuestId || g.id === parseInt(otherGuestId));
            if (otherGuest) {
                const vorname = otherGuest.vorname || otherGuest.first_name || '';
                const nachname = otherGuest.nachname || otherGuest.last_name || otherGuest.name || '';
                otherGuestName = `${vorname} ${nachname}`.trim();
                console.log('🔍 Methode 2 - Name aus allGuestsIncludingNoFood:', otherGuestName);
            }
        }
        
        // Methode 3: Fallback - Suche in guests Array nur wenn immer noch kein Name
        if (otherGuestName === 'Unbekannt' && guests && Array.isArray(guests)) {
            const otherGuest = guests.find(g => g.id === otherGuestId || g.id === parseInt(otherGuestId));
            if (otherGuest) {
                const vorname = otherGuest.vorname || otherGuest.first_name || '';
                const nachname = otherGuest.nachname || otherGuest.last_name || otherGuest.name || '';
                otherGuestName = `${vorname} ${nachname}`.trim();
                console.log('🔍 Methode 3 - Name aus guests Array:', otherGuestName);
            }
        }
        
        // Letzte Fallback-Option
        if (!otherGuestName || otherGuestName === ' ' || otherGuestName === 'Unbekannt') {
            otherGuestName = `Gast ${otherGuestId}`;
            console.log('🔍 Fallback - Verwende Gast-ID als Name:', otherGuestName);
        }
        
        console.log('🔍 Finaler Gastname:', otherGuestName);
        
        const strengthColor = rel.staerke > 0 ? 'success' : rel.staerke < 0 ? 'danger' : 'secondary';
        
        return `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${otherGuestName}</strong><br>
                    <small style="color: #8b7355;">${formatRelationshipType(rel.beziehungstyp)}</small>
                    ${rel.notizen ? `<br><small style="color: #d4af37;">📝 ${rel.notizen}</small>` : ''}
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

// deleteRelationshipFromModal wird von tischplanung-relationships.js bereitgestellt
// NICHT hier definieren, um Konflikte zu vermeiden!

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
                <p class="form-control-plaintext">${getTableDisplayData(table).total_persons}/${table.max_personen} ${isBrautTisch(table) ? 'Gäste' : 'Personen'} (${assignedGuests.filter(g => g.kategorie !== 'Brautpaar').length} zugewiesene Gäste)</p>
            </div>
        </div>
        
        <hr>
        <h6>Zugewiesene Gäste</h6>
        <div class="list-group">
            ${isBrautTisch(table) ? (() => {
                const brautpaar = getBrautpaarNames();
                return `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>👑 ${brautpaar.braut}</strong>
                            <small class="d-block" style="color: #8b7355;">1 Essen (Braut)</small>
                        </div>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>👑 ${brautpaar.braeutigam}</strong>
                            <small class="d-block" style="color: #8b7355;">1 Essen (Bräutigam)</small>
                        </div>
                    </div>
                `;
            })() : ''}
            ${assignedGuests.filter(guest => guest.kategorie !== 'Brautpaar').map(guest => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${guest.vorname} ${guest.nachname || ''}</strong>
                        <small class="d-block" style="color: #8b7355;">${guest.anzahl_essen || 0} Essen</small>
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
        const result = await apiRequest(`/tischplanung/tables/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify(tableData)
        });
        
        await loadTables();
        renderSeatingChart();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('tableDetailsModal'));
        modal.hide();
        
        showAlert('Tisch aktualisiert', 'success');
    } catch (error) {

        showAlert('Fehler beim Aktualisieren des Tisches', 'danger');
    }
}

// Tisch löschen
async function deleteTable() {
    const content = document.getElementById('tableDetailsContent');
    const tableId = parseInt(content.dataset.tableId);
    
    if (!confirm('Tisch wirklich löschen? Alle Zuordnungen gehen verloren.')) return;
    
    try {
        const result = await apiRequest(`/tischplanung/tables/${tableId}`, {
            method: 'DELETE'
        });
        
        await loadTables();
        renderSeatingChart();
        renderGuestList();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('tableDetailsModal'));
        modal.hide();
        
        showAlert('Tisch gelöscht', 'info');
    } catch (error) {

        showAlert('Fehler beim Löschen des Tisches', 'danger');
    }
}

// Tischposition aktualisieren
async function updateTablePosition(tableId, x, y) {
    try {
        await apiRequest(`/tischplanung/tables/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify({
                x_position: x,
                y_position: y
            })
        });
    } catch (error) {

    }
}

// Tischgrößen aktualisieren
async function updateTableSizes() {
    const newSize = parseInt(document.getElementById('defaultTableSize').value);
    
    // Konfiguration sofort speichern
    try {
        const result = await apiRequest('/tischplanung/config', {
            method: 'POST',
            body: JSON.stringify({
                standard_tisch_groesse: newSize
            })
        });

        
        // Globale Konfiguration aktualisieren
        tischplanung_config.standard_tisch_groesse = newSize;
    } catch (error) {

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
    // Bestehende Tooltips entfernen
    hideTooltip();
    
    if (!text) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.9;
        white-space: nowrap;
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
    
    // Tooltip nach 3 Sekunden automatisch ausblenden
    setTimeout(() => hideTooltip(), 3000);
}

function hideTooltip(element) {
    const existingTooltips = document.querySelectorAll('.custom-tooltip');
    existingTooltips.forEach(tooltip => tooltip.remove());
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
                    if (confirm('Letzte Änderung rückgängig machen?')) {
                        showAlert('Undo-Funktion noch nicht implementiert', 'info');
                    }
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

    showLoading(true);
    
    try {
        // API-Aufruf für automatische Zuordnung
        const result = await apiRequest('/tischplanung/auto-assign', {
            method: 'POST',
        });

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

            centerTables(); // Direkter Aufruf für Matrix-Layout
        } else {
            // Fallback zur alten Methode
            renderSeatingChart();
            renderGuestList();
            updateStatistics();
        }
        
        // KEIN Modal mehr - nur stille Verarbeitung für bessere UX
        // await showTableOverview(); // ENTFERNT für bessere UX
        

        
    } catch (error) {

        showAlert('Fehler bei automatischer Zuweisung: ' + error.message, 'danger');
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
    console.log('🎯 centerTables aufgerufen - Debugging:', {
        tablesArray: tables,
        tablesLength: tables?.length,
        tablesType: typeof tables,
        windowTables: window.tables
    });
    
    // Verwende globale Variable oder suche im DOM nach Tischen
    let tablesToCenter = tables;
    
    if (!tablesToCenter || !Array.isArray(tablesToCenter) || tablesToCenter.length === 0) {
        console.log('🔍 Globale tables Variable leer, suche Tische im DOM...');
        
        // Versuche, Tische aus dem DOM zu extrahieren
        const chart = document.getElementById("seatingChart");
        if (chart) {
            const tableElements = chart.querySelectorAll('.table-item');
            console.log(`📊 ${tableElements.length} Tische im DOM gefunden`);
            
            if (tableElements.length > 0) {
                tablesToCenter = Array.from(tableElements).map(el => {
                    const id = el.getAttribute('data-table-id');
                    const name = el.querySelector('.table-name')?.textContent || `Tisch ${id}`;
                    const rect = el.getBoundingClientRect();
                    const chartRect = chart.getBoundingClientRect();
                    
                    return {
                        id: parseInt(id),
                        name: name,
                        x_position: rect.left - chartRect.left,
                        y_position: rect.top - chartRect.top,
                        element: el
                    };
                });
                console.log('📋 Tische aus DOM extrahiert:', tablesToCenter);
            }
        }
    }
    
    if (!tablesToCenter || !Array.isArray(tablesToCenter) || tablesToCenter.length === 0) {
        console.warn('⚠️ Keine Tische verfügbar:', { 
            globalTables: tables?.length, 
            domTables: document.querySelectorAll('.table-item').length 
        });
        
        // Zeige Wedding-Theme Modal statt Browser-Popup
        showNoTablesModal();
        return;
    }
    
    const chart = document.getElementById("seatingChart");
    if (!chart) {
        console.error('❌ seatingChart Element nicht gefunden');
        return;
    }
    
    console.log('📊 Tische zentrieren:', {
        tischAnzahl: tablesToCenter.length,
        chartGroesse: { width: chart.offsetWidth, height: chart.offsetHeight }
    });
    
    // Berechne optimale Matrix-Layout mit Kollisionserkennung
    const tableCount = tablesToCenter.length;
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
    
    console.log('📐 Table positioning calculated:', {
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
    let updatedTables = 0;
    
    tablesToCenter.forEach((table, index) => {
        const row = Math.floor(index / tablesPerRow);
        const col = index % tablesPerRow;
        const x = startX + col * spacingX;
        const y = startY + row * spacingY;
        
        console.log(`🔧 Positioniere Tisch ${table.id} (${table.name}) an Position ${x}, ${y}`);
        
        // Update Position im DOM sofort für bessere UX
        const tableElement = document.querySelector(`[data-table-id="${table.id}"]`);
        if (tableElement) {
            tableElement.style.left = x + 'px';
            tableElement.style.top = y + 'px';
            updatedTables++;
        } else {
            console.warn(`⚠️ Tisch-Element für Tisch ${table.id} nicht gefunden`);
        }
        
        // Update auch die Position in der tables-Variable und lokalen Variable
        if (table.element) {
            // Falls aus DOM extrahiert
            table.x_position = x;
            table.y_position = y;
        } else {
            // Falls aus globaler Variable
            table.x_position = x;
            table.y_position = y;
            
            // Auch in der globalen Variable aktualisieren
            const globalTable = tables.find(t => t.id === table.id);
            if (globalTable) {
                globalTable.x_position = x;
                globalTable.y_position = y;
            }
        }
        
        // API-Update für Backend
        updatePromises.push(
            updateTablePosition(table.id, x, y)
        );
    });
    
    console.log(`✅ ${updatedTables} von ${tablesToCenter.length} Tischen im DOM positioniert`);
    
    // Alle Updates gleichzeitig ausführen
    Promise.all(updatePromises).then(() => {
        console.log('✅ Alle Tischpositionen im Backend gespeichert');
        showCenterTablesSuccessModal(tablesToCenter.length);
    }).catch(error => {
        console.error('❌ Fehler beim Speichern der Tischpositionen:', error);
        showAlert('Fehler beim Speichern der Tischpositionen', 'danger');
    });
}

// Wedding-Theme Success Modal für Tische zentriert
function showCenterTablesSuccessModal(tableCount) {
    const modalHtml = `
        <div class="modal fade modal-wedding" id="centerTablesSuccessModal" tabindex="-1" aria-labelledby="centerTablesSuccessModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                        <h5 class="modal-title" id="centerTablesSuccessModalLabel">
                            <i class="bi bi-check-circle me-2"></i>Tische zentriert
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-3">
                            <i class="bi bi-grid-3x3-gap" style="font-size: 3rem; color: #d4af37;"></i>
                        </div>
                        <h4 style="color: #8b7355; margin-bottom: 1rem;">Erfolgreich zentriert!</h4>
                        <p style="color: #8b7355; font-size: 1.1rem;">
                            <strong>${tableCount}</strong> Tische wurden in einem optimalen Matrix-Layout zentriert.
                        </p>
                        <div class="mt-3">
                            <small style="color: #8b7355;">
                                Die Tischpositionen wurden automatisch im Backend gespeichert.
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                        <button type="button" class="btn btn-wedding-primary" data-bs-dismiss="modal">
                            <i class="bi bi-check-circle me-2"></i>Perfekt!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Entferne existierendes Modal
    const existingModal = document.getElementById('centerTablesSuccessModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Modal anzeigen und nach 3 Sekunden automatisch schließen
    const modal = new bootstrap.Modal(document.getElementById('centerTablesSuccessModal'));
    modal.show();
    
    // Auto-close nach 3 Sekunden für bessere UX
    setTimeout(() => {
        modal.hide();
    }, 3000);
}

// Wedding-Theme Modal für "Keine Tische"
function showNoTablesModal() {
    const globalTableCount = tables?.length || 0;
    const domTableCount = document.querySelectorAll('.table-item').length;
    
    const modalHtml = `
        <div class="modal fade modal-wedding" id="noTablesModal" tabindex="-1" aria-labelledby="noTablesModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff9e6 100%); border: 2px solid #d4af37;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #d4af37, #b8941f); color: white; border-bottom: none;">
                        <h5 class="modal-title" id="noTablesModalLabel">
                            <i class="bi bi-info-circle me-2"></i>Tische zentrieren
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-4">
                            <i class="bi bi-table" style="font-size: 4rem; color: #d4af37; opacity: 0.5;"></i>
                        </div>
                        <h4 style="color: #8b7355; margin-bottom: 1rem;">Keine Tische vorhanden</h4>
                        <p style="color: #8b7355; font-size: 1.1rem;">
                            Es wurden noch keine Tische erstellt, die zentriert werden können.
                        </p>
                        
                        <div class="row mt-4">
                            <div class="col-md-6">
                                <div class="card" style="border: 1px solid #d4af37; background: rgba(212, 175, 55, 0.1);">
                                    <div class="card-body">
                                        <h6 style="color: #d4af37;">📊 Aktuelle Situation</h6>
                                        <p class="mb-1" style="color: #8b7355;">Globale Tische: <strong>${globalTableCount}</strong></p>
                                        <p class="mb-0" style="color: #8b7355;">DOM Tische: <strong>${domTableCount}</strong></p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card" style="border: 1px solid #8b7355; background: rgba(139, 115, 85, 0.1);">
                                    <div class="card-body">
                                        <h6 style="color: #8b7355;">💡 Nächste Schritte</h6>
                                        <p class="mb-0" style="color: #8b7355;">
                                            Erstellen Sie zuerst Tische über den 
                                            <strong>"Tisch hinzufügen"</strong> Button
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="background: #f8f4e6; border-top: 1px solid #d4af37;">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-check-circle me-2"></i>Verstanden
                        </button>
                        <button type="button" class="btn btn-wedding-primary" onclick="addNewTable(); bootstrap.Modal.getInstance(document.getElementById('noTablesModal')).hide();">
                            <i class="bi bi-plus-circle me-2"></i>Tisch hinzufügen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Entferne existierendes Modal
    const existingModal = document.getElementById('noTablesModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('noTablesModal'));
    modal.show();
}

// Alle Tische zurücksetzen mit Bestätigung
function clearAllTablesConfirm() {
    if (confirm('Alle Tischzuweisungen werden unwiderruflich gelöscht. Fortfahren?')) {
        clearAllTables();
    }
}

// Global verfügbar machen - ALLE benötigten Funktionen
window.centerTables = centerTables;

// Debug-Funktion für Tischverfügbarkeit
window.debugTischVerfügbarkeit = function() {
    console.log('🔍 Debug: Tischverfügbarkeit');
    console.log('Globale tables Variable:', {
        exists: typeof tables !== 'undefined',
        isArray: Array.isArray(tables),
        length: tables?.length,
        data: tables
    });
    
    const domTables = document.querySelectorAll('.table-item');
    console.log('DOM Tische:', {
        count: domTables.length,
        elements: Array.from(domTables).map(el => ({
            id: el.getAttribute('data-table-id'),
            name: el.querySelector('.table-name')?.textContent
        }))
    });
    
    return {
        globalTables: tables?.length || 0,
        domTables: domTables.length
    };
};
window.autoAssignGuests = autoAssignGuests;
window.clearAllTablesConfirm = clearAllTablesConfirm;
window.clearAllTables = clearAllTables;

// Debug-Funktion für den aktuellen Status
window.debugTischplanung = function() {
    console.log('🔍 Debug Tischplanung Status:', {
        tables: tables,
        tablesCount: tables?.length || 0,
        guests: guests,
        guestsCount: guests?.length || 0,
        assignedGuests: guests?.filter(g => g.assigned_table)?.length || 0,
        relationships: relationships?.length || 0,
        config: tischplanung_config
    });
    
    return {
        tables: tables?.length || 0,
        guests: guests?.length || 0,
        assigned: guests?.filter(g => g.assigned_table)?.length || 0
    };
};

// === API DEBUGGING UTILITIES ===

// API-Aufruf mit erweiterten Logs
async function makeApiCall(endpoint, method = 'GET', data = null) {
    const fullUrl = `/api/tischplanung/${endpoint}`;

    
    try {
        const config = {
            method: method,
            headers: {
                'Accept': 'application/json'
            }
        };
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        const response = await fetch(fullUrl, config);
        

        
        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const responseData = await response.json();

        
        return responseData;
        
    } catch (error) {

        throw error;
    }
}

// Debug-Funktion für komplettes System-Check
function debugSystemCheck() {

    
    // 1. DOM-Elemente prüfen

    const domElements = [
        'statisticsContent',
        'tableOverviewModal', 
        'tableOverviewContent',
        'guestList',
        'seatingChart'
    ];
    
    domElements.forEach(id => {
        const element = document.getElementById(id);

    });
    
    // 2. Datenstrukturen prüfen




    
    // 3. API-Tests durchführen

    setTimeout(async () => {
        try {
            await makeApiCall('overview');

        } catch (error) {

        }
        
        try {
            await makeApiCall('tables');

        } catch (error) {

        }
    }, 100);
}

// Global verfügbar machen (sofort nach Funktionsdefinition)
window.makeApiCall = makeApiCall;
window.debugSystemCheck = debugSystemCheck;
window.showTableOverview = showTableOverview;
window.updateStatistics = updateStatistics;
window.showStatistics = showStatistics;

// Zusätzliche explizite globale Deklaration für onclick-Handler
if (typeof window !== 'undefined') {
    window.showTableOverview = showTableOverview;
    window.showStatistics = showStatistics;
    window.updateStatistics = updateStatistics;
}





