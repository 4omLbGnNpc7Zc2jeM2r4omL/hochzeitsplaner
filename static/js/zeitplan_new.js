/**
 * Zeitplan JavaScript - Mit Gantt Chart und Listen-Ansicht
 */

let currentZeitplan = [];
let currentView = 'gantt'; // 'gantt' oder 'list'
let selectedEventIndex = null;

document.addEventListener('DOMContentLoaded', function() {
    loadZeitplan();
});

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
    
    // Erstelle Zeitbereich (6:00 bis 24:00)
    const startHour = 6;
    const endHour = 24;
    const totalHours = endHour - startHour;
    
    // Gantt Header erstellen
    let headerHtml = '<div class="gantt-timeline"><div class="gantt-header">';
    for (let hour = startHour; hour < endHour; hour++) {
        headerHtml += `<div class="gantt-header-cell">${hour.toString().padStart(2, '0')}:00</div>`;
    }
    headerHtml += '</div><div class="gantt-body">';
    
    // Events als Gantt-Balken
    zeitplan.forEach((event, index) => {
        const eventStart = parseTimeToMinutes(event.Uhrzeit);
        const startPosition = ((eventStart - (startHour * 60)) / (totalHours * 60)) * 100;
        
        let eventEnd = eventStart + 30; // Standard: 30 Min
        if (event.Dauer) {
            const durationMinutes = parseDurationToMinutes(event.Dauer);
            eventEnd = eventStart + durationMinutes;
        }
        
        const eventWidth = Math.max(((eventEnd - eventStart) / (totalHours * 60)) * 100, 2);
        const statusClass = `status-${event.Status.toLowerCase()}`;
        
        headerHtml += `
            <div class="gantt-row">
                <div class="gantt-bar ${statusClass}" 
                     style="left: ${startPosition}%; width: ${eventWidth}%;"
                     title="${event.Programmpunkt} (${event.Uhrzeit})">
                    <div class="gantt-bar-content">
                        <span class="gantt-bar-icon">${getStatusIcon(event.Status)}</span>
                        <span class="gantt-bar-text">${event.Programmpunkt}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    headerHtml += '</div></div>';
    container.innerHTML = headerHtml;
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
                            ${event.public ? `<span class="badge bg-success zeitplan-status-badge ms-1" title="Für Gäste sichtbar"><i class="bi bi-eye"></i></span>` : ''}
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
                <div class="detail-item">
                    <div class="detail-icon">
                        <i class="bi bi-eye"></i>
                    </div>
                    <div class="detail-content">
                        <div class="detail-label">Sichtbarkeit</div>
                        <div class="detail-value">
                            ${event.public ? '<span class="badge bg-success"><i class="bi bi-eye me-1"></i>Für Gäste sichtbar</span>' : '<span class="badge bg-secondary"><i class="bi bi-eye-slash me-1"></i>Nur intern</span>'}
                        </div>
                    </div>
                </div>
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
        
        const eventData = {
            Uhrzeit: startTime,
            Programmpunkt: document.getElementById('eventTitle').value,
            Dauer: calculatedDuration !== '00:00' ? calculatedDuration : '',
            EndZeit: endTime,
            Verantwortlich: document.getElementById('eventResponsible').value,
            Status: document.getElementById('eventStatus').value,
            public: document.getElementById('eventPublic').checked
        };
        
        console.log('Event-Daten:', eventData);
        
        // Validierung
        if (!eventData.Uhrzeit || !eventData.Programmpunkt) {
            alert('Bitte füllen Sie mindestens Beginn und Programmpunkt aus.');
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
                
                alert('Programmpunkt erfolgreich hinzugefügt!');
            } else {
                alert('Fehler beim Hinzufügen: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Fehler beim Hinzufügen:', error);
            alert('Fehler beim Hinzufügen des Programmpunkts: ' + error.message);
        });
    } catch (error) {
        console.error('Globaler Fehler in addEvent:', error);
        alert('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
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
            alert('Event-Daten konnten nicht geladen werden.');
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
        document.getElementById('editEventResponsible').value = event.Verantwortlich || '';
        document.getElementById('editEventStatus').value = event.Status;
        
        // Public-Checkbox setzen
        const publicCheckbox = document.getElementById('editEventPublic');
        if (publicCheckbox) {
            publicCheckbox.checked = event.public === true || event.public === 'true';
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
            alert('Modal konnte nicht gefunden werden.');
        }
    } catch (globalError) {
        console.error('Globaler Fehler in editEvent:', globalError);
        alert('Ein unerwarteter Fehler ist aufgetreten: ' + globalError.message);
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
        
        const eventData = {
            Uhrzeit: startTime,
            Programmpunkt: document.getElementById('editEventTitle').value,
            Dauer: calculatedDuration !== '00:00' ? calculatedDuration : '',
            EndZeit: endTime,
            Verantwortlich: document.getElementById('editEventResponsible').value,
            Status: document.getElementById('editEventStatus').value,
            public: document.getElementById('editEventPublic').checked
        };
        
        console.log('Update-Daten:', {index, eventData});
        
        // Validierung
        if (!eventData.Uhrzeit || !eventData.Programmpunkt) {
            alert('Bitte füllen Sie mindestens Beginn und Programmpunkt aus.');
            return;
        }
        
        if (index < 0 || isNaN(index)) {
            alert('Ungültiger Event-Index.');
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
                
                alert('Programmpunkt erfolgreich aktualisiert!');
            } else {
                alert('Fehler beim Aktualisieren: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Fehler beim Aktualisieren:', error);
            alert('Fehler beim Aktualisieren des Programmpunkts: ' + error.message);
        });
    } catch (error) {
        console.error('Globaler Fehler in saveEditEvent:', error);
        alert('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
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
            alert('Kein Event zum Löschen ausgewählt.');
            return;
        }
        
        if (index < 0 || isNaN(index)) {
            alert('Ungültiger Event-Index.');
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
                
                alert('Programmpunkt erfolgreich gelöscht!');
            } else {
                alert('Fehler beim Löschen: ' + (data.error || 'Unbekannter Fehler'));
            }
        })
        .catch(error => {
            console.error('Fehler beim Löschen:', error);
            alert('Fehler beim Löschen des Programmpunkts: ' + error.message);
        });
    } catch (error) {
        console.error('Globaler Fehler in deleteEvent:', error);
        alert('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
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
