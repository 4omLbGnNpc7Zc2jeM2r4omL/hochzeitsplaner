document.addEventListener('DOMContentLoaded', function() {
    let zeitplanData = [];
    let hochzeitsdatum = null;
    
    // Event Listeners
    document.querySelectorAll('input[name="viewType"]').forEach(radio => {
        radio.addEventListener('change', switchView);
    });
    
    // Initial laden
    loadHochzeitsdatum();
});

// Hochzeitsdatum aus Einstellungen laden
function loadHochzeitsdatum() {
    fetch('/api/settings/get')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.settings) {
                hochzeitsdatum = data.settings.hochzeitsdatum;
                console.log('Hochzeitsdatum geladen:', hochzeitsdatum);
            }
            // Nach dem Laden des Datums den Zeitplan laden
            loadZeitplan();
        })
        .catch(error => {
            console.error('Fehler beim Laden des Hochzeitsdatums:', error);
            // Auch bei Fehler den Zeitplan laden
            loadZeitplan();
        });
}

function loadZeitplan() {
    fetch('/api/guest/zeitplan')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                zeitplanData = data.events;
                updateViews();
            } else {
                showError('Fehler beim Laden des Zeitplans.');
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden des Zeitplans:', error);
            showError('Ein Fehler ist aufgetreten.');
        });
}

function updateViews() {
    const activeView = document.querySelector('input[name="viewType"]:checked').value;
    
    if (activeView === 'list') {
        updateListView();
    } else {
        updateGanttView();
    }
}

function switchView() {
    const activeView = document.querySelector('input[name="viewType"]:checked').value;
    
    if (activeView === 'list') {
        document.getElementById('listViewContainer').classList.remove('d-none');
        document.getElementById('ganttViewContainer').classList.add('d-none');
        updateListView();
    } else {
        document.getElementById('listViewContainer').classList.add('d-none');
        document.getElementById('ganttViewContainer').classList.remove('d-none');
        updateGanttView();
    }
}

