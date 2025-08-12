// Globale Variablen
let zeitplanData = [];
let hochzeitsdatum = null;

document.addEventListener('DOMContentLoaded', function() {
    // Event Listeners
    document.querySelectorAll('input[name="viewType"]').forEach(radio => {
        radio.addEventListener('change', switchView);
    });
    
    // Initial laden
    loadHochzeitsdatum();
});

// Hochzeitsdatum aus Einstellungen laden
function loadHochzeitsdatum() {
    apiRequest('/settings/get')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Neue strukturierte Settings-Struktur
                if (data.settings.hochzeit && data.settings.hochzeit.datum) {
                    hochzeitsdatum = data.settings.hochzeit.datum;
                } 
                // Fallback für direkte Settings
                else if (data.settings.hochzeitsdatum) {
                    hochzeitsdatum = data.settings.hochzeitsdatum;
                }
                
                if (hochzeitsdatum) {


                } else {

                }
                loadZeitplan();
            } else {

                loadZeitplan();
            }
        })
        .catch(error => {

            loadZeitplan();
        });
}

function loadZeitplan() {
    apiRequest('/guest/zeitplan')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                zeitplanData = data.events;

                updateViews();
            } else {
                showError(data.message || 'Fehler beim Laden des Zeitplans');
            }
        })
        .catch(error => {

            showError('Fehler beim Laden des Zeitplans');
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
        let uhrzeit = event.Uhrzeit || '';
        const programmpunkt = event.Programmpunkt || 'Unbenannter Termin';
        const ort = event.Ort || '';
        const beschreibung = event.Beschreibung || '';
        
        // Bestimme Farbe basierend auf Event-Typ (Party = Lila, sonst Blau)
        const isParty = programmpunkt.toLowerCase().includes('party');
        const eventColor = isParty ? 'party-purple' : 'primary'; // custom party-purple, primary für blau
        
        // Datum aus Hochzeitsdatum und Uhrzeit zusammensetzen
        let dateStr = '';
        let timeStr = '';
        
        // Uhrzeit korrekt verarbeiten
        if (uhrzeit.includes(' ')) {
            // Falls Uhrzeit bereits ein vollständiges Datum enthält (Format: YYYY-MM-DD HH:MM)
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
                timeStr = parts[1]; // Nur die Zeit nehmen
            }
        } else {
            // Nur Zeit vorhanden (Format: HH:MM)
            timeStr = uhrzeit;
            
            // Datum aus Hochzeitsdatum verwenden
            if (hochzeitsdatum) {
                const date = new Date(hochzeitsdatum);
                const options = { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                };
                dateStr = date.toLocaleDateString('de-DE', options);
            }
        }
        
        // Falls timeStr immer noch leer ist, verwende uhrzeit direkt
        if (!timeStr) {
            timeStr = uhrzeit;
        }
        
        html += `
            <div class="timeline-item">
                <div class="timeline-marker">
                    <div class="timeline-marker-icon bg-${eventColor}">
                        <span style="font-size: 1.2rem; color: white; display: inline-block;">${getUnicodeIcon(event)}</span>
                    </div>
                </div>
                <div class="timeline-content">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title mb-3">${programmpunkt}</h5>
                            
                            <div class="row text-muted mb-2">
                                <div class="col-sm-6 mb-2">
                                    <i class="bi bi-calendar3 me-1"></i>
                                    ${dateStr || (hochzeitsdatum ? formatDate(hochzeitsdatum) : 'Datum wird geladen...')}
                                </div>
                                <div class="col-sm-6 mb-2">
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

    // Sortiere nach Uhrzeit (wie in Admin-Version)
    const sortedEvents = [...zeitplanData].sort((a, b) => {
        const timeA = a.Uhrzeit || '';
        const timeB = b.Uhrzeit || '';
        return timeA.localeCompare(timeB);
    });

    // Zeitbereich automatisch bestimmen - erweitert für Events über Mitternacht
    const times = sortedEvents.map(event => parseTimeToMinutes(event.Uhrzeit));
    const earliestTime = Math.min(...times);
    let latestTime = Math.max(...times);
    
    // Prüfe auf Events mit EndZeit über Mitternacht und erweitere entsprechend
    let maxEndTime = latestTime;
    
    sortedEvents.forEach(event => {
        if (event.EndZeit) {
            const eventStart = parseTimeToMinutes(event.Uhrzeit);
            const eventEndRaw = parseTimeToMinutes(event.EndZeit);
            
            // Falls EndZeit früher als StartZeit ist, gehe vom nächsten Tag aus
            const eventEnd = eventEndRaw < eventStart ? eventEndRaw + 24 * 60 : eventEndRaw;
            
            maxEndTime = Math.max(maxEndTime, eventEnd);
        }
    });
    
    latestTime = maxEndTime;
    
    // Puffer hinzufügen (1 Stunde vor und nach)
    const startHour = Math.max(0, Math.floor(earliestTime / 60) - 1);
    let endHour = Math.min(32, Math.ceil(latestTime / 60) + 1); // Erweitert bis 32 Uhr (8:00 nächster Tag)
    
    // Mindestens bis 24:00 Uhr anzeigen, maximal bis 30 Uhr für bessere Darstellung
    if (endHour < 24) {
        endHour = 24;
    }
    if (endHour > 30) {
        endHour = 30; // Begrenzt auf 6:00 nächster Tag für bessere Übersicht
    }
    
    const totalHours = endHour - startHour;
    
    // Gantt Container erstellen
    let html = '';
    
    // Datum-Header hinzufügen, falls Hochzeitsdatum verfügbar
    if (hochzeitsdatum) {
        try {
            const date = new Date(hochzeitsdatum);
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            const dateStr = date.toLocaleDateString('de-DE', options);
            html += `
                <div class="gantt-date-header mb-3">
                    <h5 class="text-muted">
                        <i class="bi bi-calendar3 me-2 text-muted"></i>
                        ${dateStr}
                    </h5>
                </div>
            `;
        } catch (error) {

        }
    }
    
    html += `
        <div class="gantt-container">
            <div class="gantt-timeline">
                <div class="gantt-header">
                    <div class="gantt-time-label" style="visibility: hidden;">Zeit</div>
    `;
    
    // Erweiterte Zeitstunden-Header erstellen - 1-Stunden-Rhythmus für bessere Abdeckung
    for (let hour = startHour; hour < endHour; hour++) {
        let displayHour = hour >= 24 ? hour - 24 : hour;
        const timeLabel = `${displayHour.toString().padStart(2, '0')}:00`;
        
        // Jede zweite Stunde als Major (fett), andere als Minor
        const isMajor = (hour - startHour) % 2 === 0;
        const cellClass = isMajor ? 'gantt-hour-major' : 'gantt-hour-minor';
        html += `<div class="gantt-header-cell ${cellClass}">${timeLabel}</div>`;
    }
    
    html += `
            </div>
            <div class="gantt-body">
    `;
    
    // Events als Gantt-Balken hinzufügen (OHNE Klick-Funktionalität)
    sortedEvents.forEach((event, index) => {
        const eventStart = parseTimeToMinutes(event.Uhrzeit);
        
        // Dauer berechnen mit korrekter Behandlung für Events über Mitternacht
        let eventEnd = eventStart + 30; // Standard: 30 Min
        
        if (event.EndZeit) {
            const eventEndRaw = parseTimeToMinutes(event.EndZeit);
            // Korrekte Behandlung für Events über Mitternacht
            eventEnd = eventEndRaw < eventStart ? eventEndRaw + 24 * 60 : eventEndRaw;
        } else if (event.Dauer && event.Dauer !== '') {
            const durationMinutes = parseDurationToMinutes(event.Dauer);
            eventEnd = eventStart + durationMinutes;
        } else if (event.Programmpunkt.toLowerCase().includes('party')) {
            // Standard-Party-Dauer: bis 2:00 Uhr nächster Tag
            eventEnd = eventStart + (5 * 60); // 5 Stunden Standard für Party
            if (eventEnd >= 24 * 60) {
                eventEnd = eventEnd % (24 * 60) + (24 * 60); // Über Mitternacht
            }
        }
        
        // Responsive Position und Breite Berechnung
        const eventStartRelative = eventStart - (startHour * 60);
        const eventDuration = eventEnd - eventStart;
        
        // In responsive Design verwenden wir CSS Grid oder feste Berechnungen
        const startPosition = ((eventStartRelative) / (totalHours * 60)) * 100;
        const eventWidth = Math.max(((eventDuration) / (totalHours * 60)) * 100, 2);
        
        // Bestimme Farbe basierend auf Event-Typ (Party = Lila, sonst Blau)
        const isParty = event.Programmpunkt.toLowerCase().includes('party');
        const statusClass = isParty ? 'status-party' : 'status-standard';
        const publicClass = 'public-event'; // Alle Events für Gäste sind öffentlich
        
        // Spezial-Styling für Events über Mitternacht
        const isOverMidnight = eventEnd > 24 * 60;
        const overtimeClass = isOverMidnight ? 'party-overtime' : '';
        
        // Endzeit für Tooltip formatieren
        let endTimeDisplay = '';
        if (event.EndZeit) {
            if (isOverMidnight) {
                const endHour = Math.floor((eventEnd % (24 * 60)) / 60);
                const endMin = (eventEnd % (24 * 60)) % 60;
                endTimeDisplay = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
            } else {
                endTimeDisplay = event.EndZeit;
            }
        }
        
        // Berechne die tatsächliche Dauer für Anzeige
        let durationDisplay = '';
        if (event.Dauer && event.Dauer !== '') {
            durationDisplay = event.Dauer;
        } else if (event.EndZeit) {
            const totalMinutes = eventEnd - eventStart;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            durationDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        html += `
            <div class="gantt-row">
                <div class="gantt-time-label" style="visibility: hidden;">${event.Uhrzeit.includes(' ') ? event.Uhrzeit.split(' ')[1] : event.Uhrzeit}</div>
                <div class="gantt-timeline-area" style="position: relative;">
                    <div class="gantt-bar ${statusClass} ${publicClass} ${overtimeClass}" 
                         style="left: ${startPosition}%; width: ${eventWidth}%;"
                         title="${event.Programmpunkt} (${event.Uhrzeit.includes(' ') ? event.Uhrzeit.split(' ')[1] : event.Uhrzeit}${endTimeDisplay ? ' - ' + endTimeDisplay : ''})${durationDisplay ? ' | Dauer: ' + durationDisplay : ''}"
                         data-index="${index}"
                         data-start-minutes="${eventStart}"
                         data-end-minutes="${eventEnd}">
                        <div class="gantt-bar-content">
                            <span style="font-size: 1rem; color: white; display: inline-block;" class="gantt-bar-icon">${getUnicodeIcon(event)}</span>
                            <span class="gantt-bar-text">${event.Programmpunkt}</span>
                            ${isOverMidnight ? '<i class="bi bi-moon gantt-overtime-icon" title="Bis nach Mitternacht"></i>' : ''}
                            <i class="bi bi-eye gantt-visibility-icon"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    </div>
    `;
    
    container.innerHTML = html;
    
    // Responsive Gantt Chart Position Fix
    setTimeout(() => {
        adjustGanttPositionForResponsive();
    }, 100);
}

// Funktion zur Korrektur der Gantt-Chart-Position in responsive Design
function adjustGanttPositionForResponsive() {
    if (window.innerWidth <= 768) {
        const ganttBars = document.querySelectorAll('.gantt-bar');
        const ganttHeaderCells = document.querySelectorAll('.gantt-header-cell');
        
        if (ganttHeaderCells.length === 0) return;
        
        // Berechne die tatsächliche Breite der Header-Zellen
        const headerCellWidth = ganttHeaderCells[0].offsetWidth;
        const totalHeaderWidth = Array.from(ganttHeaderCells).reduce((sum, cell) => sum + cell.offsetWidth, 0);
        
        ganttBars.forEach(bar => {
            const startMinutes = parseInt(bar.dataset.startMinutes);
            const endMinutes = parseInt(bar.dataset.endMinutes);
            
            if (startMinutes && endMinutes) {
                // Finde Startzeit aus den Header-Zellen
                const startHour = Math.floor(startMinutes / 60);
                const endHour = Math.floor(endMinutes / 60);
                
                // Berechne Position basierend auf tatsächlichen Header-Zell-Breiten
                let leftPosition = 0;
                let headerIndex = 0;
                
                for (let cell of ganttHeaderCells) {
                    const cellTime = cell.textContent.trim();
                    if (cellTime === 'Zeit') continue;
                    
                    const cellHour = parseInt(cellTime.split(':')[0]);
                    if (cellHour <= startHour) {
                        leftPosition += cell.offsetWidth;
                    } else {
                        break;
                    }
                    headerIndex++;
                }
                
                // Feinabstimmung basierend auf Minuten
                const minuteOffset = (startMinutes % 60) / 60;
                if (headerIndex < ganttHeaderCells.length) {
                    leftPosition += minuteOffset * headerCellWidth;
                }
                
                // Berechne Breite
                const durationMinutes = endMinutes - startMinutes;
                const durationHours = durationMinutes / 60;
                const barWidth = Math.max(durationHours * headerCellWidth, 20);
                
                // Anwenden der korrigierten Position
                bar.style.left = `${leftPosition}px`;
                bar.style.width = `${barWidth}px`;
            }
        });
    }
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

// Funktion für zeit- und event-basierte Icons
function getEventIcon(event) {
    const programmpunkt = event.Programmpunkt || '';
    const uhrzeit = event.Uhrzeit || '';
    

    
    // Spezielle Icons für bestimmte Event-Typen (haben Priorität vor Zeit-basierten Icons)
    if (programmpunkt.toLowerCase().includes('essen') || 
        programmpunkt.toLowerCase().includes('dinner') || 
        programmpunkt.toLowerCase().includes('snack') || 
        programmpunkt.toLowerCase().includes('lunch')) {

        return 'bi-cup-hot'; // Essen/Trinken Icon
    }
    
    if (programmpunkt.toLowerCase().includes('party') || 
        programmpunkt.toLowerCase().includes('feier') ||
        programmpunkt.toLowerCase().includes('tanz')) {

        return 'bi-heart'; // Party Icon
    }
    
    // Zeit-basierte Icons (nur wenn kein spezifisches Event-Icon gefunden wurde)
    const timeMinutes = parseTimeToMinutes(uhrzeit);
    const hour = Math.floor(timeMinutes / 60);
    

    
    if (hour >= 6 && hour < 12) {
        // Morgens (06:00 - 11:59)

        return 'bi-sunrise';
    } else if (hour >= 12 && hour < 19) {
        // Mittag/Nachmittag (12:00 - 18:59)

        return 'bi-sun';
    } else {
        // Abends/Nachts (19:00 - 05:59)

        return 'bi-moon-stars';
    }
}

// Backup-Funktion für Unicode-Icons falls Bootstrap Icons nicht funktionieren
function getUnicodeIcon(event) {
    const programmpunkt = event.Programmpunkt || '';
    const uhrzeit = event.Uhrzeit || '';
    
    // Spezielle Icons für bestimmte Event-Typen
    if (programmpunkt.toLowerCase().includes('essen') || 
        programmpunkt.toLowerCase().includes('dinner') || 
        programmpunkt.toLowerCase().includes('snack') || 
        programmpunkt.toLowerCase().includes('lunch')) {
        return '☕'; // Coffee/Food
    }
    
    if (programmpunkt.toLowerCase().includes('party') || 
        programmpunkt.toLowerCase().includes('feier') ||
        programmpunkt.toLowerCase().includes('tanz')) {
        return '❤️'; // Heart
    }
    
    // Trauung bekommt ein spezielles Icon
    if (programmpunkt.toLowerCase().includes('trauung') || 
        programmpunkt.toLowerCase().includes('hochzeit') ||
        programmpunkt.toLowerCase().includes('zeremonie')) {
        return '💒'; // Wedding/Church
    }
    
    // Zeit-basierte Icons
    const timeMinutes = parseTimeToMinutes(uhrzeit);
    const hour = Math.floor(timeMinutes / 60);
    
    if (hour >= 6 && hour < 12) {
        return '🌅'; // Sunrise
    } else if (hour >= 12 && hour < 19) {
        return '☀️'; // Sun
    } else {
        return '🌙'; // Moon
    }
}

function showEventDetails(eventIndex) {
    const event = zeitplanData[eventIndex];
    if (!event) return;
    
    const modal = document.getElementById('eventDetailModal');
    const title = document.getElementById('eventDetailTitle');
    const body = document.getElementById('eventDetailBody');
    
    const programmpunkt = event.Programmpunkt || 'Unbenannter Termin';
    const uhrzeit = event.Uhrzeit || '';
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
            <div class="col-12">
                <h6>Datum & Zeit</h6>
                <p>
                    <i class="bi bi-calendar3 me-2"></i>
                    ${dateStr || (hochzeitsdatum ? formatDate(hochzeitsdatum) : 'Datum wird geladen...')}
                </p>
                <p>
                    <i class="bi bi-clock me-2"></i>
                    ${timeStr}
                </p>
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

function showError(message) {
    const containers = ['zeitplanList', 'ganttChart'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div class="alert alert-danger" role="alert">${message}</div>`;
        }
    });
}

