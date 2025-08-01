/**
 * Zeitplan JavaScript - Mit Gantt Chart und Listen-Ansicht
 */

let currentZeitplan = [];
let currentView = 'gantt'; // 'gantt' oder 'list'
let selectedEventIndex = null;
let brideGroom = { bride: 'Braut', groom: 'Bräutigam' }; // Default-Werte

document.addEventListener('DOMContentLoaded', function() {
    loadBrideGroomNames();
    loadZeitplan();
    setupResponsibleDropdowns();
    ensureEventpartsToggle();
});

// Braut/Bräutigam Namen laden
function loadBrideGroomNames() {
    fetch('/api/settings/get')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.settings) {
                // Versuche Namen aus hochzeit_config zu laden
                if (data.settings.bride_name && data.settings.groom_name) {
                    brideGroom.bride = data.settings.bride_name;
                    brideGroom.groom = data.settings.groom_name;
                }
                console.log('Braut/Bräutigam Namen geladen:', brideGroom);
                updateResponsibleDropdowns();
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Namen:', error);
        });
}

// Verantwortlich-Dropdowns einrichten
function setupResponsibleDropdowns() {
    // Da wir jetzt datalist verwenden, müssen wir nur die Namen aktualisieren
    updateResponsibleDropdowns();
}

// Verantwortlich-Dropdowns mit Namen aktualisieren
function updateResponsibleDropdowns() {
    const addDatalist = document.getElementById('responsibleOptions');
    const editDatalist = document.getElementById('editResponsibleOptions');
    
    [addDatalist, editDatalist].forEach(datalist => {
        if (datalist) {
            // Optionen aktualisieren
            const brideOption = datalist.querySelector('option[value="Braut"]');
            const groomOption = datalist.querySelector('option[value="Bräutigam"]');
            const bothOption = datalist.querySelector('option[value="Beide"]');
            
            if (brideOption) brideOption.textContent = `Braut (${brideGroom.bride})`;
            if (groomOption) groomOption.textContent = `Bräutigam (${brideGroom.groom})`;
            if (bothOption) bothOption.textContent = `Beide (${brideGroom.bride} & ${brideGroom.groom})`;
        }
    });
}

// Verantwortlich-Feld intelligent setzen
function setResponsibleDropdown(type, value) {
    const inputId = type === 'edit' ? 'editEventResponsible' : 'eventResponsible';
    const input = document.getElementById(inputId);
    
    if (!input) return;
    
    // Einfach den Wert direkt setzen, da es jetzt ein Input-Feld ist
    input.value = value || '';
}

// Zeitplan laden
function loadZeitplan() {
    return fetch('/api/zeitplan/list')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentZeitplan = data.zeitplan;
                if (currentZeitplan.length > 0) {
                    if (currentView === 'gantt') {
                        displayGanttChart(currentZeitplan);
                    } else {
                        displayZeitplanList(currentZeitplan);
                    }
                } else {
                    showNoDataMessage();
                }
                return Promise.resolve(); // Erfolgreich geladen
            } else {
                console.error('Fehler beim Laden des Zeitplans:', data.error);
                showNoDataMessage();
                return Promise.reject(new Error(data.error));
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden des Zeitplans:', error);
            showNoDataMessage();
            return Promise.reject(error);
        });
}

// Ansicht wechseln
function toggleView() {
    const ganttView = document.getElementById('ganttView');
    const listView = document.getElementById('listView');
    const viewToggleIcon = document.getElementById('viewToggleIcon');
    const viewToggleText = document.getElementById('viewToggleText');
    
    // Prüfe ob alle Elemente existieren
    if (!ganttView || !listView || !viewToggleIcon || !viewToggleText) {
        console.error('Zeitplan HTML-Elemente nicht gefunden');
        return;
    }
    
    if (currentView === 'gantt') {
        // Zur Listen-Ansicht wechseln
        currentView = 'list';
        ganttView.classList.add('d-none');
        listView.classList.remove('d-none');
        viewToggleIcon.className = 'bi bi-calendar3 me-1';
        viewToggleText.textContent = 'Timeline-Ansicht';
        displayZeitplanList(currentZeitplan);
    } else {
        // Zur Gantt-Ansicht wechseln
        currentView = 'gantt';
        listView.classList.add('d-none');
        ganttView.classList.remove('d-none');
        viewToggleIcon.className = 'bi bi-list-ul me-1';
        viewToggleText.textContent = 'Listenansicht';
        displayGanttChart(currentZeitplan);
    }
}

