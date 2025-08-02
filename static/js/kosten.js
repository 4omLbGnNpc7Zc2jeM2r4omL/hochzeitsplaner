/* =============================================================================
   Kostenkonfiguration - JavaScript Funktionen
   ============================================================================= */

// Fallback Funktionen falls main.js nicht geladen wurde
if (typeof apiRequest === 'undefined') {
    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(endpoint, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body ? JSON.stringify(options.body) : null
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
}

if (typeof showSuccess === 'undefined') {
    function showSuccess(message) {
        alert('Erfolg: ' + message);
    }
}

if (typeof showError === 'undefined') {
    function showError(message) {
        alert('Fehler: ' + message);
    }
}

// Globale Variablen
let currentFixkosten = {};

// =============================================================================
// Hauptfunktionen
// =============================================================================

/**
 * Initialisiert die Kostenkonfigurations-Seite
 */
async function initKosten() {
    console.log('Kostenkonfiguration wird initialisiert...');
    
    try {
        await loadKostenConfig();
        setupEventListeners();
        updateCalculations();
        console.log('✅ Kostenkonfiguration initialisiert');
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren der Kostenkonfiguration:', error);
        showError('Fehler beim Laden der Kostenkonfiguration');
    }
}

/**
 * Lädt die aktuelle Kostenkonfiguration von der API
 */
async function loadKostenConfig() {
    try {
        showLoading();
        const response = await apiRequest('/api/kosten/config');
        
        if (response.success) {
            const config = response.config;
            
            // Standesamt Kosten
            const standesamt = config.detailed_costs?.standesamt || {};
            document.getElementById('standesamtGetraenke').value = standesamt.Getränke || 4.00;
            document.getElementById('standesamtSnacks').value = standesamt.Snacks || 0.00;
            
            // Essen Kosten
            const essen = config.detailed_costs?.essen || {};
            document.getElementById('essenHauptgang').value = essen.Hauptgang || 55.00;
            document.getElementById('essenGetraenke').value = essen.Getränke || 35.00;
            
            // Party Kosten
            const party = config.detailed_costs?.party || {};
            document.getElementById('partyGetraenke').value = party.Getränke || 25.00;
            document.getElementById('partyMitternachtssnack').value = party.Mitternachtssnack || 0.00;
            
            // Fixkosten
            currentFixkosten = config.fixed_costs || {};
            updateFixkostenDisplay();
            
            // Manuelle Gästeanzahlen
            const manualGuestCounts = config.manual_guest_counts || {};
            document.getElementById('mitternachtssnackGaeste').value = manualGuestCounts.mitternachtssnack || 80;
            
            console.log('✅ Kostenkonfiguration geladen');
        } else {
            throw new Error(response.error || 'Unbekannter Fehler');
        }
    } catch (error) {
        console.error('Fehler beim Laden der Kostenkonfiguration:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

/**
 * Event Listeners einrichten
 */
function setupEventListeners() {
    // Eingabefelder überwachen für automatische Neuberechnung
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', updateCalculations);
    });
    
    // Fixkosten Form
    document.getElementById('addFixkostenForm').addEventListener('submit', handleAddFixkosten);
}

/**
 * Aktualisiert alle Berechnungen
 */
function updateCalculations() {
    // Standesamt
    const standesamtGetraenke = parseFloat(document.getElementById('standesamtGetraenke').value) || 0;
    const standesamtSnacks = parseFloat(document.getElementById('standesamtSnacks').value) || 0;
    const standesamtTotal = standesamtGetraenke + standesamtSnacks;
    
    // Essen
    const essenHauptgang = parseFloat(document.getElementById('essenHauptgang').value) || 0;
    const essenGetraenke = parseFloat(document.getElementById('essenGetraenke').value) || 0;
    const essenTotal = essenHauptgang + essenGetraenke;
    
    // Party
    const partyGetraenke = parseFloat(document.getElementById('partyGetraenke').value) || 0;
    const partyMitternachtssnack = parseFloat(document.getElementById('partyMitternachtssnack').value) || 0;
    const partyTotal = partyGetraenke + partyMitternachtssnack;
    
    // UI Updates
    document.getElementById('standesamtTotal').textContent = `€ ${standesamtTotal.toFixed(2)}`;
    document.getElementById('essenTotal').textContent = `€ ${essenTotal.toFixed(2)}`;
    document.getElementById('partyTotal').textContent = `€ ${partyTotal.toFixed(2)}`;
    
    // Übersicht aktualisieren
    document.getElementById('overviewStandesamt').textContent = `€ ${standesamtTotal.toFixed(2)}`;
    document.getElementById('overviewEssen').textContent = `€ ${essenTotal.toFixed(2)}`;
    document.getElementById('overviewParty').textContent = `€ ${partyTotal.toFixed(2)}`;
    
    // Beispielberechnungen (50 Gäste)
    const beispielStandesamt = standesamtTotal * 50;
    const beispielEssen = essenTotal * 50;
    const beispielParty = partyTotal * 25; // Nur 25 zusätzlich zur Party
    const beispielGesamt = beispielStandesamt + beispielEssen + beispielParty;
    
    document.getElementById('beispielStandesamt').textContent = formatEuro(beispielStandesamt);
    document.getElementById('beispielEssen').textContent = formatEuro(beispielEssen);
    document.getElementById('beispielParty').textContent = formatEuro(beispielParty);
    document.getElementById('beispielGesamt').textContent = formatEuro(beispielGesamt);
}

// =============================================================================
// Kostenkonfiguration speichern/laden
// =============================================================================

/**
 * Speichert die aktuelle Kostenkonfiguration
 */
async function saveKostenConfig() {
    try {
        showLoading();
        
        const config = {
            detailed_costs: {
                standesamt: {
                    Getränke: parseFloat(document.getElementById('standesamtGetraenke').value) || 0,
                    Snacks: parseFloat(document.getElementById('standesamtSnacks').value) || 0
                },
                essen: {
                    Hauptgang: parseFloat(document.getElementById('essenHauptgang').value) || 0,
                    Getränke: parseFloat(document.getElementById('essenGetraenke').value) || 0
                },
                party: {
                    Getränke: parseFloat(document.getElementById('partyGetraenke').value) || 0,
                    Mitternachtssnack: parseFloat(document.getElementById('partyMitternachtssnack').value) || 0
                }
            },
            fixed_costs: currentFixkosten,
            manual_guest_counts: {
                mitternachtssnack: parseInt(document.getElementById('mitternachtssnackGaeste').value) || 80
            }
        };
        
        // Debug: Log das Objekt vor dem Senden
        console.log('Config object before sending:', config);
        console.log('JSON.stringify result:', JSON.stringify(config));
        
        // Verwende direkten fetch statt apiRequest für bessere Kontrolle
        const response = await fetch('/api/kosten/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Kostenkonfiguration erfolgreich gespeichert');
            // Daten neu laden um sicherzustellen, dass UI aktuell ist
            await loadKostenConfig();
        } else {
            throw new Error(result.error || 'Fehler beim Speichern');
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Kostenkonfiguration:', error);
        showError('Fehler beim Speichern der Kostenkonfiguration: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Setzt die Kostenkonfiguration zurück
 */
function resetKostenConfig() {
    if (confirm('Soll die Kostenkonfiguration auf die Standardwerte zurückgesetzt werden?')) {
        // Standardwerte setzen
        document.getElementById('standesamtGetraenke').value = 4.00;
        document.getElementById('standesamtSnacks').value = 0.00;
        document.getElementById('essenHauptgang').value = 55.00;
        document.getElementById('essenGetraenke').value = 35.00;
        document.getElementById('partyGetraenke').value = 25.00;
        document.getElementById('partyMitternachtssnack').value = 0.00;
        
        // Fixkosten leeren
        currentFixkosten = {};
        updateFixkostenDisplay();
        
        updateCalculations();
        showSuccess('Kostenkonfiguration zurückgesetzt');
    }
}

// =============================================================================
// Fixkosten Management
// =============================================================================

/**
 * Zeigt Fixkosten in der UI an
 */
function updateFixkostenDisplay() {
    const container = document.getElementById('fixkostenContainer');
    container.innerHTML = '';
    
    Object.keys(currentFixkosten).forEach(name => {
        const betrag = currentFixkosten[name];
        
        const col = document.createElement('div');
        col.className = 'col-md-6 mb-3';
        
        col.innerHTML = `
            <div class="d-flex justify-content-between align-items-center p-3 border rounded">
                <div>
                    <strong>${name}</strong>
                    <div class="text-muted small">Fixkosten</div>
                </div>
                <div class="d-flex align-items-center">
                    <span class="me-3 fw-bold">${formatEuro(betrag)}</span>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="editFixkosten('${name}', ${betrag})" title="Bearbeiten">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="removeFixkosten('${name}')" title="Löschen">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(col);
    });
}

/**
 * Fügt neue Fixkosten hinzu
 */
function addFixkosten() {
    // Modal-Titel sicherstellen
    const modalTitle = document.getElementById('addFixkostenModalLabel');
    modalTitle.innerHTML = '<i class="fas fa-plus me-2"></i>Fixkosten hinzufügen';
    
    // Felder zurücksetzen
    document.getElementById('addFixkostenForm').reset();
    document.getElementById('fixkostenName').readOnly = false;
    
    const modal = new bootstrap.Modal(document.getElementById('addFixkostenModal'));
    modal.show();
}

/**
 * Behandelt das Hinzufügen von Fixkosten
 */
async function handleAddFixkosten(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const name = formData.get('name').trim();
    const betrag = parseFloat(formData.get('betrag'));
    
    if (!name || betrag < 0) {
        showError('Bitte geben Sie einen gültigen Namen und Betrag ein');
        return;
    }
    
    if (currentFixkosten[name]) {
        if (!confirm(`Fixkosten "${name}" existieren bereits. Überschreiben?`)) {
            return;
        }
    }
    
    // Füge zu currentFixkosten hinzu
    currentFixkosten[name] = betrag;
    updateFixkostenDisplay();
    
    // Modal schließen und Form zurücksetzen
    const modal = bootstrap.Modal.getInstance(document.getElementById('addFixkostenModal'));
    modal.hide();
    event.target.reset();
    
    // Automatisch speichern
    try {
        await saveKostenConfig();
        showSuccess(`Fixkosten "${name}" hinzugefügt und gespeichert`);
    } catch (error) {
        showError(`Fixkosten "${name}" hinzugefügt, aber Fehler beim Speichern: ${error.message}`);
    }
}

/**
 * Bearbeitet Fixkosten
 */
function editFixkosten(name, currentBetrag) {
    // Modal-Titel ändern
    const modalTitle = document.getElementById('addFixkostenModalLabel');
    modalTitle.innerHTML = '<i class="fas fa-edit me-2"></i>Fixkosten bearbeiten';
    
    // Felder vorausfüllen
    document.getElementById('fixkostenName').value = name;
    document.getElementById('fixkostenBetrag').value = currentBetrag;
    
    // Name-Feld deaktivieren (Name kann nicht geändert werden)
    document.getElementById('fixkostenName').readOnly = true;
    
    // Modal öffnen
    const modal = new bootstrap.Modal(document.getElementById('addFixkostenModal'));
    modal.show();
    
    // Event-Listener für das Schließen hinzufügen um Felder zurückzusetzen
    const modalElement = document.getElementById('addFixkostenModal');
    modalElement.addEventListener('hidden.bs.modal', function resetModal() {
        modalTitle.innerHTML = '<i class="fas fa-plus me-2"></i>Fixkosten hinzufügen';
        document.getElementById('fixkostenName').readOnly = false;
        document.getElementById('addFixkostenForm').reset();
        modalElement.removeEventListener('hidden.bs.modal', resetModal);
    });
}

/**
 * Entfernt Fixkosten
 */
async function removeFixkosten(name) {
    if (confirm(`Sollen die Fixkosten "${name}" wirklich gelöscht werden?`)) {
        delete currentFixkosten[name];
        updateFixkostenDisplay();
        
        // Automatisch speichern
        try {
            await saveKostenConfig();
            showSuccess(`Fixkosten "${name}" entfernt und gespeichert`);
        } catch (error) {
            showError(`Fixkosten "${name}" entfernt, aber Fehler beim Speichern: ${error.message}`);
        }
    }
}

// =============================================================================
// Hilfsfunktionen
// =============================================================================

/**
 * Formatiert einen Betrag als Euro
 */
function formatEuro(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// =============================================================================
// Event Listener für Seiteninitialisierung
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname === '/kosten') {
        initKosten();
    }
});