// Helper function für formatDate
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('de-DE', options);
    } catch (error) {
        return dateStr;
    }
}

// CSS für Timeline und Gantt-Chart wird über style-tag hinzugefügt
// Updated: Desktop responsive fix applied
const timelineStyles = `
<style>

/* Bootstrap Icons Fix - Force display */
.bi {
    font-family: "Bootstrap Icons" !important;
    font-style: normal !important;
    font-variant: normal !important;
    font-weight: normal !important;
    line-height: 1 !important;
    display: inline-block !important;
}

.timeline-marker-icon .bi,
.gantt-bar-icon.bi {
    color: white !important;
    font-size: inherit !important;
    display: inline-block !important;
}

/* Bootstrap Icons Content Fix */
.bi-heart::before { content: "\\f414"; }
.bi-cup-hot::before { content: "\\f5c6"; }
.bi-sunrise::before { content: "\\f5fc"; }
.bi-sun::before { content: "\\f5fc"; }
.bi-moon-stars::before { content: "\\f4c5"; }

/* Fallback für fehlende Bootstrap Icons */
.bi:empty + .unicode-fallback,
.bi:not([class*="bi-"])::before + .unicode-fallback {
    display: inline-block !important;
}

.bi:empty + .unicode-fallback ~ .bi,
.bi:not([class*="bi-"])::before + .unicode-fallback ~ .bi {
    display: none !important;
}

/* Gantt Chart Styling für Gäste */
.gantt-date-header {
    background: #f8f9fa;
    border-bottom: 2px solid #dee2e6;
    padding: 1rem;
    text-align: center;
    margin-bottom: 1rem;
    border-radius: 0.5rem 0.5rem 0 0;
}

.gantt-date-header h5 {
    margin: 0;
    color: #6c757d;
    font-weight: 600;
}

.gantt-container {
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 500px;
    background: linear-gradient(90deg, #f8f9fa 0%, #ffffff 100%);
    position: relative;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
}

.gantt-timeline {
    display: flex;
    flex-direction: column;
    min-width: 1200px;
    position: relative;
}

.gantt-header {
    display: flex;
    background: linear-gradient(135deg, #212529 0%, #343a40 100%);
    color: white;
    font-weight: 700;
    font-size: 0.875rem;
    border-bottom: 2px solid #dee2e6;
    position: sticky;
    top: 0;
    z-index: 10;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.gantt-header-cell {
    flex: 1;
    padding: 12px 8px;
    text-align: center;
    border-right: 1px solid rgba(255, 255, 255, 0.3);
    min-width: 80px;
    white-space: nowrap;
    font-size: 0.8rem;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
    flex-basis: auto; /* Allows responsive override */
    box-sizing: border-box;
}

.gantt-header-cell.gantt-hour-major {
    font-weight: 700;
    font-size: 0.8rem;
    background: linear-gradient(135deg, #495057 0%, #212529 100%);
    color: #ffffff;
    text-shadow: 2px 2px 3px rgba(0, 0, 0, 1);
    min-width: 90px;
    flex-basis: auto; /* Allows responsive override */
    box-sizing: border-box;
}

.gantt-header-cell.gantt-hour-minor {
    font-weight: 600;
    font-size: 0.8rem;
    background: rgba(52, 58, 64, 0.8);
    color: #ffffff;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    min-width: 70px;
    flex-basis: auto; /* Allows responsive override */
    box-sizing: border-box;
}

.gantt-header-cell:last-child {
    border-right: none;
}

.gantt-body {
    display: flex;
    flex-direction: column;
    position: relative;
}

.gantt-row {
    display: flex;
    min-height: 60px;
    border-bottom: 1px solid #e9ecef;
    position: relative;
    align-items: center;
    transition: background-color 0.2s ease;
}

.gantt-row:hover {
    background-color: rgba(13, 110, 253, 0.05);
}

.gantt-row:nth-child(even) {
    background-color: rgba(248, 249, 250, 0.5);
}

.gantt-time-label {
    min-width: 80px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-right: 1px solid #dee2e6;
    font-weight: 500;
    font-size: 0.875rem;
    color: #495057;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex-shrink: 0;
}

.gantt-timeline-area {
    flex: 1;
    min-height: 40px;
    position: relative;
    background: linear-gradient(90deg, transparent 0%, transparent calc(100% / 18 - 1px), #dee2e6 calc(100% / 18), transparent calc(100% / 18 + 1px));
    background-size: calc(100% / 18) 100%;
}

.gantt-bar {
    position: absolute;
    height: 32px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    color: white;
    font-weight: 600;
    font-size: 0.75rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    z-index: 5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    top: 50%;
    transform: translateY(-50%);
}

.gantt-bar:hover {
    transform: translateY(-50%) translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.gantt-bar.status-geplant {
    background: linear-gradient(135deg, #ffc107 0%, #ffca2c 100%);
    border-left: 4px solid #e6a400;
}

.gantt-bar.status-gebucht {
    background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);
    border-left: 4px solid #1e7e34;
}

.gantt-bar.status-bestaetigt {
    background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);
    border-left: 4px solid #1e7e34;
}

.gantt-bar.status-abgeschlossen {
    background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
    border-left: 4px solid #138496;
}

/* Vereinfachtes Gäste-Farbschema */
.gantt-bar.status-standard {
    background: linear-gradient(135deg, #0d6efd 0%, #3d8bfd 100%);
    border-left: 4px solid #0a58ca;
}

.gantt-bar.status-party {
    background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 100%);
    border-left: 4px solid #5a2d91;
}

.gantt-bar-content {
    display: flex;
    align-items: center;
    width: 100%;
}

.gantt-bar-icon {
    margin-right: 6px;
    font-size: 0.875rem;
}

.gantt-bar-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

.gantt-bar.public-event {
    border-bottom: 3px solid #28a745;
}

.gantt-bar.private-event {
    border-bottom: 3px solid #dc3545;
    opacity: 0.8;
}

.gantt-visibility-icon {
    margin-left: 4px;
    font-size: 0.75rem;
    opacity: 0.7;
}

/* Party Events über Mitternacht */
.gantt-bar.party-overtime {
    background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 50%, #2c3e50 100%);
    border-left: 4px solid #5a2d91;
    position: relative;
    animation: partyPulse 2s infinite alternate;
}

.gantt-overtime-icon {
    margin-left: 4px;
    color: #ffc107;
    animation: pulse 1.5s infinite;
}

@keyframes partyPulse {
    0% { box-shadow: 0 2px 8px rgba(111, 66, 193, 0.3); }
    100% { box-shadow: 0 4px 16px rgba(111, 66, 193, 0.6); }
}

@keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
}

/* Timeline Styles */
.timeline {
    position: relative;
    padding-left: 2rem;
}

.timeline-item {
    position: relative;
    margin-bottom: 2rem;
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

/* Custom Party Purple Background */
.bg-party-purple {
    background: linear-gradient(135deg, #6f42c1 0%, #8e44ad 100%) !important;
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

/* Gantt Chart - Responsive Design Fix */
@media (max-width: 768px) {
    .gantt-container {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
        width: 100% !important;
        max-width: 100vw !important;
    }
    
    .gantt-timeline {
        min-width: 1000px !important; /* Feste Mindestbreite für horizontales Scrollen */
        width: auto !important;
        display: flex !important;
        flex-direction: column !important;
    }
    
    .gantt-header {
        display: flex !important;
        flex-wrap: nowrap !important;
        min-width: 1000px !important;
    }
    
    .gantt-body {
        display: flex !important;
        flex-direction: column !important;
        min-width: 1000px !important;
    }
    
    .gantt-row {
        display: flex !important;
        min-height: 45px !important;
        align-items: center !important;
        border-bottom: 1px solid #eee !important;
        min-width: 1000px !important;
    }
    
    .gantt-time-label {
        min-width: 60px !important;
        max-width: 60px !important;
        width: 60px !important;
        padding: 8px 4px !important;
        font-size: 0.75rem !important;
        text-align: center !important;
        background: #f8f9fa !important;
        border-right: 1px solid #dee2e6 !important;
        flex-shrink: 0 !important;
    }
    
    .gantt-timeline-area {
        flex: 1 !important;
        position: relative !important;
        height: 35px !important;
        background: white !important;
        min-width: 940px !important; /* 1000px - 60px für time-label */
    }
    
    /* Gantt Bar - keine Position-Korrektur nötig */
    .gantt-bar {
        position: absolute !important;
        height: 30px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        min-width: 20px !important;
        z-index: 2 !important;
    }
}
    .gantt-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        max-width: 100vw;
    }
    
    .gantt-timeline {
        min-width: 800px;
    }
    
    /* Timeline responsive anpassungen */
    .timeline {
        padding-left: 1.5rem;
        margin: 0 -10px;
        padding-right: 10px;
    }
    
    .timeline-marker {
        left: -1.5rem;
        width: 1.5rem;
        height: 1.5rem;
    }
    
    .timeline-marker-icon {
        width: 1.5rem;
        height: 1.5rem;
        font-size: 0.75rem;
    }
    
    .timeline-marker-icon span {
        font-size: 0.9rem !important; /* Kleinere Icons für mobile */
    }
    
    .timeline-item:not(:last-child):before {
        left: -0.75rem;
    }
    
    .timeline-content .card-title {
        font-size: 1.1rem;
    }
    
    .timeline-content .row .col-sm-6 {
        font-size: 0.9rem;
    }
}

@media (max-width: 576px) {
    /* Timeline responsive fixes */
    .timeline {
        padding-left: 1.2rem;
        margin: 0 -5px;
    }
    
    .timeline-marker {
        left: -1.2rem;
        width: 1.3rem;
        height: 1.3rem;
        top: 0.4rem;
    }
    
    .timeline-marker-icon {
        width: 1.3rem;
        height: 1.3rem;
        font-size: 0.72rem;
    }
    
    .timeline-marker-icon span {
        font-size: 0.8rem !important; /* Noch kleinere Icons */
    }
    
    .timeline-item:not(:last-child):before {
        left: -0.65rem;
        top: 2rem;
    }
    
    .timeline-content .card {
        margin-left: 0.3rem;
    }
}

@media (max-width: 480px) {
    /* Timeline responsive fixes für kleine Bildschirme */
    .timeline {
        padding-left: 1rem;
        margin: 0 -15px;
        padding-right: 15px;
    }
    
    .timeline-marker {
        left: -1rem;
        width: 1.2rem;
        height: 1.2rem;
        top: 0.3rem;
    }
    
    .timeline-marker-icon {
        width: 1.2rem;
        height: 1.2rem;
        font-size: 0.7rem;
        border-width: 2px;
    }
    
    .timeline-marker-icon span {
        font-size: 0.75rem !important; /* Kleinste Icons für sehr kleine Bildschirme */
    }
    
    .timeline-item {
        margin-bottom: 1.5rem;
    }
    
    .timeline-item:not(:last-child):before {
        left: -0.5rem;
        top: 1.8rem;
        width: 1px;
    }
    
    .timeline-content .card {
        margin-left: 0.5rem;
    }
    
    .timeline-content .card-body {
        padding: 0.75rem;
    }
    
    .timeline-content .card-title {
        font-size: 1rem;
        margin-bottom: 0.5rem !important;
    }
    
    .timeline-content .row .col-sm-6 {
        font-size: 0.85rem;
        margin-bottom: 0.25rem !important;
    }
    
    .timeline-content .card-text {
        font-size: 0.875rem;
        line-height: 1.4;
    }
}

</style>
`;