// Gantt Chart anzeigen
function displayGanttChart(zeitplan) {
    const container = document.getElementById('ganttChart');
    
    // Sicherheitsprüfung für Container
    if (!container) {
        console.error('Gantt Chart Container nicht gefunden');
        return;
    }
    
    if (!zeitplan || zeitplan.length === 0) {
        container.innerHTML = '<div class="text-center py-5 text-muted">Keine Daten für Timeline verfügbar</div>';
        return;
    }
    
    // Sortiere nach Uhrzeit
    zeitplan.sort((a, b) => a.Uhrzeit.localeCompare(b.Uhrzeit));
    
    // Zeitbereich automatisch bestimmen
    const times = zeitplan.map(event => parseTimeToMinutes(event.Uhrzeit));
    const earliestTime = Math.min(...times);
    const latestTime = Math.max(...times);
    
    // Puffer hinzufügen (1 Stunde vor und nach)
    const startHour = Math.max(0, Math.floor(earliestTime / 60) - 1);
    const endHour = Math.min(24, Math.ceil(latestTime / 60) + 2);
    const totalHours = endHour - startHour;
    
    // Gantt Container erstellen
    let html = `
        <div class="gantt-timeline">
            <div class="gantt-header">
                <div class="gantt-time-label">Zeit</div>
    `;
    
    // Zeitstunden-Header erstellen
    for (let hour = startHour; hour < endHour; hour++) {
        html += `<div class="gantt-header-cell">${hour.toString().padStart(2, '0')}:00</div>`;
    }
    
    html += `
            </div>
            <div class="gantt-body">
    `;
    
    // Events als Gantt-Balken hinzufügen
    zeitplan.forEach((event, index) => {
        const eventStart = parseTimeToMinutes(event.Uhrzeit);
        const startPosition = ((eventStart - (startHour * 60)) / (totalHours * 60)) * 100;
        
        // Dauer berechnen
        let eventEnd = eventStart + 30; // Standard: 30 Min
        if (event.Dauer) {
            const durationMinutes = parseDurationToMinutes(event.Dauer);
            eventEnd = eventStart + durationMinutes;
        } else if (event.EndZeit) {
            eventEnd = parseTimeToMinutes(event.EndZeit);
        }
        
        const eventWidth = Math.max(((eventEnd - eventStart) / (totalHours * 60)) * 100, 2);
        const statusClass = `status-${event.Status.toLowerCase()}`;
        const publicClass = event.public ? 'public-event' : 'private-event';
        
        html += `
            <div class="gantt-row">
                <div class="gantt-time-label">${event.Uhrzeit}</div>
                <div class="gantt-timeline-area" style="position: relative;">
                    <div class="gantt-bar ${statusClass} ${publicClass}" 
                         style="left: ${startPosition}%; width: ${eventWidth}%; cursor: pointer;"
                         title="${event.Programmpunkt} (${event.Uhrzeit}${event.EndZeit ? ' - ' + event.EndZeit : ''})"
                         onclick="selectEventFromGantt(${index})"
                         data-index="${index}">
                        <div class="gantt-bar-content">
                            <i class="gantt-bar-icon ${getStatusIcon(event.Status)}"></i>
                            <span class="gantt-bar-text">${event.Programmpunkt}</span>
                            ${event.public ? '<i class="bi bi-eye gantt-visibility-icon"></i>' : '<i class="bi bi-eye-slash gantt-visibility-icon"></i>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Event aus Gantt-Chart auswählen
function selectEventFromGantt(index) {
    selectedEventIndex = index;
    
    // Event in der Timeline hervorheben
    document.querySelectorAll('.gantt-bar').forEach(bar => {
        bar.classList.remove('selected');
    });
    
    const selectedBar = document.querySelector(`[data-index="${index}"]`);
    if (selectedBar) {
        selectedBar.classList.add('selected');
    }
    
    // Zur Listen-Ansicht wechseln und Event anzeigen
    if (currentView === 'gantt') {
        toggleView(); // Wechsle zur Listen-Ansicht
    }
    
    // Event in der Liste auswählen
    selectEvent(index);
}

// Listen-Ansicht anzeigen
function displayZeitplanList(zeitplan) {
    const listContainer = document.getElementById('zeitplanList');
    
    if (!zeitplan || zeitplan.length === 0) {
        listContainer.innerHTML = '<div class="list-group-item text-center text-muted">Keine Programmpunkte vorhanden</div>';
        showNoEventSelected();
        return;
    }
    
    // Sortiere nach Uhrzeit
    zeitplan.sort((a, b) => a.Uhrzeit.localeCompare(b.Uhrzeit));
    
    let html = '';
    zeitplan.forEach((event, index) => {
        const statusClass = `zeitplan-status-${event.Status.toLowerCase()}`;
        const publicIcon = event.public ? 
            '<span class="badge bg-success ms-1" title="Für Gäste sichtbar"><i class="bi bi-eye"></i></span>' : 
            '<span class="badge bg-secondary ms-1" title="Nur intern sichtbar"><i class="bi bi-eye-slash"></i></span>';
        
        html += `
            <div class="list-group-item zeitplan-list-item position-relative" onclick="selectEvent(${index})" data-index="${index}">
                <div class="event-quick-actions">
                    <button type="button" class="btn btn-outline-primary btn-quick-edit" onclick="event.stopPropagation(); editEvent(${index})" title="Bearbeiten">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-quick-edit" onclick="event.stopPropagation(); confirmDeleteEvent(${index})" title="Löschen">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-primary zeitplan-time-badge me-2">${event.Uhrzeit}</span>
                            ${event.EndZeit ? `<span class="badge bg-secondary zeitplan-time-badge me-2">bis ${event.EndZeit}</span>` : ''}
                            <span class="badge ${statusClass} zeitplan-status-badge">${event.Status}</span>
                            ${publicIcon}
                        </div>
                        <div class="zeitplan-title">${event.Programmpunkt}</div>
                        <div class="zeitplan-meta">
                            ${event.Dauer ? `<span><i class="bi bi-hourglass"></i>${event.Dauer}</span>` : ''}
                            ${event.Verantwortlich ? `<span><i class="bi bi-person"></i>${event.Verantwortlich}</span>` : ''}
                        </div>
                    </div>
                    <div class="ms-2">
                        <i class="bi ${getStatusIcon(event.Status)} text-muted"></i>
                    </div>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    
    // Erstes Element auswählen oder vorherige Auswahl beibehalten
    if (selectedEventIndex !== null && selectedEventIndex < zeitplan.length) {
        selectEvent(selectedEventIndex);
    } else if (zeitplan.length > 0) {
        selectEvent(0);
    } else {
        showNoEventSelected();
    }
}

// Event auswählen und Details anzeigen
function selectEvent(index) {
    showEventDetails(index);
}

// Event vom Gantt Chart aus auswählen
function selectEventFromGantt(index) {
    console.log('Event aus Gantt Chart ausgewählt:', index);
    
    // Zur Listenansicht wechseln um Details zu zeigen
    if (currentView === 'gantt') {
        toggleView(); // Wechselt automatisch zur Listenansicht
    }
    
    // Event auswählen und Details anzeigen
    setTimeout(() => {
        selectEvent(index);
    }, 100); // Kurze Verzögerung um sicherzustellen, dass die Ansicht gewechselt ist
}

// Event-Details anzeigen
function showEventDetails(index) {
    console.log('Zeige Details für Event Index:', index);
    
    if (!currentZeitplan || !currentZeitplan[index]) {
        console.error('Event nicht gefunden für Index:', index);
        showNoEventSelected();
        return;
    }
    
    selectedEventIndex = index;
    const event = currentZeitplan[index];
    
    // Alle Items als inaktiv markieren
    document.querySelectorAll('.zeitplan-list-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-index="${index}"]`)?.classList.add('active');
    
    // Details anzeigen
    const detailsContainer = document.getElementById('eventDetails');
    const statusClass = `zeitplan-status-${event.Status.toLowerCase()}`;
    
    detailsContainer.innerHTML = `
        <div class="event-details-card">
            <div class="event-details-header">
                <div class="d-flex align-items-center">
                    <i class="bi ${getStatusIcon(event.Status)} me-3" style="font-size: 1.5rem;"></i>
                    <div>
                        <h5 class="mb-1">${event.Programmpunkt}</h5>
                        <span class="badge ${statusClass}">${event.Status}</span>
                    </div>
                </div>
            </div>
            <div class="event-details-body">
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-clock"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Beginn</div>
                        <div class="detail-value">${event.Uhrzeit}</div>
                    </div>
                </div>
                ${event.EndZeit ? `
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-clock-history"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Ende</div>
                        <div class="detail-value">${event.EndZeit}</div>
                    </div>
                </div>` : ''}
                ${event.Dauer ? `
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-hourglass"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Dauer</div>
                        <div class="detail-value">${event.Dauer}</div>
                    </div>
                </div>` : ''}
                ${event.Verantwortlich ? `
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-person"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Verantwortlich</div>
                        <div class="detail-value">${event.Verantwortlich}</div>
                    </div>
                </div>` : ''}
                ${event.public && event.eventteile && event.eventteile.length > 0 ? `
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-people"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Sichtbar für Eventteile</div>
                        <div class="detail-value">
                            ${event.eventteile.map(teil => {
                                switch(teil) {
                                    case 'weisser_saal': return '<span class="badge bg-secondary me-1"><i class="bi bi-building me-1"></i>Weißer Saal</span>';
                                    case 'essen': return '<span class="badge bg-success me-1"><i class="bi bi-cup-hot me-1"></i>Essen</span>';
                                    case 'party': return '<span class="badge bg-warning me-1"><i class="bi bi-music-note me-1"></i>Party</span>';
                                    default: return `<span class="badge bg-light text-dark me-1">${teil}</span>`;
                                }
                            }).join('')}
                        </div>
                    </div>
                </div>` : ''}
                ${event.public && (!event.eventteile || event.eventteile.length === 0) ? `
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-eye"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Sichtbarkeit</div>
                        <div class="detail-value">
                            <span class="badge bg-info"><i class="bi bi-people me-1"></i>Für alle Gäste sichtbar</span>
                        </div>
                    </div>
                </div>` : ''}
                <div class="mt-3">
                    <button type="button" class="btn btn-outline-primary btn-sm me-2" onclick="editEvent(${index})">
                        <i class="bi bi-pencil me-1"></i>
                        Bearbeiten
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteEventFromDetails()">
                        <i class="bi bi-trash me-1"></i>
                        Löschen
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Kein Event ausgewählt anzeigen
function showNoEventSelected() {
    selectedEventIndex = null;
    const detailsContainer = document.getElementById('eventDetails');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-arrow-left-circle display-4 mb-3"></i>
                <p>Wählen Sie einen Programmpunkt aus der Liste aus, um Details anzuzeigen</p>
            </div>
        `;
    }
}

// Status-Icon bestimmen
function getStatusIcon(status) {
    switch(status) {
        case 'Geplant':
            return 'bi-calendar-check';
        case 'Gebucht':
            return 'bi-bookmark-check';
        case 'Bestätigt':
            return 'bi-check-circle';
        case 'Abgeschlossen':
            return 'bi-check-circle-fill';
        default:
            return 'bi-question-circle';
    }
}

// Keine Daten Nachricht anzeigen
function showNoDataMessage() {
    const ganttChart = document.getElementById('ganttChart');
    const listContainer = document.getElementById('zeitplanList');
    
    // Gantt Chart Container leeren und Nachricht anzeigen
    if (ganttChart) {
        ganttChart.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-calendar-x display-4 text-muted mb-3"></i>
                <h4 class="text-muted">Noch keine Programmpunkte vorhanden</h4>
                <p class="text-muted">Fügen Sie Ihren ersten Programmpunkt hinzu, um zu beginnen.</p>
            </div>
        `;
    }
    
    // Listen Container leeren
    if (listContainer) {
        listContainer.innerHTML = '<div class="list-group-item text-center text-muted">Keine Programmpunkte vorhanden</div>';
    }
    
    // No Data Message anzeigen
    const noDataElement = document.getElementById('noDataMessage');
    if (noDataElement) {
        noDataElement.classList.remove('d-none');
    }
    
    // Views ausblenden
    const ganttView = document.getElementById('ganttView');
    const listView = document.getElementById('listView');
    if (ganttView) ganttView.classList.add('d-none');
    if (listView) listView.classList.add('d-none');
}

// Hilfsfunktionen für Zeit
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function parseDurationToMinutes(durationStr) {
    if (durationStr.includes(':')) {
        const [hours, minutes] = durationStr.split(':').map(Number);
        return hours * 60 + minutes;
    } else {
        // Nur Stunden angegeben
        return parseInt(durationStr) * 60;
    }
}

// Neuen Programmpunkt hinzufügen
function addEvent() {
    console.log('AddEvent aufgerufen');
    
    try {
        const startTime = document.getElementById('eventStartTime').value;
        const endTime = document.getElementById('eventEndTime').value;
        const calculatedDuration = document.getElementById('calculatedDuration').textContent;
        
        // Verantwortlich-Feld direkt verwenden
        const responsibleValue = document.getElementById('eventResponsible').value || '';
        
        // Eventteile sammeln (nur wenn öffentlich)
        const eventteile = [];
        if (document.getElementById('eventPublic').checked) {
            if (document.getElementById('eventWS').checked) eventteile.push('weisser_saal');
            if (document.getElementById('eventEssen').checked) eventteile.push('essen');
            if (document.getElementById('eventParty').checked) eventteile.push('party');
        }
        
        const eventData = {
            Uhrzeit: startTime,
            Programmpunkt: document.getElementById('eventTitle').value,
            Dauer: calculatedDuration !== '00:00' ? calculatedDuration : '',
            EndZeit: endTime,
            Verantwortlich: responsibleValue,
            Status: document.getElementById('eventStatus').value,
            public: document.getElementById('eventPublic').checked,
            eventteile: eventteile
        };
        
        console.log('Event-Daten:', eventData);
        
        // Validierung
        if (!eventData.Uhrzeit || !eventData.Programmpunkt) {
            showError('Bitte füllen Sie mindestens Beginn und Programmpunkt aus.');
            return;
        }
        
        // API-Aufruf zum Hinzufügen
        fetch('/api/zeitplan/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('API-Antwort:', data);
            if (data.success) {
                // Modal schließen und Form zurücksetzen
                closeAddModal();
                document.getElementById('addEventForm').reset();
                document.getElementById('durationDisplay').style.display = 'none';
                
                // Zeitplan neu laden
                loadZeitplan();
                
                showSuccess('Programmpunkt erfolgreich hinzugefügt!');
            } else {
                showError('Fehler beim Hinzufügen: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Fehler beim Hinzufügen:', error);
            showError('Fehler beim Hinzufügen des Programmpunkts: ' + error.message);
        });
    } catch (error) {
        console.error('Globaler Fehler in addEvent:', error);
        showError('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
    }
}

// Modal schließen für Add-Event
function closeAddModal() {
    const modalElement = document.getElementById('addEventModal');
    
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        } else {
            // Fallback: Modal manuell schließen
            modalElement.classList.remove('show');
            modalElement.style.display = 'none';
            document.body.classList.remove('modal-open');
            
            // Backdrop entfernen
            const backdrop = document.getElementById('modal-backdrop-add');
            if (backdrop) {
                backdrop.remove();
            }
        }
    } catch (error) {
        console.error('Fehler beim Schließen des Add-Modals:', error);
    }
}

// Zeitberechnung für neuen Event
function calculateDuration() {
    const startTime = document.getElementById('eventStartTime').value;
    const endTime = document.getElementById('eventEndTime').value;
    const durationDisplay = document.getElementById('durationDisplay');
    const calculatedDuration = document.getElementById('calculatedDuration');
    
    if (startTime && endTime) {
        const duration = calculateTimeDifference(startTime, endTime);
        calculatedDuration.textContent = duration;
        durationDisplay.style.display = 'block';
    } else {
        durationDisplay.style.display = 'none';
        calculatedDuration.textContent = '00:00';
    }
}

// Zeit-Differenz berechnen
function calculateTimeDifference(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    
    if (end <= start) {
        return '00:00';
    }
    
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Programmpunkt bearbeiten
function editEvent(index) {
    console.log('EditEvent aufgerufen mit Index:', index);
    console.log('CurrentZeitplan verfügbar:', currentZeitplan);
    console.log('Event-Anzahl:', currentZeitplan ? currentZeitplan.length : 'undefined');
    
    try {
        if (!currentZeitplan || !currentZeitplan[index]) {
            console.error('Event nicht gefunden:', {index, currentZeitplan});
            showError('Event-Daten konnten nicht geladen werden.');
            return;
        }
        
        const event = currentZeitplan[index];
        console.log('Event gefunden:', event);
        
        // Edit Modal mit Event-Daten füllen
        console.log('Fülle Modal-Felder...');
        document.getElementById('editEventIndex').value = index;
        document.getElementById('editEventStartTime').value = event.Uhrzeit;
        document.getElementById('editEventEndTime').value = event.EndZeit || '';
        document.getElementById('editEventTitle').value = event.Programmpunkt;
        
        // Verantwortlich-Feld intelligent setzen
        setResponsibleDropdown('edit', event.Verantwortlich || '');
        
        document.getElementById('editEventStatus').value = event.Status;
        
        // Public-Flag setzen
        const isPublic = event.public || false;
        document.getElementById('editEventPublic').checked = isPublic;
        
        // Eventteile setzen
        const eventteile = event.eventteile || [];
        document.getElementById('editEventWS').checked = eventteile.includes('weisser_saal');
        document.getElementById('editEventEssen').checked = eventteile.includes('essen');
        document.getElementById('editEventParty').checked = eventteile.includes('party');
        
        // Eventteile-Bereich mit toggleEventParts korrekt anzeigen/verstecken
        if (typeof toggleEventParts === 'function') {
            toggleEventParts('editEventParts', isPublic);
        } else {
            // Fallback falls toggleEventParts nicht verfügbar
            const editEventPartsDiv = document.getElementById('editEventParts');
            if (editEventPartsDiv) {
                editEventPartsDiv.style.display = isPublic ? 'block' : 'none';
            }
        }
        
        console.log('Modal-Felder gefüllt');
        
        // Dauer berechnen wenn vorhanden
        if (event.Uhrzeit && event.EndZeit) {
            console.log('Berechne Dauer...');
            calculateEditDuration();
        }
        
        // Modal anzeigen - prüfe ob Bootstrap verfügbar ist
        const modalElement = document.getElementById('editEventModal');
        console.log('Modal-Element gefunden:', modalElement ? 'ja' : 'nein');
        console.log('Bootstrap verfügbar:', typeof bootstrap !== 'undefined');
        
        if (modalElement) {
            try {
                // Versuche Bootstrap 5 Modal
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    console.log('Verwende Bootstrap Modal');
                    const modal = new bootstrap.Modal(modalElement);
                    modal.show();
                    console.log('Bootstrap Modal geöffnet');
                } else {
                    console.log('Bootstrap nicht verfügbar, verwende Fallback');
                    // Fallback: Modal manuell anzeigen
                    modalElement.classList.add('show');
                    modalElement.style.display = 'block';
                    document.body.classList.add('modal-open');
                    
                    // Backdrop hinzufügen
                    const backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    backdrop.id = 'modal-backdrop-edit';
                    document.body.appendChild(backdrop);
                    console.log('Fallback Modal geöffnet');
                }
            } catch (error) {
                console.error('Fehler beim Öffnen des Edit-Modals:', error);
                // Einfaches Alert als Fallback
                const newTitle = prompt('Neuer Titel:', event.Programmpunkt);
                if (newTitle) {
                    console.log('Quick Edit:', {index, newTitle});
                    // Hier würde normalerweise die API aufgerufen
                }
            }
        } else {
            console.error('Edit Modal Element nicht gefunden');
            showError('Modal konnte nicht gefunden werden.');
        }
    } catch (globalError) {
        console.error('Globaler Fehler in editEvent:', globalError);
        showError('Ein unerwarteter Fehler ist aufgetreten: ' + globalError.message);
    }
}

// Bearbeiteten Event speichern
function saveEditEvent() {
    console.log('SaveEditEvent aufgerufen');
    
    try {
        const index = parseInt(document.getElementById('editEventIndex').value);
        const startTime = document.getElementById('editEventStartTime').value;
        const endTime = document.getElementById('editEventEndTime').value;
        const calculatedDuration = document.getElementById('editCalculatedDuration').textContent;
        
        // Verantwortlich-Feld direkt verwenden
        const editResponsibleValue = document.getElementById('editEventResponsible').value || '';
        
        // Eventteile sammeln (nur wenn öffentlich)
        const eventteile = [];
        if (document.getElementById('editEventPublic').checked) {
            if (document.getElementById('editEventWS').checked) eventteile.push('weisser_saal');
            if (document.getElementById('editEventEssen').checked) eventteile.push('essen');
            if (document.getElementById('editEventParty').checked) eventteile.push('party');
        }
        
        const eventData = {
            Uhrzeit: startTime,
            Programmpunkt: document.getElementById('editEventTitle').value,
            Dauer: calculatedDuration !== '00:00' ? calculatedDuration : '',
            EndZeit: endTime,
            Verantwortlich: editResponsibleValue,
            Status: document.getElementById('editEventStatus').value,
            public: document.getElementById('editEventPublic').checked,
            eventteile: eventteile
        };
        
        console.log('Update-Daten:', {index, eventData});
        
        // Validierung
        if (!eventData.Uhrzeit || !eventData.Programmpunkt) {
            showError('Bitte füllen Sie mindestens Beginn und Programmpunkt aus.');
            return;
        }
        
        if (index < 0 || isNaN(index)) {
            showError('Ungültiger Event-Index.');
            return;
        }
        
        // API-Aufruf zum Aktualisieren
        fetch('/api/zeitplan/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                index: index,
                data: eventData
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Update API-Antwort:', data);
            if (data.success) {
                // Modal schließen
                closeEditModal();
                
                // Zeitplan neu laden
                loadZeitplan().then(() => {
                    // Nach dem Neuladen: Wenn wir in der Listenansicht sind und ein Event ausgewählt war,
                    // die Details für den aktualisierten Event wieder anzeigen
                    if (currentView === 'list' && selectedEventIndex === index) {
                        console.log('Aktualisiere Details für Event Index:', index);
                        setTimeout(() => {
                            showEventDetails(index);
                        }, 100); // Kurze Verzögerung um sicherzustellen, dass die Liste geladen ist
                    }
                });
                
                showSuccess('Programmpunkt erfolgreich aktualisiert!');
            } else {
                showError('Fehler beim Aktualisieren: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Fehler beim Aktualisieren:', error);
            showError('Fehler beim Aktualisieren des Programmpunkts: ' + error.message);
        });
    } catch (error) {
        console.error('Globaler Fehler in saveEditEvent:', error);
        showError('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
    }
}

// Event löschen (von Details-Panel aus)
function deleteEventFromDetails() {
    if (selectedEventIndex !== null) {
        deleteEvent();
    }
}

// Event löschen
function deleteEvent() {
    console.log('DeleteEvent aufgerufen');
    
    try {
        let index;
        
        // Index ermitteln - entweder vom Edit-Modal oder von selectedEventIndex
        const editIndex = document.getElementById('editEventIndex');
        if (editIndex && editIndex.value) {
            index = parseInt(editIndex.value);
        } else if (selectedEventIndex !== null) {
            index = selectedEventIndex;
        } else {
            showError('Kein Event zum Löschen ausgewählt.');
            return;
        }
        
        if (index < 0 || isNaN(index)) {
            showError('Ungültiger Event-Index.');
            return;
        }
        
        if (!confirm('Möchten Sie diesen Programmpunkt wirklich löschen?')) {
            return;
        }
        
        console.log('Lösche Event mit Index:', index);
        
        // API-Aufruf zum Löschen
        fetch('/api/zeitplan/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                index: index
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Delete API-Antwort:', data);
            if (data.success) {
                // Modal schließen falls geöffnet
                closeEditModal();
                
                // Nach dem Löschen: Details-Panel leeren und Zeitplan neu laden
                loadZeitplan().then(() => {
                    // Details-Panel zurücksetzen, da das Event gelöscht wurde
                    selectedEventIndex = null;
                    if (currentView === 'list') {
                        showNoEventSelected();
                    }
                });
                
                showSuccess('Programmpunkt erfolgreich gelöscht!');
            } else {
                showError('Fehler beim Löschen: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Fehler beim Löschen:', error);
            showError('Fehler beim Löschen des Programmpunkts: ' + error.message);
        });
    } catch (error) {
        console.error('Globaler Fehler in deleteEvent:', error);
        showError('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
    }
}

// Modal schließen (Bootstrap oder Fallback)
function closeEditModal() {
    const modalElement = document.getElementById('editEventModal');
    
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        } else {
            // Fallback: Modal manuell schließen
            modalElement.classList.remove('show');
            modalElement.style.display = 'none';
            document.body.classList.remove('modal-open');
            
            // Backdrop entfernen
            const backdrop = document.getElementById('modal-backdrop-edit');
            if (backdrop) {
                backdrop.remove();
            }
        }
    } catch (error) {
        console.error('Fehler beim Schließen des Modals:', error);
    }
}

// Zeitberechnung für Edit Event
function calculateEditDuration() {
    const startTime = document.getElementById('editEventStartTime').value;
    const endTime = document.getElementById('editEventEndTime').value;
    const durationDisplay = document.getElementById('editDurationDisplay');
    const calculatedDuration = document.getElementById('editCalculatedDuration');
    
    if (startTime && endTime) {
        const duration = calculateTimeDifference(startTime, endTime);
        calculatedDuration.textContent = duration;
        durationDisplay.style.display = 'block';
    } else {
        durationDisplay.style.display = 'none';
        calculatedDuration.textContent = '00:00';
    }
}

// Bestätigung vor Löschung
function confirmDeleteEvent(index) {
    if (confirm('Möchten Sie diesen Programmpunkt wirklich löschen?')) {
        // Temporär den Index setzen für deleteEvent
        document.getElementById('editEventIndex').value = index;
        deleteEvent();
    }
}

// iCal Export-Funktion
function exportToICal() {
    // Zuerst Hochzeitsdatum aus den Einstellungen laden
    fetch('/api/settings/get')
        .then(response => response.json())
        .then(data => {
            let weddingDate = '2025-09-01'; // Fallback-Datum
            
            if (data.success && data.settings) {
                if (data.settings.hochzeitsdatum) {
                    weddingDate = data.settings.hochzeitsdatum;
                } else if (data.settings.settings && data.settings.settings.hochzeitsdatum) {
                    weddingDate = data.settings.settings.hochzeitsdatum;
                }
            }
            
            console.log('Verwendetes Hochzeitsdatum für iCal:', weddingDate);
            generateICalFile(weddingDate);
        })
        .catch(error => {
            console.error('Fehler beim Laden des Hochzeitsdatums:', error);
            generateICalFile('2025-09-01'); // Fallback
        });
}

function generateICalFile(weddingDate) {
    if (!currentZeitplan || currentZeitplan.length === 0) {
        showError('Keine Termine zum Exportieren verfügbar');
        return;
    }
    
    // iCal Header
    let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hochzeitsplaner//Zeitplan//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Hochzeits-Zeitplan',
        'X-WR-CALDESC:Zeitplan für unsere Hochzeit'
    ];
    
    // Events hinzufügen
    currentZeitplan.forEach((event, index) => {
        const eventStartTime = convertToDateTime(weddingDate, event.Uhrzeit);
        let eventEndTime = eventStartTime;
        
        // Endzeit berechnen
        if (event.Dauer) {
            const durationMinutes = parseDurationToMinutes(event.Dauer);
            eventEndTime = new Date(eventStartTime.getTime() + (durationMinutes * 60000));
        } else if (event.Ende) {
            eventEndTime = convertToDateTime(weddingDate, event.Ende);
        } else {
            // Standard: 30 Minuten Dauer
            eventEndTime = new Date(eventStartTime.getTime() + (30 * 60000));
        }
        
        const uid = `hochzeit-${Date.now()}-${index}@hochzeitsplaner.local`;
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        icalContent.push(
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${timestamp}`,
            `DTSTART:${formatICalDateTime(eventStartTime)}`,
            `DTEND:${formatICalDateTime(eventEndTime)}`,
            `SUMMARY:${escapeICalText(event.Programmpunkt)}`,
            `DESCRIPTION:${escapeICalText(event.Beschreibung || '')}`,
            `STATUS:${event.Status.toUpperCase()}`,
            `LOCATION:${escapeICalText(event.Ort || '')}`
        );
        
        if (event.Verantwortlich) {
            icalContent.push(`ORGANIZER:CN=${escapeICalText(event.Verantwortlich)}`);
        }
        
        icalContent.push('END:VEVENT');
    });
    
    icalContent.push('END:VCALENDAR');
    
    // Download initiieren
    const blob = new Blob([icalContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hochzeit-zeitplan-${weddingDate}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('iCal-Datei wurde exportiert');
}

// Hilfsfunktionen für iCal
function convertToDateTime(date, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = new Date(date + 'T00:00:00');
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
}

function formatICalDateTime(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICalText(text) {
    if (!text) return '';
    return text.replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n');
}

function parseDurationToMinutes(duration) {
    if (!duration) return 30;
    
    const parts = duration.split(':');
    if (parts.length === 2) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        return (hours * 60) + minutes;
    }
    return 30;
}

// Eventteile Toggle Setup
function setupEventpartsToggle() {
    // Add Event Modal
    const eventPublicCheckbox = document.getElementById('eventPublic');
    const eventPartsDiv = document.getElementById('eventParts');
    
    if (eventPublicCheckbox && eventPartsDiv) {
        eventPublicCheckbox.addEventListener('change', function() {
            if (this.checked) {
                eventPartsDiv.style.display = 'block';
                // Standard: alle Eventteile auswählen
                const wsCheckbox = document.getElementById('eventWS');
                const essenCheckbox = document.getElementById('eventEssen');
                const partyCheckbox = document.getElementById('eventParty');
                
                if (wsCheckbox) wsCheckbox.checked = true;
                if (essenCheckbox) essenCheckbox.checked = true;
                if (partyCheckbox) partyCheckbox.checked = true;
            } else {
                eventPartsDiv.style.display = 'none';
                // Alle Eventteile deaktivieren
                const wsCheckbox = document.getElementById('eventWS');
                const essenCheckbox = document.getElementById('eventEssen');
                const partyCheckbox = document.getElementById('eventParty');
                
                if (wsCheckbox) wsCheckbox.checked = false;
                if (essenCheckbox) essenCheckbox.checked = false;
                if (partyCheckbox) partyCheckbox.checked = false;
            }
        });
    }
    
    // Edit Event Modal
    const editEventPublicCheckbox = document.getElementById('editEventPublic');
    const editEventPartsDiv = document.getElementById('editEventParts');
    
    if (editEventPublicCheckbox && editEventPartsDiv) {
        editEventPublicCheckbox.addEventListener('change', function() {
            if (this.checked) {
                editEventPartsDiv.style.display = 'block';
            } else {
                editEventPartsDiv.style.display = 'none';
                // Alle Eventteile deaktivieren
                const wsCheckbox = document.getElementById('editEventWS');
                const essenCheckbox = document.getElementById('editEventEssen');
                const partyCheckbox = document.getElementById('editEventParty');
                
                if (wsCheckbox) wsCheckbox.checked = false;
                if (essenCheckbox) essenCheckbox.checked = false;
                if (partyCheckbox) partyCheckbox.checked = false;
            }
        });
    }
}

// Robustere Setup-Funktion mit Retry-Mechanismus
function ensureEventpartsToggle() {
    setupEventpartsToggle();
    
    // Retry nach kurzer Verzögerung für den Fall, dass die Modals noch nicht geladen sind
    setTimeout(() => {
        setupEventpartsToggle();
    }, 500);
    
    // Nochmals nach längerer Verzögerung
    setTimeout(() => {
        setupEventpartsToggle();
    }, 2000);
}
