/**
 * Guest Dashboard v1.1 - Debug Control
 */

// Debug-Modus - auf false setzen um alle Debug-Ausgaben zu deaktivieren
const DEBUG_GUEST_DASHBOARD = true;

// Debug-Helper-Funktion
function debugLog(...args) {
    if (DEBUG_GUEST_DASHBOARD) {
        console.log(...args);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // First Login Check - sofort als erstes prüfen
    checkFirstLogin();
    
    loadGuestData();
    loadZeitplanPreview();
    loadLocationData();
    loadGuestInformationen();
    updatePersonalizedWelcome(); // Neue Funktion für personalisierte Begrüßung
    
    // Event Listeners nur hinzufügen wenn Elemente existieren
    const saveRsvpBtn = document.getElementById('saveRsvp');
    if (saveRsvpBtn) {
        saveRsvpBtn.addEventListener('click', saveRsvp);
    }
    
    const guestStatusSelect = document.getElementById('guestStatus');
    if (guestStatusSelect) {
        guestStatusSelect.addEventListener('change', handleStatusChange);
    }
    
    // Event Listener für Personenanzahl-Änderungen
    const personenAnzahlInput = document.getElementById('personenAnzahl');
    if (personenAnzahlInput) {
        personenAnzahlInput.addEventListener('input', function() {
            const currentValue = parseInt(this.value) || 1;
            updatePluralTexts(currentValue);
        });
    }
    
    // Event Listener für "Einladung anzeigen" Button
    const showInvitationBtn = document.getElementById('showInvitationBtn');
    if (showInvitationBtn) {
        showInvitationBtn.addEventListener('click', function() {
            showInvitationModal();
        });
    }
});

// Globale Variable für Location-Daten
let locationsData = null;
// Globale Variable für Gäste-Informationen  
let guestInformationen = null;

