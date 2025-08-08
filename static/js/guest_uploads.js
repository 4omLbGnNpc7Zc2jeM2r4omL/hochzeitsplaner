/**
 * Gäste-Upload System für das Guest Dashboard
 * Ermöglicht Gästen das Hochladen von Fotos und Videos
 */

// Globale Variablen
let selectedFiles = [];
let maxFileSize = 50 * 1024 * 1024; // 50MB default
let allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi'];
let currentGuestId = null;

/**
 * Initialisiert das Upload-System
 */
function initUploads() {

    
    // Event Listener für Upload-Bereich
    setupUploadArea();
    
    // Event Listener für Datei-Input
    setupFileInput();
    
    // Upload-Button Event Listener
    setupUploadButton();
    
    // Lade Upload-Konfiguration
    loadUploadConfig();
    
    // Lade eigene Uploads
    loadMyUploads();
}

/**
 * Setup für Upload-Bereich (Drag & Drop)
 */
function setupUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    // Drag & Drop Events
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.backgroundColor = '#f0f8ff';
        uploadArea.style.borderColor = '#007bff';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.backgroundColor = '';
        uploadArea.style.borderColor = '#d4af37';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.backgroundColor = '';
        uploadArea.style.borderColor = '#d4af37';
        
        const files = Array.from(e.dataTransfer.files);
        handleFileSelection(files);
    });
    
    // Click Event für Upload-Bereich
    uploadArea.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
}

/**
 * Setup für Datei-Input
 */
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');

    
    if (!fileInput) return;
    
    fileInput.addEventListener('change', (e) => {

        const files = Array.from(e.target.files);
        handleFileSelection(files);
    });
    

}

/**
 * Setup für Upload-Button
 */
function setupUploadButton() {
    const uploadBtn = document.getElementById('uploadBtn');

    
    if (!uploadBtn) return;
    
    uploadBtn.addEventListener('click', () => {

        if (selectedFiles.length > 0) {
            startUpload();
        } else {

        }
    });
    

}

/**
 * Lädt die Upload-Konfiguration vom Server
 */
async function loadUploadConfig() {
    try {
        const response = await fetch('/api/upload-config');
        if (response.ok) {
            const config = await response.json();
            
            // Update maxFileSize
            maxFileSize = (config.max_size_mb || 50) * 1024 * 1024;
            document.getElementById('maxFileSize').textContent = config.max_size_mb || 50;
            
            // Update allowedExtensions
            if (config.allowed_extensions) {
                allowedExtensions = config.allowed_extensions.split(',').map(ext => ext.trim().toLowerCase());
            }
            
            // Update file input accept attribute
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                const imageExts = allowedExtensions.filter(ext => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext));
                const videoExts = allowedExtensions.filter(ext => ['mp4', 'mov', 'avi', 'wmv', 'flv'].includes(ext));
                
                let acceptString = '';
                if (imageExts.length > 0) acceptString += 'image/*,';
                if (videoExts.length > 0) acceptString += 'video/*,';
                
                fileInput.accept = acceptString.slice(0, -1); // Remove trailing comma
            }
            

        }
    } catch (error) {

    }
}

/**
 * Behandelt die Dateiauswahl
 * @param {Array} files - Array der ausgewählten Dateien
 */
function handleFileSelection(files) {

    
    // Validiere Dateien
    const validFiles = [];
    const errors = [];
    
    for (const file of files) {
        const validation = validateFile(file);
        if (validation.valid) {
            validFiles.push(file);
        } else {
            errors.push(`${file.name}: ${validation.error}`);
        }
    }
    
    // Zeige Validierungsfehler
    if (errors.length > 0) {
        showAlert('Fehler bei der Dateiauswahl', errors.join('<br>'), 'warning');
    }
    
    // Füge gültige Dateien hinzu
    if (validFiles.length > 0) {
        selectedFiles = [...selectedFiles, ...validFiles];
        updateSelectedFilesList();
        
        // Zeige Upload-Bereich
        document.getElementById('selectedFiles').style.display = 'block';
        document.getElementById('uploadBtn').disabled = false;
    }
}

/**
 * Validiert eine einzelne Datei
 * @param {File} file - Die zu validierende Datei
 * @returns {Object} Validierungsergebnis
 */
