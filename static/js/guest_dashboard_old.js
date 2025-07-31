document.addEventListener('DOMContentLoaded', function() {
    loadGuestData();
    loadZeitplanPreview();
    loadLocationData();
    loadGuestInformationefunction initializeGoogleMapFallback() {
    // Fallback-Implementierung für Kartenvorschauen
    console.log('initializeGoogleMapFallback called - creating fallback map previews');
    
    if (!locationsData) {
        console.log('No locations data available for fallback maps');
        return;
    }
    
    let hasAnyMaps = false;
    
    // Standesamt Kartenvorschau
    if (locationsData.standesamt && locationsData.standesamt.adresse) {
        console.log('Creating fallback map preview for Standesamt');
        updateGuestLocationMapPreview('standesamt', locationsData.standesamt.adresse);
        hasAnyMaps = true;
    }
    
    // Hochzeitslocation Kartenvorschau  
    if (locationsData.hochzeitslocation && locationsData.hochzeitslocation.adresse) {
        console.log('Creating fallback map preview for Hochzeitslocation');
        updateGuestLocationMapPreview('hochzeitslocation', locationsData.hochzeitslocation.adresse);
        hasAnyMaps = true;
    }
    
    // Map Preview Section anzeigen falls Karten vorhanden
    if (hasAnyMaps) {
        document.getElementById('guestMapPreviewsSection').style.display = 'block';
    }
}();
    
    document.getElementById('saveRsvp').addEventListener('click', saveRsvp);
    document.getElementById('guestStatus').addEventListener('change', handleStatusChange);
});

// Globale Variable für Location-Daten
let locationsData = null;
// Globale Variable für Gäste-Informationen  
let guestInformationen = null;

function loadLocationData() {
    console.log('Loading location data...');
    fetch('/api/guest/location')
        .then(response => {
            console.log('Location API response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Location API data received:', data);
            if (data.success) {
                locationsData = data.locations;
                console.log('Locations data:', locationsData);
                displayLocationInfo();
                initializeGoogleMap();
            } else {
                console.error('Location API failed:', data.message);
                document.getElementById('locationInfo').innerHTML = 
                    '<p class="text-muted">Keine Location-Informationen verfügbar.</p>';
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Location-Daten:', error);
            document.getElementById('locationInfo').innerHTML = 
                '<p class="text-danger">Fehler beim Laden der Location-Daten: ' + error.message + '</p>';
        });
}

function displayLocationInfo() {
    console.log('displayLocationInfo called with locationsData:', locationsData);
    
    if (!locationsData) {
        console.log('No locationsData available');
        return;
    }
    
    const locationInfo = document.getElementById('locationInfo');
    if (!locationInfo) {
        console.error('locationInfo element not found');
        return;
    }
    
    let html = '';
    
    // Standesamt anzeigen (falls vorhanden)
    if (locationsData.standesamt) {
        console.log('Processing standesamt:', locationsData.standesamt);
        const standesamt = locationsData.standesamt;
        const googleMapsUrlStandesamt = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(standesamt.adresse)}`;
        
        html += `
            <div class="mb-4">
                <h6 class="fw-bold text-primary">
                    <i class="bi bi-building me-2"></i>
                    Standesamt
                </h6>
                <h6 class="fw-bold">${standesamt.name}</h6>
                <p class="mb-2">
                    <i class="bi bi-geo-alt text-success me-2"></i>
                    <a href="${googleMapsUrlStandesamt}" target="_blank" class="text-decoration-none">
                        ${standesamt.adresse}
                        <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                    </a>
                </p>
                ${standesamt.beschreibung ? `<p class="text-muted small">${standesamt.beschreibung}</p>` : ''}
            </div>
        `;
    } else {
        console.log('No standesamt data found');
    }
    
    // Hochzeitslocation anzeigen (falls vorhanden)
    if (locationsData.hochzeitslocation) {
        console.log('Processing hochzeitslocation:', locationsData.hochzeitslocation);
        const location = locationsData.hochzeitslocation;
        const googleMapsUrlLocation = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.adresse)}`;
        
        html += `
            <div class="mb-3">
                <h6 class="fw-bold text-primary">
                    <i class="bi bi-heart-fill me-2"></i>
                    Hochzeitslocation
                </h6>
                <h6 class="fw-bold">${location.name}</h6>
                <p class="mb-2">
                    <i class="bi bi-geo-alt text-success me-2"></i>
                    <a href="${googleMapsUrlLocation}" target="_blank" class="text-decoration-none">
                        ${location.adresse}
                        <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                    </a>
                </p>
                ${location.beschreibung ? `<p class="text-muted small">${location.beschreibung}</p>` : ''}
            </div>
        `;
    }
    
    // Falls keine der neuen Locations vorhanden ist, aber alte Location-Daten existieren
    if (!html && locationsData.location) {
        const location = locationsData.location;
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.adresse)}`;
        
        html = `
            <h6 class="fw-bold">${location.name}</h6>
            <p class="mb-2">
                <i class="bi bi-geo-alt text-success me-2"></i>
                <a href="${googleMapsUrl}" target="_blank" class="text-decoration-none">
                    ${location.adresse}
                    <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                </a>
            </p>
            ${location.beschreibung ? `<p class="text-muted small">${location.beschreibung}</p>` : ''}
        `;
    }
    
    if (html) {
        console.log('Setting HTML content:', html);
        locationInfo.innerHTML = html;
    } else {
        console.log('No location data to display');
        locationInfo.innerHTML = '<p class="text-muted">Keine Location-Informationen verfügbar.</p>';
    }
}

function initializeGoogleMap() {
    // Verwende die neue Google Maps Integration
    console.log('initializeGoogleMap called - using new Google Maps integration');
    
    if (!locationsData) {
        console.log('No locations data available for maps');
        return;
    }

    // Warte kurz bis Google Maps Klasse initialisiert ist
    if (window.googleMaps) {
        const hasAnyMaps = window.googleMaps.updateLocationMaps(locationsData);
        console.log('Google Maps integration result:', hasAnyMaps);
    } else {
        console.log('Google Maps integration not available, using fallback');
        initializeGoogleMapFallback();
    }
}

function updateGuestLocationMapPreview(locationType, adresse) {
    if (!adresse || adresse.trim() === '') {
        console.log(`No address available for ${locationType}`);
        return;
    }
    
    // OpenStreetMap Embed URL erstellen (funktioniert ohne API-Key)
    const osmQuery = encodeURIComponent(adresse);
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=&layer=mapnik&marker=&query=${osmQuery}`;
    
    // Alternativ: Einfacher Fallback mit Hinweis auf Google Maps
    const fallbackHtml = `
        <div class="d-flex align-items-center justify-content-center bg-light h-100 p-4">
            <div class="text-center">
                <i class="bi bi-geo-alt text-primary mb-2" style="font-size: 2rem;"></i>
                <h6 class="mb-2">${adresse}</h6>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}" 
                   target="_blank" 
                   class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-map me-1"></i>
                    In Google Maps öffnen
                </a>
            </div>
        </div>
    `;
    
    // Map Frame Element finden
    const mapFrameId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapFrame`;
    const mapPreviewId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapPreview`;
    
    const mapFrame = document.getElementById(mapFrameId);
    const mapPreview = document.getElementById(mapPreviewId);
    
    if (mapFrame && mapPreview) {
        // Iframe durch Fallback-HTML ersetzen
        const parentDiv = mapFrame.parentElement;
        parentDiv.innerHTML = fallbackHtml;
        mapPreview.style.display = 'block';
        console.log(`Map preview updated for ${locationType} with fallback solution`);
    } else {
        console.error(`Map elements not found for ${locationType}:`, {mapFrameId, mapPreviewId});
    }
}