function loadLocationData() {
    debugLog('🔄 Loading location data...');
    
    const locationInfoDiv = document.getElementById('locationInfo');
    
    fetch('/api/guest/location')
        .then(response => {
            debugLog('📡 Location API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            debugLog('📍 Location data received:', data);
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
    debugLog('🗺️ initializeOpenStreetMap called');
    
    if (!locationsData || !locationsData.success) {
        debugLog('⚠️ No locations data available for maps');
        return;
    }

    const locations = locationsData.locations || {};

    try {
        // Warte bis OpenStreetMap vollständig geladen ist
        if (typeof window.openStreetMap !== 'undefined') {
            debugLog('📚 OpenStreetMap Objekt gefunden, warte auf vollständige Initialisierung...');
            
            // Warte auf Leaflet
            let maxWait = 10; // Maximal 10 Sekunden warten
            while ((!window.openStreetMap.initialized || typeof L === 'undefined') && maxWait > 0) {
                debugLog(`⏳ Warte auf Leaflet... (${maxWait}s verbleibend)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                maxWait--;
            }
            
            if (maxWait === 0) {
                console.warn('⚠️ Timeout beim Warten auf Leaflet, verwende Fallback');
                initializeFallbackMaps();
                return;
            }
            
            debugLog('✅ Leaflet erfolgreich geladen');
            
            let hasAnyMaps = false;
            
            // Standesamt Kartenvorschau
            const standesamtContainer = document.getElementById('guestStandesamtMapPreview');
            if (locations.standesamt && locations.standesamt.adresse) {
                debugLog('🗺️ Creating OpenStreetMap for Standesamt');
                const success = await createGuestLocationMap('standesamt', locations.standesamt);
                if (success) hasAnyMaps = true;
                
                // Container anzeigen
                if (standesamtContainer) {
                    standesamtContainer.style.display = 'block';
                }
            } else {
                debugLog('🚫 Standesamt access denied or no data - hiding container');
                // Container verstecken
                if (standesamtContainer) {
                    standesamtContainer.style.display = 'none';
                }
            }
            
            // Hochzeitslocation Kartenvorschau  
            if (locations.hochzeitslocation && locations.hochzeitslocation.adresse) {
                debugLog('🗺️ Creating OpenStreetMap for Hochzeitslocation');
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
            
            debugLog('✅ OpenStreetMap initialization completed, maps created:', hasAnyMaps);
        } else {
            debugLog('❌ OpenStreetMap integration not available, using fallback');
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
        debugLog(`🗺️ Erstelle Gast-Karte für ${locationType}:`, locationData);
        
        const mapPreview = document.getElementById(mapPreviewId);
        if (mapPreview) {
            mapPreview.style.display = 'block';
        }
        
        // Warte kurz damit Container sichtbar ist
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verwende die gleiche Logik wie in Einstellungen: direkte Adress-basierte Karten
        if (window.openStreetMap && locationData.adresse) {
            debugLog(`✅ Verwende Adress-basierte Karten für ${locationType}: ${locationData.adresse}`);
            // Verwende die bewährte Adress-basierte Kartenfunktion aus Einstellungen
            const map = await window.openStreetMap.createSimpleLocationMap(
                mapContainerId, 
                locationData.adresse, 
                locationData.name
            );
            
            if (map) {
                debugLog(`✅ Adress-Karte für ${locationType} erfolgreich erstellt`);
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
}function initializeFallbackMaps() {
    // Fallback-Implementierung für Kartenvorschauen
    debugLog('initializeFallbackMaps called - creating fallback map previews');
    
    if (!locationsData || !locationsData.success) {
        debugLog('No locations data available for fallback maps');
        return;
    }
    
    const locations = locationsData.locations || {};
    let hasAnyMaps = false;
    
    // Standesamt Kartenvorschau
    if (locations.standesamt && locations.standesamt.adresse) {
        debugLog('Creating fallback map preview for Standesamt');
        showFallbackLocationMap('standesamt', locations.standesamt);
        hasAnyMaps = true;
    }
    
    // Hochzeitslocation Kartenvorschau  
    if (locations.hochzeitslocation && locations.hochzeitslocation.adresse) {
        debugLog('Creating fallback map preview for Hochzeitslocation');
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
    debugLog(`Creating fallback map for ${locationType}:`, locationData);
    
    const mapContainerId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}Map`;
    const mapPreviewId = `guest${locationType.charAt(0).toUpperCase() + locationType.slice(1)}MapPreview`;
    
    const mapContainer = document.getElementById(mapContainerId);
    const mapPreview = document.getElementById(mapPreviewId);
    
    if (!mapContainer || !mapPreview) {
        debugLog(`Map elements not found for ${locationType}`);
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
    debugLog('Map link fallback created');
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
        
        // Standesamt-Daten in die Kartenelemente laden
        const standesamtNameEl = document.getElementById('standesamtName');
        const standesamtAdresseEl = document.getElementById('standesamtAdresse');
        if (standesamtNameEl) {
            standesamtNameEl.textContent = locations.standesamt.name || 'Standesamt';
        }
        if (standesamtAdresseEl) {
            standesamtAdresseEl.textContent = locations.standesamt.adresse;
        }
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
        
        // Hochzeitslocation-Daten in die Kartenelemente laden
        const hochzeitslocationNameEl = document.getElementById('hochzeitslocationName');
        const hochzeitslocationAdresseEl = document.getElementById('hochzeitslocationAdresse');
        if (hochzeitslocationNameEl) {
            hochzeitslocationNameEl.textContent = locations.hochzeitslocation.name || 'Hochzeitslocation';
        }
        if (hochzeitslocationAdresseEl) {
            hochzeitslocationAdresseEl.textContent = locations.hochzeitslocation.adresse;
        }
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
    debugLog('Loading guest informationen...');
    fetch('/api/guest/informationen')
        .then(response => {
            debugLog('Guest informationen API response status:', response.status);
            return response.json();
        })
        .then(data => {
            debugLog('Guest informationen data received:', data);
            if (data.success && data.informationen) {
                guestInformationen = data.informationen;
                debugLog('✅ guestInformationen gesetzt:', guestInformationen);
                
                // Aktualisiere die Plural-Texte nach dem Laden der Informationen
                const personenAnzahlInput = document.getElementById('personenAnzahl');
                if (personenAnzahlInput) {
                    const currentPersonen = parseInt(personenAnzahlInput.max) || parseInt(personenAnzahlInput.value) || 1;
                    updateInformationenTexts(currentPersonen > 1);
                } else {
                    // Fallback: Nutze "mehrere" als Standard
                    updateInformationenTexts(true);
                }
            }
        })
        .catch(error => {
            console.error('Error loading guest informationen:', error);
        });
}

function displayGuestInformationen() {
    if (!guestInformationen) {
        debugLog('No guest informationen to display');
        return;
    }
    
    const informationenContainer = document.getElementById('guestInformationenContainer');
    if (!informationenContainer) {
        debugLog('Guest informationen container not found');
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
    debugLog('🔄 Loading guest data...');
    const guestId = new URLSearchParams(window.location.search).get('id');
    
    if (!guestId) {
        debugLog('ℹ️ No guest ID provided in URL - loading session-based guest data');
        // Für eingeloggte Gäste laden wir Session-Daten
        loadSessionGuestData();
        return;
    }
    
    fetch(`/api/guest/data?id=${guestId}`)
        .then(response => {
            debugLog('📊 Guest data API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            debugLog('📊 Guest data received:', data);
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

// Neue Funktion für Session-basierte Gäste
function loadSessionGuestData() {
    debugLog('🔄 Loading session-based guest data...');
    
    fetch('/api/guest/data')
        .then(response => {
            debugLog('📊 Session guest data API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            debugLog('📊 Session guest data received:', data);
            if (data.success && data.guest) {
                updateGuestFormLimits(data.guest);
            }
        })
        .catch(error => {
            console.error('Error loading session guest data:', error);
        });
}

// Neue Funktion um Formular-Limits zu setzen
function updateGuestFormLimits(guestData) {
    debugLog('🔧 Updating form limits for guest:', guestData);
    
    const personenAnzahlInput = document.getElementById('personenAnzahl');
    const maxPersonenSpan = document.getElementById('maxPersonen');
    const statusElement = document.getElementById('guestStatus');
    const notizElement = document.getElementById('guestNotiz');
    
    if (personenAnzahlInput && maxPersonenSpan) {
        const maxPersonen = guestData.max_personen || guestData.personen || 1;
        
        // Setze das Maximum und den aktuellen Wert
        personenAnzahlInput.max = maxPersonen;
        personenAnzahlInput.value = Math.min(guestData.personen || personenAnzahlInput.value || 1, maxPersonen);
        
        // Update den Hinweistext
        maxPersonenSpan.textContent = maxPersonen;
        
        // Neue Funktion: Update der Plural-/Singular-Texte
        updatePluralTexts(maxPersonen);
        
        debugLog(`✅ Person limits updated: max=${maxPersonen}, current=${personenAnzahlInput.value}`);
    }
    
    // Status und Notiz aus den Daten setzen
    if (statusElement && guestData.status) {
        statusElement.value = guestData.status;
    }
    
    if (notizElement && guestData.notiz) {
        notizElement.value = guestData.notiz;
    }
    
    // Timestamp für Conflict Detection speichern
    if (guestData.last_modified) {
        lastModified = guestData.last_modified;
        debugLog('🕒 Last modified timestamp loaded:', lastModified);
    }
}

// Neue Funktion für dynamische Plural-/Singular-Texte
function updatePluralTexts(personenanzahl) {
    const isPlural = personenanzahl > 1;
    
    // Titel der Teilnahme-Karte
    const teilnahmeTitle = document.getElementById('teilnahmeTitle');
    if (teilnahmeTitle) {
        teilnahmeTitle.textContent = isPlural ? 'Eure Teilnahme' : 'Deine Teilnahme';
    }
    
    // Status-Optionen
    const statusOpen = document.getElementById('statusOpen');
    const statusConfirmed = document.getElementById('statusConfirmed');
    const statusDeclined = document.getElementById('statusDeclined');
    
    if (statusOpen) {
        statusOpen.textContent = isPlural ? 'Noch nicht entschieden' : 'Noch nicht entschieden';
    }
    
    if (statusConfirmed) {
        statusConfirmed.textContent = isPlural ? 'Wir kommen gerne!' : 'Ich komme gerne!';
    }
    
    if (statusDeclined) {
        statusDeclined.textContent = isPlural ? 'Können leider nicht kommen' : 'Kann leider nicht kommen';
    }
    
    // Button-Text
    const saveRsvpText = document.getElementById('saveRsvpText');
    if (saveRsvpText) {
        saveRsvpText.textContent = isPlural ? 'Teilnahme speichern' : 'Teilnahme speichern';
    }
    
    // Erfolgs-Nachricht
    const rsvpSuccessText = document.getElementById('rsvpSuccessText');
    if (rsvpSuccessText) {
        rsvpSuccessText.textContent = isPlural ? 'Eure Teilnahme wurde gespeichert.' : 'Deine Teilnahme wurde gespeichert.';
    }
    
    // Informationsbereiche aktualisieren (falls guestInformationen geladen wurden)
    updateInformationenTexts(isPlural);
    
    // Einladungstext aktualisieren
    const invitationText = document.getElementById('invitationText');
    if (invitationText) {
        invitationText.textContent = isPlural 
            ? 'Ihr möchtet eure persönliche Einladung nochmal ansehen? Hier könnt ihr sie erneut öffnen.'
            : 'Du möchtest deine persönliche Einladung nochmal ansehen? Hier kannst du sie erneut öffnen.';
    }
    
    debugLog(`✅ Plural texts updated for ${personenanzahl} person(s), isPlural: ${isPlural}`);
}

// Hilfsfunktion für die Aktualisierung der Informationen-Texte
function updateInformationenTexts(isPlural) {
    // Fallback-Texte falls keine benutzerdefinierten Informationen geladen wurden
    const kontaktText = document.getElementById('kontaktText');
    if (kontaktText && !guestInformationen) {
        kontaktText.textContent = isPlural 
            ? 'Bei Fragen könnt ihr euch gerne an uns wenden.'
            : 'Bei Fragen kannst du dich gerne an uns wenden.';
    }
    
    const geschenkeText = document.getElementById('geschenkeText');
    if (geschenkeText && !guestInformationen) {
        geschenkeText.textContent = isPlural 
            ? 'Über euer Kommen freuen wir uns am meisten!'
            : 'Über dein Kommen freuen wir uns am meisten!';
    }
    
    const dresscodeText = document.getElementById('dresscodeText');
    if (dresscodeText && !guestInformationen) {
        dresscodeText.textContent = 'Festliche Kleidung erwünscht.';
    }
    
    // Falls guestInformationen geladen wurden, verwende die entsprechenden Texte
    if (guestInformationen) {
        if (kontaktText && guestInformationen.kontakt) {
            const kontaktInfo = isPlural ? guestInformationen.kontakt.mehrere : guestInformationen.kontakt.einzelperson;
            if (kontaktInfo) {
                kontaktText.textContent = kontaktInfo;
            }
        }
        
        if (geschenkeText && guestInformationen.geschenke) {
            const geschenkeInfo = isPlural ? guestInformationen.geschenke.mehrere : guestInformationen.geschenke.einzelperson;
            if (geschenkeInfo) {
                geschenkeText.textContent = geschenkeInfo;
            }
        }
        
        if (dresscodeText && guestInformationen.dresscode) {
            const dresscodeInfo = isPlural ? guestInformationen.dresscode.mehrere : guestInformationen.dresscode.einzelperson;
            if (dresscodeInfo) {
                dresscodeText.textContent = dresscodeInfo;
            }
        }
        
        // WhatsApp-Button konfigurieren
        updateWhatsAppButton();
    }
}

function updateWhatsAppButton() {
    const whatsappContainer = document.getElementById('whatsappContainer');
    const whatsappLink = document.getElementById('whatsappLink');
    
    debugLog('🔍 WhatsApp Button Debug:');
    debugLog('  - whatsappContainer gefunden:', !!whatsappContainer);
    debugLog('  - whatsappLink gefunden:', !!whatsappLink);
    debugLog('  - guestInformationen:', guestInformationen);
    debugLog('  - guestInformationen.kontakt:', guestInformationen?.kontakt);
    debugLog('  - whatsapp_nummer:', guestInformationen?.kontakt?.whatsapp_nummer);
    
    // Quick-Fix: Nutze die WhatsApp-Nummer aus settings.json direkt
    const fallbackNumber = "+4915140737042";
    const whatsappNumber = guestInformationen?.kontakt?.whatsapp_nummer || fallbackNumber;
    
    if (whatsappContainer && whatsappLink && whatsappNumber) {
        // WhatsApp-URL erstellen (internationale Nummer ohne +, ohne vordefinierte Nachricht)
        const cleanNumber = whatsappNumber.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanNumber}`;
        
        whatsappLink.href = whatsappUrl;
        whatsappLink.target = '_blank';
        whatsappContainer.style.display = 'block';
        
        debugLog('✅ WhatsApp-Button konfiguriert:', whatsappUrl);
    } else {
        if (whatsappContainer) {
            whatsappContainer.style.display = 'none';
        }
        debugLog('❌ WhatsApp-Button versteckt - Bedingung nicht erfüllt');
    }
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
        debugLog('Menu container not found');
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
        debugLog('Status change elements not found');
        return;
    }
    
    const status = statusElement.value;
    
    if (status === 'zugesagt') {
        additionalFields.style.display = 'block';
    } else {
        additionalFields.style.display = 'none';
    }
}

// Globale Variable für letzte Änderungszeit
let lastModified = null;

function saveRsvp() {
    const guestId = new URLSearchParams(window.location.search).get('id');
    const statusElement = document.getElementById('guestStatus');
    const commentElement = document.getElementById('guestComment');
    const personenElement = document.getElementById('personenAnzahl');
    const notizElement = document.getElementById('guestNotiz');
    
    if (!statusElement) {
        console.error('Guest status element not found');
        return;
    }
    
    const status = statusElement.value;
    const kommentar = commentElement ? commentElement.value : '';
    const personen = personenElement ? parseInt(personenElement.value) || 1 : 1;
    const notiz = notizElement ? notizElement.value : '';
    
    // Menü-Auswahl sammeln (falls vorhanden)
    const menuCheckboxes = document.querySelectorAll('#menuOptions input[type="checkbox"]:checked');
    const menuAuswahl = Array.from(menuCheckboxes).map(cb => cb.value);
    
    const rsvpData = {
        id: guestId,
        status: status,
        personen: personen,
        notiz: notiz,
        kommentar: kommentar,
        menu_auswahl: menuAuswahl,
        last_modified: lastModified  // Timestamp für Conflict Detection
    };
    
    debugLog('Saving RSVP data:', rsvpData);
    
    fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(rsvpData)
    })
    .then(response => response.json())
    .then(data => {
        debugLog('RSVP save response:', data);
        
        if (data.success) {
            // Timestamp aktualisieren für zukünftige Änderungen
            lastModified = data.last_modified;
            showSuccessMessage('Teilnahme erfolgreich gespeichert!');
        } else if (data.conflict) {
            // Conflict Handler: Benutzer über Änderungen informieren
            const conflictMessage = `
                Die Daten wurden zwischenzeitlich geändert. Aktuelle Werte:
                - Status: ${data.current_data.status}
                - Personen: ${data.current_data.personen}
                - Notiz: ${data.current_data.notiz || 'Keine'}
                
                Möchten Sie Ihre Änderungen trotzdem übernehmen?
            `;
            
            if (confirm(conflictMessage)) {
                // Force Update: Setze den aktuellen Timestamp und versuche erneut
                rsvpData.last_modified = data.current_data.last_modified;
                lastModified = data.current_data.last_modified;
                
                fetch('/api/guest/rsvp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(rsvpData)
                })
                .then(response => response.json())
                .then(retryData => {
                    if (retryData.success) {
                        lastModified = retryData.last_modified;
                        showSuccessMessage('Teilnahme erfolgreich gespeichert!');
                    } else {
                        showErrorMessage('Fehler beim Speichern: ' + (retryData.message || 'Unbekannter Fehler'));
                    }
                })
                .catch(error => {
                    console.error('Error on retry:', error);
                    showErrorMessage('Fehler beim erneuten Speichern: ' + error.message);
                });
            } else {
                // Benutzer möchte nicht überschreiben - lade aktuelle Daten
                loadCurrentGuestData(data.current_data);
            }
        } else {
            showErrorMessage('Fehler beim Speichern: ' + (data.message || data.error || 'Unbekannter Fehler'));
        }
    })
    .catch(error => {
        console.error('Error saving RSVP:', error);
        showErrorMessage('Fehler beim Speichern der Teilnahme: ' + error.message);
    });
}

function loadCurrentGuestData(currentData) {
    // Lade die aktuellen Daten ins Formular
    const statusElement = document.getElementById('guestStatus');
    const personenElement = document.getElementById('personenAnzahl');
    const notizElement = document.getElementById('guestNotiz');
    
    if (statusElement) statusElement.value = currentData.status || 'Offen';
    if (personenElement) personenElement.value = currentData.personen || 1;
    if (notizElement) notizElement.value = currentData.notiz || '';
    
    // Timestamp aktualisieren
    lastModified = currentData.last_modified;
    
    showInfoMessage('Die Daten wurden auf die aktuellen Werte zurückgesetzt.');
}

function loadZeitplanPreview() {
    debugLog('🔄 Loading zeitplan preview...');
    
    const zeitplanPreviewDiv = document.getElementById('zeitplanPreview');
    
    fetch('/api/guest/zeitplan_preview')
        .then(response => {
            debugLog('📅 Zeitplan API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            debugLog('📅 Zeitplan data received:', data);
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
                <span class="badge bg-primary me-2">${event.uhrzeit || '00:00'}</span>
                <small class="text-muted">${event.titel || 'Programmpunkt'}</small>
            </div>
        `;
    });
    
    if (events.length > 3) {
        html += `<small class="text-muted">... und ${events.length - 3} weitere Punkte</small>`;
    }
    
    container.innerHTML = html;
}

// Neue Funktion für personalisierte Begrüßungsnachricht
function updatePersonalizedWelcome() {
    debugLog('🔄 Updating personalized welcome message...');
    
    fetch('/api/guest/data')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            debugLog('📊 Guest data for welcome message:', data);
            if (data.success && data.guest) {
                displayPersonalizedWelcome(data.guest);
            }
        })
        .catch(error => {
            console.error('❌ Error loading guest data for welcome:', error);
        });
}

function displayPersonalizedWelcome(guestData) {
    const welcomeContainer = document.getElementById('personalizedWelcome');
    
    if (!welcomeContainer) {
        console.error('❌ personalized welcome container not found');
        return;
    }
    
    // Bestimme Event-Teile basierend auf Anzahl > 0
    const eventParts = [];
    const isPlural = guestData.Anzahl_Personen > 1;
    const personPronoun = isPlural ? 'euch' : 'dich';
    
    if (guestData.Weisser_Saal > 0) {
        eventParts.push('Trauung im Weißen Saal');
    }
    if (guestData.Anzahl_Essen > 0) {
        eventParts.push('Hochzeitsessen');
    }
    if (guestData.Anzahl_Party > 0) {
        eventParts.push('Hochzeitsfeier');
    }
    
    // Generiere personalisierte Nachricht
    let message = '';
    
    if (eventParts.length === 0) {
        message = `Hier kannst du deine Teilnahme für unsere Hochzeit verwalten und den Hochzeitsablauf einsehen.`;
    } else if (eventParts.length === 1) {
        // Nur ein Event-Teil
        const eventPart = eventParts[0];
        if (eventPart === 'Trauung im Weißen Saal') {
            message = `Wir würden uns sehr freuen ${personPronoun} zu unserer ${eventPart} begrüßen zu dürfen! 💕`;
        } else if (eventPart === 'Hochzeitsessen') {
            message = `Wir freuen uns riesig darauf ${personPronoun} zu unserem Hochzeitsessen einzuladen und gemeinsam zu genießen! 🍽️`;
        } else if (eventPart === 'Hochzeitsfeier') {
            message = `Lasst uns zusammen feiern! Wir können es kaum erwarten ${personPronoun} zu unserer Hochzeitsparty zu begrüßen! 🎉`;
        }
    } else if (eventParts.length === 2) {
        // Zwei Event-Teile
        message = `Wir würden uns sehr freuen ${personPronoun} zu ${eventParts[0]} und ${eventParts[1]} begrüßen zu dürfen! 💕`;
    } else {
        // Alle drei Event-Teile
        message = `Wir würden uns riesig freuen ${personPronoun} den ganzen Tag über bei uns zu haben - von der ${eventParts[0]} über das ${eventParts[1]} bis hin zur ${eventParts[2]}! 💕🎉`;
    }
    
    welcomeContainer.innerHTML = `<p class="mb-0">${message}</p>`;
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

function showInfoMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-info alert-dismissible fade show position-fixed';
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


/**
 * Zeigt das Einladungsmodal an (First Login Modal)
 */
function showInvitationModal() {
    debugLog("🎫 Opening invitation modal...");
    
    // Lade die personalisierte Nachricht und das Foto
    Promise.all([
        loadPersonalizedMessage(),
        loadWeddingPhoto()
    ]).then(() => {
        // Öffne das Modal
        const modal = new bootstrap.Modal(document.getElementById("firstLoginModal"));
        modal.show();
        
        debugLog("✅ Invitation modal opened");
    }).catch(error => {
        console.error("❌ Error loading personalized message for invitation:", error);
        showErrorMessage("Fehler beim Laden der personalisierten Einladung.");
    });
}


/**
 * Lädt die personalisierte Nachricht für das Modal
 */
async function loadPersonalizedMessage() {
    try {
        const response = await fetch("/api/guest/first-login-message");
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.message) {
                const welcomeText = document.getElementById("welcomeText");
                if (welcomeText) {
                    welcomeText.innerHTML = result.message.replace(/\n/g, "<br>");
                    welcomeText.dataset.personalized = "true";
                    debugLog("✅ Personalisierte Nachricht geladen");
                }
                
                // Aktualisiere auch das Datum im Header falls verfügbar
                if (result.wedding_date) {
                    const weddingDateDisplay = document.getElementById("weddingDateDisplay");
                    if (weddingDateDisplay) {
                        // Einfache Datumsformatierung
                        weddingDateDisplay.textContent = result.wedding_date;
                    }
                }
            }
        } else {
            debugLog("⚠️ Personalisierte Nachricht konnte nicht geladen werden, verwende Fallback");
        }
    } catch (error) {
        debugLog("⚠️ Fehler beim Laden der personalisierten Nachricht:", error);
        throw error; // Re-throw für Fehlerbehandlung in showInvitationModal
    }
}


/**
 * Lädt das Hochzeitsfoto für das Modal
 */
async function loadWeddingPhoto() {
    try {
        const response = await fetch("/api/guest/wedding-photo");
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.photo_data) {
                const welcomeImage = document.getElementById("welcomeImage");
                const welcomeImageContainer = document.getElementById("welcomeImageContainer");
                const welcomeImagePlaceholder = document.getElementById("welcomeImagePlaceholder");
                
                if (welcomeImage && welcomeImageContainer && welcomeImagePlaceholder) {
                    // Setze das Foto
                    welcomeImage.src = result.photo_data;
                    
                    // Zeige das Foto, verstecke Placeholder
                    welcomeImageContainer.classList.remove("d-none");
                    welcomeImagePlaceholder.classList.add("d-none");
                    
                    debugLog("✅ Hochzeitsfoto für Einladung geladen");
                }
            } else {
                // Kein Foto verfügbar - zeige Placeholder
                const welcomeImageContainer = document.getElementById("welcomeImageContainer");
                const welcomeImagePlaceholder = document.getElementById("welcomeImagePlaceholder");
                
                if (welcomeImageContainer && welcomeImagePlaceholder) {
                    welcomeImageContainer.classList.add("d-none");
                    welcomeImagePlaceholder.classList.remove("d-none");
                }
                
                debugLog("ℹ️ Kein Hochzeitsfoto verfügbar, verwende Placeholder");
            }
        } else {
            debugLog("⚠️ Hochzeitsfoto konnte nicht geladen werden");
        }
    } catch (error) {
        debugLog("⚠️ Fehler beim Laden des Hochzeitsfotos:", error);
        throw error;
    }
}
