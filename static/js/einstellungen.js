// Einstellungen JavaScript
document.addEventListener('DOMContentLoaded', function() {


    
    const settingsForm = document.getElementById('settingsForm');
    const resetButton = document.getElementById('resetSettings');
    const openMapsBtn = document.getElementById('openMapsBtn');
    const hochzeitsortField = document.getElementById('hochzeitsort');
    const mapsPreviewRow = document.getElementById('mapsPreviewRow');
    const closeMapsPreview = document.getElementById('closeMapsPreview');
    const backupButton = document.getElementById('backupData');
    
    // Einstellungen laden
    loadSettings();
    
    // Event Listeners
    settingsForm.addEventListener('submit', handleSaveSettings);
    resetButton.addEventListener('click', resetSettings);
    
    // Location Adress-Input Event Listeners für Kartenvorschau
    const standesamtAdresse = document.getElementById('standesamtAdresse');
    const hochzeitslocationAdresse = document.getElementById('hochzeitslocationAdresse');
    
    if (standesamtAdresse) {
        standesamtAdresse.addEventListener('input', debounce(() => updateLocationMapPreview('standesamt'), 1000));
        standesamtAdresse.addEventListener('blur', () => updateLocationMapPreview('standesamt'));
    }
    
    if (hochzeitslocationAdresse) {
        hochzeitslocationAdresse.addEventListener('input', debounce(() => updateLocationMapPreview('hochzeitslocation'), 1000));
        hochzeitslocationAdresse.addEventListener('blur', () => updateLocationMapPreview('hochzeitslocation'));
    }
    
    // Legacy Maps Button (falls vorhanden)
    if (openMapsBtn) {
        openMapsBtn.addEventListener('click', openInGoogleMaps);
    }
    if (hochzeitsortField) {
        hochzeitsortField.addEventListener('input', debounce(updateMapPreview, 1000));
        hochzeitsortField.addEventListener('blur', updateMapPreview);
    }
    if (closeMapsPreview) {
        closeMapsPreview.addEventListener('click', hideMapsPreview);
    }
    if (backupButton) {
        backupButton.addEventListener('click', createBackup);
    }
    
    // First Login Modal Event Listeners
    const firstLoginImage = document.getElementById('firstLoginImage');
    const firstLoginImageFile = document.getElementById('firstLoginImageFile');
    const clearUploadedImageBtn = document.getElementById('clearUploadedImage');
    const convertToBlackWhiteBtn = document.getElementById('convertToBlackWhite');
    
    if (firstLoginImage) {
        firstLoginImage.addEventListener('input', updateFirstLoginImagePreview);
        firstLoginImage.addEventListener('blur', updateFirstLoginImagePreview);
    }
    
    if (firstLoginImageFile) {
        firstLoginImageFile.addEventListener('change', handleImageFileUpload);
    }
    
    if (clearUploadedImageBtn) {
        clearUploadedImageBtn.addEventListener('click', clearUploadedImage);
    }
    
    if (convertToBlackWhiteBtn) {
        convertToBlackWhiteBtn.addEventListener('click', convertCurrentImageToBlackWhite);
    }
    
    // First Login Modal Buttons
    const previewFirstLoginModalBtn = document.getElementById('previewFirstLoginModal');
    const resetFirstLoginBtn = document.getElementById('resetFirstLoginForAllGuests');
    
    if (previewFirstLoginModalBtn) {
        previewFirstLoginModalBtn.addEventListener('click', showFirstLoginModalPreview);
    }
    
    if (resetFirstLoginBtn) {
        resetFirstLoginBtn.addEventListener('click', resetFirstLoginForAllGuests);
    }
    
    // Personalisierte Einladungstexte Buttons
    const previewInvitationTextsBtn = document.getElementById('previewInvitationTexts');
    const testInvitationGenerationBtn = document.getElementById('testInvitationGeneration');
    
    if (previewInvitationTextsBtn) {
        previewInvitationTextsBtn.addEventListener('click', showInvitationTextsPreview);
    }
    
    if (testInvitationGenerationBtn) {
        testInvitationGenerationBtn.addEventListener('click', testInvitationGeneration);
    }
    
    // Gäste-Informationen Buttons
    const previewGuestInformationenBtn = document.getElementById('previewGuestInformationen');
    const resetGuestInformationenBtn = document.getElementById('resetGuestInformationen');
    
    if (previewGuestInformationenBtn) {
        previewGuestInformationenBtn.addEventListener('click', showGuestInformationenPreview);
    }
    
    if (resetGuestInformationenBtn) {
        resetGuestInformationenBtn.addEventListener('click', resetGuestInformationenToDefaults);
    }
    
    // Event Listener für Einladungsheader-Felder (Live-Vorschau)
    const invitationHeaderInput = document.getElementById('invitationHeader');
    const invitationRingsInput = document.getElementById('invitationRings');
    
    if (invitationHeaderInput) {
        invitationHeaderInput.addEventListener('input', function() {
            const previewHeader = document.getElementById('previewInvitationHeader');
            if (previewHeader) {
                if (this.value.trim()) {
                    previewHeader.textContent = this.value.trim();
                    previewHeader.style.display = '';
                } else {
                    previewHeader.style.display = 'none';
                }
            }
        });
    }
    
    if (invitationRingsInput) {
        invitationRingsInput.addEventListener('input', function() {
            const previewRings = document.getElementById('previewInvitationRings');
            if (previewRings) {
                if (this.value.trim()) {
                    previewRings.textContent = this.value.trim();
                    previewRings.style.display = '';
                } else {
                    previewRings.style.display = 'none';
                }
            }
        });
    }
    
    // System Info laden
    loadSystemInfo();
});

async function loadSettings() {
    try {
        const response = await fetch('/api/settings/get');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.settings) {
                populateSettingsForm(result.settings);
            } else {

            }
        } else {

        }
    } catch (error) {

    }
}

function populateSettingsForm(settings) {
    // Allgemeine Einstellungen
    if (settings.braut_name) {
        document.getElementById('brautName').value = settings.braut_name;
    }
    if (settings.braeutigam_name) {
        document.getElementById('braeutigamName').value = settings.braeutigam_name;
    }
    
    // E-Mail Adressen für Aufgaben-Benachrichtigungen
    if (settings.braut_email) {
        document.getElementById('brautEmail').value = settings.braut_email;
    }
    if (settings.braeutigam_email) {
        document.getElementById('braeutigamEmail').value = settings.braeutigam_email;
    }
    
    if (settings.hochzeitsdatum) {
        document.getElementById('hochzeitsdatum').value = settings.hochzeitsdatum;
    }
    
    // Neue Locations-Struktur
    if (settings.locations) {
        // Standesamt
        if (settings.locations.standesamt) {
            setInputValue('standesamtName', settings.locations.standesamt.name);
            setInputValue('standesamtAdresse', settings.locations.standesamt.adresse);
            setInputValue('standesamtBeschreibung', settings.locations.standesamt.beschreibung);
        }
        
        // Hochzeitslocation
        if (settings.locations.hochzeitslocation) {
            setInputValue('hochzeitslocationName', settings.locations.hochzeitslocation.name);
            setInputValue('hochzeitslocationAdresse', settings.locations.hochzeitslocation.adresse);
            setInputValue('hochzeitslocationBeschreibung', settings.locations.hochzeitslocation.beschreibung);
        }
    }
    
    // Legacy Hochzeitsort (für Kompatibilität)
    if (settings.hochzeitsort) {
        setInputValue('hochzeitsort', settings.hochzeitsort);
        // Kartenvorschau aktualisieren wenn Hochzeitsort vorhanden
        setTimeout(() => updateMapPreview(), 500);
    }
    
    // First Login Modal Einstellungen
    if (settings.first_login_image) {
        setInputValue('firstLoginImage', settings.first_login_image);
        updateFirstLoginImagePreview(); // Bildvorschau aktualisieren
    }
    
    // First Login Modal Base64 Daten
    if (settings.first_login_image_data) {
        document.getElementById('firstLoginImageData').value = settings.first_login_image_data;
        // Zeige Upload-Tab und Preview für hochgeladenes Bild
        showUploadedImagePreview(settings.first_login_image_data);
    }
    
    if (settings.first_login_text) {
        setInputValue('firstLoginText', settings.first_login_text);
    }
    
    // Einladungsheader und Ring-Emojis
    if (settings.invitation_header) {
        setInputValue('invitationHeader', settings.invitation_header);
    }
    if (settings.invitation_rings) {
        setInputValue('invitationRings', settings.invitation_rings);
    }
    
    // Vorschau sofort aktualisieren
    updateHeaderPreview();
    
    // Personalisierte Einladungstexte
    if (settings.invitation_texts) {
        // Haupttexte
        setInputValue('invitationTextSingular', settings.invitation_texts.singular);
        setInputValue('invitationTextPlural', settings.invitation_texts.plural);
        
        // Event-spezifische Texte
        if (settings.invitation_texts.events) {
            setInputValue('eventTextTrauungSingular', settings.invitation_texts.events.trauung_singular);
            setInputValue('eventTextTrauungPlural', settings.invitation_texts.events.trauung_plural);
            setInputValue('eventTextEssenSingular', settings.invitation_texts.events.essen_singular);
            setInputValue('eventTextEssenPlural', settings.invitation_texts.events.essen_plural);
            setInputValue('eventTextPartySingular', settings.invitation_texts.events.party_singular);
            setInputValue('eventTextPartyPlural', settings.invitation_texts.events.party_plural);
        }
        
        // Spezielle Hinweise
        if (settings.invitation_texts.special_notes) {
            setInputValue('specialNotesWeisserSaalSingular', settings.invitation_texts.special_notes.weisser_saal_singular);
            setInputValue('specialNotesWeisserSaalPlural', settings.invitation_texts.special_notes.weisser_saal_plural);
        }
    }
    
    // Gäste-Informationen laden
    if (settings.gaeste_informationen) {
        // Kontakt-Informationen
        if (settings.gaeste_informationen.kontakt) {
            setInputValue('guestInfoKontaktSingular', settings.gaeste_informationen.kontakt.einzelperson);
            setInputValue('guestInfoKontaktPlural', settings.gaeste_informationen.kontakt.mehrere);
        }
        
        // WhatsApp-Nummer
        if (settings.gaeste_informationen.kontakt && settings.gaeste_informationen.kontakt.whatsapp_nummer) {
            setInputValue('guestInfoWhatsappNummer', settings.gaeste_informationen.kontakt.whatsapp_nummer);
        }
        
        // Geschenke-Informationen
        if (settings.gaeste_informationen.geschenke) {
            setInputValue('guestInfoGeschenkeSingular', settings.gaeste_informationen.geschenke.einzelperson);
            setInputValue('guestInfoGeschenkeePlural', settings.gaeste_informationen.geschenke.mehrere);
        }
        
        // Dresscode-Informationen
        if (settings.gaeste_informationen.dresscode) {
            setInputValue('guestInfoDresscodeSingular', settings.gaeste_informationen.dresscode.einzelperson);
            setInputValue('guestInfoDresscodeePlural', settings.gaeste_informationen.dresscode.mehrere);
        }
    }
    
    // Kartenvorschauen für neue Locations aktualisieren wenn Adressen vorhanden
    setTimeout(() => {
        const standesamtInput = document.getElementById('standesamtAdresse');
        const hochzeitslocationInput = document.getElementById('hochzeitslocationAdresse');
        
        if (standesamtInput && standesamtInput.value.trim()) {
            updateLocationMapPreview('standesamt');
        }
        
        if (hochzeitslocationInput && hochzeitslocationInput.value.trim()) {
            updateLocationMapPreview('hochzeitslocation');
        }
    }, 1000);
}