// CSS in den Head einfügen
if (!document.getElementById('timeline-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'timeline-styles';
    styleElement.textContent = timelineStyles.replace('<style>', '').replace('</style>', '');
    document.head.appendChild(styleElement);
}

// Force responsive Gantt rules - corrected version without desktop interference
const additionalCSS = `
/* Responsive Gantt Chart Fixes - Only for mobile/tablet */
@media screen and (max-width: 768px) {
    .gantt-container {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
    }
    
    .gantt-timeline {
        min-width: 1000px !important;
    }
    
    .gantt-header {
        min-width: 1000px !important;
    }
    
    .gantt-body {
        min-width: 1000px !important;
    }
    
    .gantt-row {
        min-width: 1000px !important;
        min-height: 35px !important;
    }
}

@media screen and (max-width: 576px) {
    .gantt-timeline {
        min-width: 800px !important;
    }
    
    .gantt-header {
        min-width: 800px !important;
    }
    
    .gantt-body {
        min-width: 800px !important;
    }
    
    .gantt-row {
        min-width: 800px !important;
        min-height: 30px !important;
    }
}

@media screen and (max-width: 480px) {
    .gantt-timeline {
        min-width: 600px !important;
    }
    
    .gantt-header {
        min-width: 600px !important;
    }
    
    .gantt-body {
        min-width: 600px !important;
    }
    
    .gantt-row {
        min-width: 600px !important;
        min-height: 25px !important;
    }
    
    .gantt-bar {
        height: 15px !important;
        font-size: 7px !important;
    }
    
    .gantt-time-label {
        font-size: 8px !important;
        min-width: 25px !important;
        padding: 1px !important;
    }
}
`;

if (!document.getElementById('gantt-responsive-fix')) {
    const additionalStyleElement = document.createElement('style');
    additionalStyleElement.id = 'gantt-responsive-fix';
    additionalStyleElement.textContent = additionalCSS;
    document.head.appendChild(additionalStyleElement);
}

// DOM ready
document.addEventListener('DOMContentLoaded', function() {
    loadZeitplan();
    
    // Responsive Gantt Chart anpassen bei Fenstergrößenänderung
    window.addEventListener('resize', function() {
        setTimeout(() => {
            adjustGanttPositionForResponsive();
        }, 100);
    });
});

// Event Handler für View-Switching
function showTimeline() {
    const timelineContainer = document.getElementById('zeitplanList');
    const ganttContainer = document.getElementById('ganttChart');
    const timelineBtn = document.getElementById('showTimelineBtn');
    const ganttBtn = document.getElementById('showGanttBtn');
    
    if (timelineContainer && ganttContainer && timelineBtn && ganttBtn) {
        timelineContainer.style.display = 'block';
        ganttContainer.style.display = 'none';
        timelineBtn.classList.add('active');
        ganttBtn.classList.remove('active');
    }
}

function showGantt() {
    const timelineContainer = document.getElementById('zeitplanList');
    const ganttContainer = document.getElementById('ganttChart');
    const timelineBtn = document.getElementById('showTimelineBtn');
    const ganttBtn = document.getElementById('showGanttBtn');
    
    if (timelineContainer && ganttContainer && timelineBtn && ganttBtn) {
        timelineContainer.style.display = 'none';
        ganttContainer.style.display = 'block';
        timelineBtn.classList.remove('active');
        ganttBtn.classList.add('active');
        
        // Gantt-Chart-Position nach dem Anzeigen neu berechnen
        setTimeout(() => {
            adjustGanttPositionForResponsive();
        }, 100);
    }
}

