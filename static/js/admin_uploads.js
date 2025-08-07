/**
 * Admin Uploads JavaScript - Fixed Version
 * Manages upload display on the admin uploads page
 */

let allUploads = [];
let filteredUploads = [];

/**
 * Initialize the admin uploads page
 */
function initAdminUploads() {
    console.log('🎯 Admin Uploads wird initialisiert...');
    
    // Load initial data
    loadUploadStatistics();
    loadAllUploads();
    
    // Setup filter event listeners
    setupFilterListeners();
    
    console.log('✅ Admin Uploads initialisiert');
}

/**
 * Setup filter event listeners
 */
function setupFilterListeners() {
    console.log('🎧 Setting up filter listeners...');
    
    const filterGuest = document.getElementById('filterGuest');
    const filterType = document.getElementById('filterType');
    
    if (filterGuest) {
        filterGuest.addEventListener('change', applyFilters);
        console.log('✅ Guest filter listener added');
    }
    
    if (filterType) {
        filterType.addEventListener('change', applyFilters);
        console.log('✅ Type filter listener added');
    }
}

/**
 * Get file type for filtering (mime_type or file_type)
 */
function getFileType(upload) {
    // Use mime_type if available, otherwise fall back to file_type
    return upload.mime_type || upload.file_type || 'unknown';
}

/**
 * Get guest name from upload data
 */
function getGuestName(upload) {
    // Try different possible field combinations
    if (upload.guest_name) {
        return upload.guest_name;
    }
    
    // Combine vorname and nachname if available
    const vorname = upload.gast_vorname || upload.vorname || '';
    const nachname = upload.gast_nachname || upload.nachname || '';
    
    if (vorname && nachname) {
        return `${vorname} ${nachname}`;
    } else if (vorname) {
        return vorname;
    } else if (nachname) {
        return nachname;
    }
    
    return 'Unbekannt';
}

/**
 * Apply filters to uploads
 */
function applyFilters() {
    console.log('🔍 Applying filters...');
    
    const filterGuest = document.getElementById('filterGuest');
    const filterType = document.getElementById('filterType');
    const uploadCount = document.getElementById('uploadCount');
    
    if (!filterGuest || !filterType) {
        console.warn('⚠️ Filter elements not found');
        return;
    }
    
    const selectedGuest = filterGuest.value;
    const selectedType = filterType.value;
    
    console.log('🔍 Filter values:', { selectedGuest, selectedType });
    
    // Filter uploads
    filteredUploads = allUploads.filter(upload => {
        const guestMatch = !selectedGuest || getGuestName(upload) === selectedGuest;
        const typeMatch = !selectedType || getFileType(upload).startsWith(selectedType + '/');
        
        return guestMatch && typeMatch;
    });
    
    console.log(`🔍 Filtered ${allUploads.length} uploads to ${filteredUploads.length} results`);
    
    // Update count
    if (uploadCount) uploadCount.textContent = filteredUploads.length;
    
    // Check if we have results
    const emptyState = document.getElementById('emptyState');
    if (filteredUploads.length === 0) {
        console.log('📭 No uploads match filters - showing empty state');
        if (emptyState) {
            emptyState.innerHTML = `
                <i class="bi bi-funnel text-muted" style="font-size: 4rem;"></i>
                <h4 class="text-muted mt-3">Keine Uploads gefunden</h4>
                <p class="text-muted">Keine Uploads entsprechen den aktuellen Filterkriterien.</p>
                <button class="btn btn-outline-secondary" onclick="clearFilters()">
                    <i class="bi bi-x-circle me-2"></i>Filter zurücksetzen
                </button>
            `;
            emptyState.style.display = 'block';
        }
        clearUploadsDisplay();
        return;
    }
    
    // Hide empty state and render filtered uploads
    if (emptyState) emptyState.style.display = 'none';
    renderUploadsTable(filteredUploads);
    renderUploadsGrid(filteredUploads);
    
    console.log('✅ Filters applied successfully');
}

/**
 * Clear all filters
 */
function clearFilters() {
    console.log('🧹 Clearing filters...');
    
    const filterGuest = document.getElementById('filterGuest');
    const filterType = document.getElementById('filterType');
    
    if (filterGuest) filterGuest.value = '';
    if (filterType) filterType.value = '';
    
    // Re-apply filters (which will show all uploads)
    applyFilters();
}