// Hilfsfunktion zum sicheren Setzen von Input-Werten
function setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element && value) {
        element.value = value;
    }
}

// Hilfsfunktion zum Aktualisieren der Header-Vorschau
function updateHeaderPreview() {
    const invitationHeader = document.getElementById('invitationHeader')?.value?.trim() || '';
    const invitationRings = document.getElementById('invitationRings')?.value?.trim() || '';
    
    const previewHeader = document.getElementById('previewInvitationHeader');
    const previewRings = document.getElementById('previewInvitationRings');
    
    // Header-Vorschau (verstecken wenn leer)
    if (previewHeader) {
        if (invitationHeader) {
            previewHeader.textContent = invitationHeader;
            previewHeader.style.display = '';
        } else {
            previewHeader.style.display = 'none';
        }
    }
    
    // Ring-Vorschau (verstecken wenn leer)
    if (previewRings) {
        if (invitationRings) {
            previewRings.textContent = invitationRings;
            previewRings.style.display = '';
        } else {
            previewRings.style.display = 'none';
        }
    }
}

async function handleSaveSettings(event) {
    event.preventDefault();
    
    // Hilfsfunktion zum sicheren Auslesen von Input-Werten
    function getInputValue(id) {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    }
    
    const formData = {
        braut_name: getInputValue('brautName'),
        braeutigam_name: getInputValue('braeutigamName'),
        braut_email: getInputValue('brautEmail'),
        braeutigam_email: getInputValue('braeutigamEmail'),
        hochzeitsdatum: getInputValue('hochzeitsdatum'),
        
        // Neue Locations-Struktur
        locations: {
            standesamt: {
                name: getInputValue('standesamtName'),
                adresse: getInputValue('standesamtAdresse'),
                beschreibung: getInputValue('standesamtBeschreibung')
            },
            hochzeitslocation: {
                name: getInputValue('hochzeitslocationName'),
                adresse: getInputValue('hochzeitslocationAdresse'),
                beschreibung: getInputValue('hochzeitslocationBeschreibung')
            }
        },
        
        // First Login Modal Einstellungen
        first_login_image: getInputValue('firstLoginImage'),
        first_login_image_data: getInputValue('firstLoginImageData'),
        first_login_text: getInputValue('firstLoginText'),
        
        // Einladungsheader und Ring-Emojis
        invitation_header: getInputValue('invitationHeader'),
        invitation_rings: getInputValue('invitationRings'),
        
        // Personalisierte Einladungstexte
        invitation_texts: {
            singular: getInputValue('invitationTextSingular'),
            plural: getInputValue('invitationTextPlural'),
            events: {
                trauung_singular: getInputValue('eventTextTrauungSingular'),
                trauung_plural: getInputValue('eventTextTrauungPlural'),
                essen_singular: getInputValue('eventTextEssenSingular'),
                essen_plural: getInputValue('eventTextEssenPlural'),
                party_singular: getInputValue('eventTextPartySingular'),
                party_plural: getInputValue('eventTextPartyPlural')
            },
            special_notes: {
                weisser_saal_singular: getInputValue('specialNotesWeisserSaalSingular'),
                weisser_saal_plural: getInputValue('specialNotesWeisserSaalPlural')
            }
        },
        
        // Gäste-Informationen
        gaeste_informationen: {
            kontakt: {
                einzelperson: getInputValue('guestInfoKontaktSingular'),
                mehrere: getInputValue('guestInfoKontaktPlural'),
                whatsapp_nummer: getInputValue('guestInfoWhatsappNummer')
            },
            geschenke: {
                einzelperson: getInputValue('guestInfoGeschenkeSingular'),
                mehrere: getInputValue('guestInfoGeschenkeePlural')
            },
            dresscode: {
                einzelperson: getInputValue('guestInfoDresscodeSingular'),
                mehrere: getInputValue('guestInfoDresscodeePlural')
            }
        },
        
        // Upload-Einstellungen
        upload_enabled: document.getElementById('uploadEnabled')?.checked || false,
        upload_path: getInputValue('uploadPath'),
        upload_max_size_mb: parseInt(getInputValue('uploadMaxSize')) || 50,
        upload_allowed_extensions: getInputValue('uploadAllowedExtensions'),
        
        // Legacy Hochzeitsort für Kompatibilität - verwende hochzeitslocation-Daten
        hochzeitsort: {
            name: getInputValue('hochzeitslocationName'),
            adresse: getInputValue('hochzeitslocationAdresse'),
            beschreibung: getInputValue('hochzeitslocationBeschreibung')
        }
    };
    
    try {
        const response = await fetch('/api/settings/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAlert('Einstellungen erfolgreich gespeichert!', 'success');
        } else {
            showAlert('Fehler beim Speichern: ' + (result.error || 'Unbekannter Fehler'), 'danger');
        }
    } catch (error) {

        showAlert('Fehler beim Speichern der Einstellungen', 'danger');
    }
}

function resetSettings() {
    if (confirm('Möchten Sie wirklich alle Einstellungen zurücksetzen?')) {
        document.getElementById('settingsForm').reset();
    }
}

