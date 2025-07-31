document.addEventListener('DOMContentLoaded', function() {
    loadGuestData();
    loadZeitplanPreview();
    loadLocationData();
    loadGuestInformationen();
    
    // Event Listeners nur hinzufügen wenn Elemente existieren
    const saveRsvpBtn = document.getElementById('saveRsvp');
    if (saveRsvpBtn) {
        saveRsvpBtn.addEventListener('click', saveRsvp);
    }
    
    const guestStatusSelect = document.getElementById('guestStatus');
    if (guestStatusSelect) {
        guestStatusSelect.addEventListener('change', handleStatusChange);
    }
});

// Globale Variable für Location-Daten
let locationsData = null;
// Globale Variable für Gäste-Informationen  
let guestInformationen = null;

function loadLocationData() {
    console.log('🔄 Loading location data...');
    
    const locationInfoDiv = document.getElementById('locationInfo');
    
    fetch('/api/guest/location')
        .then(response => {
            console.log('📡 Location API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('📍 Location data received:', data);
            locationsData = data;
            
            // Locations anzeigen
            displayLocationInfo();
            
            // OpenStreetMap initialisieren
            initializeOpenStreetMap();
        })
        .catch(error => {
            console.error('❌ Error loading location data:', error);
            
            // Fehler in der UI anzeigen
            if (locationInfoDiv) {
                locationInfoDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Location-Daten konnten nicht geladen werden.
                        <br><small>Fehler: ${error.message}</small>
                    </div>
                `;
            }
        });
}

async function initializeOpenStreetMap() {
    console.log('🗺️ initializeOpenStreetMap called');
    
    if (!locationsData || !locationsData.success) {
        console.log('⚠️ No locations data available for maps');
        return;
    }

    const locations = locationsData.locations || {};

    try {
        // Warte bis OpenStreetMap vollständig geladen ist
        if (typeof window.openStreetMap !== 'undefined') {
            console.log('📚 OpenStreetMap Objekt gefunden, warte auf vollständige Initialisierung...');
            
            // Warte auf Leaflet
            let maxWait = 10; // Maximal 10 Sekunden warten
            while ((!window.openStreetMap.initialized || typeof L === 'undefined') && maxWait > 0) {
                console.log(`⏳ Warte auf Leaflet... (${maxWait}s verbleibend)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                maxWait--;
            }
            
            if (maxWait === 0) {
                console.warn('⚠️ Timeout beim Warten auf Leaflet, verwende Fallback');
                initializeFallbackMaps();
                return;
            }
            
            console.log('✅ Leaflet erfolgreich geladen');
            
            let hasAnyMaps = false;
            
            // Standesamt Kartenvorschau
            if (locations.standesamt && locations.standesamt.adresse) {
                console.log('🗺️ Creating OpenStreetMap for Standesamt');
                const success = await createGuestLocationMap('standesamt', locations.standesamt);
                if (success) hasAnyMaps = true;
            }
            
            // Hochzeitslocation Kartenvorschau  
            if (locations.hochzeitslocation && locations.hochzeitslocation.adresse) {
                console.log('🗺️ Creating OpenStreetMap for Hochzeitslocation');
                const success = await createGuestLocationMap('hochzeitslocation', locations.hochzeitslocation);
                if (success) hasAnyMaps = true;
            }
            
            // Zeige Kartenbereich wenn Karten erstellt wurden
            if (hasAnyMaps) {
                const mapSection = document.getElementById('guestMapPreviewsSection');
                if (mapSection) {
                    mapSection.style.display = 'block';
                }
            }
            
            console.log('✅ OpenStreetMap initialization completed, maps created:', hasAnyMaps);
        } else {
            console.log('❌ OpenStreetMap integration not available, using fallback');
            initializeFallbackMaps();
        }
    } catch (error) {
        console.error('❌ Error initializing OpenStreetMap:', error);
        initializeFallbackMaps();
    }
}

async function createGuestLocationMap(locationType, locationData) {
    const mapContainerId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}Map`;
    const mapPreviewId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapPreview`;
    
    try {
        console.log(`🗺️ Erstelle Gast-Karte für ${locationType}:`, locationData);
        
        const mapPreview = document.getElementById(mapPreviewId);
        if (mapPreview) {
            mapPreview.style.display = 'block';
        }
        
        // Warte kurz damit Container sichtbar ist
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Prüfe ob createLocationMapFromBackend verfügbar ist
        if (typeof window.createLocationMapFromBackend === 'function') {
            console.log(`✅ Verwende Backend-basierte Karten für ${locationType}`);
            // Verwende die neue Backend-basierte Kartenfunktion
            const map = await window.createLocationMapFromBackend(
                mapContainerId, 
                locationType  // z.B. 'standesamt' oder 'hochzeitslocation'
            );
            
            if (map) {
                console.log(`✅ Backend-Karte für ${locationType} erfolgreich erstellt`);
                return true;
            }
        }
        
        // Fallback: Verwende die alte Methode mit Adressen
        console.log(`⚠️ Fallback auf Adress-basierte Karten für ${locationType}`);
        if (window.openStreetMap && locationData.adresse) {
            const map = await window.openStreetMap.createSimpleLocationMap(
                mapContainerId, 
                locationData.adresse, 
                locationData.name
            );
            
            if (map) {
                console.log(`✅ Fallback-Karte für ${locationType} erfolgreich erstellt`);
                return true;
            }
        }
        
        // Letzter Fallback: Zeige statische Karteninfo
        console.warn(`⚠️ Keine Karte möglich für ${locationType}, zeige Fallback`);
        showFallbackLocationMap(locationType, locationData);
        return false;
        
    } catch (error) {
        console.error(`❌ Fehler beim Erstellen der Karte für ${locationType}:`, error);
        // Zeige Fallback
        showFallbackLocationMap(locationType, locationData);
        return false;
    }
}