function validateFile(file) {
    // Prüfe Dateigröße
    if (file.size > maxFileSize) {
        return {
            valid: false,
            error: `Datei zu groß (${formatFileSize(file.size)}). Maximum: ${formatFileSize(maxFileSize)}`
        };
    }
    
    // Prüfe Dateierweiterung
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
        return {
            valid: false,
            error: `Dateierweiterung "${extension}" nicht erlaubt. Erlaubt: ${allowedExtensions.join(', ')}`
        };
    }
    
    return { valid: true };
}

/**
 * Aktualisiert die Liste der ausgewählten Dateien
 */
function updateSelectedFilesList() {
    const filesList = document.getElementById('filesList');
    if (!filesList) return;
    
    filesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'list-group-item d-flex justify-content-between align-items-start';
        
        // Bestimme Icon basierend auf Dateityp
        const extension = file.name.split('.').pop().toLowerCase();
        let icon = 'bi-file-earmark';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            icon = 'bi-image';
        } else if (['mp4', 'mov', 'avi', 'wmv', 'flv'].includes(extension)) {
            icon = 'bi-play-circle';
        }
        
        fileItem.innerHTML = `
            <div class="d-flex align-items-start">
                <i class="bi ${icon} me-3 mt-1" style="color: #d4af37; font-size: 1.2rem;"></i>
                <div>
                    <h6 class="mb-1">${file.name}</h6>
                    <p class="mb-1 text-muted small">${formatFileSize(file.size)}</p>
                    <small class="text-muted">${file.type || 'Unbekannter Typ'}</small>
                </div>
            </div>
            <div class="d-flex flex-column align-items-end">
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFile(${index})">
                    <i class="bi bi-trash"></i>
                </button>
                <div class="mt-2">
                    <input type="text" class="form-control form-control-sm" 
                           placeholder="Beschreibung (optional)" 
                           data-file-index="${index}"
                           onchange="updateFileDescription(${index}, this.value)">
                </div>
            </div>
        `;
        
        filesList.appendChild(fileItem);
    });
}

/**
 * Entfernt eine Datei aus der Auswahl
 * @param {number} index - Index der zu entfernenden Datei
 */
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateSelectedFilesList();
    
    if (selectedFiles.length === 0) {
        document.getElementById('selectedFiles').style.display = 'none';
        document.getElementById('uploadBtn').disabled = true;
    }
}

/**
 * Aktualisiert die Beschreibung einer Datei
 * @param {number} index - Index der Datei
 * @param {string} description - Neue Beschreibung
 */
function updateFileDescription(index, description) {
    if (selectedFiles[index]) {
        selectedFiles[index].description = description;
    }
}

/**
 * Startet den Upload-Prozess
 */
async function startUpload() {

    
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadPercent = document.getElementById('uploadPercent');
    
    // UI aktualisieren
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Wird hochgeladen...';
    uploadProgress.style.display = 'block';
    
    try {
        let uploadedCount = 0;
        const totalFiles = selectedFiles.length;
        
        for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('description', file.description || '');
            
            const response = await fetch('/api/guest-upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                uploadedCount++;
                const progress = Math.round((uploadedCount / totalFiles) * 100);
                uploadProgressBar.style.width = `${progress}%`;
                uploadProgressBar.setAttribute('aria-valuenow', progress);
                uploadPercent.textContent = `${progress}%`;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Upload fehlgeschlagen');
            }
        }
        
        // Erfolg
        showAlert('Upload erfolgreich', `${uploadedCount} Datei(en) erfolgreich hochgeladen!`, 'success');
        
        // Aufräumen
        selectedFiles = [];
        document.getElementById('selectedFiles').style.display = 'none';
        document.getElementById('fileInput').value = '';
        
        // Eigene Uploads neu laden
        loadMyUploads();
        
    } catch (error) {

        showAlert('Upload fehlgeschlagen', error.message, 'danger');
    } finally {
        // UI zurücksetzen
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Hochladen';
        uploadProgress.style.display = 'none';
        uploadProgressBar.style.width = '0%';
        uploadProgressBar.setAttribute('aria-valuenow', 0);
        uploadPercent.textContent = '0%';
    }
}

/**
 * Lädt die eigenen Uploads des Gastes
 */
