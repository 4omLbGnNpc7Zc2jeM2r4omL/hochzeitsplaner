/**
 * Einladungs Generator - JavaScript Funktionalität
 * Erstellt personalisierte QR-Code Einladungskarten mit Live-Vorschau
 */

// Globale Variablen
window.einladungsGenerator = null;

// ===== SOFORT VERFÜGBARE GLOBALE FUNKTIONEN =====
// Diese werden SOFORT definiert und sind für onclick-Handler verfügbar

// Erste Überprüfung ob Funktionen existieren
if (typeof selectTemplate === 'undefined') {

    
    // Direkte globale Funktionen (für onclick-Handler)
    window.selectTemplate = function(templateName) {

        
        // Sofortige visuelle Aktualisierung (wie in der Debug-Version)
        try {
            const templateOptions = document.querySelectorAll('.template-option');

            
            // Alle 'selected' entfernen und gewählte Option markieren
            templateOptions.forEach(option => {
                const optionTemplate = option.getAttribute('data-template');
                option.classList.remove('selected');
                
                if (optionTemplate === templateName) {
                    option.classList.add('selected');

                }
            });
            
            // Verifikation
            const selectedCount = document.querySelectorAll('.template-option.selected').length;

            
        } catch (error) {

        }
        
        // Generator-Methode aufrufen wenn verfügbar
        if (window.einladungsGenerator && typeof window.einladungsGenerator.selectTemplate === 'function') {
            window.einladungsGenerator.selectTemplate(templateName);
        } else {

            
            // Retry in 200ms für Generator-spezifische Funktionalität (Vorschau-Update etc.)
            setTimeout(() => {
                if (window.einladungsGenerator && typeof window.einladungsGenerator.selectTemplate === 'function') {
                    window.einladungsGenerator.selectTemplate(templateName);
                } else {

                }
            }, 200);
        }
    };

    window.updatePreview = function() {

        if (window.einladungsGenerator) {
            window.einladungsGenerator.updatePreview();
        }
    };

    window.updateColorFromText = function(colorType) {

        if (window.einladungsGenerator) {
            const textInput = document.getElementById(colorType + 'ColorText');
            const colorPicker = document.getElementById(colorType + 'Color');
            
            if (textInput && colorPicker) {
                const newColor = textInput.value;
                colorPicker.value = newColor;
                window.einladungsGenerator.currentSettings[colorType + 'Color'] = newColor;
                window.einladungsGenerator.updatePreview();
            }
        }
    };

    window.generateTestCard = function() {

        if (window.einladungsGenerator) {
            window.einladungsGenerator.generateTestCard();
        } else {

        }
    };

    window.generateAllCards = function() {

        if (window.einladungsGenerator) {
            window.einladungsGenerator.generateAllCards();
        } else {

        }
    };

    window.downloadTestCard = function() {

        if (window.einladungsGenerator) {
            window.einladungsGenerator.downloadTestCard();
        } else {

        }
    };

    // AUCH im globalen Scope ohne window verfügbar machen
    selectTemplate = window.selectTemplate;
    updatePreview = window.updatePreview;
    updateColorFromText = window.updateColorFromText;
    generateTestCard = window.generateTestCard;
    generateAllCards = window.generateAllCards;
    downloadTestCard = window.downloadTestCard;
    

} else {

}

// ===== KLASSEN-DEFINITION =====

class EinladungsGenerator {
    constructor() {

        
        this.currentTemplate = 'elegant';
        this.guestData = [];
        this.currentSettings = {
            primaryColor: '#8b7355',
            accentColor: '#d4af37',
            backgroundColor: '#ffffff',
            titleText: '',
            dateText: '',
            greetingText: 'Liebe Familie,\nliebe Freunde,',
            invitationText: 'Ihr seid herzlich zu unserer Hochzeit eingeladen!\n\nDer QR Code ist euer magisches Portal zu unserem Hochzeitschaos!',
            fontSize: 100,
            qrSize: 120,
            includePhoto: true,
            showLoginData: true,
            elegantFont: true
        };
        

        
        try {
            this.init();

        } catch (error) {

            throw error;
        }
    }
    
    init() {

        
        try {

            this.loadSettings();

        } catch (error) {

        }
        
        try {

            this.loadGuestData();

        } catch (error) {

        }
        
        try {

            this.initEventListeners();

        } catch (error) {

        }
        
        try {

            this.updatePreview();

        } catch (error) {

        }
    }
    
