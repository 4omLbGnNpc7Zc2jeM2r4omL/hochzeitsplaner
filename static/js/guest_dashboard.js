document.addEventListener('DOMContentLoaded', function() {
    loadGuestData();
    loadZeitplanPreview();
    loadLocationData();
    loadGuestInformationen();
    
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
            console.log('Location data received:', data);
            locationsData = data;
            
            // Locations anzeigen
            displayLocationInfo();
            
            // Google Maps initialisieren
            initializeGoogleMap();
        })
        .catch(error => {
            console.error('Error loading location data:', error);
        });
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

function initializeGoogleMapFallback() {
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
}

function updateGuestLocationMapPreview(locationType, address) {
    console.log(`Updating map preview for ${locationType}:`, address);
    
    const mapPreviewDiv = document.getElementById(`guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapPreview`);
    const mapFrameElement = document.getElementById(`guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapFrame`);
    
    if (!mapPreviewDiv || !mapFrameElement) {
        console.log(`Map preview elements not found for ${locationType}`);
        console.log(`Looking for: guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapPreview`);
        return;
    }

    // Query für Maps erstellen
    const query = encodeURIComponent(address);
    
    // Zuerst versuchen, neue Google Maps Integration zu verwenden
    if (window.googleMaps) {
        try {
            const embedUrl = window.googleMaps.createEmbedUrl(query);
            if (embedUrl) {
                mapFrameElement.src = embedUrl;
                mapPreviewDiv.style.display = 'block';
                console.log(`Google Maps embed loaded for ${locationType}`);
                return;
            }
        } catch (error) {
            console.log(`Google Maps integration failed for ${locationType}:`, error);
        }
    }
    
    // Fallback: Versuche Google Maps mit altem API Key
    const gmapsUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dw901SwHHzFbOg&q=${query}`;
    
    // Test ob Google Maps funktioniert
    const testImg = new Image();
    testImg.onload = function() {
        // Google Maps funktioniert
        mapFrameElement.src = gmapsUrl;
        mapPreviewDiv.style.display = 'block';
        console.log(`Google Maps fallback loaded for ${locationType}`);
    };
    
    testImg.onerror = function() {
        // Google Maps funktioniert nicht, verwende OpenStreetMap
        console.log(`Google Maps failed for ${locationType}, using OpenStreetMap`);
        useOpenStreetMapFallback(locationType, address, mapFrameElement, mapPreviewDiv);
    };
    
    // Teste mit einem kleinen Google Maps Bild
    testImg.src = `https://maps.googleapis.com/maps/api/staticmap?center=${query}&zoom=15&size=100x100&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dw901SwHHzFbOg`;
    
    // Timeout für den Test
    setTimeout(() => {
        if (!mapFrameElement.src) {
            console.log(`Google Maps test timed out for ${locationType}, using OpenStreetMap`);
            useOpenStreetMapFallback(locationType, address, mapFrameElement, mapPreviewDiv);
        }
    }, 3000);
}