async function loadSystemInfo() {
    try {
        const response = await fetch('/api/dashboard/stats');
        if (response.ok) {
            const data = await response.json();
            
            // System Info aktualisieren
            document.getElementById('lastUpdate').textContent = new Date().toLocaleString('de-DE');
            
            // Gäste-Anzahl (Personen, nicht Einträge)
            document.getElementById('totalGuests').textContent = data.gaeste?.personen_gesamt || 0;
            
            // Budget-Positionen (Anzahl der Kategorien)
            const budgetCategories = data.budget?.categories ? Object.keys(data.budget.categories).length : 0;
            document.getElementById('totalBudgetItems').textContent = budgetCategories;
        }
    } catch (error) {

    }
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

// OpenStreetMap Integration für Locations
function showLocationOnMap(locationType, inputId) {

    
    const addressInput = document.getElementById(inputId);
    if (!addressInput) {

        showAlert('Input-Element nicht gefunden', 'danger');
        return;
    }
    
    if (!addressInput.value.trim()) {
        showAlert('Bitte gib zuerst eine Adresse ein', 'warning');
        addressInput.focus();
        return;
    }
    

    updateLocationMapPreview(locationType);
}

// Neue Kartenvorschau für Locations mit OpenStreetMap
async function updateLocationMapPreview(locationType) {

    
    const addressInputId = locationType === 'standesamt' ? 'standesamtAdresse' : 'hochzeitslocationAdresse';
    const nameInputId = locationType === 'standesamt' ? 'standesamtName' : 'hochzeitslocationName';
    const mapPreviewId = locationType + 'MapPreview';
    const mapContainerId = locationType + 'Map';
    
    const addressInput = document.getElementById(addressInputId);
    const nameInput = document.getElementById(nameInputId);
    const mapPreview = document.getElementById(mapPreviewId);
    const mapPreviewsSection = document.getElementById('mapPreviewsSection');
    
    if (!addressInput || !mapPreview) {
        return;
    }
    
    const address = addressInput.value.trim();
    const locationName = nameInput ? nameInput.value.trim() : '';
    

    
    if (!address) {
        mapPreview.style.display = 'none';
        // Prüfe ob noch andere Karten angezeigt werden
        checkMapPreviewsVisibility();
        return;
    }

    try {
        // Entferne alte Karte falls vorhanden
        if (window.openStreetMap && window.openStreetMap.maps && window.openStreetMap.maps.has(mapContainerId)) {

            window.openStreetMap.removeMap(mapContainerId);
        }

        // Zeige Karten-Container
        mapPreview.style.display = 'block';
        if (mapPreviewsSection) {
            mapPreviewsSection.style.display = 'block';
        }


        // Warte kurz damit Container sichtbar ist
        await new Promise(resolve => setTimeout(resolve, 200));

        // Prüfe ob OpenStreetMap verfügbar ist
        if (typeof window.openStreetMap === 'undefined') {

            showFallbackMap(mapContainerId, address, locationName);
            return;
        }

        // Erstelle neue Karte

        await window.openStreetMap.createSimpleLocationMap(mapContainerId, address, locationName);


    } catch (error) {

        showFallbackMap(mapContainerId, address, locationName);
    }
}

// Fallback-Karte wenn OpenStreetMap nicht verfügbar
function showFallbackMap(containerId, address, locationName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const fallbackHtml = `
        <div class="d-flex align-items-center justify-content-center bg-light h-100 p-4" style="min-height: 250px;">
            <div class="text-center">
                <i class="bi bi-geo-alt text-primary mb-3" style="font-size: 3rem;"></i>
                <h6 class="mb-2">${locationName || 'Location'}</h6>
                <p class="text-muted mb-3">${address}</p>
                <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}" 
                   target="_blank" 
                   class="btn btn-wedding-primary">
                    <i class="bi bi-map me-2"></i>
                    OpenStreetMap
                </a>
            </div>
        </div>
    `;
    
    container.innerHTML = fallbackHtml;
}

// Prüfe ob Kartenvorschau-Sektion angezeigt werden soll
function checkMapPreviewsVisibility() {
    const standesamtPreview = document.getElementById('standesamtMapPreview');
    const hochzeitslocationPreview = document.getElementById('hochzeitslocationMapPreview');
    const mapPreviewsSection = document.getElementById('mapPreviewsSection');
    
    if (!mapPreviewsSection) return;
    
    const standesamtVisible = standesamtPreview && standesamtPreview.style.display !== 'none';
    const hochzeitslocationVisible = hochzeitslocationPreview && hochzeitslocationPreview.style.display !== 'none';
    
    // Zeige Sektion nur wenn mindestens eine Karte sichtbar ist
    if (standesamtVisible || hochzeitslocationVisible) {
        mapPreviewsSection.style.display = 'block';
        
        // Stelle sicher, dass das Flexbox-Layout korrekt angewendet wird
        const rowElement = mapPreviewsSection.querySelector('.row');
        if (rowElement) {
            rowElement.style.display = 'flex';
            rowElement.style.flexWrap = 'wrap';
            
            // Setze explizite Flexbox-Eigenschaften für col-sm-6 Elemente
            const cols = rowElement.querySelectorAll('.col-sm-6');
            cols.forEach(col => {
                col.style.flex = '0 0 50%';
                col.style.maxWidth = '50%';
            });
        }
        
        // Debug-Log für Layout
        } else {
        mapPreviewsSection.style.display = 'none';

    }
}

// Kartenvorschau ausblenden
function hideMapPreview(locationType) {

    
    const mapPreviewId = locationType + 'MapPreview';
    const mapContainerId = locationType + 'Map';
    const mapPreview = document.getElementById(mapPreviewId);
    
    if (mapPreview) {
        mapPreview.style.display = 'none';

        
        // Entferne Karte aus OpenStreetMap
        if (window.openStreetMap && window.openStreetMap.maps && window.openStreetMap.maps.has(mapContainerId)) {

            window.openStreetMap.removeMap(mapContainerId);
        }
        
        // Prüfe ob andere Karten noch sichtbar sind
        checkMapPreviewsVisibility();
    } else {

    }
}

function openInGoogleMaps() {
    const hochzeitsort = document.getElementById('hochzeitsort').value.trim();
    
    if (!hochzeitsort) {
        showAlert('Bitte geben Sie einen Hochzeitsort ein, bevor Sie die Karte öffnen.', 'warning');
        return;
    }
    
    // URL-encode die Adresse für Google Maps
    const encodedAddress = encodeURIComponent(hochzeitsort);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    
    // In neuem Tab öffnen
    window.open(googleMapsUrl, '_blank');
}

function updateMapPreview() {

    // Diese Funktion ist deaktiviert - OpenStreetMap wird jetzt verwendet
    return;
    
    const hochzeitsort = document.getElementById('hochzeitsort');
    const mapsPreviewRow = document.getElementById('mapsPreviewRow');
    const mapFrame = document.getElementById('mapFrame');
    
    // Prüfe ob Elemente existieren
    if (!hochzeitsort || !mapsPreviewRow || !mapFrame) {

        return;
    }
    
    const ortValue = hochzeitsort.value.trim();
    
    if (!ortValue) {
        hideMapsPreview();
        return;
    }
    
    // Google Maps Embed URL erstellen
    const encodedAddress = encodeURIComponent(ortValue);
    const embedUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dw901SwHHzFbOg&q=${encodedAddress}&zoom=15&maptype=roadmap`;
    
    // Fallback ohne API Key (weniger Features aber funktional)
    const fallbackUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    
    // Verwende Fallback-URL (funktioniert ohne API Key)
    mapFrame.src = fallbackUrl;
    
    // Vorschau anzeigen
    mapsPreviewRow.style.display = 'block';
    
    // Smooth scroll zur Karte
    setTimeout(() => {
        mapsPreviewRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function hideMapsPreview() {
    const mapsPreviewRow = document.getElementById('mapsPreviewRow');
    const mapFrame = document.getElementById('mapFrame');
    
    mapsPreviewRow.style.display = 'none';
    mapFrame.src = ''; // Karte zurücksetzen
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function createBackup() {
    try {
        // Loading-Anzeige
        const originalText = document.getElementById('backupData').innerHTML;
        document.getElementById('backupData').innerHTML = '<i class="bi bi-clock-history me-2"></i>Erstelle Backup...';
        document.getElementById('backupData').disabled = true;
        
        const response = await fetch('/api/backup/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // ZIP-File download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Dateinamen mit Timestamp erstellen
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
            a.download = `hochzeit-backup-${timestamp}.zip`;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Backup erfolgreich erstellt und heruntergeladen!', 'success');
        } else {
            const error = await response.json();
            showAlert('Fehler beim Erstellen des Backups: ' + (error.error || 'Unbekannter Fehler'), 'danger');
        }
    } catch (error) {

        showAlert('Fehler beim Erstellen des Backups', 'danger');
    } finally {
                // Button zurücksetzen
        document.getElementById('backupData').innerHTML = '<i class="bi bi-shield-check me-2"></i>Backup erstellen';
    }
}

// First Login Modal Bildvorschau-Funktionen
function updateFirstLoginImagePreview() {
    const imageInput = document.getElementById('firstLoginImage');
    const imagePreview = document.getElementById('firstLoginImagePreview');
    const imagePlaceholder = document.getElementById('firstLoginImagePlaceholder');
    const imageData = document.getElementById('firstLoginImageData');
    
    if (!imageInput || !imagePreview || !imagePlaceholder) {
        return;
    }
    
    // Prüfe zuerst auf hochgeladene Base64-Daten
    if (imageData && imageData.value.trim()) {
        imagePreview.src = imageData.value;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        return;
    }
    
    const imageUrl = imageInput.value.trim();
    
    if (imageUrl) {
        // Versuche das Bild zu laden
        const tempImg = new Image();
        tempImg.onload = function() {
            // Bild erfolgreich geladen - konvertiere zu Schwarz-Weiß und zeige Vorschau
            convertImageToBlackAndWhite(imageUrl, function(bwBase64Data) {
                // Schwarz-Weiß Version in imageData speichern für das Speichern der Einstellungen
                document.getElementById('firstLoginImageData').value = bwBase64Data;
                
                // Zeige Schwarz-Weiß Vorschau
                imagePreview.src = bwBase64Data;
                imagePreview.style.display = 'block';
                imagePlaceholder.style.display = 'none';
                
                // Zeige Buttons
                document.getElementById('clearUploadedImage').style.display = 'inline-block';
                document.getElementById('convertToBlackWhite').style.display = 'inline-block';
            });
        };
        tempImg.onerror = function() {
            // Bild konnte nicht geladen werden - zeige Placeholder
            imagePreview.style.display = 'none';
            imagePlaceholder.innerHTML = '<i class="bi bi-exclamation-triangle text-warning" style="font-size: 2rem;"></i><br>Bild konnte nicht geladen werden';
            imagePlaceholder.style.display = 'block';
            
            // Verstecke Buttons
            document.getElementById('clearUploadedImage').style.display = 'none';
            document.getElementById('convertToBlackWhite').style.display = 'none';
        };
        // CORS-Probleme vermeiden - versuche direkt zu laden
        tempImg.crossOrigin = 'anonymous';
        tempImg.src = imageUrl;
    } else {
        // Keine URL - zeige Standard-Placeholder
        imagePreview.style.display = 'none';
        imagePlaceholder.innerHTML = '<i class="bi bi-image" style="font-size: 2rem;"></i><br>Keine Bildvorschau verfügbar';
        imagePlaceholder.style.display = 'block';
        
        // Verstecke Buttons wenn kein Bild vorhanden
        document.getElementById('clearUploadedImage').style.display = 'none';
        document.getElementById('convertToBlackWhite').style.display = 'none';
    }
}

// Datei-Upload für Willkommensbild
function handleImageFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    // Dateigröße prüfen (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Fehler: Die Datei ist zu groß. Maximal 5MB sind erlaubt.', 'error');
        event.target.value = '';
        return;
    }
    
    // Dateityp prüfen
    if (!file.type.startsWith('image/')) {
        showToast('Fehler: Nur Bilddateien sind erlaubt.', 'error');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const originalBase64 = e.target.result;
        
        // Bild in Schwarz-Weiß umwandeln
        convertImageToBlackAndWhite(originalBase64, function(bwBase64Data) {
            // Schwarz-Weiß Base64-Daten in Hidden Field speichern
            document.getElementById('firstLoginImageData').value = bwBase64Data;
            
            // URL-Field leeren wenn Datei hochgeladen wird
            document.getElementById('firstLoginImage').value = '';
            
            // Vorschau aktualisieren
            updateFirstLoginImagePreview();
            
            // Buttons zeigen
            document.getElementById('clearUploadedImage').style.display = 'inline-block';
            document.getElementById('convertToBlackWhite').style.display = 'inline-block';
            
            showToast('Bild erfolgreich hochgeladen und in Schwarz-Weiß umgewandelt!', 'success');
        });
    };
    
    reader.onerror = function() {
        showToast('Fehler beim Lesen der Datei.', 'error');
        event.target.value = '';
    };
    
    reader.readAsDataURL(file);
}

// Hochgeladenes Bild löschen
function clearUploadedImage() {
    // Hidden Field leeren
    document.getElementById('firstLoginImageData').value = '';
    
    // File Input leeren
    document.getElementById('firstLoginImageFile').value = '';
    
    // Buttons verstecken
    document.getElementById('clearUploadedImage').style.display = 'none';
    document.getElementById('convertToBlackWhite').style.display = 'none';
    
    // Vorschau aktualisieren
    updateFirstLoginImagePreview();
    
    showToast('Hochgeladenes Bild entfernt.', 'info');
}

// Zeige Vorschau für hochgeladenes Bild (beim Laden der Settings)
function showUploadedImagePreview(base64Data) {
    if (base64Data) {
        // Wechsle zum Upload-Tab
        const uploadTab = document.getElementById('upload-tab');
        const uploadPane = document.getElementById('upload-pane');
        const urlTab = document.getElementById('url-tab');
        const urlPane = document.getElementById('url-pane');
        
        if (uploadTab && uploadPane && urlTab && urlPane) {
            // Aktiviere Upload-Tab
            uploadTab.classList.add('active');
            uploadPane.classList.add('show', 'active');
            
            // Deaktiviere URL-Tab
            urlTab.classList.remove('active');
            urlPane.classList.remove('show', 'active');
        }
        
        // Zeige Buttons
        const clearBtn = document.getElementById('clearUploadedImage');
        const convertBtn = document.getElementById('convertToBlackWhite');
        if (clearBtn) {
            clearBtn.style.display = 'inline-block';
        }
        if (convertBtn) {
            convertBtn.style.display = 'inline-block';
        }
        
        // Aktualisiere Vorschau
        updateFirstLoginImagePreview();
    }
}

/**
 * Zeigt eine Vorschau des First-Login-Modals mit den aktuell konfigurierten Werten
 */
function showFirstLoginModalPreview() {

    
    // Aktuelle Werte aus den Einstellungen holen
    const imageUrl = document.getElementById('firstLoginImage').value.trim();
    const imageData = document.getElementById('firstLoginImageData').value.trim();
    const text = document.getElementById('firstLoginText').value.trim();
    const weddingDate = document.getElementById('hochzeitsdatum').value.trim();
    const invitationHeader = document.getElementById('invitationHeader').value.trim();
    const invitationRings = document.getElementById('invitationRings').value.trim();
    
    // Vorschau-Modal Elemente
    const previewImage = document.getElementById('previewImage');
    const previewImagePlaceholder = document.getElementById('previewImagePlaceholder');
    const previewText = document.getElementById('previewText');
    const previewWeddingDate = document.getElementById('previewWeddingDate');
    const previewInvitationHeader = document.getElementById('previewInvitationHeader');
    const previewInvitationRings = document.getElementById('previewInvitationRings');
    
    // Header-Vorschau aktualisieren
    if (invitationHeader && previewInvitationHeader) {
        previewInvitationHeader.textContent = invitationHeader;
    }
    if (invitationRings && previewInvitationRings) {
        previewInvitationRings.textContent = invitationRings;
    }
    
    // Hochzeitsdatum in der Vorschau anzeigen
    if (weddingDate && previewWeddingDate) {
        const formattedDate = formatWeddingDateForPreview(weddingDate);
        previewWeddingDate.textContent = formattedDate;
    }
    
    // Bild-Vorschau - Priorisiere hochgeladene Bilder über URLs
    if (imageData) {
        // Base64-Bild direkt verwenden
        previewImage.src = imageData;
        previewImage.style.display = 'block';
        previewImagePlaceholder.style.display = 'none';
    } else if (imageUrl) {
        // URL-Bild laden
        const tempImg = new Image();
        tempImg.onload = function() {
            previewImage.src = imageUrl;
            previewImage.style.display = 'block';
            previewImagePlaceholder.style.display = 'none';
        };
        tempImg.onerror = function() {
            previewImage.style.display = 'none';
            previewImagePlaceholder.innerHTML = '<i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i><br>Bild konnte nicht geladen werden';
            previewImagePlaceholder.style.display = 'block';
        };
        tempImg.src = imageUrl;
    } else {
        previewImage.style.display = 'none';
        previewImagePlaceholder.innerHTML = '<i class="bi bi-heart-fill text-muted opacity-50" style="font-size: 4rem;"></i><p class="text-muted mt-2 mb-0">Hochzeitsfoto nicht konfiguriert</p>';
        previewImagePlaceholder.style.display = 'block';
    }
    
    // Text-Vorschau
    if (text) {
        // Text mit Zeilenumbrüchen korrekt anzeigen
        previewText.innerHTML = text.replace(/\n/g, '<br>');
        previewText.classList.remove('text-muted');
    } else {
        previewText.innerHTML = '<em class="text-muted">Text nicht konfiguriert</em>';
        previewText.classList.add('text-muted');
    }
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('firstLoginModalPreview'));
    modal.show();
}

function formatWeddingDateForPreview(dateString) {
    try {
        const date = new Date(dateString);
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}. ${month} ${year}`;
    } catch (error) {

        return dateString || '25. Juli 2026'; // Fallback
    }
}