function loadGuestInformationen() {
    fetch('/api/guest/informationen')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                guestInformationen = data.informationen;
                console.log('Gäste-Informationen geladen:', guestInformationen);
                
                // Texte erneut aktualisieren, falls Gästedaten bereits geladen sind
                const personenInput = document.getElementById('personenAnzahl');
                if (personenInput && personenInput.max) {
                    updateGeschenkeText(parseInt(personenInput.max));
                }
            } else {
                console.error('Fehler beim Laden der Gäste-Informationen:', data.message);
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Gäste-Informationen:', error);
        });
}

function loadGuestData() {
    fetch('/api/guest/data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const guest = data.guest;
                
                // Status setzen
                document.getElementById('guestStatus').value = guest.status || 'Offen';
                
                // Personenanzahl
                const personenInput = document.getElementById('personenAnzahl');
                const maxPersonenSpan = document.getElementById('maxPersonen');
                
                personenInput.value = guest.personen || 1;
                personenInput.max = guest.max_personen || 1;
                maxPersonenSpan.textContent = guest.max_personen || 1;
                
                // Notiz
                document.getElementById('guestNotiz').value = guest.notiz || '';
                
                // Geschenke-Text basierend auf Personenanzahl aktualisieren
                updateGeschenkeText(guest.max_personen || 1);
                
                handleStatusChange();
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Gästedaten:', error);
            showAlert('Fehler beim Laden deiner Daten.', 'danger');
        });
}

