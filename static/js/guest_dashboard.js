/**
 * Guest Dashboard v1.1 - Debug Control
 */

// Debug-Modus - auf false setzen um alle Debug-Ausgaben zu deaktivieren
const DEBUG_GUEST_DASHBOARD = false;

// Debug-Helper-Funktion
function debugLog(...args) {
    if (DEBUG_GUEST_DASHBOARD) {

    }
}

/**
 * Generisches API-Request für Guest Dashboard
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Add cache-busting for GET requests
        let url = endpoint;
        if (!url.startsWith('/api') && !url.startsWith('/settings')) {
            url = `/api${endpoint}`;
        }
        if (!options.method || options.method.toUpperCase() === 'GET') {
            const separator = endpoint.includes('?') ? '&' : '?';
            url += `${separator}_cb=${Date.now()}`;
        }
        
        const response = await fetch(url, {
            ...defaultOptions,
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP Error: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // First Login Check - sofort als erstes prüfen
    checkFirstLogin();
    
    // Tab Navigation Setup für Mobile
    initializeTabNavigation();
    
    loadGuestData();
    loadCompleteZeitplan();
    loadLocationData();
    loadGuestInformationen();
    loadInvitationHeaders(); // Lade konfigurierbare Header-Texte
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
    
    // Event Listener für "Einladung anzeigen" Button in RSVP Success
    const showInvitationBtnInRsvp = document.getElementById('showInvitationBtnInRsvp');
    if (showInvitationBtnInRsvp) {
        showInvitationBtnInRsvp.addEventListener('click', function() {
            showInvitationModal();
        });
    }
    
    // Initialize Bootstrap Tooltips
    initializeTooltips();
});

/**
 * Initialisiert Bootstrap Tooltips
 */
