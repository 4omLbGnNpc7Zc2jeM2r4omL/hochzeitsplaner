// Einstellungen JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Einstellungen.js geladen');
    console.log('🔍 OpenStreetMap verfügbar:', typeof window.openStreetMap !== 'undefined');
    
    const settingsForm = document.getElementById('settingsForm');
    const resetButton = document.getElementById('resetSettings');
    const openMapsBtn = document.getElementById('openMapsBtn');
    const hochzeitsortField = document.getElementById('hochzeitsort');
    const mapsPreviewRow = document.getElementById('mapsPreviewRow');
    const closeMapsPreview = document.getElementById('closeMapsPreview');
    const backupButton = document.getElementById('backupData');
    
    console.log('📋 Element-Status:', {
        settingsForm: !!settingsForm,
        resetButton: !!resetButton,
        openMapsBtn: !!openMapsBtn,
        hochzeitsortField: !!hochzeitsortField,
        mapsPreviewRow: !!mapsPreviewRow,
        closeMapsPreview: !!closeMapsPreview,
        backupButton: !!backupButton
    });
    
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
                console.error('Fehler beim Laden der Einstellungen:', result.error);
            }
        } else {
            console.error('Fehler beim Laden der Einstellungen');
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
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
        console.error('Fehler beim Speichern der Einstellungen:', error);
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
        console.error('Fehler beim Laden der System Info:', error);
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
    console.log(`🔍 Zeige Location auf Karte: ${locationType}, Input: ${inputId}`);
    
    const addressInput = document.getElementById(inputId);
    if (!addressInput) {
        console.error(`❌ Input-Element nicht gefunden: ${inputId}`);
        showAlert('Input-Element nicht gefunden', 'danger');
        return;
    }
    
    if (!addressInput.value.trim()) {
        showAlert('Bitte gib zuerst eine Adresse ein', 'warning');
        addressInput.focus();
        return;
    }
    
    console.log(`📍 Adresse gefunden: "${addressInput.value.trim()}"`);
    updateLocationMapPreview(locationType);
}

// Neue Kartenvorschau für Locations mit OpenStreetMap
async function updateLocationMapPreview(locationType) {
    console.log(`🗺️ Aktualisiere Kartenvorschau für: ${locationType}`);
    
    const addressInputId = locationType === 'standesamt' ? 'standesamtAdresse' : 'hochzeitslocationAdresse';
    const nameInputId = locationType === 'standesamt' ? 'standesamtName' : 'hochzeitslocationName';
    const mapPreviewId = locationType + 'MapPreview';
    const mapContainerId = locationType + 'Map';
    
    const addressInput = document.getElementById(addressInputId);
    const nameInput = document.getElementById(nameInputId);
    const mapPreview = document.getElementById(mapPreviewId);
    const mapPreviewsSection = document.getElementById('mapPreviewsSection');
    
    if (!addressInput || !mapPreview) {
        console.error(`❌ Elemente nicht gefunden für ${locationType}:`, {
            addressInput: !!addressInput,
            mapPreview: !!mapPreview
        });
        return;
    }
    
    const address = addressInput.value.trim();
    const locationName = nameInput ? nameInput.value.trim() : '';
    
    console.log(`📍 Adresse: "${address}", Name: "${locationName}"`);
    
    if (!address) {
        mapPreview.style.display = 'none';
        // Prüfe ob noch andere Karten angezeigt werden
        checkMapPreviewsVisibility();
        return;
    }

    try {
        // Entferne alte Karte falls vorhanden
        if (window.openStreetMap && window.openStreetMap.maps && window.openStreetMap.maps.has(mapContainerId)) {
            console.log(`🧹 Entferne alte Karte: ${mapContainerId}`);
            window.openStreetMap.removeMap(mapContainerId);
        }

        // Zeige Karten-Container
        mapPreview.style.display = 'block';
        if (mapPreviewsSection) {
            mapPreviewsSection.style.display = 'block';
        }
        console.log(`👁️ Karten-Container sichtbar gemacht`);

        // Warte kurz damit Container sichtbar ist
        await new Promise(resolve => setTimeout(resolve, 200));

        // Prüfe ob OpenStreetMap verfügbar ist
        if (typeof window.openStreetMap === 'undefined') {
            console.error('❌ OpenStreetMap Integration nicht geladen');
            showFallbackMap(mapContainerId, address, locationName);
            return;
        }

        // Erstelle neue Karte
        console.log(`🗺️ Erstelle OpenStreetMap für Container: ${mapContainerId}`);
        await window.openStreetMap.createSimpleLocationMap(mapContainerId, address, locationName);
        console.log(`✅ Karte für ${locationType} erfolgreich erstellt`);

    } catch (error) {
        console.error(`❌ Fehler beim Erstellen der Karte für ${locationType}:`, error);
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
                   class="btn btn-primary">
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
        console.log('🗺️ Karten-Layout:', {
            standesamtVisible,
            hochzeitslocationVisible,
            sectionVisible: true
        });
    } else {
        mapPreviewsSection.style.display = 'none';
        console.log('🗺️ Alle Karten versteckt');
    }
}

