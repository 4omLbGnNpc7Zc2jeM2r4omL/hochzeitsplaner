/**
 * Globale Variablen und Einstellungen für Tischplanung
 * Diese Datei setzt die globalen JavaScript-Variablen für die Tischplanung-Module
 */

// Initialisiert globale Variablen für Brautpaar-Namen
async function initializeTischplanungGlobals() {
    try {

        const response = await apiRequest('/settings/get');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.settings) {
                // 💑 WICHTIG: Brautpaar-Namen für tischplanung-relationships.js setzen
                // Die Namen sind in der Datenbank als braut_name und braeutigam_name gespeichert
                const brautName = result.settings.braut_name || result.settings.bride_name || 'Braut';
                const braeutigamName = result.settings.braeutigam_name || result.settings.groom_name || 'Bräutigam';
                const weddingCoupleName = `${brautName} & ${braeutigamName}`;
                
                // ✅ LÖSUNG FÜR "weddingCoupleName is not defined": 
                // Globale Variablen für JavaScript-Module setzen
                window.WEDDING_COUPLE_NAME = weddingCoupleName;
                window.BRIDE_NAME = brautName;
                window.GROOM_NAME = braeutigamName;
                window.BRAUT_NAME = brautName;  // Fallback für deutsche Bezeichnung
                window.BRAEUTIGAM_NAME = braeutigamName;  // Fallback für deutsche Bezeichnung
                
                // KRITISCH: Diese Variable wird von tischplanung-relationships.js erwartet!
                window.weddingCoupleName = weddingCoupleName;
                
                // App-Einstellungen global verfügbar machen
                window.appSettings = result.settings;
                
                return true;
            } else {

                setFallbackNames();
                return false;
            }
        } else {

            setFallbackNames();
            return false;
        }
    } catch (error) {

        setFallbackNames();
        return false;
    }
}

// Setzt Fallback-Namen wenn die Einstellungen nicht geladen werden können
function setFallbackNames() {
    window.WEDDING_COUPLE_NAME = 'Braut & Bräutigam';
    window.BRIDE_NAME = 'Braut';
    window.GROOM_NAME = 'Bräutigam';
    window.BRAUT_NAME = 'Braut';
    window.BRAEUTIGAM_NAME = 'Bräutigam';
    window.weddingCoupleName = 'Braut & Bräutigam'; // ← WICHTIG FÜR FEHLERFIX!
    window.appSettings = {};
    

}

// Automatische Initialisierung beim Laden der Seite
if (window.location.pathname === '/tischplanung') {
    document.addEventListener('DOMContentLoaded', function() {
        initializeTischplanungGlobals();
    });
}

// Export für manuelle Verwendung
window.initializeTischplanungGlobals = initializeTischplanungGlobals;