/**
 * Setzt den First-Login-Status für alle Gäste zurück
 */
async function resetFirstLoginForAllGuests() {

    
    // Bestätigung vom Benutzer einholen
    if (!confirm('Möchten Sie wirklich den First-Login-Status für ALLE Gäste zurücksetzen?\n\nDadurch wird beim nächsten Login aller Gäste wieder das Willkommens-Modal angezeigt.')) {
        return;
    }
    
    try {
        // Loading-Anzeige
        const button = document.getElementById('resetFirstLoginForAllGuests');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Wird zurückgesetzt...';
        button.disabled = true;
        
        const response = await fetch('/api/admin/reset-first-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Success-Toast
            showToast('Erfolg', `First-Login-Status für ${result.count} Gäste erfolgreich zurückgesetzt!`, 'success');
        } else {
            throw new Error(result.message || 'Unbekannter Fehler');
        }
        
    } catch (error) {

        showToast('Fehler', 'Fehler beim Zurücksetzen: ' + error.message, 'danger');
    } finally {
        // Button zurücksetzen
        const button = document.getElementById('resetFirstLoginForAllGuests');
        button.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>First-Login für alle zurücksetzen';
        button.disabled = false;
    }
}

/**
 * Zeigt ein Toast-Notification
 */
function showToast(title, message, type = 'info') {
    // Erstelle Toast-Element falls nicht vorhanden
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    const toastId = 'toast-' + Date.now();
    const iconClass = type === 'success' ? 'bi-check-circle' : 
                     type === 'danger' ? 'bi-exclamation-triangle' : 
                     type === 'warning' ? 'bi-exclamation-circle' : 'bi-info-circle';
    
    const bgClass = `bg-${type}`;
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
            <div class="toast-header ${bgClass} text-white">
                <i class="${iconClass} me-2"></i>
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">${message}</div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Toast anzeigen
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
    toast.show();
    
    // Toast nach dem Ausblenden entfernen
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Konvertiert ein Bild zu Schwarz-Weiß
 * @param {string} imageSource - Base64-kodierte Bilddaten oder Image-URL
 * @param {function} callback - Callback-Funktion die mit den SW-Daten aufgerufen wird
 */
function convertImageToBlackAndWhite(imageSource, callback) {
    const img = new Image();
    
    img.onload = function() {
        // Canvas erstellen
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Canvas-Größe auf Bildgröße setzen
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Bild auf Canvas zeichnen
        ctx.drawImage(img, 0, 0);
        
        // Bilddaten abrufen
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Jedes Pixel zu Graustufen konvertieren
        for (let i = 0; i < data.length; i += 4) {
            const red = data[i];
            const green = data[i + 1];
            const blue = data[i + 2];
            
            // Graustufen-Wert mit gewichteter Formel berechnen
            // Diese Formel berücksichtigt die Hellempfindlichkeit des Auges
            const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
            
            // Alle RGB-Kanäle auf den Graustufen-Wert setzen
            data[i] = gray;     // Rot
            data[i + 1] = gray; // Grün
            data[i + 2] = gray; // Blau
            // Alpha-Kanal (data[i + 3]) bleibt unverändert
        }
        
        // Geänderte Bilddaten zurück auf Canvas setzen
        ctx.putImageData(imageData, 0, 0);
        
        // Canvas zu Base64 konvertieren
        const blackAndWhiteBase64 = canvas.toDataURL('image/jpeg', 0.9);
        
        // Callback mit den Schwarz-Weiß-Daten aufrufen
        callback(blackAndWhiteBase64);
    };
    
    img.onerror = function() {

        showToast('Fehler bei der Bildverarbeitung.', 'error');
        // Fallback: Originalbild verwenden
        callback(imageSource);
    };
    
    // Setze CORS für externe URLs
    if (!imageSource.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
    }
    
    // Bild laden
    img.src = imageSource;
}

/**
 * Konvertiert das aktuell angezeigte Bild zu Schwarz-Weiß
 */
function convertCurrentImageToBlackWhite() {
    const imageData = document.getElementById('firstLoginImageData');
    const imagePreview = document.getElementById('firstLoginImagePreview');
    const imageUrl = document.getElementById('firstLoginImage').value.trim();
    
    let currentImageSource = null;
    
    // Bestimme die aktuelle Bildquelle
    if (imageData && imageData.value.trim()) {
        // Bereits hochgeladenes Bild
        currentImageSource = imageData.value;
    } else if (imageUrl) {
        // URL-Bild
        currentImageSource = imageUrl;
    } else {
        showToast('Kein Bild zum Konvertieren gefunden.', 'warning');
        return;
    }
    
    // Zeige Loading-Zustand
    const convertBtn = document.getElementById('convertToBlackWhite');
    const originalText = convertBtn.innerHTML;
    convertBtn.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i>Konvertiert...';
    convertBtn.disabled = true;
    
    // Konvertiere zu Schwarz-Weiß
    convertImageToBlackAndWhite(currentImageSource, function(bwBase64Data) {
        // Speichere das Schwarz-Weiß-Bild
        document.getElementById('firstLoginImageData').value = bwBase64Data;
        
        // Leere URL-Feld falls es ein URL-Bild war
        if (imageUrl) {
            document.getElementById('firstLoginImage').value = '';
        }
        
        // Aktualisiere Vorschau
        imagePreview.src = bwBase64Data;
        
        // Button zurücksetzen
        convertBtn.innerHTML = originalText;
        convertBtn.disabled = false;
        
        showToast('Bild erfolgreich zu Schwarz-Weiß konvertiert!', 'success');
    });
}

// ===============================================
// Personalisierte Einladungstexte Funktionen
// ===============================================

/**
 * Zeigt eine Vorschau der konfigurierten Einladungstexte
 */
function showInvitationTextsPreview() {

    
    // Aktuelle Werte aus den Einstellungen holen
    const singularText = document.getElementById('invitationTextSingular').value.trim();
    const pluralText = document.getElementById('invitationTextPlural').value.trim();
    
    // Event-spezifische Texte
    const eventTexts = {
        trauung_singular: document.getElementById('eventTextTrauungSingular').value.trim(),
        trauung_plural: document.getElementById('eventTextTrauungPlural').value.trim(),
        essen_singular: document.getElementById('eventTextEssenSingular').value.trim(),
        essen_plural: document.getElementById('eventTextEssenPlural').value.trim(),
        party_singular: document.getElementById('eventTextPartySingular').value.trim(),
        party_plural: document.getElementById('eventTextPartyPlural').value.trim()
    };
    
    // Spezielle Hinweise
    const specialNotes = {
        weisser_saal_singular: document.getElementById('specialNotesWeisserSaalSingular').value.trim(),
        weisser_saal_plural: document.getElementById('specialNotesWeisserSaalPlural').value.trim()
    };
    
    // Modal-Inhalt erstellen
    let modalContent = `
        <div class="modal fade" id="invitationPreviewModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-envelope-heart me-2"></i>
                            Vorschau: Personalisierte Einladungstexte
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-primary">
                                    <i class="bi bi-person me-1"></i>
                                    Singular (Eine Person)
                                </h6>
                                <div class="border rounded p-3 bg-light mb-4" style="min-height: 200px;">
                                    <pre style="white-space: pre-wrap; font-family: inherit;">${singularText || '<em class="text-muted">Nicht konfiguriert</em>'}</pre>
                                </div>
                                
                                <h6 class="text-secondary">Event-Texte (Singular)</h6>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Trauung:</strong> ${eventTexts.trauung_singular || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Essen:</strong> ${eventTexts.essen_singular || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Party:</strong> ${eventTexts.party_singular || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Weißer Saal Hinweis:</strong> ${specialNotes.weisser_saal_singular || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <h6 class="text-primary">
                                    <i class="bi bi-people me-1"></i>
                                    Plural (Mehrere Personen)
                                </h6>
                                <div class="border rounded p-3 bg-light mb-4" style="min-height: 200px;">
                                    <pre style="white-space: pre-wrap; font-family: inherit;">${pluralText || '<em class="text-muted">Nicht konfiguriert</em>'}</pre>
                                </div>
                                
                                <h6 class="text-secondary">Event-Texte (Plural)</h6>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Trauung:</strong> ${eventTexts.trauung_plural || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Essen:</strong> ${eventTexts.essen_plural || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Party:</strong> ${eventTexts.party_plural || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                                <div class="border rounded p-2 mb-2">
                                    <strong>Weißer Saal Hinweis:</strong> ${specialNotes.weisser_saal_plural || '<em class="text-muted">Nicht konfiguriert</em>'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Schließen</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Entferne existierendes Modal
    const existingModal = document.getElementById('invitationPreviewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('invitationPreviewModal'));
    modal.show();
}

/**
 * Testet die Template-Generierung mit Beispieldaten
 */
async function testInvitationGeneration() {

    
    const button = document.getElementById('testInvitationGeneration');
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Teste...';
    button.disabled = true;
    
    try {
        // Einfache Testdaten - nur Singular und Plural mit Vollprogramm
        const testCases = [
            {
                category: "👤 Einzelgast (wie Gäste es sehen würden)",
                name: "Max Mustermann",
                anzahl_personen: 1,
                weisser_saal: 1,
                anzahl_essen: 1,
                anzahl_party: 1
            },
            {
                category: "👥 Mehrere Gäste (wie Gäste es sehen würden)",
                name: "Familie Müller", 
                anzahl_personen: 3,
                weisser_saal: 3,
                anzahl_essen: 3,
                anzahl_party: 3
            }
        ];
        
        // Teste die Generierung für jeden Fall
        const results = [];
        for (const testCase of testCases) {
            const response = await fetch('/api/admin/test-invitation-generation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testCase)
            });
            
            if (response.ok) {
                const result = await response.json();
                results.push({
                    testCase,
                    result: result.success ? result.message : result.error
                });
            } else {
                results.push({
                    testCase,
                    result: 'Fehler beim Testen'
                });
            }
        }
        
        // Ergebnisse in Modal anzeigen
        showTestResults(results);
        
    } catch (error) {

        showToast('Fehler beim Testen der Template-Generierung', 'danger');
    } finally {
        // Button zurücksetzen
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

/**
 * Lädt das aktuelle Hochzeitsdatum aus den Einstellungen
 */
function getCurrentWeddingDate() {
    try {
        // Versuche das Datum aus dem DOM zu lesen (falls bereits geladen)
        const dateInput = document.getElementById('hochzeitsdatum');
        if (dateInput && dateInput.value) {
            const date = new Date(dateInput.value);
            return date.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });
        }
        
        // Fallback auf Standarddatum
        return '25. Juli 2026';
    } catch (error) {

        return '25. Juli 2026';
    }
}

/**
 * Generiert das HTML für das Hochzeitsfoto (exakt wie im Gäste-Dashboard)
 */
function generateWeddingPhotoHtml(photoData, photoUrl, index) {
    // Priorisiere Base64-Daten über URL (genau wie im echten Modal)
    if (photoData && photoData.trim()) {
        return `
            <div id="welcomeImageContainer_${index}">
                <img src="${photoData.trim()}" alt="Hochzeitsfoto" class="img-fluid shadow-lg" 
                     style="max-height: 200px; max-width: 100%; object-fit: cover; border-radius: 10px; border: 3px solid #f8f9fa;">
            </div>
        `;
    } else if (photoUrl && photoUrl.trim()) {
        return `
            <div id="welcomeImageContainer_${index}">
                <img src="${photoUrl.trim()}" alt="Hochzeitsfoto" class="img-fluid shadow-lg" 
                     style="max-height: 200px; max-width: 100%; object-fit: cover; border-radius: 10px; border: 3px solid #f8f9fa;">
            </div>
        `;
    } else {
        // Kein Bild - zeige Placeholder (wie im echten Modal)
        return `
            <div class="photo-placeholder p-2" style="background: linear-gradient(45deg, #f8f9fa, #e9ecef); border-radius: 10px; border: 2px dashed #d4af37;">
                <i class="bi bi-heart-fill text-muted opacity-50" style="font-size: 2rem;"></i>
                <p class="text-muted mt-1 mb-0 small">Hochzeitsfoto</p>
            </div>
        `;
    }
}

/**
 * Zeigt die Test-Ergebnisse in einem Modal an
 */
function showTestResults(results) {
    // Lade das echte Hochzeitsfoto aus den Einstellungen
    const weddingPhotoDataElement = document.getElementById('firstLoginImageData');
    const weddingPhotoUrlElement = document.getElementById('firstLoginImage');
    
    const weddingPhotoData = weddingPhotoDataElement ? weddingPhotoDataElement.value.trim() : '';
    const weddingPhotoUrl = weddingPhotoUrlElement ? weddingPhotoUrlElement.value.trim() : '';
    
    let modalContent = `
        <div class="modal fade" id="testResultsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-envelope-heart me-2"></i>
                            Einladungsvorschau - Genauso wie Gäste sie sehen
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
    `;
    
    // Hochzeitsdatum für die Vorschau laden
    const weddingDate = getCurrentWeddingDate();
    
    results.forEach((item, index) => {
        const testCase = item.testCase;
        const isPrimary = index === 0;
        const colClass = results.length > 1 ? 'col-lg-6' : 'col-12';
        
        modalContent += `
            <div class="${colClass} mb-4">
                <div class="card border-0 shadow-lg h-100">
                    <div class="card-header text-center py-2" style="background: linear-gradient(135deg, #d4af37, #f4e4bc); border: none;">
                        <small class="text-dark fw-bold">
                            <i class="bi bi-${isPrimary ? 'person' : 'people'} me-1"></i>
                            ${testCase.category}
                        </small>
                    </div>
                    <div class="card-body p-0">
                        <!-- EXAKTE NACHBILDUNG DES GUEST DASHBOARD MODALS -->
                        <div class="modal-content border-0 shadow-lg" style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);">
                            <div class="modal-body p-0">
                                <div class="invitation-card text-center p-4" style="background: #ffffff; border-radius: 15px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
                                    
                                    <!-- Hochzeitsdatum oben -->
                                    <div class="wedding-date mb-3">
                                        <h5 class="text-elegant mb-2" style="font-family: 'Playfair Display', serif; font-weight: 300; color: #8b7355; letter-spacing: 2px;">
                                            ${weddingDate}
                                        </h5>
                                        <hr class="elegant-divider mx-auto" style="width: 120px; height: 2px; background: linear-gradient(90deg, transparent, #d4af37, transparent); border: none;">
                                    </div>
                                    
                                    <!-- Foto Bereich (exakt wie im Gäste-Dashboard) -->
                                    <div class="wedding-photo mb-3">
                                        ${generateWeddingPhotoHtml(weddingPhotoData, weddingPhotoUrl, index)}
                                    </div>
                                    
                                    <!-- Trennstrich unter dem Foto -->
                                    <hr class="elegant-divider mx-auto mb-3" style="width: 120px; height: 2px; background: linear-gradient(90deg, transparent, #d4af37, transparent); border: none;">
                                    
                                    <!-- Header Emojis -->
                                    <div class="rings-emoji mb-3">
                                        <span id="testInvitationRings-${index}" style="font-size: 2rem; display: none;"></span>
                                    </div>
                                    
                                    <!-- Einladungstext -->
                                    <div class="invitation-text">
                                        <h6 id="testInvitationHeader-${index}" class="text-elegant mb-3" style="font-family: 'Playfair Display', serif; font-weight: 400; color: #8b7355; display: none;">
                                        </h6>
                                        <div class="text-content mx-auto" 
                                             style="font-family: 'Crimson Text', serif; font-size: 0.95rem; line-height: 1.6; color: #5a5a5a; max-width: 300px;">
                                            ${item.result}
                                        </div>
                                    </div>
                                    
                                    <!-- Weiter Button (kleiner für Vorschau) -->
                                    <div class="mt-4">
                                        <button type="button" class="btn btn-elegant btn-sm px-4 py-2 rounded-pill shadow-sm" 
                                                style="background: linear-gradient(135deg, #d4af37, #f4e4bc); border: none; color: #8b7355; font-weight: 500; letter-spacing: 1px; font-size: 0.8rem;">
                                            ✨ Zur Hochzeitswebsite ✨
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    modalContent += `
                        </div>
                        <div class="alert alert-success mt-3">
                            <i class="bi bi-check-circle me-2"></i>
                            <strong>Perfekt!</strong> Diese Vorschau zeigt die Einladungen <strong>exakt so</strong>, wie sie Gäste im Dashboard sehen - 
                            mit dem gleichen Design, der gleichen Formatierung und den gleichen Farben.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Schließen</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Entferne existierendes Modal
    const existingModal = document.getElementById('testResultsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Füge neues Modal hinzu
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('testResultsModal'));
    modal.show();
    
    // Nach dem Anzeigen des Modals: Header-Werte aus den Eingabefeldern aktualisieren
    const invitationHeader = document.getElementById('invitationHeader').value.trim();
    const invitationRings = document.getElementById('invitationRings').value.trim();
    
    // Aktualisiere die Header in allen Test-Karten
    results.forEach((item, index) => {
        const headerElement = document.getElementById(`testInvitationHeader-${index}`);
        const ringsElement = document.getElementById(`testInvitationRings-${index}`);
        
        if (headerElement && invitationHeader) {
            headerElement.textContent = invitationHeader;
            headerElement.style.display = 'block';
        }
        if (ringsElement && invitationRings) {
            ringsElement.textContent = invitationRings;
            ringsElement.style.display = 'block';
        }
    });
}

/**
 * Zeigt eine Vorschau der Gäste-Informationen an
 */
function showGuestInformationenPreview() {
    // Sammle die Daten aus dem Formular
    const kontaktSingular = document.getElementById('guestInfoKontaktSingular').value.trim() || 'Bei Fragen kannst du dich gerne an uns wenden.';
    const kontaktPlural = document.getElementById('guestInfoKontaktPlural').value.trim() || 'Bei Fragen könnt ihr euch gerne an uns wenden.';
    const whatsappNummer = document.getElementById('guestInfoWhatsappNummer').value.trim();
    
    const geschenkeSingular = document.getElementById('guestInfoGeschenkeSingular').value.trim() || 'Über dein Kommen freuen wir uns am meisten!';
    const geschenkePlural = document.getElementById('guestInfoGeschenkeePlural').value.trim() || 'Über euer Kommen freuen wir uns am meisten!';
    
    const dresscodeSingular = document.getElementById('guestInfoDresscodeSingular').value.trim() || 'Festliche Kleidung erwünscht.';
    const dresscodePlural = document.getElementById('guestInfoDresscodeePlural').value.trim() || 'Festliche Kleidung erwünscht.';
    
    // Modal erstellen
    const modalContent = `
        <div class="modal fade" id="guestInfoPreviewModal" tabindex="-1" aria-labelledby="guestInfoPreviewModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title" id="guestInfoPreviewModalLabel">
                            <i class="bi bi-info-circle me-2"></i>
                            Vorschau: Gäste-Informationen
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info mb-4">
                            <i class="bi bi-info-circle me-2"></i>
                            Diese Informationen werden im "Infos"-Bereich des Gästedashboards angezeigt.
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Einzelpersonen (Singular)</h6>
                                <div class="card bg-light">
                                    <div class="card-body">
                                        <h6><i class="bi bi-envelope me-2"></i>Kontakt</h6>
                                        <div class="alert alert-info">${kontaktSingular}</div>
                                        
                                        <h6><i class="bi bi-gift me-2"></i>Geschenke</h6>
                                        <div class="alert alert-success">${geschenkeSingular}</div>
                                        
                                        <h6><i class="bi bi-person-check me-2"></i>Dresscode</h6>
                                        <div class="alert alert-warning">${dresscodeSingular}</div>
                                        
                                        ${whatsappNummer ? `
                                        <div class="text-center mt-3">
                                            <a href="https://wa.me/${whatsappNummer.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-wedding-success">
                                                <i class="bi bi-whatsapp me-2"></i>WhatsApp
                                            </a>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <h6>Mehrere Personen (Plural)</h6>
                                <div class="card bg-light">
                                    <div class="card-body">
                                        <h6><i class="bi bi-envelope me-2"></i>Kontakt</h6>
                                        <div class="alert alert-info">${kontaktPlural}</div>
                                        
                                        <h6><i class="bi bi-gift me-2"></i>Geschenke</h6>
                                        <div class="alert alert-success">${geschenkePlural}</div>
                                        
                                        <h6><i class="bi bi-person-check me-2"></i>Dresscode</h6>
                                        <div class="alert alert-warning">${dresscodePlural}</div>
                                        
                                        ${whatsappNummer ? `
                                        <div class="text-center mt-3">
                                            <a href="https://wa.me/${whatsappNummer.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-wedding-success">
                                                <i class="bi bi-whatsapp me-2"></i>WhatsApp
                                            </a>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${whatsappNummer ? `
                        <div class="alert alert-success mt-3">
                            <i class="bi bi-whatsapp me-2"></i>
                            <strong>WhatsApp aktiviert!</strong> WhatsApp-Nummer: ${whatsappNummer}
                        </div>
                        ` : `
                        <div class="alert alert-warning mt-3">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            <strong>WhatsApp nicht konfiguriert</strong> - Tragen Sie eine Nummer ein, um den WhatsApp-Button zu aktivieren.
                        </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Schließen</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    const modal = new bootstrap.Modal(document.getElementById('guestInfoPreviewModal'));
    modal.show();
    
    modal._element.addEventListener('hidden.bs.modal', function () {
        document.getElementById('guestInfoPreviewModal').remove();
    });
}

/**
 * Setzt die Gäste-Informationen auf Standardwerte zurück
 */
function resetGuestInformationenToDefaults() {
    if (!confirm('Möchten Sie wirklich alle Gäste-Informationen auf die Standardwerte zurücksetzen?')) {
        return;
    }
    
    // Standardwerte setzen
    document.getElementById('guestInfoKontaktSingular').value = 'Bei Fragen kannst du dich gerne an uns wenden.';
    document.getElementById('guestInfoKontaktPlural').value = 'Bei Fragen könnt ihr euch gerne an uns wenden.';
    document.getElementById('guestInfoWhatsappNummer').value = '';
    
    document.getElementById('guestInfoGeschenkeSingular').value = 'Über dein Kommen freuen wir uns am meisten!';
    document.getElementById('guestInfoGeschenkeePlural').value = 'Über euer Kommen freuen wir uns am meisten!';
    
    document.getElementById('guestInfoDresscodeSingular').value = 'Festliche Kleidung erwünscht.';
    document.getElementById('guestInfoDresscodeePlural').value = 'Festliche Kleidung erwünscht.';
    
    showToast('Erfolg', 'Gäste-Informationen wurden auf die Standardwerte zurückgesetzt.', 'success');
}

// ============================
// Upload-Einstellungen
// ============================

/**
 * Lädt die Upload-Einstellungen und füllt die Formularfelder
 */
async function loadUploadSettings() {
    try {
        const response = await fetch('/api/upload-config');
        if (response.ok) {
            const config = await response.json();
            
            // Formularfelder füllen
            const uploadEnabled = document.getElementById('uploadEnabled');
            const uploadPath = document.getElementById('uploadPath');
            const uploadMaxSize = document.getElementById('uploadMaxSize');
            const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
            
            if (uploadEnabled) uploadEnabled.checked = config.upload_enabled !== false;
            if (uploadPath) uploadPath.value = config.upload_path || '';
            if (uploadMaxSize) uploadMaxSize.value = config.max_size_mb || 50;
            if (uploadAllowedExtensions) uploadAllowedExtensions.value = config.allowed_extensions || 'jpg,jpeg,png,gif,mp4,mov,avi';
            

        }
    } catch (error) {

    }
}

/**
 * Öffnet Ordner-Auswahl für Upload-Pfad
 */
function selectUploadFolder() {
    // Hinweis anzeigen, da direkte Ordnerauswahl im Browser nicht möglich ist
    showToast('Hinweis', 'Bitte geben Sie den gewünschten Upload-Pfad manuell ein. Der Pfad wird automatisch erstellt, falls er nicht existiert.', 'info');
    
    // Fokus auf Upload-Pfad-Feld setzen
    const uploadPath = document.getElementById('uploadPath');
    if (uploadPath) {
        uploadPath.focus();
    }
}

/**
 * Testet den Upload-Pfad
 */
async function testUploadPath() {
    const uploadPath = document.getElementById('uploadPath');
    if (!uploadPath || !uploadPath.value.trim()) {
        showToast('Warnung', 'Bitte geben Sie erst einen Upload-Pfad ein.', 'warning');
        return;
    }
    
    try {
        // Simuliere Pfad-Test (in echter Implementierung würde das der Server machen)
        showToast('Test', 'Upload-Pfad wird getestet...', 'info');
        
        // Hier könnte eine API-Route zum Testen des Pfads aufgerufen werden
        setTimeout(() => {
            showToast('Erfolg', 'Upload-Pfad ist gültig und wird bei Bedarf erstellt.', 'success');
        }, 1000);
        
    } catch (error) {

        showToast('Fehler', 'Fehler beim Testen des Upload-Pfads.', 'danger');
    }
}

/**
 * Setzt die Upload-Einstellungen auf Standardwerte zurück
 */
function resetUploadSettings() {
    if (!confirm('Möchten Sie wirklich alle Upload-Einstellungen auf die Standardwerte zurücksetzen?')) {
        return;
    }
    
    const uploadEnabled = document.getElementById('uploadEnabled');
    const uploadPath = document.getElementById('uploadPath');
    const uploadMaxSize = document.getElementById('uploadMaxSize');
    const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
    
    if (uploadEnabled) uploadEnabled.checked = true;
    if (uploadPath) uploadPath.value = '';
    if (uploadMaxSize) uploadMaxSize.value = 50;
    if (uploadAllowedExtensions) uploadAllowedExtensions.value = 'jpg,jpeg,png,gif,mp4,mov,avi';
    
    showToast('Erfolg', 'Upload-Einstellungen wurden auf die Standardwerte zurückgesetzt.', 'success');
}

/**
 * Validiert die Upload-Einstellungen
 */
function validateUploadSettings() {
    const uploadMaxSize = document.getElementById('uploadMaxSize');
    const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
    
    let isValid = true;
    const errors = [];
    
    // Maximale Dateigröße prüfen
    if (uploadMaxSize) {
        const maxSize = parseInt(uploadMaxSize.value);
        if (isNaN(maxSize) || maxSize < 1 || maxSize > 1000) {
            errors.push('Die maximale Dateigröße muss zwischen 1 und 1000 MB liegen.');
            isValid = false;
        }
    }
    
    // Erlaubte Erweiterungen prüfen
    if (uploadAllowedExtensions) {
        const extensions = uploadAllowedExtensions.value.trim();
        if (!extensions) {
            errors.push('Mindestens eine Dateierweiterung muss erlaubt sein.');
            isValid = false;
        } else {
            // Validiere Erweiterungen-Format
            const extensionList = extensions.split(',').map(ext => ext.trim().toLowerCase());
            const validExtensions = /^[a-z0-9]+$/;
            
            for (const ext of extensionList) {
                if (!validExtensions.test(ext)) {
                    errors.push(`Ungültige Dateierweiterung: "${ext}". Nur Buchstaben und Zahlen sind erlaubt.`);
                    isValid = false;
                    break;
                }
            }
        }
    }
    
    if (!isValid) {
        showToast('Validierungsfehler', errors.join('<br>'), 'danger');
    }
    
    return isValid;
}

// Event Listener für Upload-Einstellungen hinzufügen
document.addEventListener('DOMContentLoaded', function() {
    // Upload-Einstellungen laden
    loadUploadSettings();
    
    // Event Listener für Upload-Buttons
    const selectUploadFolderBtn = document.getElementById('selectUploadFolder');
    const testUploadPathBtn = document.getElementById('testUploadPath');
    const resetUploadBtn = document.getElementById('resetUploadSettings');
    
    if (selectUploadFolderBtn) {
        selectUploadFolderBtn.addEventListener('click', selectUploadFolder);
    }
    
    if (testUploadPathBtn) {
        testUploadPathBtn.addEventListener('click', testUploadPath);
    }
    
    if (resetUploadBtn) {
        resetUploadBtn.addEventListener('click', resetUploadSettings);
    }
    
    // Validierung bei Eingabe
    const uploadMaxSize = document.getElementById('uploadMaxSize');
    const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
    
    if (uploadMaxSize) {
        uploadMaxSize.addEventListener('blur', validateUploadSettings);
    }
    
    if (uploadAllowedExtensions) {
        uploadAllowedExtensions.addEventListener('blur', validateUploadSettings);
    }
});

// Upload-Einstellungen auch beim Speichern der Haupteinstellungen mit einbeziehen
document.addEventListener('DOMContentLoaded', function() {
    // Upload-Einstellungen laden
    loadUploadSettings();
    
    // Event Listener für Upload-Buttons
    const selectUploadFolderBtn = document.getElementById('selectUploadFolder');
    const testUploadPathBtn = document.getElementById('testUploadPath');
    const resetUploadBtn = document.getElementById('resetUploadSettings');
    
    if (selectUploadFolderBtn) {
        selectUploadFolderBtn.addEventListener('click', selectUploadFolder);
    }
    
    if (testUploadPathBtn) {
        testUploadPathBtn.addEventListener('click', testUploadPath);
    }
    
    if (resetUploadBtn) {
        resetUploadBtn.addEventListener('click', resetUploadSettings);
    }
    
    // Validierung bei Eingabe
    const uploadMaxSize = document.getElementById('uploadMaxSize');
    const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
    
    if (uploadMaxSize) {
        uploadMaxSize.addEventListener('blur', validateUploadSettings);
    }
    
    if (uploadAllowedExtensions) {
        uploadAllowedExtensions.addEventListener('blur', validateUploadSettings);
    }
    
    // Original handleSaveSettings erweitern für Upload-Einstellungen
    const originalForm = document.getElementById('settingsForm');
    if (originalForm) {
        originalForm.addEventListener('submit', function(event) {
            // Upload-Einstellungen validieren
            if (!validateUploadSettings()) {
                event.preventDefault();
                return;
            }
            
            // Upload-Einstellungen zu FormData hinzufügen wird automatisch durch name-Attribute gemacht
        });
    }
});

// ============================
// Upload-Pfad Browser Funktionen
// ============================

let currentBrowserPath = '';

function selectUploadFolder() {
    openDirectoryBrowser();
}

function openDirectoryBrowser() {
    // Modal für Verzeichnis-Browser erstellen
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'directoryBrowserModal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">📁 Upload-Verzeichnis auswählen</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Aktueller Pfad:</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="currentPath" readonly>
                            <button class="btn btn-outline-secondary" type="button" onclick="refreshBrowser()">
                                🔄 Aktualisieren
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label mb-0">Verzeichnisse:</label>
                            <button class="btn btn-sm btn-success" onclick="showCreateDirectoryForm()">
                                ➕ Neuer Ordner
                            </button>
                        </div>
                        
                        <!-- Neuer Ordner erstellen Form (versteckt) -->
                        <div id="createDirectoryForm" class="alert alert-info d-none">
                            <div class="input-group input-group-sm">
                                <input type="text" class="form-control" id="newDirectoryName" placeholder="Ordnername eingeben...">
                                <button class="btn btn-wedding-success" onclick="createNewDirectory()">Erstellen</button>
                                <button class="btn btn-wedding-secondary" onclick="hideCreateDirectoryForm()">Abbrechen</button>
                            </div>
                        </div>
                        
                        <div id="directoryList" class="border rounded p-2" style="height: 300px; overflow-y: auto;">
                            <div class="text-center p-4">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Lade...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="d-flex justify-content-between w-100">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Abbrechen</button>
                        <button type="button" class="btn btn-wedding-primary" onclick="selectCurrentPath()">
                            ✅ Diesen Pfad verwenden
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Modal anzeigen
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Event Listener für Modal schließen
    modal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modal);
    });
    
    // Start mit Home-Verzeichnis
    loadDirectoryContents('');
}

async function loadDirectoryContents(path) {
    try {
        const response = await fetch('/api/admin/browse-directories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: path })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentBrowserPath = result.current_path;
            document.getElementById('currentPath').value = currentBrowserPath;
            
            const directoryList = document.getElementById('directoryList');
            directoryList.innerHTML = '';
            
            // Verzeichnisse anzeigen
            result.directories.forEach(dir => {
                const item = document.createElement('div');
                item.className = 'p-2 border-bottom directory-item';
                item.style.cursor = 'pointer';
                
                let icon = '📁';
                if (dir.type === 'parent') {
                    icon = '⬆️';
                }
                
                item.innerHTML = `
                    <div class="d-flex align-items-center">
                        <span class="me-2">${icon}</span>
                        <span>${dir.name}</span>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    loadDirectoryContents(dir.path);
                });
                
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = '#f8f9fa';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = '';
                });
                
                directoryList.appendChild(item);
            });
            
            if (result.directories.length === 0) {
                directoryList.innerHTML = '<div class="text-muted text-center p-3">Keine Unterverzeichnisse gefunden</div>';
            }
            
        } else {

            const directoryList = document.getElementById('directoryList');
            directoryList.innerHTML = `<div class="text-danger p-3">❌ ${result.error}</div>`;
        }
        
    } catch (error) {

        const directoryList = document.getElementById('directoryList');
        directoryList.innerHTML = '<div class="text-danger p-3">❌ Fehler beim Laden der Verzeichnisse</div>';
    }
}