function initializeFallbackMaps() {
    // Fallback-Implementierung für Kartenvorschauen
    console.log('initializeFallbackMaps called - creating fallback map previews');
    
    if (!locationsData || !locationsData.success) {
        console.log('No locations data available for fallback maps');
        return;
    }
    
    const locations = locationsData.locations || {};
    let hasAnyMaps = false;
    
    // Standesamt Kartenvorschau
    if (locations.standesamt && locations.standesamt.adresse) {
        console.log('Creating fallback map preview for Standesamt');
        showFallbackLocationMap('standesamt', locations.standesamt);
        hasAnyMaps = true;
    }
    
    // Hochzeitslocation Kartenvorschau  
    if (locations.hochzeitslocation && locations.hochzeitslocation.adresse) {
        console.log('Creating fallback map preview for Hochzeitslocation');
        showFallbackLocationMap('hochzeitslocation', locations.hochzeitslocation);
        hasAnyMaps = true;
    }
    
    // Map Preview Section anzeigen falls Karten vorhanden
    if (hasAnyMaps) {
        const mapSection = document.getElementById('guestMapPreviewsSection');
        if (mapSection) {
            mapSection.style.display = 'block';
        }
    }
}

function showFallbackLocationMap(locationType, locationData) {
    console.log(`Creating fallback map for ${locationType}:`, locationData);
    
    const mapContainerId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}Map`;
    const mapPreviewId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapPreview`;
    
    const mapContainer = document.getElementById(mapContainerId);
    const mapPreview = document.getElementById(mapPreviewId);
    
    if (!mapContainer || !mapPreview) {
        console.log(`Map elements not found for ${locationType}`);
        return;
    }

    const address = locationData.adresse;
    const name = locationData.name || 'Location';
    
    // Fallback HTML mit Links zu verschiedenen Kartendiensten
    const fallbackHtml = `
        <div class="d-flex align-items-center justify-content-center bg-light h-100 p-4" style="min-height: 200px;">
            <div class="text-center">
                <i class="bi bi-geo-alt text-primary mb-3" style="font-size: 2.5rem;"></i>
                <h6 class="mb-2">${name}</h6>
                <p class="text-muted mb-3 small">${address}</p>
                <div class="d-grid gap-2 d-md-block">
                    <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}" 
                       target="_blank" 
                       class="btn btn-primary btn-sm">
                        <i class="bi bi-map me-1"></i>
                        OpenStreetMap
                    </a>
                </div>
            </div>
        </div>
    `;
    
    mapContainer.innerHTML = fallbackHtml;
    mapPreview.style.display = 'block';
    
    // Map Preview Section anzeigen
    const mapSection = document.getElementById('guestMapPreviewsSection');
    if (mapSection) {
        mapSection.style.display = 'block';
    }
}
// Funktion zur Anzeige von Location-Informationen
function displayLocationInformation(locations) {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 10px; font-family: system-ui;">
            ${mapLinkHtml}
        </body>
        </html>
    `);
    
    mapFrameElement.src = dataUrl;
    mapPreviewDiv.style.display = 'block';
    console.log('Map link fallback created');
}

function displayLocationInfo() {
    const locationInfoDiv = document.getElementById('locationInfo');
    
    if (!locationInfoDiv) {
        console.error('❌ locationInfo container not found');
        return;
    }
    
    if (!locationsData || !locationsData.success) {
        locationInfoDiv.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Location-Informationen werden noch vorbereitet
            </div>
        `;
        return;
    }
    
    const locations = locationsData.locations || {};
    let html = '';
    
    // Standesamt Information
    if (locations.standesamt && locations.standesamt.adresse) {
        html += `
            <div class="mb-3">
                <h6><i class="bi bi-building me-2"></i>Standesamt</h6>
                <p class="mb-1"><strong>Name:</strong> ${locations.standesamt.name || 'Standesamt'}</p>
                <p class="mb-1"><strong>Adresse:</strong> ${locations.standesamt.adresse}</p>
                ${locations.standesamt.beschreibung ? `<p class="text-muted small">${locations.standesamt.beschreibung}</p>` : ''}
            </div>
        `;
    }
    
    // Hochzeitslocation Information
    if (locations.hochzeitslocation && locations.hochzeitslocation.adresse) {
        html += `
            <div class="mb-3">
                <h6><i class="bi bi-heart-fill me-2"></i>Hochzeitslocation</h6>
                <p class="mb-1"><strong>Name:</strong> ${locations.hochzeitslocation.name || 'Hochzeitslocation'}</p>
                <p class="mb-1"><strong>Adresse:</strong> ${locations.hochzeitslocation.adresse}</p>
                ${locations.hochzeitslocation.beschreibung ? `<p class="text-muted small">${locations.hochzeitslocation.beschreibung}</p>` : ''}
            </div>
        `;
    }
    
    if (html === '') {
        html = `
            <div class="alert alert-info">
                <i class="bi bi-geo-alt me-2"></i>
                Location-Details werden noch hinzugefügt
            </div>
        `;
    }
    
    locationInfoDiv.innerHTML = html;
}

