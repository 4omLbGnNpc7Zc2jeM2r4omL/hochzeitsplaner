/**
 * Settings Manager für Einladungs-Generator
 * Erweitert den bestehenden Generator um Auto-Save Funktionalität
 */

// Settings Manager Funktionen
window.SettingsManager = {
    
    async loadSettings() {
        // Lädt Einstellungen aus der Datenbank
        try {

            
            const response = await fetch('/api/einladungs-generator/settings', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
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
                

                return data.settings;
            } else {

                return null;
            }
            
        } catch (error) {

            return null;
        }
    },
    
    async saveSettings() {
        // Speichert aktuelle Einstellungen in der Datenbank
        if (!window.einladungsGenerator) {

            return false;
        }
        
        try {

            
            const response = await fetch('/api/einladungs-generator/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: window.einladungsGenerator.currentSettings
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {

                
                // Erfolgs-Toast anzeigen
                this.showToast('success', 'Einstellungen wurden gespeichert');
                return true;
            } else {
                throw new Error(data.error || 'Unbekannter Fehler beim Speichern');
            }
            
        } catch (error) {

            this.showToast('error', 'Fehler beim Speichern der Einstellungen: ' + error.message);
            return false;
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
            if (settings.template && window.selectTemplate) {
                window.selectTemplate(settings.template);
            }
            

            
        } catch (error) {

        }
    },
    
    // Auto-Save mit Debounce
    autoSaveTimer: null,
    
    autoSaveSettings() {
        // Debounce: Speichere erst nach 2 Sekunden ohne weitere Änderungen
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveSettings();
        }, 2000);
    },
    
    showToast(type, message) {
        // Zeigt Toast-Nachrichten an
        const toastId = type === 'success' ? 'successToast' : 'errorToast';
        const bodyId = type === 'success' ? 'successToastBody' : 'errorToastBody';
        
        const toastElement = document.getElementById(toastId);
        const bodyElement = document.getElementById(bodyId);
        
        if (toastElement && bodyElement) {
            bodyElement.textContent = message;
            
            // Bootstrap Toast anzeigen
            const toast = new bootstrap.Toast(toastElement);
            toast.show();
        } else {
            // Fallback: alert()
            alert(message);
        }
    },
    
    // Initialisierung
    init() {

        
        // Event Listeners für Auto-Save hinzufügen
        this.setupAutoSaveListeners();
        
        // Einstellungen beim Start laden
        setTimeout(() => {
            this.loadSettings();
        }, 1000); // Warte bis Generator bereit ist
    },
    
    setupAutoSaveListeners() {
        // Überwache Änderungen und speichere automatisch
        
        // Beobachte Änderungen am currentSettings Objekt
        if (window.einladungsGenerator) {
            const originalUpdatePreview = window.einladungsGenerator.updatePreview;
            if (originalUpdatePreview) {
                window.einladungsGenerator.updatePreview = function() {
                    originalUpdatePreview.call(this);
                    window.SettingsManager.autoSaveSettings();
                };
            }
        }
        
        // Direkte Event Listeners auf wichtige Elemente
        const elementsToWatch = [
            'primaryColor', 'accentColor', 'backgroundColor',
            'primaryColorText', 'accentColorText', 'backgroundColorText',
            'titleText', 'dateText', 'greetingText', 'invitationText',
            'fontSizeRange', 'qrSizeRange',
            'includePhoto', 'showLoginData', 'elegantFont'
        ];
        
        elementsToWatch.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.autoSaveSettings();
                });
            }
        });
        

    }
};

// Auto-Initialisierung nach DOM-Load
document.addEventListener('DOMContentLoaded', () => {
    // Warte etwas, damit der Generator initialisiert ist
    setTimeout(() => {
        window.SettingsManager.init();
    }, 2000);
});