function refreshBrowser() {
    loadDirectoryContents(currentBrowserPath);
}

function selectCurrentPath() {
    // Aktuellen Pfad in das Upload-Pfad Feld eintragen
    const uploadPathField = document.getElementById('uploadPath');
    if (uploadPathField) {
        uploadPathField.value = currentBrowserPath;
        
        // Erfolgsmeldung anzeigen
        showAlert(`Upload-Pfad gesetzt: ${currentBrowserPath}`, 'success');
    }
    
    // Modal schließen
    const modal = bootstrap.Modal.getInstance(document.getElementById('directoryBrowserModal'));
    modal.hide();
}

function showCreateDirectoryForm() {
    const form = document.getElementById('createDirectoryForm');
    form.classList.remove('d-none');
    document.getElementById('newDirectoryName').focus();
}

function hideCreateDirectoryForm() {
    const form = document.getElementById('createDirectoryForm');
    form.classList.add('d-none');
    document.getElementById('newDirectoryName').value = '';
}

async function createNewDirectory() {
    const nameInput = document.getElementById('newDirectoryName');
    const directoryName = nameInput.value.trim();
    
    if (!directoryName) {
        showAlert('Bitte geben Sie einen Ordnernamen ein', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/create-directory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent_path: currentBrowserPath,
                directory_name: directoryName
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            hideCreateDirectoryForm();
            // Verzeichnis neu laden
            loadDirectoryContents(currentBrowserPath);
        } else {
            showAlert(`Fehler: ${result.error}`, 'danger');
        }
        
    } catch (error) {

        showAlert('Fehler beim Erstellen des Verzeichnisses', 'danger');
    }
}