function updateGeschenkeText(maxPersonen) {
    if (!guestInformationen) {
        console.log('Gäste-Informationen noch nicht geladen, verwende Fallback-Texte');
        // Fallback-Verhalten
        const geschenkeElement = document.getElementById('geschenkeText');
        if (geschenkeElement) {
            if (maxPersonen === 1) {
                geschenkeElement.textContent = 'Über dein Kommen freuen wir uns am meisten!';
            } else {
                geschenkeElement.textContent = 'Über euer Kommen freuen wir uns am meisten!';
            }
        }
        return;
    }
    
    // Alle Texte basierend auf Personenanzahl aktualisieren
    const isEinzelperson = maxPersonen === 1;
    const typ = isEinzelperson ? 'einzelperson' : 'mehrere';
    
    // Geschenke-Text
    const geschenkeElement = document.getElementById('geschenkeText');
    if (geschenkeElement && guestInformationen.geschenke) {
        geschenkeElement.textContent = guestInformationen.geschenke[typ] || 
            (isEinzelperson ? 'Über dein Kommen freuen wir uns am meisten!' : 'Über euer Kommen freuen wir uns am meisten!');
    }
    
    // Kontakt-Text
    const kontaktElement = document.getElementById('kontaktText');
    if (kontaktElement && guestInformationen.kontakt) {
        kontaktElement.textContent = guestInformationen.kontakt[typ] || 
            (isEinzelperson ? 'Bei Fragen kannst du dich gerne an uns wenden.' : 'Bei Fragen könnt ihr euch gerne an uns wenden.');
    }
    
    // Dresscode-Text
    const dresscodeElement = document.getElementById('dresscodeText');
    if (dresscodeElement && guestInformationen.dresscode) {
        dresscodeElement.textContent = guestInformationen.dresscode[typ] || 'Festliche Kleidung erwünscht.';
    }
}

function handleStatusChange() {
    const status = document.getElementById('guestStatus').value;
    const personenDiv = document.getElementById('personenDiv');
    
    if (status === 'Abgesagt') {
        personenDiv.style.display = 'none';
    } else {
        personenDiv.style.display = 'block';
    }
}

function saveRsvp() {
    const status = document.getElementById('guestStatus').value;
    const personen = status === 'Abgesagt' ? 0 : parseInt(document.getElementById('personenAnzahl').value);
    const notiz = document.getElementById('guestNotiz').value;
    
    const saveButton = document.getElementById('saveRsvp');
    const originalText = saveButton.innerHTML;
    
    // Button deaktivieren und Loading-Status anzeigen
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Speichere...';
    
    fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            status: status,
            personen: personen,
            notiz: notiz
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showRsvpSuccess();
        } else {
            showAlert(data.message || 'Fehler beim Speichern.', 'danger');
        }
    })
    .catch(error => {
        console.error('Fehler beim Speichern:', error);
        showAlert('Ein Fehler ist aufgetreten.', 'danger');
    })
    .finally(() => {
        // Button wieder aktivieren
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
    });
}

function showRsvpSuccess() {
    document.getElementById('rsvpForm').classList.add('d-none');
    document.getElementById('rsvpSuccess').classList.remove('d-none');
    
    // Nach 3 Sekunden wieder zum Formular wechseln
    setTimeout(() => {
        document.getElementById('rsvpSuccess').classList.add('d-none');
        document.getElementById('rsvpForm').classList.remove('d-none');
    }, 3000);
    
    showAlert('Deine Teilnahme wurde erfolgreich gespeichert!', 'success');
}

function loadZeitplanPreview() {
    fetch('/api/guest/zeitplan_preview')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const preview = document.getElementById('zeitplanPreview');
                
                if (data.events.length === 0) {
                    preview.innerHTML = '<p class="text-muted">Noch keine öffentlichen Termine verfügbar.</p>';
                    return;
                }
                
                let html = '<div class="list-group list-group-flush">';
                
                data.events.slice(0, 3).forEach(event => {
                    // Verwende die echten Feldnamen aus der Datenbank
                    const uhrzeit = event.Uhrzeit || '';
                    const programmpunkt = event.Programmpunkt || event.title || 'Unbenannter Termin';
                    const status = event.Status || 'Geplant';
                    
                    html += `
                        <div class="list-group-item px-0 py-2">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="mb-1">${programmpunkt}</h6>
                                    <small class="text-muted">${uhrzeit}</small>
                                </div>
                                <span class="badge bg-${getStatusColor(status)}">${status}</span>
                            </div>
                        </div>
                    `;
                });
                
                if (data.events.length > 3) {
                    html += `
                        <div class="list-group-item px-0 py-2 text-center">
                            <small class="text-muted">
                                und ${data.events.length - 3} weitere Termine...
                            </small>
                        </div>
                    `;
                }
                
                html += '</div>';
                preview.innerHTML = html;
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Zeitplan-Vorschau:', error);
            document.getElementById('zeitplanPreview').innerHTML = 
                '<p class="text-muted">Fehler beim Laden der Vorschau.</p>';
        });
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

function showAlert(message, type) {
    // Verwende den globalen festen Alert-Container
    let alertContainer = document.getElementById('globalAlertContainer');
    
    if (!alertContainer) {
        // Fallback: Erstelle globalen festen Alert-Container falls nicht vorhanden
        alertContainer = document.createElement('div');
        alertContainer.id = 'globalAlertContainer';
        alertContainer.className = 'alert-container-fixed';
        document.body.appendChild(alertContainer);
    }
    
    // Erstelle Alert-Element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Füge Alert zum Container hinzu
    alertContainer.appendChild(alertDiv);
    
    // Automatisch nach 5 Sekunden ausblenden mit Fadeout-Effekt
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.classList.remove('show');
            alertDiv.classList.add('fade');
            // Nach der Fade-Animation entfernen
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 150);
        }
    }, 5000);
}