    initEventListeners() {

        
        // Farb-Picker Event Listeners
        ['primaryColor', 'accentColor', 'backgroundColor'].forEach(colorId => {
            const colorPicker = document.getElementById(colorId);
            const textInput = document.getElementById(colorId + 'Text');
            
            if (colorPicker) {
                colorPicker.addEventListener('change', () => {
                    if (textInput) textInput.value = colorPicker.value;
                    this.currentSettings[colorId] = colorPicker.value;
                    this.updatePreview();
                    this.autoSaveSettings(); // Automatisch speichern
                });

            } else {

            }
            
            if (textInput) {
                textInput.addEventListener('input', () => {
                    if (this.isValidColor(textInput.value)) {
                        if (colorPicker) colorPicker.value = textInput.value;
                        this.currentSettings[colorId] = textInput.value;
                        this.updatePreview();
                    }
                });

            } else {

            }
        });
        
        // Text Input Event Listeners
        ['titleText', 'dateText', 'greetingText', 'invitationText'].forEach(textId => {
            const input = document.getElementById(textId);
            if (input) {
                input.addEventListener('input', () => {
                    this.currentSettings[textId] = input.value;
                    this.updatePreview();
                    this.autoSaveSettings(); // Automatisch speichern
                });

            } else {

            }
        });
        
        // Range Input Event Listeners
        const fontSizeRange = document.getElementById('fontSize');
        if (fontSizeRange) {
            fontSizeRange.addEventListener('input', () => {
                const valueDisplay = document.getElementById('fontSizeValue');
                if (valueDisplay) valueDisplay.textContent = fontSizeRange.value;
                this.currentSettings.fontSize = parseInt(fontSizeRange.value);
                this.updatePreview();
            });

        } else {

        }
        
        const qrSizeRange = document.getElementById('qrSize');
        if (qrSizeRange) {
            qrSizeRange.addEventListener('input', () => {
                const valueDisplay = document.getElementById('qrSizeValue');
                if (valueDisplay) valueDisplay.textContent = qrSizeRange.value;
                this.currentSettings.qrSize = parseInt(qrSizeRange.value);
                this.updatePreview();
            });

        } else {

        }
        
        // Checkbox Event Listeners
        ['includePhoto', 'showLoginData', 'elegantFont'].forEach(checkboxId => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.currentSettings[checkboxId] = checkbox.checked;
                    this.updatePreview();
                });

            } else {

            }
        });
        
        // Template Button Event Listeners
        const templateOptions = document.querySelectorAll('.template-option');

        
        templateOptions.forEach((option, index) => {
            const templateName = option.getAttribute('data-template');

            
            option.addEventListener('click', () => {

                if (templateName) {
                    this.selectTemplate(templateName);
                }
            });
        });
        
        // Test-Gast Auswahl
        const testGuestSelect = document.getElementById('testGuestSelect');
        if (testGuestSelect) {
            testGuestSelect.addEventListener('change', () => {
                this.updatePreview();
            });

        } else {

        }
        

    }
    
    // Auto-Save Debounce Timer
    autoSaveTimer = null;
    
    autoSaveSettings() {
        // Debounce: Speichere erst nach 2 Sekunden ohne weitere Änderungen
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveSettings();
        }, 2000);
    }
    
    async loadGuestData() {
        try {

            
            // Zeige Loading-Indikator
            const select = document.getElementById('testGuestSelect');
            if (select) {
                select.innerHTML = '<option value="">Lade Gäste...</option>';
            }
            
            const response = await apiRequest('/einladungs-generator/gaeste', {
                method: 'GET',
                credentials: 'same-origin'  // Include session cookies
            });
            
            if (response.ok) {
                const data = await response.json();
                this.guestData = data.gaeste || [];
                this.populateGuestSelect();

            } else {

                
                // Fallback: Verwende Testdaten wenn API nicht funktioniert
                this.guestData = [
                    { id: 1, vorname: 'Max', nachname: 'Mustermann' },
                    { id: 2, vorname: 'Maria', nachname: 'Musterfrau' },
                    { id: 3, vorname: 'Test', nachname: 'Gast' }
                ];
                this.populateGuestSelect();

                this.showWarning('Gästeliste konnte nicht geladen werden. Verwende Testdaten.');
            }
        } catch (error) {

            
            // Fallback: Verwende Testdaten
            this.guestData = [
                { id: 1, vorname: 'Max', nachname: 'Mustermann' },
                { id: 2, vorname: 'Maria', nachname: 'Musterfrau' },
                { id: 3, vorname: 'Test', nachname: 'Gast' }
            ];
            this.populateGuestSelect();

            this.showWarning('Netzwerkfehler beim Laden der Gästeliste. Verwende Testdaten.');
        }
    }
    
    populateGuestSelect() {
        const select = document.getElementById('testGuestSelect');
        if (!select) return;
        
        // Bestehende Optionen löschen (außer der ersten)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Gäste hinzufügen
        this.guestData.forEach(guest => {
            const option = document.createElement('option');
            option.value = guest.id;
            option.textContent = `${guest.vorname} ${guest.nachname || ''}`.trim();
            select.appendChild(option);
        });
    }
    
    selectTemplate(templateName) {


        
        this.currentTemplate = templateName;
        
        // Template Buttons aktualisieren
        const templateOptions = document.querySelectorAll('.template-option');

        
        templateOptions.forEach(option => {
            const optionTemplate = option.getAttribute('data-template');
            
            // Entferne 'selected' Klasse von allen
            option.classList.remove('selected');
            
            // Füge 'selected' zur gewählten Option hinzu
            if (optionTemplate === templateName) {
                option.classList.add('selected');

            }
            

        });
        
        // Zusätzlich: Überprüfe ob die Auswahl korrekt ist
        const selectedOption = document.querySelector(`[data-template="${templateName}"]`);
        if (selectedOption) {
            if (!selectedOption.classList.contains('selected')) {

                selectedOption.classList.add('selected');
            }

        } else {

        }
        
        // Aktualisiere Vorschau
        try {
            this.updatePreview();

        } catch (error) {

        }
    }
    
    updatePreview() {

        
        const preview = document.getElementById('cardPreview');
        if (!preview) return;
        
        // Test-Gast Daten
        const testGuestSelect = document.getElementById('testGuestSelect');
        const selectedGuestId = testGuestSelect ? testGuestSelect.value : null;
        const selectedGuest = this.guestData.find(g => g.id == selectedGuestId);
        
        // Vorschau-Elemente aktualisieren
        this.updatePreviewColors(preview);
        this.updatePreviewTexts(selectedGuest);
        this.updatePreviewLayout();
    }
    
    updatePreviewColors(preview) {
        const style = preview.style;
        style.setProperty('--primary-color', this.currentSettings.primaryColor);
        style.setProperty('--accent-color', this.currentSettings.accentColor);
        style.setProperty('--background-color', this.currentSettings.backgroundColor);
        
        // Direkte Farbanwendung
        preview.style.background = this.currentSettings.backgroundColor;
        
        const title = document.getElementById('previewTitle');
        if (title) {
            title.style.color = this.currentSettings.primaryColor;
            if (this.currentSettings.elegantFont) {
                title.style.fontFamily = "'Dancing Script', cursive";
            } else {
                title.style.fontFamily = "Arial, sans-serif";
            }
        }
        
        const date = document.getElementById('previewDate');
        if (date) {
            date.style.color = this.currentSettings.accentColor;
        }
        
        const qrIcon = document.querySelector('#previewQR i');
        if (qrIcon) {
            qrIcon.style.color = this.currentSettings.accentColor;
        }
        
        const scanText = document.getElementById('previewScanText');
        if (scanText) {
            scanText.style.color = this.currentSettings.accentColor;
        }
    }
    
    updatePreviewTexts(selectedGuest) {
        // Titel
        const title = document.getElementById('previewTitle');
        if (title) {
            title.textContent = this.currentSettings.titleText || 'Brautpaar heiratet';
        }
        
        // Datum
        const date = document.getElementById('previewDate');
        if (date) {
            date.textContent = this.currentSettings.dateText || 'Hochzeitsdatum';
        }
        
        // Begrüßung
        const greeting = document.getElementById('previewGreeting');
        if (greeting) {
            greeting.innerHTML = this.currentSettings.greetingText.replace(/\n/g, '<br>');
        }
        
        // Einladungstext
        const invitation = document.getElementById('previewInvitation');
        if (invitation) {
            const shortText = this.currentSettings.invitationText.substring(0, 100) + '...';
            invitation.innerHTML = shortText.replace(/\n/g, '<br>');
        }
        
        // Login-Daten
        const loginData = document.getElementById('previewLoginData');
        if (loginData) {
            if (this.currentSettings.showLoginData) {
                if (selectedGuest) {
                    const guestCode = selectedGuest.guest_code || `GUEST${selectedGuest.id}`;
                    const guestPassword = selectedGuest.guest_password || `pass${selectedGuest.id}`;
                    loginData.innerHTML = `Login: ${guestCode}<br>Password: ${guestPassword}`;
                } else {
                    loginData.innerHTML = 'Login: GUEST123<br>Password: pass123';
                }
                loginData.style.display = 'block';
            } else {
                loginData.style.display = 'none';
            }
        }
    }
    
    updatePreviewLayout() {
        // QR-Code Größe
        const qrPreview = document.getElementById('previewQR');
        if (qrPreview) {
            const size = this.currentSettings.qrSize;
            qrPreview.style.width = size + 'px';
            qrPreview.style.height = size + 'px';
        }
        
        // Schriftgröße
        const preview = document.getElementById('cardPreview');
        if (preview) {
            const fontSize = this.currentSettings.fontSize / 100;
            preview.style.fontSize = fontSize + 'rem';
            
            // Template-spezifische Layout-Anpassungen
            this.applyTemplateLayout(preview);
        }
        
        // Foto anzeigen/verstecken und aus Datenbank laden
        const photo = document.getElementById('previewPhoto');
        if (photo) {
            photo.style.display = this.currentSettings.includePhoto ? 'block' : 'none';
            
            // Wenn Foto angezeigt werden soll, versuche echtes Foto zu laden
            if (this.currentSettings.includePhoto) {
                const img = photo.querySelector('img');
                if (img) {
                    // Versuche echtes Hochzeitsfoto aus API zu laden
                    apiRequest('/guest/wedding-photo')
                        .then(response => {
                            if (response.ok) {
                                return response.blob();
                            }
                            throw new Error('Foto nicht verfügbar');
                        })
                        .then(blob => {
                            const photoUrl = URL.createObjectURL(blob);
                            img.src = photoUrl;
                            img.style.maxWidth = '100%';
                            img.style.height = 'auto';
                            img.style.borderRadius = '8px';
                            
                            // Für elegantes Design: Kein Rahmen
                            if (this.currentTemplate === 'elegant') {
                                img.style.border = 'none';
                            } else {
                                img.style.border = `2px solid ${this.currentSettings.primaryColor}`;
                            }
                        })
                        .catch(error => {

                            // Fallback zu Platzhalter-Foto
                            img.src = 'data:image/svg+xml;base64,' + btoa(`
                                <svg width="200" height="280" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="200" height="280" fill="#f8f9fa" stroke="${this.currentTemplate === 'elegant' ? 'none' : this.currentSettings.primaryColor}" stroke-width="${this.currentTemplate === 'elegant' ? '0' : '2'}"/>
                                    <text x="100" y="140" text-anchor="middle" fill="${this.currentSettings.primaryColor}" font-family="Arial" font-size="14">Hochzeitsfoto</text>
                                    <text x="100" y="160" text-anchor="middle" fill="${this.currentSettings.accentColor}" font-family="Arial" font-size="12">wird aus Datenbank geladen</text>
                                </svg>
                            `);
                        });
                }
            }
        }
        
        // Kamera-Icon hinzufügen (Position wie in generate_guest_qr_cards.py)
        this.updateCameraIcon();
    }
    
    updateCameraIcon() {
        // Kamera-Icon mit Herz-Emoji erstellen (Position wie in Python-Script)
        const qrPreview = document.getElementById('previewQR');
        if (!qrPreview) return;
        
        // Entferne vorhandenes Kamera-Icon
        const existingCamera = document.getElementById('previewCamera');
        if (existingCamera) {
            existingCamera.remove();
        }
        
        // Erstelle neues Kamera-Icon
        const cameraIcon = document.createElement('div');
        cameraIcon.id = 'previewCamera';
        cameraIcon.style.position = 'absolute';
        cameraIcon.style.fontSize = '24px';
        cameraIcon.style.color = this.currentSettings.accentColor;
        cameraIcon.style.transform = 'rotate(45deg)';
        cameraIcon.style.pointerEvents = 'none';
        cameraIcon.style.zIndex = '10';
        cameraIcon.style.filter = 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))';
        
        // Position relativ zum QR-Code (links oben, außerhalb)
        const leftOffset = -35; // 25px Abstand + 10px für Icon-Größe
        const topOffset = -35;  // 25px Abstand + 10px für Icon-Größe
        
        cameraIcon.style.left = `calc(50% - ${(120 - leftOffset)}px)`;
        cameraIcon.style.top = `calc(50% - ${(60 - topOffset)}px)`;
        
        // Kamera-Icon HTML mit Herz-Emoji
        cameraIcon.innerHTML = `
            <div style="position: relative; display: inline-block;">
                📷
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 8px;
                    color: #d4af37;
                ">❤️</div>
            </div>
        `;
        
        // Füge Kamera zum QR-Container hinzu
        qrPreview.style.position = 'relative';
        qrPreview.appendChild(cameraIcon);
    }
        }
        
        // Realistische Kartenproportionen für Vorschau
        if (preview) {
            preview.style.aspectRatio = '2/3'; // 800x1200 Verhältnis
            preview.style.maxWidth = '300px';
            preview.style.border = `2px solid ${this.currentSettings.primaryColor}`;
            preview.style.borderRadius = '15px';
            preview.style.overflow = 'hidden';
        }
    }
    
    // ===== EINSTELLUNGEN LADEN UND SPEICHERN =====
    
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
                Object.assign(this.currentSettings, data.settings);
                
                // UI-Elemente mit geladenen Werten aktualisieren
                this.updateUIFromSettings();
                

            } else {

            }
            
        } catch (error) {

            // Bei Fehler werden die Default-Werte aus dem Constructor verwendet
        }
    }
    
    async saveSettings() {
        // Speichert aktuelle Einstellungen in der Datenbank
        try {

            
            const response = await apiRequest('/einladungs-generator/settings', {
                method: 'POST',
                body: JSON.stringify({
                    settings: this.currentSettings
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {

                
                // Erfolgs-Toast anzeigen
                this.showSuccess('Einstellungen wurden gespeichert');
            } else {
                throw new Error(data.error || 'Unbekannter Fehler beim Speichern');
            }
            
        } catch (error) {

            this.showError('Fehler beim Speichern der Einstellungen: ' + error.message);
        }
    }
    
    updateUIFromSettings() {
        // Aktualisiert UI-Elemente basierend auf geladenen Einstellungen
        try {

            
            // Farb-Picker und Text-Inputs
            ['primaryColor', 'accentColor', 'backgroundColor'].forEach(colorId => {
                const colorPicker = document.getElementById(colorId);
                const textInput = document.getElementById(colorId + 'Text');
                
                if (colorPicker && this.currentSettings[colorId]) {
                    colorPicker.value = this.currentSettings[colorId];
                }
                if (textInput && this.currentSettings[colorId]) {
                    textInput.value = this.currentSettings[colorId];
                }
            });
            
            // Text-Eingabefelder
            ['titleText', 'dateText', 'greetingText', 'invitationText'].forEach(textId => {
                const input = document.getElementById(textId);
                if (input && this.currentSettings[textId] !== undefined) {
                    input.value = this.currentSettings[textId];
                }
            });
            
            // Font Size Range
            const fontSizeRange = document.getElementById('fontSizeRange');
            const fontSizeValue = document.getElementById('fontSizeValue');
            if (fontSizeRange && this.currentSettings.fontSize !== undefined) {
                fontSizeRange.value = this.currentSettings.fontSize;
                if (fontSizeValue) fontSizeValue.textContent = this.currentSettings.fontSize;
            }
            
            // QR Size Range
            const qrSizeRange = document.getElementById('qrSizeRange');
            const qrSizeValue = document.getElementById('qrSizeValue');
            if (qrSizeRange && this.currentSettings.qrSize !== undefined) {
                qrSizeRange.value = this.currentSettings.qrSize;
                if (qrSizeValue) qrSizeValue.textContent = this.currentSettings.qrSize;
            }
            
            // Checkboxen
            ['includePhoto', 'showLoginData', 'elegantFont'].forEach(checkboxId => {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox && this.currentSettings[checkboxId] !== undefined) {
                    checkbox.checked = this.currentSettings[checkboxId];
                }
            });
            
            // Template-Auswahl
            if (this.currentSettings.template) {
                this.selectTemplate(this.currentSettings.template);
            }
            

            
        } catch (error) {

        }
    }
    
    applyTemplateLayout(preview) {
        // Template-spezifische CSS-Klassen entfernen
        preview.classList.remove('template-elegant', 'template-classic', 'template-modern');
        
        // Neue Template-Klasse hinzufügen
        preview.classList.add(`template-${this.currentTemplate}`);
        
        // Elegantes Design: Kein Rahmen
        if (this.currentTemplate === 'elegant') {
            preview.style.border = 'none';
            preview.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.15)';
        } else {
            preview.style.border = `2px solid ${this.currentSettings.primaryColor}`;
            preview.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
        }
        
        const title = document.getElementById('previewTitle');
        const date = document.getElementById('previewDate');
        const greeting = document.getElementById('previewGreeting');
        const invitation = document.getElementById('previewInvitation');
        const qr = document.getElementById('previewQR');
        const photo = document.getElementById('previewPhoto');
        const loginData = document.getElementById('previewLoginData');
        
        // Alle Elemente zurücksetzen
        [title, date, greeting, invitation, qr, photo, loginData].forEach(el => {
            if (el) {
                el.style.cssText = '';
            }
        });
        
        switch (this.currentTemplate) {
            case 'elegant':
                // Elegant: Exakt wie das originale Design
                if (title) {
                    title.style.fontSize = '1.8rem';
                    title.style.fontFamily = this.currentSettings.elegantFont ? "'Dancing Script', cursive" : "Georgia, serif";
                    title.style.textAlign = 'center';
                    title.style.marginBottom = '0.5rem';
                    title.style.color = this.currentSettings.primaryColor;
                    title.style.fontWeight = 'normal';
                }
                if (date) {
                    date.style.fontSize = '1.2rem';
                    date.style.textAlign = 'center';
                    date.style.fontStyle = 'italic';
                    date.style.marginBottom = '1rem';
                    date.style.color = this.currentSettings.accentColor;
                    date.style.fontFamily = this.currentSettings.elegantFont ? "'Dancing Script', cursive" : "Georgia, serif";
                }
                if (photo) {
                    photo.style.margin = '1rem auto';
                    photo.style.textAlign = 'center';
                    const img = photo.querySelector('img');
                    if (img) {
                        img.style.width = '150px';
                        img.style.height = '200px';
                        img.style.objectFit = 'cover';
                        img.style.border = `2px solid ${this.currentSettings.primaryColor}`;
                        img.style.borderRadius = '8px';
                    }
                }
                if (greeting) {
                    greeting.style.fontSize = '1.4rem';
                    greeting.style.textAlign = 'center';
                    greeting.style.margin = '1.5rem 0 1rem 0';
                    greeting.style.color = this.currentSettings.primaryColor;
                    greeting.style.fontFamily = this.currentSettings.elegantFont ? "'Dancing Script', cursive" : "Georgia, serif";
                    greeting.style.lineHeight = '1.3';
                }
                if (invitation) {
                    invitation.style.fontSize = '0.85rem';
                    invitation.style.textAlign = 'center';
                    invitation.style.lineHeight = '1.4';
                    invitation.style.color = this.currentSettings.primaryColor;
                    invitation.style.margin = '1rem 0';
                    invitation.style.fontFamily = this.currentSettings.elegantFont ? "'Dancing Script', cursive" : "Arial, sans-serif";
                }
                if (qr) {
                    // QR-Code rechts unten positionieren (simuliert)
                    qr.style.position = 'absolute';
                    qr.style.bottom = '60px';
                    qr.style.right = '20px';
                    qr.style.border = `3px solid ${this.currentSettings.accentColor}`;
                    qr.style.borderRadius = '8px';
                    qr.style.background = 'white';
                    qr.style.display = 'flex';
                    qr.style.alignItems = 'center';
                    qr.style.justifyContent = 'center';
                    
                    // Scan-Text direkt unter QR-Code
                    const scanText = document.getElementById('previewScanText');
                    if (scanText) {
                        scanText.style.position = 'absolute';
                        scanText.style.bottom = '35px';
                        scanText.style.right = '20px';
                        scanText.style.width = qr.style.width;
                        scanText.style.textAlign = 'center';
                        scanText.style.color = this.currentSettings.accentColor;
                        scanText.style.fontSize = '0.7rem';
                        scanText.style.fontFamily = this.currentSettings.elegantFont ? "'Dancing Script', cursive" : "Arial, sans-serif";
                    }
                }
                if (loginData) {
                    loginData.style.position = 'absolute';
                    loginData.style.bottom = '20px';
                    loginData.style.left = '20px';
                    loginData.style.fontSize = '0.65rem';
                    loginData.style.color = '#666';
                    loginData.style.fontFamily = 'Arial, sans-serif';
                    loginData.style.lineHeight = '1.2';
                }
                // Container für absolute Positionierung
                preview.style.position = 'relative';
                break;
                
            case 'classic':
                // Classic: Traditionell, symmetrisch
                if (title) {
                    title.style.fontSize = '1.6rem';
                    title.style.fontFamily = "Georgia, serif";
                    title.style.textAlign = 'center';
                    title.style.fontWeight = 'bold';
                    title.style.marginBottom = '1rem';
                    title.style.color = this.currentSettings.primaryColor;
                }
                if (date) {
                    date.style.fontSize = '1rem';
                    date.style.textAlign = 'center';
                    date.style.fontWeight = 'normal';
                    date.style.marginBottom = '1.5rem';
                    date.style.color = this.currentSettings.accentColor;
                }
                if (greeting) {
                    greeting.style.fontSize = '1.1rem';
                    greeting.style.textAlign = 'center';
                    greeting.style.margin = '1.5rem 0 1rem 0';
                    greeting.style.color = this.currentSettings.primaryColor;
                    greeting.style.fontFamily = "Georgia, serif";
                }
                if (invitation) {
                    invitation.style.fontSize = '0.9rem';
                    invitation.style.textAlign = 'center';
                    invitation.style.lineHeight = '1.5';
                    invitation.style.color = '#333';
                    invitation.style.margin = '1rem 0';
                }
                if (qr) {
                    qr.style.margin = '1.5rem auto';
                    qr.style.display = 'block';
                    qr.style.border = `2px solid ${this.currentSettings.primaryColor}`;
                    qr.style.borderRadius = '4px';
                }
                preview.style.position = 'static';
                break;
                
            case 'modern':
                // Modern: Minimalistisch, sauber
                if (title) {
                    title.style.fontSize = '1.5rem';
                    title.style.fontFamily = "Arial, sans-serif";
                    title.style.textAlign = 'center';
                    title.style.fontWeight = '300';
                    title.style.marginBottom = '0.5rem';
                    title.style.color = this.currentSettings.primaryColor;
                }
                if (date) {
                    date.style.fontSize = '0.9rem';
                    date.style.textAlign = 'center';
                    date.style.color = '#666';
                    date.style.marginBottom = '2rem';
                    date.style.fontWeight = 'normal';
                }
                if (greeting) {
                    greeting.style.fontSize = '1.2rem';
                    greeting.style.textAlign = 'center';
                    greeting.style.margin = '1rem 0';
                    greeting.style.fontWeight = '300';
                    greeting.style.color = this.currentSettings.primaryColor;
                }
                if (invitation) {
                    invitation.style.fontSize = '0.8rem';
                    invitation.style.textAlign = 'center';
                    invitation.style.lineHeight = '1.4';
                    invitation.style.color = '#666';
                    invitation.style.margin = '1rem 0 2rem 0';
                }
                if (qr) {
                    // Größerer QR-Code für Modern Template
                    const modernQRSize = Math.max(100, this.currentSettings.qrSize * 0.8);
                    qr.style.width = modernQRSize + 'px';
                    qr.style.height = modernQRSize + 'px';
                    qr.style.margin = '2rem auto';
                    qr.style.display = 'block';
                    qr.style.border = `1px solid ${this.currentSettings.accentColor}`;
                    qr.style.borderRadius = '12px';
                }
                if (photo) {
                    photo.style.display = 'none'; // Modern Template ohne Foto
                }
                preview.style.position = 'static';
                break;
        }
    }
    
    async generateTestCard() {
        const testGuestSelect = document.getElementById('testGuestSelect');
        if (!testGuestSelect || !testGuestSelect.value) {
            this.showError('Bitte wählen Sie einen Gast für die Test-Karte aus.');
            return;
        }
        
        try {

            this.showProgress('Erstelle Test-Karte...');
            
            const requestData = {
                guest_id: parseInt(testGuestSelect.value),
                settings: this.currentSettings,
                template: this.currentTemplate
            };
            
            const response = await apiRequest('/generate-test-card', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.hideProgress();
                this.showSuccess(`Test-Karte für ${result.guest_name} erfolgreich erstellt! (Template: ${result.template})`);

                
                // Optional: Karte direkt anzeigen wenn card_data verfügbar ist
                if (result.card_data) {
                    this.showCardPreview(result.card_data, result.guest_name);
                }
                
                // Download-Button für Test-Karte aktivieren
                const downloadBtn = document.querySelector('[onclick="downloadTestCard()"]');
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    downloadBtn.setAttribute('data-filepath', result.filepath);
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Unbekannter Fehler');
            }
        } catch (error) {

            this.hideProgress();
            this.showError('Fehler beim Erstellen der Test-Karte: ' + error.message);
        }
    }
    
    async downloadTestCard() {
        const downloadBtn = document.querySelector('[onclick="downloadTestCard()"]');
        const filepath = downloadBtn ? downloadBtn.getAttribute('data-filepath') : null;
        
        if (!filepath) {
            this.showError('Bitte erst eine Test-Karte erstellen.');
            return;
        }
        
        try {
            window.open(`/api/download-card?filepath=${encodeURIComponent(filepath)}`, '_blank');
        } catch (error) {

            this.showError('Fehler beim Herunterladen der Karte.');
        }
    }
    
    async generateAllCards() {
        if (this.guestData.length === 0) {
            this.showError('Keine Gäste gefunden. Bitte laden Sie die Daten neu.');
            return;
        }
        
        try {

            this.showProgress(`Erstelle ${this.guestData.length} Karten...`);
            
            const requestData = {
                settings: this.currentSettings,
                template: this.currentTemplate
            };
            
            const response = await apiRequest('/generate-all-cards', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.hideProgress();
                this.showGenerationSuccess(result);

            } else {
                const error = await response.json();
                throw new Error(error.error || 'Unbekannter Fehler');
            }
        } catch (error) {

            this.hideProgress();
            this.showError('Fehler beim Erstellen der Karten: ' + error.message);
        }
    }
    
    showProgress(text) {
        const progressDiv = document.querySelector('.generation-progress');
        const successDiv = document.querySelector('.generation-success');
        const progressText = document.getElementById('progressText');
        
        if (progressDiv) progressDiv.style.display = 'block';
        if (successDiv) successDiv.style.display = 'none';
        if (progressText) progressText.textContent = text;
    }
    
    hideProgress() {
        const progressDiv = document.querySelector('.generation-progress');
        if (progressDiv) progressDiv.style.display = 'none';
    }
    
    showGenerationSuccess(result) {
        const successDiv = document.querySelector('.generation-success');
        const successText = document.getElementById('successText');
        const downloadBtn = document.getElementById('downloadZipBtn');
        
        if (successDiv) successDiv.style.display = 'block';
        if (successText) successText.textContent = `${result.generated_count} Karten erfolgreich erstellt!`;
        
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                window.open(`/api/download-zip?filepath=${encodeURIComponent(result.zip_filepath)}`, '_blank');
            };
        }
    }
    
    showCardPreview(cardDataBase64, guestName) {
        // Zeige die generierte Karte in einem Modal oder neuen Fenster an
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'cardPreviewModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">QR-Karte Vorschau - ${guestName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="data:image/png;base64,${cardDataBase64}" class="img-fluid" style="max-height: 600px;">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                        <a href="data:image/png;base64,${cardDataBase64}" download="qr_card_${guestName}.png" class="btn btn-primary">
                            <i class="bi bi-download me-1"></i>Herunterladen
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Modal zum Body hinzufügen und anzeigen
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Modal nach dem Schließen entfernen
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }
    
    showSuccess(message) {
        const toast = document.getElementById('successToast');
        const toastBody = document.getElementById('successToastBody');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }
    
    showError(message) {
        const toast = document.getElementById('errorToast');
        const toastBody = document.getElementById('errorToastBody');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }
    
    showWarning(message) {
        const toast = document.getElementById('warningToast');
        const toastBody = document.getElementById('warningToastBody');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        } else {
            // Fallback: Verwende Error-Toast wenn Warning-Toast nicht existiert

            this.showError('⚠️ ' + message);
        }
    }
    
    isValidColor(color) {
        const style = new Option().style;
        style.color = color;
        return style.color !== '';
    }
}