function initializeTooltips() {
    // Alle Elemente mit data-bs-toggle="tooltip" finden und Tooltip aktivieren
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(function(tooltipTriggerEl) {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
    debugLog('✨ Bootstrap Tooltips initialisiert für', tooltipTriggerList.length, 'Elemente');
}

/**
 * Tab Navigation für Mobile Setup
 */
function initializeTabNavigation() {
    debugLog('📱 Initializing tab navigation for mobile experience');
    
    // Bootstrap Tab Events für bessere UX
    const triggerTabList = document.querySelectorAll('#guestDashboardTabs button');
    triggerTabList.forEach(triggerEl => {
        triggerEl.addEventListener('shown.bs.tab', function(event) {
            const targetTab = event.target.getAttribute('data-bs-target');
            debugLog('📱 Tab switched to:', targetTab);
            
            // Bei Location Tab - Karten neu initialisieren falls nötig
            if (targetTab === '#locations-pane') {
                setTimeout(() => {
                    if (typeof initializeOpenStreetMap === 'function') {
                        debugLog('🗺️ Re-initializing maps for location tab');
                        initializeOpenStreetMap();
                    }
                }, 100);
            }
        });
        
        // Touch-optimierte Event-Handler für mobile Geräte
        triggerEl.addEventListener('touchstart', function() {
            this.style.opacity = '0.7';
        });
        
        triggerEl.addEventListener('touchend', function() {
            this.style.opacity = '1';
        });
    });
    
    // Smart Tab Auto-Switch basierend auf RSVP Status
    setTimeout(() => {
        checkAndSwitchToAppropriateTab();
    }, 1000);
}

/**
 * Intelligente Tab-Umschaltung basierend auf Gast-Status
 */
function checkAndSwitchToAppropriateTab() {
    const guestStatus = document.getElementById('guestStatus');
    if (guestStatus && guestStatus.value === 'Zugesagt') {
        // Wenn bereits zugesagt, könnte Zeitplan interessant sein
        debugLog('📱 Guest confirmed - zeitplan could be interesting');
        // Badge/Indikator wurde entfernt - kein Ausrufezeichen mehr
    }
}

// Globale Variable für Location-Daten
let locationsData = null;
// Globale Variable für Gäste-Informationen  
let guestInformationen = null;

function loadLocationData() {
    debugLog('🔄 Loading location data...');
    
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
            
            // Locations in Karten-Cards anzeigen
            displayLocationInfo();
            
            // OpenStreetMap initialisieren
            initializeOpenStreetMap();
        })
        .catch(error => {

            
            // Fallback: Adresse-Felder mit Fehlermeldung füllen
            const standesamtAdresseEl = document.getElementById('standesamtAdresse');
            const hochzeitslocationAdresseEl = document.getElementById('hochzeitslocationAdresse');
            
            if (standesamtAdresseEl) {
                standesamtAdresseEl.textContent = 'Adresse konnte nicht geladen werden';
                standesamtAdresseEl.style.color = '#dc3545';
            }
            if (hochzeitslocationAdresseEl) {
                hochzeitslocationAdresseEl.textContent = 'Adresse konnte nicht geladen werden';
                hochzeitslocationAdresseEl.style.color = '#dc3545';
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
        // Robuste OSM-Initialisierung mit mehreren Versuchen
        let osmReady = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!osmReady && attempts < maxAttempts) {
            attempts++;
            debugLog(`🔄 OSM-Initialisierungsversuch ${attempts}/${maxAttempts}`);
            
            // Prüfe ob OpenStreetMap verfügbar ist
            if (typeof window.openStreetMap === 'undefined') {
                debugLog(`⏳ Warte auf OpenStreetMap-Laden... (Versuch ${attempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                continue;
            }
            
            // Warte auf Leaflet und vollständige Initialisierung
            let leafletWait = 0;
            const maxLeafletWait = 10;
            
            while ((!window.openStreetMap.initialized || typeof L === 'undefined') && leafletWait < maxLeafletWait) {
                debugLog(`⏳ Warte auf Leaflet... (${maxLeafletWait - leafletWait}s verbleibend)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                leafletWait++;
            }
            
            if (leafletWait >= maxLeafletWait) {
                debugLog(`❌ Leaflet-Timeout nach ${maxLeafletWait}s (Versuch ${attempts})`);
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                break;
            }
            
            // Prüfe ob alle erforderlichen Funktionen verfügbar sind
            if (typeof window.openStreetMap.createSimpleLocationMap !== 'function') {
                debugLog(`⏳ OpenStreetMap-Funktionen noch nicht bereit... (Versuch ${attempts})`);
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue;
                }
                break;
            }
            
            debugLog('✅ OpenStreetMap und Leaflet erfolgreich initialisiert');
            osmReady = true;
        }
        
        if (!osmReady) {
            debugLog('❌ OSM-Initialisierung nach allen Versuchen fehlgeschlagen, verwende Fallback');
            initializeFallbackMaps();
            return;
        }
            
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
        } else {
            debugLog('❌ Keine Karten erstellt, verwende Fallback');
            initializeFallbackMaps();
        }
        
        debugLog('✅ OpenStreetMap initialization completed, maps created:', hasAnyMaps);
        
    } catch (error) {
        debugLog('❌ Error during OpenStreetMap initialization:', error);
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
        
        // Längere Wartezeit für Container-Sichtbarkeit
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Prüfe ob Container verfügbar ist
        const mapContainer = document.getElementById(mapContainerId);
        if (!mapContainer) {
            debugLog(`❌ Karten-Container ${mapContainerId} nicht gefunden`);
            showFallbackLocationMap(locationType, locationData);
            return false;
        }
        
        // Robuste OSM-Prüfung mit mehreren Versuchen
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            if (window.openStreetMap && typeof window.openStreetMap.createSimpleLocationMap === 'function' && locationData.adresse) {
                debugLog(`✅ Versuch ${attempts}: Verwende OSM für ${locationType}: ${locationData.adresse}`);
                
                try {
                    let map;
                    
                    // Prüfe ob Parkplätze für diese Location vorhanden sind
                    if (locationData.parkplaetze && locationData.parkplaetze.length > 0) {
                        debugLog(`🅿️ Erstelle Karte mit ${locationData.parkplaetze.length} Parkplätzen für ${locationType}`);
                        
                        if (typeof window.openStreetMap.createLocationMapWithParking === 'function') {
                            map = await window.openStreetMap.createLocationMapWithParking(mapContainerId, locationData);
                        } else {
                            // Fallback auf einfache Karte wenn Parking-Funktion nicht verfügbar
                            map = await window.openStreetMap.createSimpleLocationMap(
                                mapContainerId, 
                                locationData.adresse, 
                                locationData.name
                            );
                        }
                    } else {
                        // Standard-Karte ohne Parkplätze
                        map = await window.openStreetMap.createSimpleLocationMap(
                            mapContainerId, 
                            locationData.adresse, 
                            locationData.name
                        );
                    }
                    
                    if (map) {
                        debugLog(`✅ OSM-Karte für ${locationType} erfolgreich erstellt`);
                        return true;
                    }
                    
                } catch (osmError) {
                    debugLog(`❌ Versuch ${attempts} fehlgeschlagen:`, osmError);
                    
                    if (attempts < maxAttempts) {
                        // Warte vor dem nächsten Versuch
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
            } else {
                debugLog(`⏳ Versuch ${attempts}: OSM noch nicht bereit, warte...`);
                
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
            
            break;
        }

        // Fallback wenn alle OSM-Versuche fehlschlagen
        debugLog(`❌ Alle OSM-Versuche für ${locationType} fehlgeschlagen, verwende Fallback`);
        showFallbackLocationMap(locationType, locationData);
        return false;
        
    } catch (error) {
        debugLog(`❌ Kritischer Fehler bei Kartenerstellung für ${locationType}:`, error);
        showFallbackLocationMap(locationType, locationData);
        return false;
    }
}

function initializeFallbackMaps() {
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
    if (!locationsData || !locationsData.success) {
        debugLog('⚠️ No location data available for display');
        return;
    }
    
    const locations = locationsData.locations || {};
    
    // Standesamt Information in die Karten-Card laden
    if (locations.standesamt && locations.standesamt.adresse) {
        const standesamtNameEl = document.getElementById('standesamtName');
        const standesamtAdresseEl = document.getElementById('standesamtAdresse');
        const standesamtBeschreibungEl = document.getElementById('standesamtBeschreibung');
        
        if (standesamtNameEl) {
            standesamtNameEl.textContent = locations.standesamt.name || 'Standesamt';
        }
        if (standesamtAdresseEl) {
            standesamtAdresseEl.textContent = locations.standesamt.adresse;
        }
        if (standesamtBeschreibungEl && locations.standesamt.beschreibung) {
            standesamtBeschreibungEl.innerHTML = `<i class="bi bi-info-circle me-1" style="color: #d4af37;"></i>${locations.standesamt.beschreibung}`;
        } else if (standesamtBeschreibungEl) {
            standesamtBeschreibungEl.style.display = 'none';
        }
    }
    
    // Hochzeitslocation Information in die Karten-Card laden
    if (locations.hochzeitslocation && locations.hochzeitslocation.adresse) {
        const hochzeitslocationNameEl = document.getElementById('hochzeitslocationName');
        const hochzeitslocationAdresseEl = document.getElementById('hochzeitslocationAdresse');
        const hochzeitslocationBeschreibungEl = document.getElementById('hochzeitslocationBeschreibung');
        
        if (hochzeitslocationNameEl) {
            hochzeitslocationNameEl.textContent = locations.hochzeitslocation.name || 'Hochzeitslocation';
        }
        if (hochzeitslocationAdresseEl) {
            hochzeitslocationAdresseEl.textContent = locations.hochzeitslocation.adresse;
        }
        if (hochzeitslocationBeschreibungEl && locations.hochzeitslocation.beschreibung) {
            hochzeitslocationBeschreibungEl.innerHTML = `<i class="bi bi-info-circle me-1" style="color: #8b7355;"></i>${locations.hochzeitslocation.beschreibung}`;
        } else if (hochzeitslocationBeschreibungEl) {
            hochzeitslocationBeschreibungEl.style.display = 'none';
        }
    }
    
    debugLog('✅ Location info loaded into map cards');
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
                
                // Informationen anzeigen
                displayGuestInformationen();
                
                // Aktualisiere die Plural-Texte nach dem Laden der Informationen
                const personenAnzahlInput = document.getElementById('personenAnzahl');
                if (personenAnzahlInput) {
                    const currentPersonen = parseInt(personenAnzahlInput.max) || parseInt(personenAnzahlInput.value) || 1;
                    updateInformationenTexts(currentPersonen > 1);
                } else {
                    // Fallback: Nutze "mehrere" als Standard
                    updateInformationenTexts(true);
                }
            } else {
                // Fallback anzeigen wenn keine Daten vorhanden
                displayGuestInformationen();
            }
        })
        .catch(error => {

            // Fallback anzeigen bei Fehler
            displayGuestInformationen();
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
        
        // Personenanzahl ermitteln für richtige Textauswahl
        const personenAnzahlInput = document.getElementById('personenAnzahl');
        const isPlural = personenAnzahlInput ? parseInt(personenAnzahlInput.max) > 1 : false;
        
        const kontaktText = isPlural ? 
            (guestInformationen.kontakt.mehrere || 'Bei Fragen könnt ihr euch gerne an uns wenden.') :
            (guestInformationen.kontakt.einzelperson || 'Bei Fragen kannst du dich gerne an uns wenden.');
        
        html += `<div class="alert alert-info">${kontaktText}</div>`;
        
        // WhatsApp-Button hinzufügen falls Nummer vorhanden
        if (guestInformationen.kontakt.whatsapp_nummer) {
            const whatsappNumber = guestInformationen.kontakt.whatsapp_nummer.replace(/[^0-9]/g, '');
            if (whatsappNumber) {
                html += `
                    <div class="text-center mb-3">
                        <a href="https://wa.me/${whatsappNumber}" target="_blank" class="btn btn-success">
                            <i class="bi bi-whatsapp me-2"></i>WhatsApp
                        </a>
                    </div>
                `;
            }
        }
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

// Lade konfigurierbare Einladungsheader
function loadInvitationHeaders() {
    debugLog('🔄 Loading invitation headers...');
    
    fetch('/api/guest/invitation-headers')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Ring-Emojis aktualisieren (nur wenn nicht leer)
                const ringsElement = document.getElementById('invitationRings');
                if (ringsElement) {
                    ringsElement.textContent = data.invitation_rings || '';
                    // Element verstecken wenn leer
                    if (!data.invitation_rings) {
                        ringsElement.style.display = 'none';
                    } else {
                        ringsElement.style.display = '';
                    }
                }
                
                // Einladungsheader aktualisieren (nur wenn nicht leer)
                const headerElement = document.getElementById('invitationHeader');
                if (headerElement) {
                    headerElement.textContent = data.invitation_header || '';
                    // Element verstecken wenn leer
                    if (!data.invitation_header) {
                        headerElement.style.display = 'none';
                    } else {
                        headerElement.style.display = '';
                    }
                }
                
                debugLog('✅ Invitation headers updated:', {
                    rings: data.invitation_rings || '(leer)',
                    header: data.invitation_header || '(leer)'
                });
            }
        })
        .catch(error => {

        });
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

        });
}

