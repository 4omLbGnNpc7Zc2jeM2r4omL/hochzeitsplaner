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
    if (settings.bride_name) {
        document.getElementById('brautName').value = settings.bride_name;
    }
    if (settings.groom_name) {
        document.getElementById('braeutigamName').value = settings.groom_name;
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
        bride_name: getInputValue('brautName'),
        groom_name: getInputValue('braeutigamName'),
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
        
        // Legacy Hochzeitsort für Kompatibilität
        hochzeitsort: getInputValue('hochzeitsort')
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
        document.getElementById('backupData').disabled = false;
    }
}