async function testUploadPath() {
    const uploadPathField = document.getElementById('uploadPath');
    const path = uploadPathField.value.trim();
    
    if (!path) {
        showAlert('Bitte geben Sie einen Upload-Pfad ein', 'warning');
        return;
    }
    
    try {
        // Test ob Pfad existiert durch Verzeichnis-Browse API
        const response = await fetch('/api/admin/browse-directories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: path })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`✅ Upload-Pfad ist gültig und zugänglich: ${path}`, 'success');
        } else {
            showAlert(`❌ Upload-Pfad ungültig: ${result.error}`, 'danger');
        }
        
    } catch (error) {

        showAlert('❌ Fehler beim Testen des Upload-Pfads', 'danger');
    }
}

function resetUploadSettings() {
    if (!confirm('Möchten Sie wirklich alle Upload-Einstellungen zurücksetzen?')) {
        return;
    }
    
    // Standard-Werte setzen
    const uploadEnabled = document.getElementById('uploadEnabled');
    const uploadPath = document.getElementById('uploadPath');
    const uploadMaxSize = document.getElementById('uploadMaxSize');
    const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
    
    if (uploadEnabled) uploadEnabled.checked = true;
    if (uploadPath) uploadPath.value = '';
    if (uploadMaxSize) uploadMaxSize.value = '50';
    if (uploadAllowedExtensions) uploadAllowedExtensions.value = 'jpg,jpeg,png,gif,mp4,mov,avi';
    
    showAlert('Upload-Einstellungen zurückgesetzt', 'info');
}

