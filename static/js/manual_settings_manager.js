/**
 * Manueller Settings Manager für Einladungs-Generator
 * Bietet Buttons zum manuellen Speichern und Laden der Einstellungen
 */

// Sofortige globale Funktionsdefinitionen als Fallback (nur wenn nicht bereits definiert)


// Prüfe ob Funktionen bereits im HEAD definiert wurden
if (typeof window.saveGeneratorSettings !== 'function') {

    window.saveGeneratorSettings = function() {

        alert('Settings Manager wird geladen...');
    };
}

if (typeof window.loadGeneratorSettings !== 'function') {

    window.loadGeneratorSettings = function() {

        alert('Settings Manager wird geladen...');
    };
}



window.ManualSettingsManager = {
    
    async saveSettings() {
        // Speichert aktuelle Einstellungen in der Datenbank
        if (!window.einladungsGenerator) {

            this.showToast('error', 'Generator nicht initialisiert');
            return false;
        }
        
        try {

            
            // Aktuellen Template-Status in Settings einbeziehen
            const templateOptions = document.querySelectorAll('.template-option');
            let selectedTemplate = 'elegant'; // Default
            templateOptions.forEach(option => {
                if (option.classList.contains('selected')) {
                    selectedTemplate = option.getAttribute('data-template');
                }
            });
            
            // Template zu currentSettings hinzufügen
            window.einladungsGenerator.currentSettings.template = selectedTemplate;
            
            const response = await apiRequest('/einladungs-generator/settings', {
                method: 'POST',
                body: JSON.stringify({
                    settings: window.einladungsGenerator.currentSettings
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {

                this.showToast('success', 'Einstellungen wurden gespeichert');
                return true;
            } else {
                throw new Error(data.error || 'Unbekannter Fehler beim Speichern');
            }
            
        } catch (error) {

            this.showToast('error', 'Fehler beim Speichern: ' + error.message);
            return false;
        }
    },
    
    async loadSettings() {
        // Lädt Einstellungen aus der Datenbank
        try {

            
            const response = await apiRequest('/einladungs-generator/settings', {
                method: 'GET',
                });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.settings) {
                // Geladene Einstellungen in currentSettings übernehmen
                if (window.einladungsGenerator) {
                    Object.assign(window.einladungsGenerator.currentSettings, data.settings);
                    
                    // UI-Elemente mit geladenen Werten aktualisieren
                    this.updateUIFromSettings(data.settings);
                    
                    // Vorschau aktualisieren
                    window.einladungsGenerator.updatePreview();
                }
                

                this.showToast('success', 'Einstellungen wurden geladen');
                return data.settings;
            } else {

                this.showToast('warning', 'Keine gespeicherten Einstellungen gefunden');
                return null;
            }
            
        } catch (error) {

            this.showToast('error', 'Fehler beim Laden: ' + error.message);
            return null;
        }
    },
    
    updateUIFromSettings(settings) {
        // Aktualisiert UI-Elemente basierend auf geladenen Einstellungen
        try {

            
            // Farb-Picker und Text-Inputs
            ['primaryColor', 'accentColor', 'backgroundColor'].forEach(colorId => {
                const colorPicker = document.getElementById(colorId);
                const textInput = document.getElementById(colorId + 'Text');
                
                if (colorPicker && settings[colorId]) {
                    colorPicker.value = settings[colorId];
                }
                if (textInput && settings[colorId]) {
                    textInput.value = settings[colorId];
                }
            });
            
            // Text-Eingabefelder
            ['titleText', 'dateText', 'greetingText', 'invitationText'].forEach(textId => {
                const input = document.getElementById(textId);
                if (input && settings[textId] !== undefined) {
                    input.value = settings[textId];
                }
            });
            
            // Font Size Range
            const fontSizeRange = document.getElementById('fontSizeRange');
            const fontSizeValue = document.getElementById('fontSizeValue');
            if (fontSizeRange && settings.fontSize !== undefined) {
                fontSizeRange.value = settings.fontSize;
                if (fontSizeValue) fontSizeValue.textContent = settings.fontSize + '%';
            }
            
            // QR Size Range
            const qrSizeRange = document.getElementById('qrSizeRange');
            const qrSizeValue = document.getElementById('qrSizeValue');
            if (qrSizeRange && settings.qrSize !== undefined) {
                qrSizeRange.value = settings.qrSize;
                if (qrSizeValue) qrSizeValue.textContent = settings.qrSize + 'px';
            }
            
            // Checkboxen
            ['includePhoto', 'showLoginData', 'elegantFont'].forEach(checkboxId => {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox && settings[checkboxId] !== undefined) {
                    checkbox.checked = settings[checkboxId];
                }
            });
            
            // Template-Auswahl
            if (settings.template && window.selectTemplate) {
                window.selectTemplate(settings.template);
            }
            

            
        } catch (error) {

        }
    },
    
    showToast(type, message) {
        // Zeigt Toast-Nachrichten an
        const toastId = type === 'success' ? 'successToast' : 
                        type === 'warning' ? 'errorToast' : 'errorToast';
        const bodyId = type === 'success' ? 'successToastBody' : 'errorToastBody';
        
        const toastElement = document.getElementById(toastId);
        const bodyElement = document.getElementById(bodyId);
        
        if (toastElement && bodyElement) {
            bodyElement.textContent = message;
            
            // Bootstrap Toast anzeigen
            const toast = new bootstrap.Toast(toastElement);
            toast.show();
        } else {
            // Fallback: console log

        }
    }
};

// Verbinde globale Funktionen mit ManualSettingsManager (überschreibe HEAD-Definitionen)


window.saveGeneratorSettings = function() {

    if (window.ManualSettingsManager && window.ManualSettingsManager.saveSettings) {
        window.ManualSettingsManager.saveSettings();
    } else {

        alert('Fehler: Settings Manager nicht geladen');
    }
};

window.loadGeneratorSettings = function() {

    if (window.ManualSettingsManager && window.ManualSettingsManager.loadSettings) {
        window.ManualSettingsManager.loadSettings();
    } else {

        alert('Fehler: Settings Manager nicht geladen');
    }
};






// Zusätzliche Sicherstellung nach DOM-Load
document.addEventListener('DOMContentLoaded', function() {

    
    // Final check und Debug-Ausgabe




    
    // Teste Button-Verfügbarkeit
    const saveBtn = document.querySelector('button[onclick*="saveGeneratorSettings"]');
    if (saveBtn) {

    } else {

    }
});

