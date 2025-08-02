/**
 * Excel Import API - JavaScript Client
 * 
 * Diese Datei stellt JavaScript-Funktionen für den Import von Excel-Dateien bereit.
 * Kann in andere Anwendungen oder Scripts eingebunden werden.
 */

class GuestListImporter {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.importEndpoint = '/api/import/excel';
    }

    /**
     * Importiert eine Excel-Datei mit Gästeliste
     * @param {File} file - Excel-Datei (.xlsx, .xls)
     * @param {Object} options - Import-Optionen
     * @param {string|number} options.sheetName - Arbeitsblatt (0 für erstes, oder Name)
     * @param {boolean} options.replaceExisting - Bestehende Gästeliste ersetzen
     * @param {Function} options.onProgress - Fortschritt-Callback
     * @returns {Promise<Object>} Import-Ergebnis
     */
    async importExcelFile(file, options = {}) {
        const {
            sheetName = 0,
            replaceExisting = false,
            onProgress = null
        } = options;

        // Validierung
        if (!file) {
            throw new Error('Keine Datei ausgewählt');
        }

        if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
            throw new Error('Nur Excel-Dateien (.xlsx, .xls) sind erlaubt');
        }

        // FormData vorbereiten
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sheet_name', sheetName.toString());
        formData.append('replace_existing', replaceExisting.toString());

        try {
            // Progress-Event falls verfügbar
            if (onProgress) {
                onProgress({ stage: 'uploading', progress: 0 });
            }

            const response = await fetch(this.baseUrl + this.importEndpoint, {
                method: 'POST',
                body: formData
            });

            if (onProgress) {
                onProgress({ stage: 'processing', progress: 50 });
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            if (onProgress) {
                onProgress({ stage: 'completed', progress: 100 });
            }

            return result;

        } catch (error) {
            if (onProgress) {
                onProgress({ stage: 'error', progress: 0, error: error.message });
            }
            throw error;
        }
    }

    /**
     * Importiert Excel-Daten aus einer URL
     * @param {string} fileUrl - URL zur Excel-Datei
     * @param {Object} options - Import-Optionen
     * @returns {Promise<Object>} Import-Ergebnis
     */
    async importFromUrl(fileUrl, options = {}) {
        try {
            // Datei von URL laden
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Fehler beim Laden der Datei: ${response.statusText}`);
            }

            const blob = await response.blob();
            const filename = fileUrl.split('/').pop() || 'import.xlsx';
            const file = new File([blob], filename, { type: blob.type });

            return await this.importExcelFile(file, options);

        } catch (error) {
            throw new Error(`URL-Import fehlgeschlagen: ${error.message}`);
        }
    }

    /**
     * Validiert eine Excel-Datei vor dem Import
     * @param {File} file - Excel-Datei
     * @returns {Object} Validierungs-Ergebnis
     */
    validateFile(file) {
        const errors = [];
        const warnings = [];

        // Datei-Validierung
        if (!file) {
            errors.push('Keine Datei ausgewählt');
            return { valid: false, errors, warnings };
        }

        // Dateierweiterung prüfen
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            errors.push('Nur Excel-Dateien (.xlsx, .xls) sind erlaubt');
        }

        // Dateigröße prüfen (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            errors.push('Datei ist zu groß (max. 10MB)');
        }

        // Warnungen
        if (file.size > 1024 * 1024) { // 1MB
            warnings.push('Große Datei - Import kann länger dauern');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Erstellt ein Import-Formular-Element
     * @param {string} containerId - ID des Container-Elements
     * @param {Object} options - UI-Optionen
     * @returns {HTMLElement} Formular-Element
     */
    createImportForm(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container mit ID '${containerId}' nicht gefunden`);
        }

        const {
            showSheetSelection = true,
            showReplaceOption = true,
            buttonText = 'Gästeliste importieren',
            acceptText = 'Excel-Dateien (.xlsx, .xls)'
        } = options;

        const form = document.createElement('form');
        form.innerHTML = `
            <div class="mb-3">
                <label class="form-label">Excel-Datei auswählen</label>
                <input type="file" class="form-control" accept=".xlsx,.xls" required>
                <div class="form-text">${acceptText}</div>
            </div>
            
            ${showSheetSelection ? `
            <div class="mb-3">
                <label class="form-label">Arbeitsblatt</label>
                <input type="text" class="form-control" value="0" placeholder="0 oder Blattname">
                <div class="form-text">0 für erstes Arbeitsblatt oder Name des Blatts</div>
            </div>
            ` : ''}
            
            ${showReplaceOption ? `
            <div class="mb-3">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox">
                    <label class="form-check-label">Bestehende Gästeliste ersetzen</label>
                </div>
            </div>
            ` : ''}
            
            <button type="submit" class="btn btn-primary">
                <i class="bi bi-cloud-upload me-2"></i>${buttonText}
            </button>
            
            <div class="mt-3" style="display: none;">
                <div class="progress">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="alert-container mt-3"></div>
        `;

        // Event-Handler hinzufügen
        this._attachFormEvents(form);

        container.appendChild(form);
        return form;
    }

    /**
     * Hängt Event-Handler an ein Formular an
     * @private
     */
    _attachFormEvents(form) {
        const fileInput = form.querySelector('input[type="file"]');
        const sheetInput = form.querySelector('input[type="text"]');
        const replaceCheckbox = form.querySelector('input[type="checkbox"]');
        const submitButton = form.querySelector('button[type="submit"]');
        const progressContainer = form.querySelector('.mt-3');
        const progressBar = form.querySelector('.progress-bar');
        const alertContainer = form.querySelector('.alert-container');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const file = fileInput.files[0];
            if (!file) {
                this._showAlert(alertContainer, 'Bitte wählen Sie eine Datei aus', 'warning');
                return;
            }

            // Validierung
            const validation = this.validateFile(file);
            if (!validation.valid) {
                this._showAlert(alertContainer, validation.errors.join('<br>'), 'danger');
                return;
            }

            // Warnungen anzeigen
            if (validation.warnings.length > 0) {
                this._showAlert(alertContainer, validation.warnings.join('<br>'), 'warning');
            }

            const options = {
                sheetName: sheetInput ? sheetInput.value : 0,
                replaceExisting: replaceCheckbox ? replaceCheckbox.checked : false,
                onProgress: (progress) => {
                    if (progress.stage === 'uploading' || progress.stage === 'processing') {
                        progressContainer.style.display = 'block';
                        progressBar.style.width = progress.progress + '%';
                        submitButton.disabled = true;
                    } else if (progress.stage === 'completed') {
                        progressContainer.style.display = 'none';
                        submitButton.disabled = false;
                    } else if (progress.stage === 'error') {
                        progressContainer.style.display = 'none';
                        submitButton.disabled = false;
                    }
                }
            };

            try {
                const result = await this.importExcelFile(file, options);
                this._showAlert(alertContainer, result.message, 'success');
                
                // Formular zurücksetzen
                form.reset();
                
                // Optional: Seite neu laden oder weiterleiten
                if (window.location.pathname.includes('gaeste')) {
                    setTimeout(() => window.location.reload(), 2000);
                }

            } catch (error) {
                console.error('Import-Fehler:', error);
                this._showAlert(alertContainer, error.message, 'danger');
            }
        });
    }

    /**
     * Zeigt eine Alert-Nachricht an
     * @private
     */
    _showAlert(container, message, type) {
        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'warning' ? 'alert-warning' : 'alert-danger';
        
        const alertIcon = type === 'success' ? 'check-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'x-circle';

        container.innerHTML = `
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                <i class="bi bi-${alertIcon} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}

// Globale Instanz verfügbar machen
window.GuestListImporter = GuestListImporter;

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuestListImporter;
}
