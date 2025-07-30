/**
 * Zeitplan JavaScript mit Gantt Chart
 */

let zeitplanData = [];
let currentView = 'gantt'; // 'gantt' oder 'cards'
let ganttZoomLevel = 1; // 1 = normal, 2 = zoom in, 0.5 = zoom out

document.addEventListener('DOMContentLoaded', function() {
    loadZeitplan();
    showGanttView(); // Standard: Gantt Chart anzeigen
});

// Zeitplan laden
function loadZeitplan() {
    fetch('/api/zeitplan/list')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                zeitplanData = data.zeitplan;
                if (currentView === 'gantt') {
                    displayGanttChart(zeitplanData);
                } else {
                    displayZeitplan(zeitplanData);
                }
            } else {
                console.error('Fehler beim Laden des Zeitplans:', data.error);
                showNoDataMessage();
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden des Zeitplans:', error);
            showNoDataMessage();
        });
}

// View-Switching
function showGanttView() {
    currentView = 'gantt';
    document.getElementById('ganttView').classList.remove('d-none');
    document.getElementById('cardView').classList.add('d-none');
    document.getElementById('ganttViewBtn').classList.add('btn-primary');
    document.getElementById('ganttViewBtn').classList.remove('btn-outline-primary');
    document.getElementById('cardViewBtn').classList.remove('btn-primary');
    document.getElementById('cardViewBtn').classList.add('btn-outline-primary');
    
    displayGanttChart(zeitplanData);
}

function showCardView() {
    currentView = 'cards';
    document.getElementById('cardView').classList.remove('d-none');
    document.getElementById('ganttView').classList.add('d-none');
    document.getElementById('cardViewBtn').classList.add('btn-primary');
    document.getElementById('cardViewBtn').classList.remove('btn-outline-primary');
    document.getElementById('ganttViewBtn').classList.remove('btn-primary');
    document.getElementById('ganttViewBtn').classList.add('btn-outline-primary');
    
    displayZeitplan(zeitplanData);
}

