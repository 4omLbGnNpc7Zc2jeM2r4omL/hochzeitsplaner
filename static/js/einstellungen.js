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
    // Alert am Anfang der Seite anzeigen
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    // Alert vor dem ersten Element einfügen
    const container = document.querySelector('.row');
    container.insertAdjacentHTML('afterbegin', alertHtml);
    
    // Alert nach 5 Sekunden automatisch ausblenden
    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

// Neue Google Maps Funktion für Location-Inputs
function openGoogleMaps(inputId) {
    const addressInput = document.getElementById(inputId);
    if (!addressInput || !addressInput.value.trim()) {
        showAlert('Bitte gib zuerst eine Adresse ein', 'warning');
        return;
    }
    
    const address = encodeURIComponent(addressInput.value.trim());
    const mapsUrl = `https://maps.google.com/maps?q=${address}`;
    window.open(mapsUrl, '_blank');
}

// Neue Kartenvorschau für Locations
function updateLocationMapPreview(locationType) {
    const addressInputId = locationType === 'standesamt' ? 'standesamtAdresse' : 'hochzeitslocationAdresse';
    const mapPreviewId = locationType + 'MapPreview';
    const mapFrameId = locationType + 'MapFrame';
    
    const addressInput = document.getElementById(addressInputId);
    const mapPreview = document.getElementById(mapPreviewId);
    const mapFrame = document.getElementById(mapFrameId);
    const mapPreviewsSection = document.getElementById('mapPreviewsSection');
    
    if (!addressInput || !mapPreview || !mapFrame) {
        return;
    }
    
    const address = addressInput.value.trim();
    
    if (!address) {
        mapPreview.style.display = 'none';
        // Prüfe ob noch andere Karten angezeigt werden
        checkMapPreviewsVisibility();
        return;
    }
    
    // Fallback-Lösung ohne Google Maps API-Key
    const fallbackHtml = `
        <div class="d-flex align-items-center justify-content-center bg-light h-100 p-4" style="min-height: 250px;">
            <div class="text-center">
                <i class="bi bi-geo-alt text-primary mb-3" style="font-size: 3rem;"></i>
                <h6 class="mb-3">${address}</h6>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" 
                   target="_blank" 
                   class="btn btn-primary">
                    <i class="bi bi-map me-2"></i>
                    In Google Maps öffnen
                </a>
            </div>
        </div>
    `;
    
    // Iframe durch Fallback-HTML ersetzen
    const parentDiv = mapFrame.parentElement;
    parentDiv.innerHTML = fallbackHtml;
    mapPreview.style.display = 'block';
    
    // Zeige die gesamte Kartenvorschau-Sektion
    if (mapPreviewsSection) {
        mapPreviewsSection.style.display = 'block';
    }
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
    } else {
        mapPreviewsSection.style.display = 'none';
    }
}

// Kartenvorschau ausblenden
function hideMapPreview(locationType) {
    const mapPreviewId = locationType + 'MapPreview';
    const mapPreview = document.getElementById(mapPreviewId);
    
    if (mapPreview) {
        mapPreview.style.display = 'none';
        // Prüfe ob noch andere Karten angezeigt werden
        checkMapPreviewsVisibility();
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
    const hochzeitsort = document.getElementById('hochzeitsort').value.trim();
    const mapsPreviewRow = document.getElementById('mapsPreviewRow');
    const mapFrame = document.getElementById('mapFrame');
    
    if (!hochzeitsort) {
        hideMapsPreview();
        return;
    }
    
    // Google Maps Embed URL erstellen
    const encodedAddress = encodeURIComponent(hochzeitsort);
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