// Kartenvorschau ausblenden
function hideMapPreview(locationType) {
    console.log(`❌ Verstecke Kartenvorschau: ${locationType}`);
    
    const mapPreviewId = locationType + 'MapPreview';
    const mapContainerId = locationType + 'Map';
    const mapPreview = document.getElementById(mapPreviewId);
    
    if (mapPreview) {
        mapPreview.style.display = 'none';
        console.log(`👁️ Karten-Container versteckt: ${mapPreviewId}`);
        
        // Entferne Karte aus OpenStreetMap
        if (window.openStreetMap && window.openStreetMap.maps && window.openStreetMap.maps.has(mapContainerId)) {
            console.log(`🧹 Entferne Karte: ${mapContainerId}`);
            window.openStreetMap.removeMap(mapContainerId);
        }
        
        // Prüfe ob andere Karten noch sichtbar sind
        checkMapPreviewsVisibility();
    } else {
        console.error(`❌ Karten-Preview Element nicht gefunden: ${mapPreviewId}`);
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
    console.log('⚠️ updateMapPreview (Legacy Google Maps) - deaktiviert');
    // Diese Funktion ist deaktiviert - OpenStreetMap wird jetzt verwendet
    return;
    
    const hochzeitsort = document.getElementById('hochzeitsort');
    const mapsPreviewRow = document.getElementById('mapsPreviewRow');
    const mapFrame = document.getElementById('mapFrame');
    
    // Prüfe ob Elemente existieren
    if (!hochzeitsort || !mapsPreviewRow || !mapFrame) {
        console.log('⚠️ Legacy Google Maps Elemente nicht gefunden - wird übersprungen');
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
        console.error('Fehler beim Erstellen des Backups:', error);
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
    console.log('🔍 Zeige First-Login-Modal Vorschau');
    
    // Aktuelle Werte aus den Einstellungen holen
    const imageUrl = document.getElementById('firstLoginImage').value.trim();
    const imageData = document.getElementById('firstLoginImageData').value.trim();
    const text = document.getElementById('firstLoginText').value.trim();
    const weddingDate = document.getElementById('hochzeitsdatum').value.trim();
    
    // Vorschau-Modal Elemente
    const previewImage = document.getElementById('previewImage');
    const previewImagePlaceholder = document.getElementById('previewImagePlaceholder');
    const previewText = document.getElementById('previewText');
    const previewWeddingDate = document.getElementById('previewWeddingDate');
    
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
        console.log('⚠️ Fehler beim Formatieren des Datums:', error);
        return dateString || '25. Juli 2026'; // Fallback
    }
}

/**
 * Setzt den First-Login-Status für alle Gäste zurück
 */
async function resetFirstLoginForAllGuests() {
    console.log('🔄 Reset First-Login für alle Gäste');
    
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
        console.error('Fehler beim Zurücksetzen des First-Login-Status:', error);
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
        console.error('Fehler beim Laden des Bildes für Schwarz-Weiß-Konvertierung');
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