// Initialisierung bei DOM-Ready
document.addEventListener('DOMContentLoaded', function() {

    
    try {
        // Versuche den Generator zu erstellen

        window.einladungsGenerator = new EinladungsGenerator();

        
        // Bestätige dass alle Methoden verfügbar sind
        const requiredMethods = ['selectTemplate', 'generateTestCard', 'generateAllCards', 'downloadTestCard', 'updatePreview'];
        requiredMethods.forEach(method => {
            const available = typeof window.einladungsGenerator[method] === 'function';

        });
        
    } catch (error) {


        
        // Fallback: Erstelle minimalen Generator

        window.einladungsGenerator = {
            selectTemplate: function(templateName) {

                // Einfache Template-Auswahl ohne volle Funktionalität
                document.querySelectorAll('.template-option').forEach(option => {
                    option.classList.remove('selected');
                    if (option.getAttribute('data-template') === templateName) {
                        option.classList.add('selected');
                    }
                });
            },
            generateTestCard: function() {

                alert('Die Karten-Generierung ist momentan nicht verfügbar.');
            },
            generateAllCards: function() {

                alert('Die Karten-Generierung ist momentan nicht verfügbar.');
            },
            downloadTestCard: function() {

                alert('Download ist momentan nicht verfügbar.');
            },
            updatePreview: function() {

            }
        };

    }
    
    // BACKUP: Funktionen nochmals überprüfen und ggf. definieren
    setTimeout(() => {
        const requiredFunctions = ['selectTemplate', 'generateTestCard', 'generateAllCards', 'downloadTestCard', 'updatePreview'];
        const missingFunctions = [];
        
        requiredFunctions.forEach(funcName => {
            if (typeof window[funcName] !== 'function') {
                missingFunctions.push(funcName);
            }
        });
        
        if (missingFunctions.length > 0) {


            
            // Backup-Definitionen
            if (!window.selectTemplate) {
                window.selectTemplate = function(templateName) {

                    if (window.einladungsGenerator) {
                        window.einladungsGenerator.selectTemplate(templateName);
                    }
                };
                selectTemplate = window.selectTemplate;
            }
            
            if (!window.generateTestCard) {
                window.generateTestCard = function() {

                    if (window.einladungsGenerator) {
                        window.einladungsGenerator.generateTestCard();
                    }
                };
                generateTestCard = window.generateTestCard;
            }
            
            if (!window.generateAllCards) {
                window.generateAllCards = function() {

                    if (window.einladungsGenerator) {
                        window.einladungsGenerator.generateAllCards();
                    }
                };
                generateAllCards = window.generateAllCards;
            }
            
            if (!window.downloadTestCard) {
                window.downloadTestCard = function() {

                    if (window.einladungsGenerator) {
                        window.einladungsGenerator.downloadTestCard();
                    }
                };
                downloadTestCard = window.downloadTestCard;
            }
            
            if (!window.updatePreview) {
                window.updatePreview = function() {

                    if (window.einladungsGenerator) {
                        window.einladungsGenerator.updatePreview();
                    }
                };
                updatePreview = window.updatePreview;
            }
        }
        

        requiredFunctions.forEach(funcName => {
            const available = typeof window[funcName] === 'function';

        });
        
    }, 500); // Warte 500ms nach DOM-Load
    
    // Sofortige Funktionalitätsprüfung




    
    if (typeof window.selectTemplate === 'function') {

    } else {

    }
});

// Debug-Funktion
window.debugEinladungsGenerator = function() {







};