function useOpenStreetMapFallback(locationType, address, mapFrameElement, mapPreviewDiv) {
    const query = encodeURIComponent(address);
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
    
    fetch(osmUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                // OpenStreetMap Embed URL (funktioniert besser als die Export-Variante)
                const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lon}`;
                
                mapFrameElement.src = osmEmbedUrl;
                mapPreviewDiv.style.display = 'block';
                console.log(`OpenStreetMap loaded for ${locationType} at ${lat}, ${lon}`);
            } else {
                // Letzter Fallback: Einfacher Link zu Google Maps
                createMapLinkFallback(address, mapFrameElement, mapPreviewDiv);
            }
        })
        .catch(error => {
            console.error(`OpenStreetMap geocoding failed for ${locationType}:`, error);
            createMapLinkFallback(address, mapFrameElement, mapPreviewDiv);
        });
}

function createMapLinkFallback(address, mapFrameElement, mapPreviewDiv) {
    const query = encodeURIComponent(address);
    const mapLinkHtml = `
        <div style="display: flex; align-items: center; justify-content: center; height: 200px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;">
            <div class="text-center">
                <i class="bi bi-geo-alt-fill text-primary" style="font-size: 2rem;"></i>
                <p class="mt-2 mb-2"><strong>${address}</strong></p>
                <a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" class="btn btn-primary btn-sm">
                    <i class="bi bi-map me-1"></i>Karte öffnen
                </a>
            </div>
        </div>
    `;
    
    // Erstelle ein Data-URL für das HTML
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
    if (!locationsData) {
        console.log('No location data to display');
        return;
    }
    
    // Standesamt Information
    if (locationsData.standesamt) {
        const standesamtInfo = document.getElementById('standesamtInfo');
        if (standesamtInfo) {
            const time = locationsData.standesamt.uhrzeit || 'Uhrzeit wird noch bekannt gegeben';
            standesamtInfo.innerHTML = `
                <h6><i class="fas fa-gavel"></i> Standesamt</h6>
                <p><strong>Adresse:</strong> ${locationsData.standesamt.adresse || 'Wird noch bekannt gegeben'}</p>
                <p><strong>Uhrzeit:</strong> ${time}</p>
                ${locationsData.standesamt.hinweise ? `<p><strong>Hinweise:</strong> ${locationsData.standesamt.hinweise}</p>` : ''}
            `;
        }
    }
    
    // Hochzeitslocation Information
    if (locationsData.hochzeitslocation) {
        const locationInfo = document.getElementById('hochzeitslocationInfo');
        if (locationInfo) {
            const time = locationsData.hochzeitslocation.uhrzeit || 'Uhrzeit wird noch bekannt gegeben';
            locationInfo.innerHTML = `
                <h6><i class="fas fa-heart"></i> Hochzeitslocation</h6>
                <p><strong>Adresse:</strong> ${locationsData.hochzeitslocation.adresse || 'Wird noch bekannt gegeben'}</p>
                <p><strong>Uhrzeit:</strong> ${time}</p>
                ${locationsData.hochzeitslocation.hinweise ? `<p><strong>Hinweise:</strong> ${locationsData.hochzeitslocation.hinweise}</p>` : ''}
            `;
        }
    }
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
            guestInformationen = data;
            displayGuestInformationen();
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
    
    // Allgemeine Informationen
    if (guestInformationen.allgemein && guestInformationen.allgemein.length > 0) {
        html += '<h6><i class="fas fa-info-circle"></i> Allgemeine Informationen</h6>';
        guestInformationen.allgemein.forEach(info => {
            html += `<div class="alert alert-info"><strong>${info.titel}:</strong> ${info.text}</div>`;
        });
    }
    
    // Anfahrt Informationen
    if (guestInformationen.anfahrt && guestInformationen.anfahrt.length > 0) {
        html += '<h6><i class="fas fa-route"></i> Anfahrt</h6>';
        guestInformationen.anfahrt.forEach(info => {
            html += `<div class="alert alert-warning"><strong>${info.titel}:</strong> ${info.text}</div>`;
        });
    }
    
    // Übernachtung Informationen
    if (guestInformationen.uebernachtung && guestInformationen.uebernachtung.length > 0) {
        html += '<h6><i class="fas fa-bed"></i> Übernachtung</h6>';
        guestInformationen.uebernachtung.forEach(info => {
            html += `<div class="alert alert-success"><strong>${info.titel}:</strong> ${info.text}</div>`;
        });
    }
    
    informationenContainer.innerHTML = html;
}

function loadGuestData() {
    console.log('Loading guest data...');
    const guestId = new URLSearchParams(window.location.search).get('id');
    
    if (!guestId) {
        console.error('No guest ID provided');
        document.getElementById('guestInfo').innerHTML = '<div class="alert alert-danger">Kein Gast-ID gefunden</div>';
        return;
    }
    
    fetch(`/api/guest/data?id=${guestId}`)
        .then(response => {
            console.log('Guest data API response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Guest data received:', data);
            displayGuestData(data);
        })
        .catch(error => {
            console.error('Error loading guest data:', error);
            document.getElementById('guestInfo').innerHTML = '<div class="alert alert-danger">Fehler beim Laden der Gästedaten</div>';
        });
}

function displayGuestData(data) {
    const guestInfo = document.getElementById('guestInfo');
    const rsvpForm = document.getElementById('rsvpForm');
    
    if (data.error) {
        guestInfo.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        return;
    }
    
    // Gast-Informationen anzeigen
    let guestHtml = `<h5>Hallo ${data.name}!</h5>`;
    
    if (data.begleitung && data.begleitung.length > 0) {
        guestHtml += '<p><strong>Begleitung:</strong> ' + data.begleitung.join(', ') + '</p>';
    }
    
    guestInfo.innerHTML = guestHtml;
    
    // RSVP-Status setzen
    document.getElementById('guestStatus').value = data.status || 'offen';
    
    // Menü-Auswahl anzeigen falls vorhanden
    if (data.menu_optionen && data.menu_optionen.length > 0) {
        displayMenuOptions(data.menu_optionen, data.menu_auswahl);
    }
    
    // Kommentar setzen
    if (data.kommentar) {
        document.getElementById('guestComment').value = data.kommentar;
    }
    
    // RSVP-Formular anzeigen
    rsvpForm.style.display = 'block';
    
    // Status-Change Handler
    handleStatusChange();
}

function displayMenuOptions(menuOptionen, ausgewaehlt) {
    const menuContainer = document.getElementById('menuOptions');
    
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
    const status = document.getElementById('guestStatus').value;
    const additionalFields = document.getElementById('additionalFields');
    
    if (status === 'zugesagt') {
        additionalFields.style.display = 'block';
    } else {
        additionalFields.style.display = 'none';
    }
}

function saveRsvp() {
    const guestId = new URLSearchParams(window.location.search).get('id');
    const status = document.getElementById('guestStatus').value;
    const kommentar = document.getElementById('guestComment').value;
    
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
    console.log('Loading zeitplan preview...');
    fetch('/api/guest/zeitplan')
        .then(response => {
            console.log('Zeitplan API response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Zeitplan data received:', data);
            displayZeitplanPreview(data);
        })
        .catch(error => {
            console.error('Error loading zeitplan preview:', error);
            document.getElementById('zeitplanContainer').innerHTML = '<div class="alert alert-warning">Zeitplan wird noch erstellt</div>';
        });
}

function displayZeitplanPreview(zeitplan) {
    const container = document.getElementById('zeitplanContainer');
    
    if (!zeitplan || zeitplan.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Zeitplan wird noch erstellt</div>';
        return;
    }
    
    let html = '<h6><i class="fas fa-clock"></i> Zeitplan</h6>';
    html += '<div class="timeline">';
    
    zeitplan.slice(0, 5).forEach(event => { // Nur erste 5 Events zeigen
        html += `
            <div class="timeline-item">
                <div class="timeline-time">${event.uhrzeit}</div>
                <div class="timeline-content">
                    <strong>${event.titel}</strong>
                    ${event.beschreibung ? `<br><small class="text-muted">${event.beschreibung}</small>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    if (zeitplan.length > 5) {
        html += `<p class="text-muted"><small>... und ${zeitplan.length - 5} weitere Programmpunkte</small></p>`;
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