function loadGuestInformationen() {
    console.log('Loading guest informationen...');
    fetch('/api/guest/informationen')
        .then(response => {
            console.log('Guest informationen API response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Guest informationen data received:', data);
            if (data.success && data.informationen) {
                guestInformationen = data.informationen;
                displayGuestInformationen();
            }
        })
        .catch(error => {
            console.error('Error loading guest informationen:', error);
        });
}

function displayGuestInformationen() {
    if (!guestInformationen) {
        console.log('No guest informationen to display');
        return;
    }
    
    const informationenContainer = document.getElementById('guestInformationenContainer');
    if (!informationenContainer) {
        console.log('Guest informationen container not found');
        return;
    }
    
    let html = '';
    
    // Kontakt Information
    if (guestInformationen.kontakt) {
        html += '<h6><i class="bi bi-envelope me-2"></i>Kontakt</h6>';
        html += `<div class="alert alert-info">${guestInformationen.kontakt.einzelperson || guestInformationen.kontakt.mehrere || 'Bei Fragen könnt ihr euch gerne an uns wenden.'}</div>`;
    }
    
    // Geschenke Information
    if (guestInformationen.geschenke) {
        html += '<h6><i class="bi bi-gift me-2"></i>Geschenke</h6>';
        html += `<div class="alert alert-success">${guestInformationen.geschenke.einzelperson || guestInformationen.geschenke.mehrere || 'Über euer Kommen freuen wir uns am meisten!'}</div>`;
    }
    
    // Dresscode Information
    if (guestInformationen.dresscode) {
        html += '<h6><i class="bi bi-person-check me-2"></i>Dresscode</h6>';
        html += `<div class="alert alert-warning">${guestInformationen.dresscode.einzelperson || guestInformationen.dresscode.mehrere || 'Festliche Kleidung erwünscht.'}</div>`;
    }
    
    if (html === '') {
        html = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Informationen werden noch vorbereitet
            </div>
        `;
    }
    
    informationenContainer.innerHTML = html;
}

function loadGuestData() {
    console.log('🔄 Loading guest data...');
    const guestId = new URLSearchParams(window.location.search).get('id');
    
    if (!guestId) {
        console.log('ℹ️ No guest ID provided in URL - using session data');
        // Für eingeloggte Gäste verwenden wir Session-Daten statt URL-Parameter
        return;
    }
    
    fetch(`/api/guest/data?id=${guestId}`)
        .then(response => {
            console.log('📊 Guest data API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('📊 Guest data received:', data);
            displayGuestData(data);
        })
        .catch(error => {
            console.error('Error loading guest data:', error);
            const guestInfoElement = document.getElementById('guestInfo');
            if (guestInfoElement) {
                guestInfoElement.innerHTML = '<div class="alert alert-danger">Fehler beim Laden der Gästedaten</div>';
            }
        });
}

function displayGuestData(data) {
    const guestInfo = document.getElementById('guestInfo');
    const rsvpForm = document.getElementById('rsvpForm');
    
    if (data.error) {
        if (guestInfo) {
            guestInfo.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        }
        return;
    }
    
    // Gast-Informationen anzeigen
    let guestHtml = `<h5>Hallo ${data.name}!</h5>`;
    
    if (data.begleitung && data.begleitung.length > 0) {
        guestHtml += '<p><strong>Begleitung:</strong> ' + data.begleitung.join(', ') + '</p>';
    }
    
    if (guestInfo) {
        guestInfo.innerHTML = guestHtml;
    }
    
    // RSVP-Status setzen
    const guestStatusElement = document.getElementById('guestStatus');
    if (guestStatusElement) {
        guestStatusElement.value = data.status || 'offen';
    }
    
    // Menü-Auswahl anzeigen falls vorhanden
    if (data.menu_optionen && data.menu_optionen.length > 0) {
        displayMenuOptions(data.menu_optionen, data.menu_auswahl);
    }
    
    // Kommentar setzen
    const guestCommentElement = document.getElementById('guestComment');
    if (guestCommentElement && data.kommentar) {
        guestCommentElement.value = data.kommentar;
    }
    
    // RSVP-Formular anzeigen
    if (rsvpForm) {
        rsvpForm.style.display = 'block';
    }
    
    // Status-Change Handler
    handleStatusChange();
}

function displayMenuOptions(menuOptionen, ausgewaehlt) {
    const menuContainer = document.getElementById('menuOptions');
    
    if (!menuContainer) {
        console.log('Menu container not found');
        return;
    }
    
    if (!menuOptionen || menuOptionen.length === 0) {
        menuContainer.style.display = 'none';
        return;
    }
    
    let menuHtml = '<h6>Menü-Auswahl:</h6>';
    
    menuOptionen.forEach((option, index) => {
        const checked = ausgewaehlt && ausgewaehlt.includes(option) ? 'checked' : '';
        menuHtml += `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${option}" id="menu${index}" ${checked}>
                <label class="form-check-label" for="menu${index}">
                    ${option}
                </label>
            </div>
        `;
    });
    
    menuContainer.innerHTML = menuHtml;
    menuContainer.style.display = 'block';
}

function handleStatusChange() {
    const statusElement = document.getElementById('guestStatus');
    const additionalFields = document.getElementById('additionalFields');
    
    if (!statusElement || !additionalFields) {
        console.log('Status change elements not found');
        return;
    }
    
    const status = statusElement.value;
    
    if (status === 'zugesagt') {
        additionalFields.style.display = 'block';
    } else {
        additionalFields.style.display = 'none';
    }
}

function saveRsvp() {
    const guestId = new URLSearchParams(window.location.search).get('id');
    const statusElement = document.getElementById('guestStatus');
    const commentElement = document.getElementById('guestComment');
    
    if (!statusElement) {
        console.error('Guest status element not found');
        return;
    }
    
    const status = statusElement.value;
    const kommentar = commentElement ? commentElement.value : '';
    
    // Menü-Auswahl sammeln
    const menuCheckboxes = document.querySelectorAll('#menuOptions input[type="checkbox"]:checked');
    const menuAuswahl = Array.from(menuCheckboxes).map(cb => cb.value);
    
    const rsvpData = {
        id: guestId,
        status: status,
        kommentar: kommentar,
        menu_auswahl: menuAuswahl
    };
    
    console.log('Saving RSVP data:', rsvpData);
    
    fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(rsvpData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('RSVP save response:', data);
        if (data.success) {
            showSuccessMessage('RSVP erfolgreich gespeichert!');
        } else {
            showErrorMessage('Fehler beim Speichern der RSVP: ' + (data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(error => {
        console.error('Error saving RSVP:', error);
        showErrorMessage('Fehler beim Speichern der RSVP: ' + error.message);
    });
}

function loadZeitplanPreview() {
    console.log('🔄 Loading zeitplan preview...');
    
    const zeitplanPreviewDiv = document.getElementById('zeitplanPreview');
    
    fetch('/api/guest/zeitplan_preview')
        .then(response => {
            console.log('📅 Zeitplan API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('📅 Zeitplan data received:', data);
            displayZeitplanPreview(data);
        })
        .catch(error => {
            console.error('❌ Error loading zeitplan preview:', error);
            
            // Fehler in der UI anzeigen
            if (zeitplanPreviewDiv) {
                zeitplanPreviewDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Zeitplan konnte nicht geladen werden.
                        <br><small>Fehler: ${error.message}</small>
                    </div>
                `;
            }
        });
}

function displayZeitplanPreview(response) {
    const container = document.getElementById('zeitplanPreview');
    
    if (!container) {
        console.error('❌ zeitplanPreview container not found');
        return;
    }
    
    // Prüfe Response-Struktur
    if (!response || !response.success) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Zeitplan wird noch erstellt
            </div>
        `;
        return;
    }
    
    const events = response.events || [];
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-calendar me-2"></i>
                Noch keine Programmpunkte verfügbar
            </div>
        `;
        return;
    }
    
    let html = '';
    
    events.slice(0, 3).forEach(event => { // Nur erste 3 Events zeigen
        html += `
            <div class="d-flex align-items-center mb-2">
                <span class="badge bg-primary me-2">${event.Uhrzeit || '00:00'}</span>
                <small class="text-muted">${event.Programmpunkt || 'Programmpunkt'}</small>
            </div>
        `;
    });
    
    if (events.length > 3) {
        html += `<small class="text-muted">... und ${events.length - 3} weitere Punkte</small>`;
    }
    
    container.innerHTML = html;
}

function showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
