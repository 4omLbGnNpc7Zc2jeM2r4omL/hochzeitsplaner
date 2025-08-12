/**
 * Einladungs-Generator Settings - Speichern und Laden
 */

// Globale Funktionen für Settings-Management
window.invitationSettings = {
    // Lädt Einstellungen vom Server
    async loadSettings() {
        try {

            
            const response = await apiRequest('/einladungs-generator/settings', {
                method: 'GET',
                });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.settings) {
                // Einstellungen in UI übernehmen
                this.updateUIFromSettings(data.settings);
                
                // Falls Einladungs-Generator existiert, auch dort übernehmen
                if (window.einladungsGenerator && window.einladungsGenerator.currentSettings) {
                    Object.assign(window.einladungsGenerator.currentSettings, data.settings);
                    if (typeof window.einladungsGenerator.updatePreview === 'function') {
                        window.einladungsGenerator.updatePreview();
                    }
                }
                

                this.showSuccess('Einstellungen wurden geladen');
                return data.settings;
            } else {

                return null;
            }
            
        } catch (error) {

            this.showError('Fehler beim Laden der Einstellungen: ' + error.message);
            return null;
        }
    },

    // Speichert aktuelle Einstellungen auf Server
    async saveSettings() {
        try {

            
            // Aktuelle Einstellungen aus UI sammeln
            const settings = this.collectCurrentSettings();
            
            const response = await apiRequest('/einladungs-generator/settings', {
                method: 'POST',
                body: JSON.stringify({
                    settings: settings
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {

                this.showSuccess('Einstellungen wurden erfolgreich gespeichert');
                return true;
            } else {
                throw new Error(data.error || 'Unbekannter Fehler beim Speichern');
            }
            
        } catch (error) {

            this.showError('Fehler beim Speichern der Einstellungen: ' + error.message);
            return false;
        }
    },

    // Sammelt aktuelle Einstellungen aus UI-Elementen
    collectCurrentSettings() {
        const settings = {};
        
        try {
            // Farb-Einstellungen
            ['primaryColor', 'accentColor', 'backgroundColor'].forEach(colorId => {
                const colorPicker = document.getElementById(colorId);
                if (colorPicker) {
                    settings[colorId] = colorPicker.value;
                }
            });
            
            // Text-Einstellungen
            ['titleText', 'dateText', 'greetingText', 'invitationText'].forEach(textId => {
                const input = document.getElementById(textId);
                if (input) {
                    settings[textId] = input.value;
                }
            });
            
            // Range-Einstellungen
            const fontSizeRange = document.getElementById('fontSizeRange');
            if (fontSizeRange) {
                settings.fontSize = parseInt(fontSizeRange.value);
            }
            
            const qrSizeRange = document.getElementById('qrSizeRange');
            if (qrSizeRange) {
                settings.qrSize = parseInt(qrSizeRange.value);
            }
            
            // Checkbox-Einstellungen
            ['includePhoto', 'showLoginData', 'elegantFont'].forEach(checkboxId => {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    settings[checkboxId] = checkbox.checked;
                }
            });
            
            // Template-Auswahl
            const selectedTemplate = document.querySelector('.template-option.selected');
            if (selectedTemplate) {
                settings.template = selectedTemplate.getAttribute('data-template');
            }
            
            // Falls Einladungs-Generator existiert, auch dessen Settings verwenden
            if (window.einladungsGenerator && window.einladungsGenerator.currentSettings) {
                Object.assign(settings, window.einladungsGenerator.currentSettings);
            }
            

            return settings;
            
        } catch (error) {

            return {};
        }
    },

    // Aktualisiert UI-Elemente mit geladenen Einstellungen
    updateUIFromSettings(settings) {
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
                if (fontSizeValue) fontSizeValue.textContent = settings.fontSize;
            }
            
            // QR Size Range
            const qrSizeRange = document.getElementById('qrSizeRange');
            const qrSizeValue = document.getElementById('qrSizeValue');
            if (qrSizeRange && settings.qrSize !== undefined) {
                qrSizeRange.value = settings.qrSize;
                if (qrSizeValue) qrSizeValue.textContent = settings.qrSize;
            }
            
            // Checkboxen
            ['includePhoto', 'showLoginData', 'elegantFont'].forEach(checkboxId => {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox && settings[checkboxId] !== undefined) {
                    checkbox.checked = settings[checkboxId];
                }
            });
            
            // Template-Auswahl
            if (settings.template) {
                // Alle Templates deselektieren
                document.querySelectorAll('.template-option').forEach(option => {
                    option.classList.remove('selected');
                });
                
                // Gewähltes Template selektieren
                const templateOption = document.querySelector(`[data-template="${settings.template}"]`);
                if (templateOption) {
                    templateOption.classList.add('selected');
                }
                
                // Template auswählen wenn globale Funktion existiert
                if (typeof window.selectTemplate === 'function') {
                    window.selectTemplate(settings.template);
                }
            }
            

            
        } catch (error) {

        }
    },

    // Toast-Nachrichten
    showSuccess(message) {
        const toast = document.getElementById('successToast');
        const toastBody = document.getElementById('successToastBody');
        if (toast && toastBody) {
            toastBody.textContent = message;
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    },

    showError(message) {
        const toast = document.getElementById('errorToast');
        const toastBody = document.getElementById('errorToastBody');
        if (toast && toastBody) {
            toastBody.textContent = message;
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }
};

// Globale Funktionen für Button-Clicks
window.saveInvitationSettings = function() {

    window.invitationSettings.saveSettings();
};

window.loadInvitationSettings = function() {

    window.invitationSettings.loadSettings();
};

// Automatisches Laden beim Seitenstart
document.addEventListener('DOMContentLoaded', function() {

    
    // Kurz warten bis andere Scripts geladen sind
    setTimeout(() => {
        window.invitationSettings.loadSettings();
    }, 1000);
});