// Gantt Chart erstellen
function displayGanttChart(zeitplan) {
    const container = document.getElementById('ganttChart');
    
    if (!zeitplan || zeitplan.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-calendar-x display-4 text-muted mb-3"></i>
                <h4 class="text-muted">Noch keine Programmpunkte vorhanden</h4>
                <p class="text-muted">Fügen Sie Programmpunkte hinzu, um die Timeline zu sehen.</p>
            </div>
        `;
        return;
    }
    
    // Sortiere nach Uhrzeit
    const sortedEvents = [...zeitplan].sort((a, b) => a.Uhrzeit.localeCompare(b.Uhrzeit));
    
    // Ermittle Zeitbereich
    const timeRange = calculateTimeRange(sortedEvents);
    
    // Erstelle Gantt Chart HTML
    const ganttHTML = createGanttHTML(sortedEvents, timeRange);
    container.innerHTML = ganttHTML;
    
    // Aktuelle Zeit anzeigen
    showCurrentTimeIndicator(timeRange);
    
    // Event Listeners für Tooltips
    addGanttEventListeners();
}

// Zeitbereich berechnen
function calculateTimeRange(events) {
    if (events.length === 0) return { start: '08:00', end: '22:00', hours: [] };
    
    const times = events.map(event => event.Uhrzeit).sort();
    const startTime = times[0];
    
    // Endzeit basierend auf letztem Event + Dauer berechnen
    let endTime = '22:00';
    const lastEvent = events[events.length - 1];
    if (lastEvent.Dauer) {
        const endTimeCalc = addDurationToTime(lastEvent.Uhrzeit, lastEvent.Dauer);
        endTime = endTimeCalc > endTime ? endTimeCalc : endTime;
    }
    
    // Stunden-Array erstellen
    const hours = [];
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]) + (parseInt(endTime.split(':')[1]) > 0 ? 1 : 0);
    
    for (let h = startHour; h <= endHour; h++) {
        hours.push(String(h).padStart(2, '0') + ':00');
    }
    
    return { start: startTime, end: endTime, hours };
}

// Zeit + Dauer addieren
function addDurationToTime(time, duration) {
    const [timeHours, timeMinutes] = time.split(':').map(Number);
    const [durHours, durMinutes] = duration.split(':').map(Number);
    
    const totalMinutes = (timeHours * 60 + timeMinutes) + (durHours * 60 + durMinutes);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

// Gantt Chart HTML erstellen
function createGanttHTML(events, timeRange) {
    const cellWidth = 60 * ganttZoomLevel;
    
    let html = `
        <div class="gantt-timeline">
            <div class="gantt-header">
                ${timeRange.hours.map(hour => `
                    <div class="gantt-header-cell" style="min-width: ${cellWidth}px;">
                        ${hour}
                    </div>
                `).join('')}
            </div>
            <div class="gantt-body">
    `;
    
    events.forEach((event, index) => {
        const barPosition = calculateBarPosition(event, timeRange, cellWidth);
        const statusClass = getStatusClass(event.Status);
        const statusIcon = getStatusIcon(event.Status);
        
        html += `
            <div class="gantt-row" data-event-index="${index}">
                ${timeRange.hours.map((hour, cellIndex) => `
                    <div class="gantt-cell" style="min-width: ${cellWidth}px;">
                        ${cellIndex === 0 ? createGanttBar(event, barPosition, statusClass, statusIcon) : ''}
                    </div>
                `).join('')}
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="gantt-time-axis">
                ${timeRange.hours.map(hour => `
                    <div class="gantt-time-cell" style="min-width: ${cellWidth}px;">
                        ${hour}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    return html;
}

// Gantt Bar Position berechnen
function calculateBarPosition(event, timeRange, cellWidth) {
    const eventTime = event.Uhrzeit;
    const startTime = timeRange.start;
    
    // Minuten seit Start berechnen
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [eventHour, eventMin] = eventTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const eventMinutes = eventHour * 60 + eventMin;
    const offsetMinutes = eventMinutes - startMinutes;
    
    // Dauer in Minuten
    let durationMinutes = 60; // Standard: 1 Stunde
    if (event.Dauer) {
        const [durHour, durMin] = event.Dauer.split(':').map(Number);
        durationMinutes = durHour * 60 + durMin;
    }
    
    // Pixel-Position und -Breite berechnen
    const minutesPerPixel = 60 / cellWidth; // Minuten pro Pixel
    const left = offsetMinutes / minutesPerPixel;
    const width = durationMinutes / minutesPerPixel;
    
    return { left, width };
}

// Gantt Bar HTML erstellen
function createGanttBar(event, position, statusClass, statusIcon) {
    return `
        <div class="gantt-bar ${statusClass}" 
             style="left: ${position.left}px; width: ${position.width}px;"
             data-event='${JSON.stringify(event)}'>
            <div class="gantt-bar-content">
                <i class="bi ${statusIcon} gantt-bar-icon"></i>
                <span class="gantt-bar-text">${event.Programmpunkt || 'Unbenannt'}</span>
            </div>
        </div>
    `;
}

// Status CSS-Klasse
function getStatusClass(status) {
    switch(status) {
        case 'Geplant':
            return 'status-geplant';
        case 'Bestätigt':
            return 'status-bestaetigt';
        case 'Abgeschlossen':
            return 'status-abgeschlossen';
        default:
            return 'status-geplant';
    }
}

// Aktuelle Zeit Indikator
function showCurrentTimeIndicator(timeRange) {
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    // Prüfen ob aktuelle Zeit im Bereich liegt
    if (currentTime >= timeRange.start && currentTime <= timeRange.end) {
        const cellWidth = 60 * ganttZoomLevel;
        const [startHour, startMin] = timeRange.start.split(':').map(Number);
        const [currentHour, currentMin] = currentTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const currentMinutes = currentHour * 60 + currentMin;
        const offsetMinutes = currentMinutes - startMinutes;
        
        const minutesPerPixel = 60 / cellWidth;
        const left = offsetMinutes / minutesPerPixel;
        
        // Indikator hinzufügen
        setTimeout(() => {
            const ganttBody = document.querySelector('.gantt-body');
            if (ganttBody) {
                const indicator = document.createElement('div');
                indicator.className = 'gantt-current-time';
                indicator.style.left = left + 'px';
                ganttBody.appendChild(indicator);
            }
        }, 100);
    }
}

// Event Listeners für Gantt Chart
function addGanttEventListeners() {
    const bars = document.querySelectorAll('.gantt-bar');
    
    bars.forEach(bar => {
        bar.addEventListener('mouseenter', showGanttTooltip);
        bar.addEventListener('mouseleave', hideGanttTooltip);
        bar.addEventListener('click', function() {
            const eventData = JSON.parse(this.getAttribute('data-event'));
            showEventDetails(eventData);
        });
    });
}

// Tooltip anzeigen
function showGanttTooltip(event) {
    const eventData = JSON.parse(event.target.closest('.gantt-bar').getAttribute('data-event'));
    
    const tooltip = document.createElement('div');
    tooltip.className = 'gantt-tooltip';
    tooltip.innerHTML = `
        <div><strong>${eventData.Programmpunkt}</strong></div>
        <div>🕒 ${eventData.Uhrzeit} ${eventData.Dauer ? `(${eventData.Dauer})` : ''}</div>
        ${eventData.Verantwortlich ? `<div>👤 ${eventData.Verantwortlich}</div>` : ''}
        <div>📊 ${eventData.Status}</div>
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
}

// Tooltip verstecken
function hideGanttTooltip() {
    const tooltip = document.querySelector('.gantt-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Event Details anzeigen
function showEventDetails(eventData) {
    alert(`Programmpunkt: ${eventData.Programmpunkt}\nZeit: ${eventData.Uhrzeit}\nDauer: ${eventData.Dauer || 'Nicht angegeben'}\nVerantwortlich: ${eventData.Verantwortlich || 'Nicht angegeben'}\nStatus: ${eventData.Status}`);
}

// Gantt Zoom
function zoomGantt(direction) {
    if (direction === 'in' && ganttZoomLevel < 3) {
        ganttZoomLevel *= 1.5;
    } else if (direction === 'out' && ganttZoomLevel > 0.5) {
        ganttZoomLevel /= 1.5;
    }
    
    displayGanttChart(zeitplanData);
}

// Zeitplan anzeigen (Card View)
function displayZeitplan(zeitplan) {
    const container = document.getElementById('zeitplanContainer');
    const noDataMessage = document.getElementById('noDataMessage');
    
    if (!zeitplan || zeitplan.length === 0) {
        showNoDataMessage();
        return;
    }
    
    // Sortiere nach Uhrzeit
    zeitplan.sort((a, b) => a.Uhrzeit.localeCompare(b.Uhrzeit));
    
    let html = '';
    
    zeitplan.forEach((event, index) => {
        const statusColor = getStatusColor(event.Status);
        const statusIcon = getStatusIcon(event.Status);
        
        html += `
            <div class="col-12 col-md-6 col-lg-4 mb-3">
                <div class="card h-100 event-card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary">
                            <i class="bi bi-clock me-1"></i>
                            ${event.Uhrzeit}
                        </span>
                        <span class="badge ${statusColor}">
                            <i class="bi ${statusIcon} me-1"></i>
                            ${event.Status}
                        </span>
                    </div>
                    <div class="card-body">
                        <h6 class="card-title">${event.Programmpunkt || 'Unbenannt'}</h6>
                        <div class="card-text small text-muted">
                            ${event.Dauer ? `<div><i class="bi bi-hourglass me-1"></i>Dauer: ${event.Dauer}</div>` : ''}
                            ${event.Verantwortlich ? `<div><i class="bi bi-person me-1"></i>Verantwortlich: ${event.Verantwortlich}</div>` : ''}
                        </div>
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="btn-group btn-group-sm w-100" role="group">
                            <button type="button" class="btn btn-outline-primary" onclick="editEvent(${index})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger" onclick="deleteEvent(${index})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    noDataMessage.classList.add('d-none');
}

// Status-Farbe bestimmen
function getStatusColor(status) {
    switch(status) {
        case 'Geplant':
            return 'bg-warning text-dark';
        case 'Bestätigt':
            return 'bg-info text-white';
        case 'Abgeschlossen':
            return 'bg-success text-white';
        default:
            return 'bg-secondary text-white';
    }
}

// Status-Icon bestimmen
function getStatusIcon(status) {
    switch(status) {
        case 'Geplant':
            return 'bi-calendar-check';
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
    const container = document.getElementById('zeitplanContainer');
    const noDataMessage = document.getElementById('noDataMessage');
    
    container.innerHTML = '';
    noDataMessage.classList.remove('d-none');
}

// Neuen Programmpunkt hinzufügen
function addEvent() {
    const form = document.getElementById('addEventForm');
    const formData = new FormData(form);
    
    const eventData = {
        Uhrzeit: document.getElementById('eventTime').value,
        Programmpunkt: document.getElementById('eventTitle').value,
        Dauer: document.getElementById('eventDuration').value,
        Verantwortlich: document.getElementById('eventResponsible').value,
        Status: document.getElementById('eventStatus').value
    };
    
    // Validierung
    if (!eventData.Uhrzeit || !eventData.Programmpunkt) {
        alert('Bitte füllen Sie mindestens Uhrzeit und Programmpunkt aus.');
        return;
    }
    
    // TODO: Hier würde die API zum Hinzufügen aufgerufen
    console.log('Neuer Programmpunkt:', eventData);
    
    // Modal schließen und Form zurücksetzen
    const modal = bootstrap.Modal.getInstance(document.getElementById('addEventModal'));
    modal.hide();
    form.reset();
    
    // Zeitplan neu laden
    loadZeitplan();
}

// Programmpunkt bearbeiten
function editEvent(index) {
    // TODO: Edit-Modal implementieren
    console.log('Programmpunkt bearbeiten:', index);
}

// Programmpunkt löschen
function deleteEvent(index) {
    if (confirm('Möchten Sie diesen Programmpunkt wirklich löschen?')) {
        // TODO: API zum Löschen aufrufen
        console.log('Programmpunkt löschen:', index);
        loadZeitplan();
    }
}

// Zeitplan-Timeline anzeigen (optional)
function showTimeline() {
    // TODO: Timeline-Ansicht implementieren
    console.log('Timeline-Ansicht');
}