function updateListView() {
    const container = document.getElementById('zeitplanList');
    
    if (zeitplanData.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Noch keine öffentlichen Termine verfügbar.</p>';
        return;
    }
    
    // Nach Datum sortieren - verwende Uhrzeit anstatt start
    const sortedEvents = [...zeitplanData].sort((a, b) => {
        const timeA = a.Uhrzeit || '';
        const timeB = b.Uhrzeit || '';
        return timeA.localeCompare(timeB);
    });
    
    let html = '<div class="timeline">';
    
    sortedEvents.forEach((event, index) => {
        // Verwende die echten Feldnamen aus der Datenbank
        const uhrzeit = event.Uhrzeit || '';
        const programmpunkt = event.Programmpunkt || 'Unbenannter Termin';
        const status = event.Status || 'Geplant';
        const verantwortlich = event.Verantwortlich || '';
        const ort = event.Ort || '';
        const beschreibung = event.Beschreibung || '';
        
        // Datum aus Hochzeitsdatum und Uhrzeit zusammensetzen
        let dateStr = '';
        let timeStr = uhrzeit;
        
        if (hochzeitsdatum) {
            // Formatiere das Datum schön
            const date = new Date(hochzeitsdatum);
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            dateStr = date.toLocaleDateString('de-DE', options);
        }
        
        // Falls Uhrzeit bereits ein vollständiges Datum enthält (Format: YYYY-MM-DD HH:MM)
        if (uhrzeit.includes(' ')) {
            const parts = uhrzeit.split(' ');
            if (parts.length >= 2) {
                const eventDate = new Date(parts[0]);
                const options = { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                };
                dateStr = eventDate.toLocaleDateString('de-DE', options);
                timeStr = parts[1];
            }
        }
        
        html += `
            <div class="timeline-item" onclick="showEventDetails('${index}')">
                <div class="timeline-marker">
                    <div class="timeline-marker-icon bg-${getStatusColor(status)}">
                        <i class="bi bi-${getStatusIcon(status)}"></i>
                    </div>
                </div>
                <div class="timeline-content">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title mb-0">${programmpunkt}</h5>
                                <span class="badge bg-${getStatusColor(status)}">${status}</span>
                            </div>
                            
                            <div class="row text-muted mb-2">
                                <div class="col-md-6">
                                    <i class="bi bi-calendar3 me-1"></i>
                                    ${dateStr || 'Datum nicht angegeben'}
                                </div>
                                <div class="col-md-6">
                                    <i class="bi bi-clock me-1"></i>
                                    ${timeStr}
                                </div>
                            </div>
                            
                            ${beschreibung ? `<p class="card-text">${beschreibung}</p>` : ''}
                            
                            ${ort ? `
                                <p class="card-text">
                                    <i class="bi bi-geo-alt me-1"></i>
                                    <strong>Ort:</strong> ${ort}
                                </p>
                            ` : ''}

                            ${verantwortlich ? `
                                <p class="card-text">
                                    <i class="bi bi-person me-1"></i>
                                    <strong>Verantwortlich:</strong> ${verantwortlich}
                                </p>
                            ` : ''}
                            
                            <div class="text-end">
                                <small class="text-muted">Klicken für Details</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function updateGanttView() {
    const container = document.getElementById('ganttChart');
    
    if (zeitplanData.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Noch keine öffentlichen Termine verfügbar.</p>';
        return;
    }
    
    // Sortiere nach Uhrzeit
    const sortedEvents = [...zeitplanData].sort((a, b) => {
        const timeA = a.Uhrzeit || '';
        const timeB = b.Uhrzeit || '';
        return timeA.localeCompare(timeB);
    });
    
    // Zeitbereich automatisch bestimmen
    const times = sortedEvents.map(event => parseTimeToMinutes(event.Uhrzeit || '00:00'));
    const earliestTime = Math.min(...times);
    const latestTime = Math.max(...times);
    
    // Puffer hinzufügen (1 Stunde vor und nach)
    const startHour = Math.max(0, Math.floor(earliestTime / 60) - 1);
    const endHour = Math.min(24, Math.ceil(latestTime / 60) + 2);
    const totalHours = endHour - startHour;
    
    // Gantt Container erstellen
    let html = '';
    
    // Datum-Header hinzufügen, falls Hochzeitsdatum verfügbar
    if (hochzeitsdatum) {
        const date = new Date(hochzeitsdatum);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateStr = date.toLocaleDateString('de-DE', options);
        html += `
            <div class="gantt-date-header">
                <h5 class="mb-3">
                    <i class="bi bi-calendar3 me-2"></i>
                    ${dateStr}
                </h5>
            </div>
        `;
    }
    
    html += `
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
    sortedEvents.forEach((event, index) => {
        const eventStart = parseTimeToMinutes(event.Uhrzeit || '00:00');
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
        const statusClass = `status-${(event.Status || 'geplant').toLowerCase()}`;
        
        html += `
            <div class="gantt-row">
                <div class="gantt-time-label">${event.Uhrzeit || '00:00'}</div>
                <div class="gantt-timeline-area" style="position: relative;">
                    <div class="gantt-bar ${statusClass} public-event" 
                         style="left: ${startPosition}%; width: ${eventWidth}%; cursor: pointer;"
                         title="${event.Programmpunkt || 'Termin'} (${event.Uhrzeit || '00:00'})"
                         onclick="showEventDetails('${index}')"
                         data-index="${index}">
                        <div class="gantt-bar-content">
                            <i class="gantt-bar-icon ${getStatusIconClass(event.Status || 'Geplant')}"></i>
                            <span class="gantt-bar-text">${event.Programmpunkt || 'Termin'}</span>
                            <i class="bi bi-eye gantt-visibility-icon" title="Öffentlich sichtbar"></i>
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

// Hilfsfunktionen für Gantt-Chart
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    
    // Format kann "HH:MM" oder "YYYY-MM-DD HH:MM" sein
    let time = timeStr;
    if (timeStr.includes(' ')) {
        time = timeStr.split(' ')[1]; // Nur den Zeit-Teil nehmen
    }
    
    const parts = time.split(':');
    if (parts.length >= 2) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        return (hours * 60) + minutes;
    }
    return 0;
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

function getStatusIconClass(status) {
    switch(status?.toLowerCase()) {
        case 'geplant': return 'bi bi-clock';
        case 'gebucht': return 'bi bi-check-circle';
        case 'bestätigt': return 'bi bi-check-circle-fill';
        case 'abgeschlossen': return 'bi bi-check2-all';
        default: return 'bi bi-circle';
    }
}

// Gantt-Chart Funktion entfernt, da unsere Zeitplan-Daten nur Uhrzeiten haben
// und keine Start-/Enddaten

function showEventDetails(eventIndex) {
    const event = zeitplanData[eventIndex];
    if (!event) return;
    
    const modal = document.getElementById('eventDetailModal');
    const title = document.getElementById('eventDetailTitle');
    const body = document.getElementById('eventDetailBody');
    
    const programmpunkt = event.Programmpunkt || 'Unbenannter Termin';
    const uhrzeit = event.Uhrzeit || '';
    const status = event.Status || 'Geplant';
    const verantwortlich = event.Verantwortlich || '';
    const ort = event.Ort || '';
    const beschreibung = event.Beschreibung || '';
    
    title.textContent = programmpunkt;
    
    // Datum aus Hochzeitsdatum und Uhrzeit zusammensetzen
    let dateStr = '';
    let timeStr = uhrzeit;
    
    if (hochzeitsdatum) {
        // Formatiere das Datum schön
        const date = new Date(hochzeitsdatum);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dateStr = date.toLocaleDateString('de-DE', options);
    }
    
    // Falls Uhrzeit bereits ein vollständiges Datum enthält (Format: YYYY-MM-DD HH:MM)
    if (uhrzeit.includes(' ')) {
        const parts = uhrzeit.split(' ');
        if (parts.length >= 2) {
            const eventDate = new Date(parts[0]);
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            dateStr = eventDate.toLocaleDateString('de-DE', options);
            timeStr = parts[1];
        }
    }
    
    let detailHtml = `
        <div class="row">
            <div class="col-md-6">
                <h6>Datum & Zeit</h6>
                <p>
                    <i class="bi bi-calendar3 me-2"></i>
                    ${dateStr || 'Datum nicht angegeben'}
                </p>
                <p>
                    <i class="bi bi-clock me-2"></i>
                    ${timeStr}
                </p>
            </div>
            <div class="col-md-6">
                <h6>Status</h6>
                <p>
                    <span class="badge bg-${getStatusColor(status)}">${status}</span>
                </p>
                ${verantwortlich ? `
                    <h6>Verantwortlich</h6>
                    <p>
                        <i class="bi bi-person me-2"></i>
                        ${verantwortlich}
                    </p>
                ` : ''}
            </div>
        </div>`;
        
        if (ort) {
            detailHtml += `
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>Ort</h6>
                        <p>
                            <i class="bi bi-geo-alt me-2"></i>
                            ${ort}
                        </p>
                    </div>
                </div>
            `;
        }
        
        if (beschreibung) {
            detailHtml += `
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>Beschreibung</h6>
                        <p>${beschreibung}</p>
                    </div>
                </div>
            `;
        }
        
        body.innerHTML = detailHtml;
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

function getStatusColor(status) {
    const colors = {
        'Geplant': 'primary',
        'In Bearbeitung': 'warning',
        'Abgeschlossen': 'success',
        'Verschoben': 'secondary',
        'Abgesagt': 'danger'
    };
    return colors[status] || 'secondary';
}

function getStatusIcon(status) {
    const icons = {
        'Geplant': 'calendar-check',
        'In Bearbeitung': 'clock',
        'Abgeschlossen': 'check-circle',
        'Verschoben': 'arrow-right',
        'Abgesagt': 'x-circle'
    };
    return icons[status] || 'circle';
}

function showError(message) {
    const containers = ['zeitplanList', 'ganttChart'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    });
}

// CSS für Timeline und Gantt-Chart wird über style-tag hinzugefügt
const timelineStyles = `
<style>
.timeline {
    position: relative;
    padding-left: 2rem;
}

.timeline-item {
    position: relative;
    margin-bottom: 2rem;
    cursor: pointer;
}

.timeline-marker {
    position: absolute;
    left: -2rem;
    top: 0.5rem;
    width: 2rem;
    height: 2rem;
    z-index: 10;
}

.timeline-marker-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.9rem;
    border: 3px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.timeline-item:not(:last-child):before {
    content: '';
    position: absolute;
    left: -1rem;
    top: 2.5rem;
    bottom: -2rem;
    width: 2px;
    background: #dee2e6;
    z-index: 1;
}

.timeline-content .card:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    transform: translateY(-1px);
    transition: all 0.2s ease;
}

.gantt-container {
    overflow-x: auto;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
}

.gantt-header {
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
    height: 3rem;
    position: relative;
}

.gantt-timeline {
    position: relative;
    height: 100%;
    min-width: 800px;
}

.time-marker {
    position: absolute;
    top: 0.5rem;
    font-size: 0.8rem;
    color: #6c757d;
    transform: translateX(-50%);
    white-space: nowrap;
}

.gantt-body {
    min-width: 800px;
}

.gantt-row {
    display: flex;
    height: 3rem;
    border-bottom: 1px solid #f0f0f0;
}

.gantt-row:hover {
    background: #f8f9fa;
}

.gantt-label {
    width: 200px;
    padding: 0.5rem;
    border-right: 1px solid #dee2e6;
    background: white;
    flex-shrink: 0;
    font-size: 0.9rem;
}

.gantt-bar-container {
    flex: 1;
    position: relative;
    padding: 0.25rem 0;
}

.gantt-bar {
    position: absolute;
    height: 2rem;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    color: white;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s ease;
    min-width: 8px;
}

.gantt-bar:hover {
    opacity: 0.8;
    transform: scaleY(1.1);
}

.gantt-bar-label {
    padding: 0 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
`;

// Styles hinzufügen
if (!document.getElementById('guest-zeitplan-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'guest-zeitplan-styles';
    styleElement.innerHTML = timelineStyles;
    document.head.appendChild(styleElement);
}