function validateUploadSettings() {
    let isValid = true;
    
    // Max. Dateigröße validieren
    const uploadMaxSize = document.getElementById('uploadMaxSize');
    if (uploadMaxSize) {
        const size = parseInt(uploadMaxSize.value);
        if (isNaN(size) || size < 1 || size > 1000) {
            showAlert('Maximale Dateigröße muss zwischen 1 und 1000 MB liegen', 'warning');
            isValid = false;
        }
    }
    
    // Dateierweiterungen validieren
    const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
    if (uploadAllowedExtensions) {
        const extensions = uploadAllowedExtensions.value.trim();
        if (extensions && !extensions.match(/^[a-z0-9,]+$/i)) {
            showAlert('Dateierweiterungen dürfen nur Buchstaben, Zahlen und Kommas enthalten', 'warning');
            isValid = false;
        }
    }
    
    return isValid;
}

async function loadUploadSettings() {
    try {
        const response = await fetch('/api/settings/get');
        const result = await response.json();
        
        if (result.success && result.settings) {
            const settings = result.settings;
            
            // Upload-Einstellungen laden falls vorhanden
            const uploadEnabled = document.getElementById('uploadEnabled');
            const uploadPath = document.getElementById('uploadPath');
            const uploadMaxSize = document.getElementById('uploadMaxSize');
            const uploadAllowedExtensions = document.getElementById('uploadAllowedExtensions');
            
            if (uploadEnabled && settings.upload_enabled !== undefined) {
                uploadEnabled.checked = settings.upload_enabled;
            }
            
            if (uploadPath && settings.upload_path !== undefined) {
                uploadPath.value = settings.upload_path;
            }
            
            if (uploadMaxSize && settings.upload_max_size_mb !== undefined) {
                uploadMaxSize.value = settings.upload_max_size_mb;
            }
            
            if (uploadAllowedExtensions && settings.upload_allowed_extensions !== undefined) {
                uploadAllowedExtensions.value = settings.upload_allowed_extensions;
            }
        }
    } catch (error) {

    }
}

