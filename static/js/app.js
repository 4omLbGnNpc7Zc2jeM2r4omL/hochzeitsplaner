/* =============================================================================
   Hochzeitsplaner Web - JavaScript Funktionen
   ============================================================================= */

// Globale Variablen
let currentSettings = {};

// =============================================================================
// Utility Funktionen
// =============================================================================

/**
 * Zeigt/Versteckt Loading Spinner
 * @param {boolean} show - true zum Anzeigen, false zum Verstecken
 */
function showLoading(show = true) {
    // Versuche verschiedene Loading-Elemente zu finden
    let spinner = document.getElementById('loading-spinner') || 
                  document.getElementById('loadingSpinner') ||
                  document.querySelector('.loading-spinner') ||
                  document.querySelector('.spinner');
    
    if (spinner) {
        if (show) {
            spinner.classList.remove('d-none', 'hidden');
            spinner.classList.add('d-block');
        } else {
            spinner.classList.add('d-none', 'hidden');
            spinner.classList.remove('d-block');
        }
    } else {
        // Fallback: Dynamisch Loading-Spinner erstellen
        if (show) {
            createDynamicSpinner();
        } else {
            removeDynamicSpinner();
        }
    }
}

/**
 * Versteckt Loading Spinner (Legacy-Kompatibilität)
 */
function hideLoading() {
    showLoading(false);
}

/**
 * Erstellt einen dynamischen Loading-Spinner
 */
function createDynamicSpinner() {
    // Prüfen ob bereits vorhanden
    if (document.getElementById('dynamic-loading-spinner')) return;
    
    const spinner = document.createElement('div');
    spinner.id = 'dynamic-loading-spinner';
    spinner.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center';
    spinner.style.cssText = 'background: rgba(0,0,0,0.5); z-index: 9999;';
    spinner.innerHTML = `
        <div class="text-center text-white">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Lädt...</span>
            </div>
            <div class="mt-2">Lädt...</div>
        </div>
    `;
    document.body.appendChild(spinner);
}

/**
 * Entfernt den dynamischen Loading-Spinner
 */