async function loadMyUploads() {

    
    const container = document.getElementById('myUploadsContainer');
    if (!container) return;
    
    try {
        const response = await fetch('/api/my-uploads');
        if (!response.ok) {
            throw new Error('Fehler beim Laden der Uploads');
        }
        
        const uploads = await response.json();

        
        if (uploads.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-cloud-upload text-muted" style="font-size: 3rem;"></i>
                    <h6 class="text-muted mt-3">Noch keine Uploads</h6>
                    <p class="text-muted small">Du hast noch keine Dateien hochgeladen.</p>
                </div>
            `;
            return;
        }
        
        // Uploads anzeigen
        container.innerHTML = '';
        
        uploads.forEach(upload => {
            const uploadCard = createUploadCard(upload);
            container.appendChild(uploadCard);
        });
        
    } catch (error) {

        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Fehler beim Laden der Uploads: ${error.message}
            </div>
        `;
    }
}

/**
 * Erstellt eine Karte für einen Upload
 * @param {Object} upload - Upload-Daten
 * @returns {HTMLElement} Upload-Karte
 */
function createUploadCard(upload) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    
    // Bestimme Icon und Typ
    const isImage = upload.mime_type.startsWith('image/');
    const isVideo = upload.mime_type.startsWith('video/');
    
    let icon = 'bi-file-earmark';
    let typeText = 'Datei';
    
    if (isImage) {
        icon = 'bi-image';
        typeText = 'Bild';
    } else if (isVideo) {
        icon = 'bi-play-circle';
        typeText = 'Video';
    }
    
    card.innerHTML = `
        <div class="card-body">
            <div class="row align-items-center">
                <div class="col-2 col-md-1 text-center">
                    <i class="bi ${icon}" style="font-size: 2rem; color: #d4af37;"></i>
                </div>
                <div class="col-7 col-md-8">
                    <h6 class="mb-1">${upload.original_filename}</h6>
                    <p class="mb-1 text-muted small">
                        ${typeText} • ${formatFileSize(upload.file_size)} • ${formatDate(upload.upload_date)}
                    </p>
                    ${upload.beschreibung ? `<p class="mb-0 small text-secondary">${upload.beschreibung}</p>` : ''}
                </div>
                <div class="col-3 col-md-3 text-end">
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" onclick="viewUpload(${upload.id})" title="Anzeigen">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-success" onclick="downloadUpload(${upload.id})" title="Herunterladen">
                            <i class="bi bi-download"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="deleteUpload(${upload.id})" title="Löschen">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Zeigt einen Upload in einem Modal an
 * @param {number} uploadId - ID des Uploads
 */
async function viewUpload(uploadId) {
    // TODO: Implementiere Upload-Anzeige Modal

}

/**
 * Lädt einen Upload herunter
 * @param {number} uploadId - ID des Uploads
 */
function downloadUpload(uploadId) {
    window.open(`/api/download-upload/${uploadId}`, '_blank');
}

/**
 * Löscht einen Upload
 * @param {number} uploadId - ID des Uploads
 */
async function deleteUpload(uploadId) {
    if (!confirm('Möchtest du diese Datei wirklich löschen?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/delete-upload/${uploadId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('Upload gelöscht', 'Die Datei wurde erfolgreich gelöscht.', 'success');
            loadMyUploads(); // Neu laden
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Löschen fehlgeschlagen');
        }
    } catch (error) {

        showAlert('Löschen fehlgeschlagen', error.message, 'danger');
    }
}

/**
 * Formatiert eine Dateigröße für die Anzeige
 * @param {number} bytes - Größe in Bytes
 * @returns {string} Formatierte Größe
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formatiert ein Datum für die Anzeige
 * @param {string} dateString - Datum als String
 * @returns {string} Formatiertes Datum
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Zeigt eine Benachrichtigung an
 * @param {string} title - Titel der Benachrichtigung
 * @param {string} message - Nachricht
 * @param {string} type - Typ (success, danger, warning, info)
 */
function showAlert(title, message, type = 'info') {
    // Erstelle Alert Element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    
    alertDiv.innerHTML = `
        <strong>${title}</strong><br>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Automatisch nach 5 Sekunden entfernen
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Initialisierung beim Laden der Seite
document.addEventListener('DOMContentLoaded', function() {

    
    // Initialisiere Upload-System direkt
    if (document.getElementById('uploadArea')) {

        initUploads();
        window.uploadsInitialized = true;
    }
    
    // Zusätzlicher Event Listener für Tab-Aktivierung
    const uploadsTab = document.getElementById('uploads-tab');
    if (uploadsTab) {
        uploadsTab.addEventListener('shown.bs.tab', function() {

            if (!window.uploadsInitialized) {

                initUploads();
                window.uploadsInitialized = true;
            }
        });
    }
});