function displayPersonalizedWelcome(guestData) {
    const welcomeContainer = document.getElementById('personalizedWelcome');
    
    if (!welcomeContainer) {

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
        // Lade auch die konfigurierbaren Header für das Modal
        loadInvitationHeaders();
        
        // Öffne das Modal
        const modal = new bootstrap.Modal(document.getElementById("firstLoginModal"));
        modal.show();
        
        debugLog("✅ Invitation modal opened");
    }).catch(error => {

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
                    welcomeText.innerHTML = result.message;
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

// Map Navigation Functions
function openInAppleMaps(locationType) {
    debugLog(`🗺️ Opening Apple Maps for ${locationType}`);
    
    if (!locationsData || !locationsData.success) {
        alert('Location-Daten sind noch nicht geladen. Bitte versuche es in einem Moment erneut.');
        return;
    }
    
    const location = locationsData.locations[locationType];
    if (!location || !location.adresse) {
        alert('Adresse für diese Location ist nicht verfügbar.');
        return;
    }
    
    // Apple Maps URL erstellen
    const encodedAddress = encodeURIComponent(location.adresse);
    const appleMapsUrl = `maps://?address=${encodedAddress}`;
    
    // Fallback für Systeme, die Apple Maps nicht unterstützen
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMac = /Mac/.test(navigator.userAgent);
    
    if (isIOS || isMac) {
        window.open(appleMapsUrl, '_blank');
    } else {
        // Fallback zu Google Maps auf anderen Systemen
        openInGoogleMaps(locationType);
    }
}

function openInGoogleMaps(locationType) {
    debugLog(`🗺️ Opening Google Maps for ${locationType}`);
    
    if (!locationsData || !locationsData.success) {
        alert('Location-Daten sind noch nicht geladen. Bitte versuche es in einem Moment erneut.');
        return;
    }
    
    const location = locationsData.locations[locationType];
    if (!location || !location.adresse) {
        alert('Adresse für diese Location ist nicht verfügbar.');
        return;
    }
    
    // Google Maps URL erstellen
    const encodedAddress = encodeURIComponent(location.adresse);
    const googleMapsUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
    
    window.open(googleMapsUrl, '_blank');
}

// Vollständigen Zeitplan für Gäste-Dashboard laden
function loadCompleteZeitplan() {
    debugLog('🔄 Loading complete zeitplan for guest dashboard...');
    
    const zeitplanContainer = document.getElementById('zeitplanComplete');
    
    if (!zeitplanContainer) {
        debugLog('❌ zeitplanComplete container not found');
        return;
    }
    
    fetch('/api/guest/zeitplan')
        .then(response => {
            debugLog('📅 Zeitplan API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            debugLog('📅 Complete zeitplan data received:', data);
            
            // Speichere Locations-Daten für intelligente Location-Funktionalität
            if (data.locations_info) {
                zeitplanLocationsData = data.locations_info;
                debugLog('✅ zeitplanLocationsData loaded:', zeitplanLocationsData);
            }
            
            displayCompleteZeitplan(data);
        })
        .catch(error => {

            
            zeitplanContainer.innerHTML = `
                <div class="alert alert-warning border-0" style="background: linear-gradient(135deg, #fff3cd, #ffeaa7); border-radius: 12px;">
                    <i class="bi bi-exclamation-triangle me-2" style="color: #856404;"></i>
                    <span style="color: #856404;">Zeitplan konnte nicht geladen werden.</span>
                    <br><small style="color: #6c757d;">Fehler: ${error.message}</small>
                </div>
            `;
        });
}

function displayCompleteZeitplan(response) {
    const container = document.getElementById('zeitplanComplete');
    
    if (!container) {

        return;
    }
    
    // Prüfe Response-Struktur
    if (!response || !response.success) {
        container.innerHTML = `
            <div class="alert alert-info border-0" style="background: linear-gradient(135deg, #d1ecf1, #bee5eb); border-radius: 12px;">
                <i class="bi bi-info-circle me-2" style="color: #0c5460;"></i>
                <span style="color: #0c5460;">Zeitplan wird noch erstellt</span>
            </div>
        `;
        return;
    }
    
    const events = response.events || [];
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info border-0" style="background: linear-gradient(135deg, #d1ecf1, #bee5eb); border-radius: 12px;">
                <i class="bi bi-calendar me-2" style="color: #0c5460;"></i>
                <span style="color: #0c5460;">Noch keine Programmpunkte verfügbar</span>
            </div>
        `;
        return;
    }
    
    let html = '<div class="timeline-container">';
    
    events.forEach((event, index) => {
        const startTime = event.uhrzeit || '00:00';
        const title = event.titel || 'Programmpunkt';
        const description = event.beschreibung || '';
        const originalLocation = event.ort || '';
        const duration = event.dauer || '';
        
        // Intelligente Location-Erkennung
        debugLog(`Processing event: ${title}`);
        const locationInfo = getIntelligentLocation(title, originalLocation);
        debugLog('Location info for event:', locationInfo);
        
        // Berechne Endzeit falls Dauer vorhanden
        let endTimeDisplay = '';
        if (duration && startTime !== '00:00') {
            try {
                const [startHour, startMin] = startTime.split(':').map(Number);
                const durationMin = parseInt(duration);
                if (!isNaN(startHour) && !isNaN(startMin) && !isNaN(durationMin)) {
                    const endTime = new Date(0, 0, 0, startHour, startMin + durationMin);
                    endTimeDisplay = ` - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                }
            } catch (e) {
                // Fehler beim Berechnen der Endzeit ignorieren
            }
        }
        
        // Location-Anzeige erstellen
        let locationHtml = '';
        if (locationInfo) {
            if (locationInfo.isClickable) {
                locationHtml = `
                    <div class="d-flex align-items-center mt-2">
                        <i class="bi bi-geo-alt-fill me-2" style="color: #d4af37; font-size: 0.9rem;"></i>
                        <a href="#" class="text-decoration-none" onclick="switchToOrteTab('${locationInfo.type}')" title="Zu Orte-Informationen wechseln">
                            <small style="color: #8b7355; font-weight: 500;">${locationInfo.name}</small>
                            <br><small class="text-muted">${locationInfo.address}</small>
                        </a>
                        <i class="bi bi-box-arrow-up-right ms-2 text-muted" style="font-size: 0.8rem;" title="Mehr Details im Orte-Tab"></i>
                    </div>
                `;
            } else {
                locationHtml = `
                    <div class="d-flex align-items-center mt-2">
                        <i class="bi bi-geo-alt-fill me-2" style="color: #d4af37; font-size: 0.9rem;"></i>
                        <small class="text-muted">${locationInfo.name}</small>
                    </div>
                `;
            }
        }
        
        html += `
            <div class="timeline-item mb-4" style="position: relative; padding-left: 3rem;">
                <!-- Timeline-Punkt -->
                <div class="timeline-point" style="position: absolute; left: 0; top: 0.5rem; width: 2rem; height: 2rem; background: linear-gradient(135deg, #d4af37, #f4e4bc); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);">
                    <i class="bi bi-clock" style="color: #8b7355; font-size: 0.8rem;"></i>
                </div>
                
                <!-- Verbindungslinie -->
                ${index < events.length - 1 ? '<div class="timeline-line" style="position: absolute; left: 0.9rem; top: 2.5rem; bottom: -1rem; width: 2px; background: linear-gradient(to bottom, #d4af37, #f4e4bc);"></div>' : ''}
                
                <!-- Event-Content -->
                <div class="timeline-content card border-0 shadow-sm" style="background: linear-gradient(135deg, #ffffff, #f8f9fa); border-radius: 12px; border: 1px solid #d4af37 !important;">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="mb-0" style="color: #8b7355; font-weight: 600;">
                                ${title}
                            </h6>
                            <span class="badge rounded-pill" style="background: linear-gradient(135deg, #d4af37, #f4e4bc); color: #8b7355; font-weight: 500;">
                                ${startTime}${endTimeDisplay}
                            </span>
                        </div>
                        
                        ${description ? `
                            <p class="text-muted mb-2" style="font-size: 0.9rem; line-height: 1.4;">
                                ${description}
                            </p>
                        ` : ''}
                        
                        ${locationHtml}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Optional: Hochzeitsdatum anzeigen, falls verfügbar
    if (response.wedding_date) {
        const dateHtml = `
            <div class="mb-4 p-3 border-0 rounded" style="background: linear-gradient(135deg, #e8d5a3, #f4e4bc); border-radius: 12px;">
                <div class="text-center">
                    <i class="bi bi-calendar-heart" style="color: #8b7355; font-size: 1.5rem;"></i>
                    <h6 class="mt-2 mb-0" style="color: #8b7355; font-weight: 500;">
                        ${new Date(response.wedding_date).toLocaleDateString('de-DE', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </h6>
                </div>
            </div>
        `;
        html = dateHtml + html;
    }
    
    container.innerHTML = html;
}

// Globale Variablen für intelligente Location-Funktionalität
let zeitplanLocationsData = {};

/**
 * Intelligente Location-Erkennung basierend auf Programmpunkt-Titel
 */
function getIntelligentLocation(programmpunkt, originalOrt) {
    // Debug-Ausgaben
    debugLog('=== getIntelligentLocation Debug ===');
    debugLog('Input parameters:');
    debugLog('  - programmpunkt:', programmpunkt);
    debugLog('  - originalOrt:', originalOrt);
    debugLog('  - zeitplanLocationsData:', zeitplanLocationsData);
    debugLog('  - typeof zeitplanLocationsData:', typeof zeitplanLocationsData);
    debugLog('  - zeitplanLocationsData keys:', Object.keys(zeitplanLocationsData || {}));
    
    // Prüfe ob zeitplanLocationsData verfügbar ist
    if (!zeitplanLocationsData || typeof zeitplanLocationsData !== 'object') {
        debugLog('❌ zeitplanLocationsData not available or not an object');
        if (originalOrt && originalOrt.trim()) {
            debugLog('✅ Using originalOrt as fallback:', originalOrt);
            return {
                name: originalOrt,
                address: originalOrt,
                isClickable: false,
                type: 'custom'
            };
        }
        debugLog('❌ No originalOrt available, returning null');
        return null;
    }
    
    // Bestimmt den Ort basierend auf dem Programmpunkt-Titel
    const titel = programmpunkt.toLowerCase();
    debugLog('Processing titel (lowercase):', titel);
    
    // Trauung → Standesamt
    if (titel.includes('trauung')) {
        debugLog('✅ Trauung detected in titel!');
        debugLog('Checking standesamt data:', zeitplanLocationsData.standesamt);
        
        if (zeitplanLocationsData.standesamt) {
            debugLog('✅ standesamt object exists');
            debugLog('  - name:', zeitplanLocationsData.standesamt.name);
            debugLog('  - adresse:', zeitplanLocationsData.standesamt.adresse);
            
            if (zeitplanLocationsData.standesamt.adresse) {
                debugLog('✅ Using Standesamt address:', zeitplanLocationsData.standesamt.adresse);
                return {
                    name: zeitplanLocationsData.standesamt.name || 'Standesamt',
                    address: zeitplanLocationsData.standesamt.adresse,
                    isClickable: true,
                    type: 'standesamt'
                };
            } else {
                debugLog('❌ standesamt.adresse is empty/null');
            }
        } else {
            debugLog('❌ standesamt object not found in zeitplanLocationsData');
        }
    } else {
        debugLog('❌ "trauung" not found in titel');
    }

    // Sektempfang oder Location → Hochzeitslocation
    if (titel.includes('sektempfang') || titel.includes('location')) {
        debugLog('✅ Sektempfang/Location detected!');
        debugLog('Checking hochzeitslocation data:', zeitplanLocationsData.hochzeitslocation);
        
        if (zeitplanLocationsData.hochzeitslocation) {
            debugLog('✅ hochzeitslocation object exists');
            debugLog('  - name:', zeitplanLocationsData.hochzeitslocation.name);
            debugLog('  - adresse:', zeitplanLocationsData.hochzeitslocation.adresse);
            
            if (zeitplanLocationsData.hochzeitslocation.adresse) {
                debugLog('✅ Using Hochzeitslocation address:', zeitplanLocationsData.hochzeitslocation.adresse);
                return {
                    name: zeitplanLocationsData.hochzeitslocation.name || 'Hochzeitslocation',
                    address: zeitplanLocationsData.hochzeitslocation.adresse,
                    isClickable: true,
                    type: 'hochzeitslocation'
                };
            } else {
                debugLog('❌ hochzeitslocation.adresse is empty/null');
            }
        } else {
            debugLog('❌ hochzeitslocation object not found in zeitplanLocationsData');
        }
    } else {
        debugLog('❌ "sektempfang" or "location" not found in titel');
    }

    // Fallback: Original-Ort verwenden
    if (originalOrt && originalOrt.trim()) {
        debugLog('ℹ️ Using originalOrt as fallback:', originalOrt);
        return {
            name: originalOrt,
            address: originalOrt,
            isClickable: false,
            type: 'custom'
        };
    } else {
        debugLog('❌ originalOrt is empty/null');
    }

    debugLog('❌ No location found - returning null');
    return null;
}

/**
 * Funktion zum Wechseln zum Orte-Tab im Gäste-Dashboard
 */
function switchToOrteTab(locationType) {
    // Versuche zu den Orte-Tabs zu wechseln
    const orteTab = document.querySelector('#locations-tab');
    if (orteTab) {
        // Bootstrap Tab aktivieren
        const tab = new bootstrap.Tab(orteTab);
        tab.show();
        
        // Optional: Zu einem spezifischen Ort scrollen
        setTimeout(() => {
            const targetElement = document.querySelector(`[data-location-type="${locationType}"]`);
            if (targetElement) {
                targetElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }, 300);
    } else {
        // Fallback: Zeige eine Benachrichtigung
        alert('Weitere Informationen zu diesem Ort finden Sie im Orte-Bereich des Dashboards.');
    }
}