function removeDynamicSpinner() {
    const spinner = document.getElementById('dynamic-loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

/**
 * Zeigt Erfolgs-Nachricht
 */
function showSuccess(message) {
    // console.log('showSuccess aufgerufen mit:', message);
    const alertElement = document.getElementById('success-alert');
    const messageElement = document.getElementById('success-message');
    
    // console.log('alertElement gefunden:', alertElement);
    // console.log('messageElement gefunden:', messageElement);
    
    // Sicherheitsprüfung für messageElement
    if (messageElement) {
        messageElement.textContent = message;
        // console.log('Message gesetzt:', message);
    } else {
        // console.log('Success message element not found, showing alert instead:', message);
        alert('Erfolg: ' + message);
        return;
    }
    
    // Sicherheitsprüfung für alertElement
    if (alertElement) {
        // console.log('Zeige Alert an - entferne d-none Klasse');
        alertElement.classList.remove('d-none');
        
        // Automatisch nach 5 Sekunden ausblenden
        setTimeout(() => {
            // console.log('Alert automatisch ausblenden nach 5 Sekunden');
            alertElement.classList.add('d-none');
        }, 5000);
    } else {
        // console.log('Success alert element not found, message was:', message);
        alert('Erfolg: ' + message);
    }
}

/**
 * Zeigt Fehler-Nachricht
 */
function showError(message) {
    const alertElement = document.getElementById('error-alert');
    const messageElement = document.getElementById('error-message');
    
    // Sicherheitsprüfung für messageElement
    if (messageElement) {
        messageElement.textContent = message;
    } else {
        // console.error('Error message element not found, showing alert instead:', message);
        alert('Fehler: ' + message);
        return;
    }
    
    // Sicherheitsprüfung für alertElement
    if (alertElement) {
        alertElement.classList.remove('d-none');
        
        // Automatisch nach 10 Sekunden ausblenden
        setTimeout(() => {
            alertElement.classList.add('d-none');
        }, 10000);
    } else {
        // console.error('Error alert element not found, message was:', message);
        alert('Fehler: ' + message);
    }
}

/**
 * Versteckt alle Alerts
 */
function hideAlerts() {
    const successAlert = document.getElementById('success-alert');
    const errorAlert = document.getElementById('error-alert');
    
    if (successAlert) {
        successAlert.classList.add('d-none');
    }
    if (errorAlert) {
        errorAlert.classList.add('d-none');
    }
}

/**
 * Formatiert Zahl als Euro-Betrag
 */
function formatEuro(amount) {
    if (isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

/**
 * Formatiert Zahl mit deutschen Tausender-Trennzeichen
 */
function formatNumber(number) {
    if (isNaN(number)) return '0';
    return new Intl.NumberFormat('de-DE').format(number);
}

/**
 * Validiert E-Mail-Adresse
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validiert Telefonnummer (deutsche Formate)
 */
function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{6,}$/;
    return phoneRegex.test(phone);
}

// =============================================================================
// API Funktionen
// =============================================================================

/**
 * Generisches API-Request
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const defaultOptions = {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Add cache-busting for GET requests
        let url = `/api${endpoint}`;
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

        throw error;
    }
}

/**
 * Lädt Einstellungen
 */
async function loadSettings() {
    try {
        // Für DJ Panel: Verwende Default-Werte ohne API-Aufruf
        if (window.location.pathname === '/dj-panel') {
            // console.log('DJ Panel detected - using default settings'); // Guest console logs disabled
            currentSettings = {
                braut_name: 'Braut',
                braeutigam_name: 'Bräutigam',
                hochzeitsdatum: ''
            };
            updateNavigationTitle();
            return currentSettings;
        }
        
        // Für alle anderen Seiten: Normale Settings API
        const data = await apiRequest('/settings/get');
        currentSettings = data.settings;
        updateNavigationTitle();
        return data.settings;
    } catch (error) {
        // console.error('Settings load error:', error); // Guest console logs disabled
        showError('Einstellungen konnten nicht geladen werden');
        return {};
    }
}

/**
 * Speichert Einstellungen
 */
async function saveSettings(settings) {
    try {
        showLoading();
        await apiRequest('/settings/save', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        currentSettings = { ...currentSettings, ...settings };
        updateNavigationTitle();
        showSuccess('Einstellungen erfolgreich gespeichert');
        return true;
    } catch (error) {

        showError('Einstellungen konnten nicht gespeichert werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Lädt Dashboard-Statistiken
 */
async function loadDashboardStats() {
    try {
        const data = await apiRequest('/dashboard/stats');
        return data;
    } catch (error) {

        showError('Dashboard-Daten konnten nicht geladen werden');
        return null;
    }
}

/**
 * Lädt Gästeliste
 */
async function loadGuestList() {
    try {
        const data = await apiRequest('/gaeste/list');
        return data.gaeste;
    } catch (error) {

        showError('Gästeliste konnte nicht geladen werden');
        return [];
    }
}

/**
 * Fügt Gast hinzu
 */
async function addGuest(guestData) {
    try {
        showLoading();
        await apiRequest('/gaeste/add', {
            method: 'POST',
            body: JSON.stringify(guestData)
        });
        showSuccess('Gast erfolgreich hinzugefügt');
        return true;
    } catch (error) {

        showError('Gast konnte nicht hinzugefügt werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Aktualisiert Gast
 */
async function updateGuest(index, guestData) {
    try {
        showLoading();
        await apiRequest(`/gaeste/update/${index}`, {
            method: 'PUT',
            body: JSON.stringify(guestData)
        });
        showSuccess('Gast erfolgreich aktualisiert');
        return true;
    } catch (error) {

        showError('Gast konnte nicht aktualisiert werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Löscht Gast
 */
async function deleteGuest(index) {
    try {
        showLoading();
        await apiRequest(`/gaeste/delete/${index}`, {
            method: 'DELETE'
        });
        showSuccess('Gast erfolgreich gelöscht');
        return true;
    } catch (error) {

        showError('Gast konnte nicht gelöscht werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Lädt Budget-Liste
 */
async function loadBudgetList() {
    try {
        const data = await apiRequest('/budget/list');
        return data.budget;
    } catch (error) {

        showError('Budget konnte nicht geladen werden');
        return [];
    }
}

/**
 * Fügt Budget-Position hinzu
 */
async function addBudgetItem(budgetData) {
    try {
        showLoading();
        await apiRequest('/budget/add', {
            method: 'POST',
            body: JSON.stringify(budgetData)
        });
        showSuccess('Budget-Position erfolgreich hinzugefügt');
        return true;
    } catch (error) {

        showError('Budget-Position konnte nicht hinzugefügt werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Aktualisiert Budget-Position
 */
async function updateBudgetItem(kategorie, budgetData) {
    try {
        showLoading();
        await apiRequest('/budget/save', {
            method: 'POST',
            body: JSON.stringify({
                kategorie: kategorie,
                budget_data: budgetData
            })
        });
        showSuccess('Budget-Position erfolgreich aktualisiert');
        return true;
    } catch (error) {

        showError('Budget-Position konnte nicht aktualisiert werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Generiert automatisches Budget
 */
async function generateAutoBudget() {
    try {
        showLoading();
        await apiRequest('/budget/auto-generate', {
            method: 'POST'
        });
        showSuccess('Budget automatisch erstellt');
        
        // Seite neu laden oder Dashboard aktualisieren
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        if (typeof loadBudgetData === 'function') {
            loadBudgetData();
        }
        
        return true;
    } catch (error) {

        showError('Automatisches Budget konnte nicht erstellt werden');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Exportiert Daten nach Excel
 */
async function exportToExcel() {
    try {
        showLoading();
        
        const response = await fetch('/api/export/excel');
        
        if (!response.ok) {
            throw new Error('Export fehlgeschlagen');
        }
        
        // Datei herunterladen
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hochzeitsplaner_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSuccess('Excel-Export erfolgreich heruntergeladen');
        return true;
    } catch (error) {

        showError('Excel-Export fehlgeschlagen');
        return false;
    } finally {
        hideLoading();
    }
}

// =============================================================================
// UI Update Funktionen
// =============================================================================

/**
 * Aktualisiert den Navigations-Titel mit Namen aus Einstellungen
 */
function updateNavigationTitle() {
    const navTitle = document.getElementById('nav-title');
    if (navTitle && currentSettings) {
        const brautName = currentSettings.braut_name || 'Käthe';
        const braeutigamName = currentSettings.braeutigam_name || 'Pascal';
        navTitle.textContent = `Hochzeit ${brautName} & ${braeutigamName}`;
    }
}

/**
 * Erstellt Status-Badge HTML
 */
function createStatusBadge(status) {
    const statusClass = {
        'Kommt': 'status-kommt',
        'Kommt nicht': 'status-kommt-nicht',
        'Offen': 'status-offen'
    }[status] || 'status-offen';
    
    return `<span class="status-badge ${statusClass}">${status}</span>`;
}

/**
 * Erstellt Event-Teilnahme Icons
 */
function createEventParticipation(participation) {
    const iconClass = {
        'Ja': 'event-yes',
        'Nein': 'event-no',
        'Vielleicht': 'event-maybe'
    }[participation] || 'event-maybe';
    
    const iconText = {
        'Ja': '✓',
        'Nein': '✗',
        'Vielleicht': '?'
    }[participation] || '?';
    
    return `<span class="event-participation ${iconClass}" title="${participation}">${iconText}</span>`;
}

// =============================================================================
// Initialisierung
// =============================================================================

/**
 * Initialisiert die Anwendung
 */
document.addEventListener('DOMContentLoaded', async function() {
    
    
    // Einstellungen laden
    await loadSettings();
    
    // Aktuelle Seite spezifische Initialisierung
    const path = window.location.pathname;
    
    if (path === '/' && typeof initDashboard === 'function') {
        initDashboard();
    } else if (path === '/gaesteliste' && typeof initGuestList === 'function') {
        initGuestList();
    } else if (path === '/budget' && typeof initBudget === 'function') {
        initBudget();
    } else if (path === '/einstellungen' && typeof initSettings === 'function') {
        initSettings();
    }
    
    
});

// =============================================================================
// Event Listeners
// =============================================================================

// Alert Schließen
document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-close')) {
        const alert = e.target.closest('.alert');
        if (alert) {
            alert.classList.add('d-none');
        }
    }
});

// Form Submit Prevention (für AJAX)
document.addEventListener('submit', function(e) {
    e.preventDefault();

});

// =============================================================================
// Globale Hilfsfunktionen
// =============================================================================

/**
 * Konfirmations-Dialog
 */
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

/**
 * Debounce Funktion für Search/Filter
 */
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