/**
 * Load upload statistics
 */
async function loadUploadStatistics() {
    console.log('📊 Lade Upload-Statistiken...');
    
    try {
        const response = await fetch('/api/admin/upload-statistics', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Fehler beim Laden der Statistiken');
        }
        
        const stats = await response.json();
        console.log('📊 Statistiken erhalten:', stats);
        
        // Update statistics display
        const totalUploads = document.getElementById('totalUploads');
        const totalImages = document.getElementById('totalImages');
        const totalVideos = document.getElementById('totalVideos');
        const totalSize = document.getElementById('totalSize');
        
        if (totalUploads) totalUploads.textContent = stats.total_uploads || 0;
        if (totalImages) totalImages.textContent = stats.total_images || 0;
        if (totalVideos) totalVideos.textContent = stats.total_videos || 0;
        if (totalSize) totalSize.textContent = formatFileSize(stats.total_size || 0);
        
        console.log('✅ Upload-Statistiken geladen');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Statistiken:', error);
    }
}

/**
 * Load all uploads and display them
 */
async function loadAllUploads() {
    console.log('📂 Lade alle Uploads...');
    
    // Get required elements
    const uploadsTableBody = document.getElementById('uploadsTableBody');
    const uploadsGrid = document.getElementById('uploadsGrid');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const uploadCount = document.getElementById('uploadCount');
    
    console.log('🎯 Upload Elements Check:');
    console.log('  - uploadsTableBody:', uploadsTableBody);
    console.log('  - uploadsGrid:', uploadsGrid);
    console.log('  - loadingState:', loadingState);
    console.log('  - emptyState:', emptyState);
    
    if (!uploadsTableBody || !uploadsGrid) {
        console.error('❌ Required upload elements not found!');
        return;
    }
    
    // Show loading state
    if (loadingState) loadingState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    try {
        console.log('🚀 Fetching uploads from API...');
        const response = await fetch('/api/admin/all-uploads', {
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 API Response Status:', response.status, response.statusText);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('🔐 Authentication failed');
                showAuthError();
                return;
            }
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const uploads = await response.json();
        console.log('📦 Uploads received:', uploads);
        console.log('📦 Upload count:', uploads.length);
        
        allUploads = uploads;
        filteredUploads = uploads; // Initial state: no filters applied
        
        // Hide loading state
        if (loadingState) loadingState.style.display = 'none';
        
        // Update upload count
        if (uploadCount) uploadCount.textContent = uploads.length;
        
        if (uploads.length === 0) {
            console.log('📭 No uploads found - showing empty state');
            if (emptyState) emptyState.style.display = 'block';
            clearUploadsDisplay();
            return;
        }
        
        console.log(`📁 Rendering ${uploads.length} uploads...`);
        if (emptyState) emptyState.style.display = 'none';
        
        // Update filter options
        updateFilterOptions(uploads);
        
        // Render uploads
        renderUploadsTable(uploads);
        renderUploadsGrid(uploads);
        
        console.log('✅ Uploads rendered successfully!');
        
    } catch (error) {
        console.error('❌ Error loading uploads:', error);
        showLoadError(error.message);
    }
}

/**
 * Render uploads in table view
 */
function renderUploadsTable(uploads) {
    const uploadsTableBody = document.getElementById('uploadsTableBody');
    if (!uploadsTableBody) return;
    
    console.log('📋 Rendering table view with', uploads.length, 'uploads');
    
    uploadsTableBody.innerHTML = '';
    
    uploads.forEach(upload => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="upload-preview" style="width: 60px; height: 60px;">
                    ${getFilePreview(upload)}
                </div>
            </td>
            <td>
                <strong>${escapeHtml(upload.original_filename)}</strong><br>
                <small class="text-muted">${escapeHtml(upload.filename)}</small>
            </td>
            <td>
                ${escapeHtml(getGuestName(upload))}
            </td>
            <td>
                <span class="badge ${getFileTypeBadge(getFileType(upload))}">
                    ${(upload.file_type || getFileType(upload).split('/')[0]).toUpperCase()}
                </span>
            </td>
            <td>${formatFileSize(upload.file_size)}</td>
            <td>
                <small>${formatDateTime(upload.upload_date)}</small>
            </td>
            <td>
                ${getApprovalStatusBadge(upload)}
            </td>
            <td>
                <small>${escapeHtml(upload.beschreibung || 'Keine Beschreibung')}</small>
            </td>
            <td>
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
            </td>
        `;
        uploadsTableBody.appendChild(row);
    });
    
    console.log('✅ Table view rendered');
}

/**
 * Render uploads in grid view
 */
function renderUploadsGrid(uploads) {
    const uploadsGrid = document.getElementById('uploadsGrid');
    if (!uploadsGrid) return;
    
    console.log('🔲 Rendering grid view with', uploads.length, 'uploads');
    
    uploadsGrid.innerHTML = '';
    
    uploads.forEach(upload => {
        const col = document.createElement('div');
        col.className = 'col-md-4 col-lg-3 mb-3';
        
        col.innerHTML = `
            <div class="card h-100">
                <div class="card-img-top d-flex align-items-center justify-content-center" style="height: 200px; background-color: #f8f9fa;">
                    ${getFilePreview(upload, 'large')}
                </div>
                <div class="card-body">
                    <h6 class="card-title text-truncate" title="${escapeHtml(upload.original_filename)}">
                        ${escapeHtml(upload.original_filename)}
                    </h6>
                    <p class="card-text">
                        <small class="text-muted">
                            Von: ${escapeHtml(getGuestName(upload))}<br>
                            Größe: ${formatFileSize(upload.file_size)}<br>
                            Datum: ${formatDateTime(upload.upload_date)}
                        </small>
                    </p>
                    <div class="mb-2">
                        ${getApprovalStatusBadge(upload)}
                    </div>
                </div>
                <div class="card-footer">
                    <div class="btn-group w-100" role="group">
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="viewUpload(${upload.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-success btn-sm" onclick="downloadUpload(${upload.id})">
                            <i class="bi bi-download"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteUpload(${upload.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        uploadsGrid.appendChild(col);
    });
    
    console.log('✅ Grid view rendered');
}

/**
 * Update filter options based on available uploads
 */
function updateFilterOptions(uploads) {
    console.log('🔍 Updating filter options...');
    
    const filterGuest = document.getElementById('filterGuest');
    if (!filterGuest) {
        console.warn('⚠️ filterGuest element not found');
        return;
    }
    
    // Get unique guest names from uploads
    const uniqueGuests = [...new Set(uploads.map(upload => getGuestName(upload)))];
    uniqueGuests.sort(); // Sort alphabetically
    
    console.log('👥 Unique guests found:', uniqueGuests);
    
    // Clear existing options (except "Alle Gäste")
    filterGuest.innerHTML = '<option value="">Alle Gäste</option>';
    
    // Add guest options
    uniqueGuests.forEach(guestName => {
        const option = document.createElement('option');
        option.value = guestName;
        option.textContent = guestName;
        filterGuest.appendChild(option);
    });
    
    console.log(`✅ Filter updated with ${uniqueGuests.length} guests`);
}

/**
 * Clear uploads display
 */
function clearUploadsDisplay() {
    const uploadsTableBody = document.getElementById('uploadsTableBody');
    const uploadsGrid = document.getElementById('uploadsGrid');
    
    if (uploadsTableBody) uploadsTableBody.innerHTML = '';
    if (uploadsGrid) uploadsGrid.innerHTML = '';
}

/**
 * Show authentication error
 */
function showAuthError() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (emptyState) {
        emptyState.innerHTML = `
            <i class="bi bi-shield-exclamation text-warning" style="font-size: 4rem;"></i>
            <h4 class="text-warning mt-3">Authentifizierung fehlgeschlagen</h4>
            <p class="text-muted">Deine Session ist möglicherweise abgelaufen.</p>
            <button class="btn btn-wedding-warning" onclick="window.location.reload()">
                <i class="bi bi-arrow-clockwise me-2"></i>Seite neu laden
            </button>
        `;
        emptyState.style.display = 'block';
    }
}

/**
 * Show load error
 */
function showLoadError(message) {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (emptyState) {
        emptyState.innerHTML = `
            <i class="bi bi-exclamation-triangle text-danger" style="font-size: 4rem;"></i>
            <h4 class="text-danger mt-3">Fehler beim Laden</h4>
            <p class="text-muted">${escapeHtml(message)}</p>
            <button class="btn btn-outline-danger" onclick="loadAllUploads()">
                <i class="bi bi-arrow-clockwise me-2"></i>Erneut versuchen
            </button>
        `;
        emptyState.style.display = 'block';
    }
}

/**
 * Get file preview HTML
 */
function getFilePreview(upload, size = 'small') {
    const iconSize = size === 'large' ? '3rem' : '1.5rem';
    const fileType = getFileType(upload);
    
    if (fileType.startsWith('image/')) {
        return `<img src="/api/gallery-image/${upload.id}" alt="${escapeHtml(upload.original_filename)}" class="img-fluid rounded" style="max-height: ${size === 'large' ? '180px' : '50px'}; max-width: 100%;">`;
    } else if (fileType.startsWith('video/')) {
        return `<i class="bi bi-play-circle text-primary" style="font-size: ${iconSize};"></i>`;
    } else {
        return `<i class="bi bi-file-earmark text-secondary" style="font-size: ${iconSize};"></i>`;
    }
}

/**
 * Get file type badge class
 */
function getFileTypeBadge(fileType) {
    if (fileType.startsWith('image/') || fileType === 'image') return 'badge-wedding-success';
    if (fileType.startsWith('video/') || fileType === 'video') return 'badge-wedding-info';
    return 'badge-wedding-secondary';
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date time
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get approval status badge for upload
 */
function getApprovalStatusBadge(upload) {
    const status = upload.admin_approved;
    
    if (status === 1) {
        return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Genehmigt</span>';
    } else if (status === -1) {
        return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Abgelehnt</span>';
    } else {
        return '<span class="badge bg-warning"><i class="bi bi-hourglass-split me-1"></i>Ausstehend</span>';
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Placeholder functions for upload actions
 */
function viewUpload(id) {
    console.log('View upload:', id);
    // TODO: Implement view upload functionality
}

function downloadUpload(id) {
    console.log('Download upload:', id);
    window.open(`/api/admin/download-upload/${id}`, '_blank');
}

async function deleteUpload(id) {
    console.log('Delete upload:', id);
    
    // Finde Upload-Info für Modal
    const upload = allUploads.find(u => u.id === id);
    if (!upload) {
        showDeleteError('Upload nicht gefunden');
        return;
    }
    
    // Zeige Bestätigungs-Modal mit Upload-Details
    showDeleteConfirmModal(upload);
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmModal(upload) {
    // Modal-Elemente
    const modal = document.getElementById('deleteConfirmModal');
    const deletePreview = document.getElementById('deletePreview');
    const deleteFilename = document.getElementById('deleteFilename');
    const deleteGuestName = document.getElementById('deleteGuestName');
    const deleteFileSize = document.getElementById('deleteFileSize');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (!modal || !deletePreview || !deleteFilename || !deleteGuestName || !deleteFileSize || !confirmDeleteBtn) {
        console.error('❌ Modal-Elemente nicht gefunden');
        // Fallback zu Browser-Confirm
        if (confirm(`Möchten Sie die Datei "${upload.original_filename}" wirklich löschen?`)) {
            performDeleteUpload(upload.id);
        }
        return;
    }
    
    // Upload-Details ins Modal einfügen
    deletePreview.innerHTML = getFilePreview(upload);
    deleteFilename.textContent = upload.original_filename;
    deleteGuestName.textContent = getGuestName(upload);
    deleteFileSize.textContent = formatFileSize(upload.file_size);
    
    // Event-Listener für Bestätigung
    const handleConfirmDelete = () => {
        confirmDeleteBtn.removeEventListener('click', handleConfirmDelete);
        
        // Modal schließen
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) {
            bootstrapModal.hide();
        }
        
        // Löschung durchführen
        performDeleteUpload(upload.id);
    };
    
    // Alten Event-Listener entfernen und neuen hinzufügen
    confirmDeleteBtn.removeEventListener('click', handleConfirmDelete);
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    
    // Modal anzeigen
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

/**
 * Perform actual upload deletion
 */
async function performDeleteUpload(uploadId) {
    // Finde Upload für Feedback
    const upload = allUploads.find(u => u.id === uploadId);
    const filename = upload ? upload.original_filename : `Upload ${uploadId}`;
    
    try {
        console.log(`🗑️ Lösche Upload ${uploadId}...`);
        
        // Loading-Feedback
        showToast('Wird gelöscht...', `Die Datei "${filename}" wird gelöscht...`, 'info');
        
        const response = await fetch(`/api/admin/delete-upload/${uploadId}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Upload nicht gefunden');
            } else if (response.status === 403) {
                throw new Error('Keine Berechtigung zum Löschen');
            } else {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `Server-Fehler: ${response.status}`);
            }
        }
        
        const result = await response.json();
        console.log('✅ Upload erfolgreich gelöscht:', result);
        
        // Erfolgs-Feedback
        showDeleteSuccess(filename);
        
        // Uploads neu laden
        await loadAllUploads();
        await loadUploadStatistics();
        
    } catch (error) {
        console.error('❌ Fehler beim Löschen:', error);
        showDeleteError(error.message);
    }
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info') {
    const toastTypes = {
        'success': 'successToast',
        'error': 'errorToast', 
        'danger': 'errorToast',
        'info': 'infoToast'
    };
    
    const toastId = toastTypes[type] || 'infoToast';
    const toastBodyId = toastId + 'Body';
    
    const toastElement = document.getElementById(toastId);
    const toastBody = document.getElementById(toastBodyId);
    
    if (toastElement && toastBody) {
        // Set message
        toastBody.innerHTML = `<strong>${title}</strong><br>${message}`;
        
        // Show toast
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: type === 'error' || type === 'danger' ? 8000 : 5000  // Errors stay longer
        });
        toast.show();
    } else {
        // Fallback to alert
        alert(`${title}: ${message}`);
    }
}

/**
 * Show delete success message
 */
function showDeleteSuccess(filename) {
    showToast('Erfolgreich gelöscht', `Die Datei "${filename}" wurde erfolgreich gelöscht.`, 'success');
}

/**
 * Show delete error message
 */
function showDeleteError(message) {
    showToast('Löschung fehlgeschlagen', message, 'error');
}

function refreshUploads() {
    console.log('Refreshing uploads...');
    loadUploadStatistics();
    loadAllUploads();
}

function downloadAllUploads() {
    console.log('Download all uploads...');
    window.open('/api/admin/download-all-uploads', '_blank');
}

function setView(viewType) {
    console.log('Set view to:', viewType);
    const listView = document.getElementById('uploadsListView');
    const gridView = document.getElementById('uploadsGridView');
    const viewListBtn = document.getElementById('viewList');
    const viewGridBtn = document.getElementById('viewGrid');
    
    if (viewType === 'grid') {
        if (listView) listView.style.display = 'none';
        if (gridView) gridView.style.display = 'block';
        if (viewListBtn) viewListBtn.classList.remove('active');
        if (viewGridBtn) viewGridBtn.classList.add('active');
    } else {
        if (listView) listView.style.display = 'block';
        if (gridView) gridView.style.display = 'none';
        if (viewListBtn) viewListBtn.classList.add('active');
        if (viewGridBtn) viewGridBtn.classList.remove('active');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing admin uploads...');
    initAdminUploads();
});

// Debug function
window.debugAdminUploads = function() {
    console.log('🔍 Debug Admin Uploads:');
    console.log('  - allUploads:', allUploads);
    console.log('  - allUploads.length:', allUploads.length);
    console.log('  - filteredUploads:', filteredUploads);
    console.log('  - filteredUploads.length:', filteredUploads.length);
    
    if (allUploads.length > 0) {
        console.log('  - Sample upload object:', allUploads[0]);
        console.log('  - Guest names from uploads:');
        allUploads.forEach((upload, index) => {
            console.log(`    Upload ${index + 1}: "${getGuestName(upload)}" (vorname: ${upload.gast_vorname}, nachname: ${upload.gast_nachname})`);
        });
    }
    
    console.log('  - Elements check:');
    console.log('    - uploadsTableBody:', document.getElementById('uploadsTableBody'));
    console.log('    - uploadsGrid:', document.getElementById('uploadsGrid'));
    console.log('    - loadingState:', document.getElementById('loadingState'));
    console.log('    - emptyState:', document.getElementById('emptyState'));
    console.log('    - filterGuest:', document.getElementById('filterGuest'));
};

// Bulk action functions
function bulkDownload() {
    console.log('Bulk download initiated');
    HochzeitsplanerApp.showAlert('Bulk Download wird implementiert...', 'info');
}

function bulkDelete() {
    console.log('Bulk delete initiated');
    HochzeitsplanerApp.showAlert('Bulk Delete wird implementiert...', 'warning');
}

// ============================
// Admin Upload Functions
// ============================

/**
 * Toggle the admin upload section visibility
 */
function toggleAdminUpload() {
    const section = document.getElementById('adminUploadSection');
    if (section) {
        if (section.style.display === 'none') {
            section.style.display = 'block';
            document.getElementById('adminUploadFile').focus();
        } else {
            section.style.display = 'none';
            // Reset form
            document.getElementById('adminUploadForm').reset();
            hideAdminUploadProgress();
        }
    }
}

/**
 * Start the admin upload process
 */
function startAdminUpload() {
    const fileInput = document.getElementById('adminUploadFile');
    const descriptionInput = document.getElementById('adminUploadDescription');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        HochzeitsplanerApp.showAlert('Bitte wählen Sie mindestens eine Datei aus.', 'warning');
        return;
    }
    
    const files = Array.from(fileInput.files);
    const description = descriptionInput.value.trim();
    
    console.log(`📤 Starting admin upload of ${files.length} file(s)`);
    
    // Show progress
    showAdminUploadProgress();
    updateAdminUploadProgress(0, `Uploading ${files.length} file(s)...`);
    
    // Upload files sequentially
    uploadFilesSequentially(files, description, 0);
}

/**
 * Upload files one by one to avoid overwhelming the server
 */
function uploadFilesSequentially(files, description, currentIndex) {
    if (currentIndex >= files.length) {
        // All files uploaded
        hideAdminUploadProgress();
        HochzeitsplanerApp.showAlert(`✅ Alle ${files.length} Datei(en) erfolgreich hochgeladen!`, 'success');
        document.getElementById('adminUploadForm').reset();
        toggleAdminUpload();
        // Refresh the uploads list
        loadAllUploads();
        return;
    }
    
    const file = files[currentIndex];
    const progress = Math.round(((currentIndex) / files.length) * 100);
    
    updateAdminUploadProgress(progress, `Uploading "${file.name}" (${currentIndex + 1}/${files.length})...`);
    
    // Create FormData for this file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    
    fetch('/api/admin/admin-upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        console.log(`✅ File "${file.name}" uploaded successfully with ID ${data.upload_id}`);
        
        // Upload next file
        uploadFilesSequentially(files, description, currentIndex + 1);
    })
    .catch(error => {
        console.error(`❌ Error uploading "${file.name}":`, error);
        hideAdminUploadProgress();
        HochzeitsplanerApp.showAlert(`Fehler beim Upload von "${file.name}": ${error.message}`, 'error');
    });
}

/**
 * Show the upload progress indicators
 */
function showAdminUploadProgress() {
    const progressDiv = document.getElementById('adminUploadProgress');
    if (progressDiv) {
        progressDiv.style.display = 'block';
    }
    
    // Disable upload button
    const uploadBtn = document.querySelector('button[onclick="startAdminUpload()"]');
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Uploading...';
    }
}

/**
 * Hide the upload progress indicators
 */
function hideAdminUploadProgress() {
    const progressDiv = document.getElementById('adminUploadProgress');
    if (progressDiv) {
        progressDiv.style.display = 'none';
    }
    
    // Re-enable upload button
    const uploadBtn = document.querySelector('button[onclick="startAdminUpload()"]');
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Dateien hochladen';
    }
}

/**
 * Update the upload progress
 */
function updateAdminUploadProgress(percentage, status) {
    const progressBar = document.querySelector('#adminUploadProgress .progress-bar');
    const statusText = document.getElementById('adminUploadStatus');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
    }
    
    if (statusText) {
        statusText.textContent = status;
    }
}
