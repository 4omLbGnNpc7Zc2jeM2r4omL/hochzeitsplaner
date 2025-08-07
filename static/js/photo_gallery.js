/**
 * Photo Gallery JavaScript
 * Manages the photo gallery functionality
 */

// Global variables
let currentPhotos = [];
let filteredPhotos = [];
let currentViewMode = 'grid'; // 'grid' or 'list'
let currentModalIndex = -1;

/**
 * Initialize photo gallery
 */
function initPhotoGallery() {
    console.log('🚀 Photo Gallery: Initializing...');
    
    // Check if required elements exist
    checkRequiredElements();
    
    // Load gallery data
    loadGallery();
    
    // Setup keyboard navigation
    setupKeyboardNavigation();
    
    console.log('✅ Photo Gallery: Initialization complete');
}

/**
 * Check if all required DOM elements exist
 */
function checkRequiredElements() {
    console.log('🔍 Photo Gallery: Checking required elements...');
    
    const requiredElements = {
        'galleryContainer': document.getElementById('galleryContainer'),
        'loadingAnimation': document.getElementById('loadingAnimation'),
        'noPhotosMessage': document.getElementById('noPhotosMessage'),
        'guestFilter': document.getElementById('guestFilter'),
        'typeFilter': document.getElementById('typeFilter'),
        'searchInput': document.getElementById('searchInput')
    };
    
    console.log('📋 Photo Gallery: Element check results:');
    Object.entries(requiredElements).forEach(([name, element]) => {
        const status = element ? '✅' : '❌';
        console.log(`  - ${name}: ${status}`);
        if (!element) {
            console.error(`❌ Photo Gallery: Required element '${name}' not found!`);
        }
    });
    
    return Object.values(requiredElements).every(element => element !== null);
}

/**
 * Load gallery data from API
 */
async function loadGallery() {
    console.log('🎯 Photo Gallery: Loading gallery...');
    
    try {
        showLoading();
        
        console.log('📡 Photo Gallery: Fetching from /api/approved-gallery...');
        
        const response = await fetch('/api/approved-gallery', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Photo Gallery: Response received:', response.status, response.statusText);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentifizierung erforderlich');
            } else if (response.status === 403) {
                throw new Error('Keine Berechtigung');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        console.log('📦 Photo Gallery: Data received:', data);
        console.log('📦 Photo Gallery: Data length:', data.length);
        
        if (data.length > 0) {
            console.log('📦 Photo Gallery: Sample photo object:', data[0]);
        }
        
        currentPhotos = data;
        filteredPhotos = [...data];
        
        console.log('🔍 Photo Gallery: Populating guest filter...');
        populateGuestFilter();
        
        console.log('🎨 Photo Gallery: Rendering gallery...');
        renderGallery();
        
        console.log('✅ Photo Gallery: Loading complete');
        
    } catch (error) {
        console.error('❌ Photo Gallery: Error loading gallery:', error);
        console.error('❌ Photo Gallery: Error details:', error.message);
        showError('Fehler beim Laden der Galerie: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Refresh gallery
 */
function refreshGallery() {
    console.log('🔄 Photo Gallery: Refreshing gallery...');
    loadGallery();
}

/**
 * Populate guest filter dropdown
 */
function populateGuestFilter() {
    console.log('🔍 Photo Gallery: Populating guest filter with', currentPhotos.length, 'photos');
    
    const guestFilter = document.getElementById('guestFilter');
    if (!guestFilter) {
        console.error('❌ Photo Gallery: guestFilter element not found!');
        return;
    }
    
    const guests = [...new Set(currentPhotos.map(photo => {
        const guestName = `${photo.gast_vorname || ''} ${photo.gast_nachname || ''}`.trim();
        console.log('👤 Photo Gallery: Processing guest:', guestName, 'from photo:', photo.original_filename);
        return guestName;
    }))].filter(name => name !== ''); // Remove empty names
    
    console.log('👥 Photo Gallery: Unique guests found:', guests);
    
    // Clear existing options (except "Alle Gäste")
    while (guestFilter.children.length > 1) {
        guestFilter.removeChild(guestFilter.lastChild);
    }
    
    // Add guest options
    guests.forEach(guest => {
        const option = document.createElement('option');
        option.value = guest;
        option.textContent = guest;
        guestFilter.appendChild(option);
    });
    
    console.log('✅ Photo Gallery: Guest filter populated with', guests.length, 'guests');
}

/**
 * Render gallery
 */
function renderGallery() {
    console.log('🎨 Photo Gallery: Rendering gallery with', filteredPhotos.length, 'photos');
    
    const container = document.getElementById('galleryContainer');
    const noPhotosMessage = document.getElementById('noPhotosMessage');
    
    if (!container) {
        console.error('❌ Photo Gallery: galleryContainer element not found!');
        return;
    }
    
    if (!noPhotosMessage) {
        console.error('❌ Photo Gallery: noPhotosMessage element not found!');
    }
    
    if (filteredPhotos.length === 0) {
        console.log('📭 Photo Gallery: No photos to display - showing empty message');
        container.innerHTML = '';
        if (noPhotosMessage) noPhotosMessage.classList.remove('d-none');
        return;
    }
    
    console.log('✅ Photo Gallery: Rendering', filteredPhotos.length, 'photos');
    if (noPhotosMessage) noPhotosMessage.classList.add('d-none');
    
    const columns = currentViewMode === 'grid' ? 'col-lg-3 col-md-4 col-sm-6' : 'col-12';
    const viewClass = `view-mode-${currentViewMode}`;
    
    container.className = `row ${viewClass}`;
    
    console.log('🎨 Photo Gallery: Using view mode:', currentViewMode, 'columns:', columns);
    
    container.innerHTML = filteredPhotos.map((photo, index) => {
        console.log(`🖼️ Photo Gallery: Rendering photo ${index + 1}:`, photo.original_filename, 'type:', photo.file_type);
        
        return `
        <div class="${columns}">
            <div class="gallery-item" onclick="openFullscreen(${index})">
                ${photo.file_type === 'image' ? 
                    `<img src="/api/gallery-image/${photo.id}" alt="${escapeHtml(photo.original_filename)}" loading="lazy">` :
                    `<video poster="" preload="metadata">
                        <source src="/api/gallery-image/${photo.id}" type="${photo.mime_type}">
                        Ihr Browser unterstützt dieses Video-Format nicht.
                    </video>`
                }
                <div class="type-badge">
                    <i class="bi bi-${photo.file_type === 'image' ? 'image' : 'camera-video'}"></i>
                </div>
                <div class="gallery-overlay">
                    <h6 class="mb-1">${escapeHtml(photo.original_filename)}</h6>
                    <small>von ${escapeHtml(photo.gast_vorname || '')} ${escapeHtml(photo.gast_nachname || '')}</small><br>
                    <small>${formatDate(photo.upload_date)}</small>
                    ${photo.beschreibung ? `<br><small class="text-muted">${escapeHtml(photo.beschreibung)}</small>` : ''}
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    console.log('✅ Photo Gallery: Gallery rendered successfully');
}

/**
 * Filter photos based on search and filter criteria
 */
function filterPhotos() {
    console.log('🔍 Photo Gallery: Filtering photos...');
    
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const guestFilter = document.getElementById('guestFilter');
    
    if (!searchInput || !typeFilter || !guestFilter) {
        console.error('❌ Photo Gallery: Filter elements not found!');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    const selectedType = typeFilter.value;
    const selectedGuest = guestFilter.value;
    
    console.log('🔍 Photo Gallery: Filter criteria:', {
        searchTerm,
        selectedType,
        selectedGuest
    });
    
    filteredPhotos = currentPhotos.filter(photo => {
        const matchesSearch = photo.original_filename.toLowerCase().includes(searchTerm) ||
                            (photo.beschreibung && photo.beschreibung.toLowerCase().includes(searchTerm)) ||
                            `${photo.gast_vorname || ''} ${photo.gast_nachname || ''}`.toLowerCase().includes(searchTerm);
        
        const matchesType = !selectedType || photo.file_type === selectedType;
        
        const matchesGuest = !selectedGuest || `${photo.gast_vorname || ''} ${photo.gast_nachname || ''}`.trim() === selectedGuest;
        
        return matchesSearch && matchesType && matchesGuest;
    });
    
    console.log(`🔍 Photo Gallery: Filtered ${currentPhotos.length} photos to ${filteredPhotos.length} results`);
    renderGallery();
}

/**
 * Toggle view mode between grid and list
 */
function toggleViewMode() {
    console.log('🔄 Photo Gallery: Toggling view mode from', currentViewMode);
    
    currentViewMode = currentViewMode === 'grid' ? 'list' : 'grid';
    
    console.log('🔄 Photo Gallery: New view mode:', currentViewMode);
    
    renderGallery();
    
    // Update button text
    const btn = document.querySelector('button[onclick="toggleViewMode()"]');
    if (btn) {
        const icon = currentViewMode === 'grid' ? 'grid-3x3-gap' : 'list-ul';
        btn.innerHTML = `<i class="bi bi-${icon} me-2"></i>Ansicht`;
    }
}

/**
 * Open fullscreen modal for photo
 */
function openFullscreen(index) {
    console.log('🖼️ Photo Gallery: Opening fullscreen for photo index:', index);
    
    if (index < 0 || index >= filteredPhotos.length) {
        console.error('❌ Photo Gallery: Invalid photo index:', index);
        return;
    }
    
    currentModalIndex = index;
    const photo = filteredPhotos[index];
    
    console.log('🖼️ Photo Gallery: Photo details:', photo);
    
    // Update modal content
    const modalLabel = document.getElementById('fullscreenModalLabel');
    const modalFileName = document.getElementById('modalFileName');
    const modalUploadInfo = document.getElementById('modalUploadInfo');
    const fullscreenImage = document.getElementById('fullscreenImage');
    const fullscreenVideo = document.getElementById('fullscreenVideo');
    
    if (modalLabel) modalLabel.textContent = photo.original_filename;
    if (modalFileName) modalFileName.textContent = photo.original_filename;
    if (modalUploadInfo) {
        modalUploadInfo.innerHTML = `
            von ${escapeHtml(photo.gast_vorname || '')} ${escapeHtml(photo.gast_nachname || '')} • ${formatDate(photo.upload_date)}
            ${photo.beschreibung ? `<br>${escapeHtml(photo.beschreibung)}` : ''}
        `;
    }
    
    // Set media content
    if (photo.file_type === 'image') {
        if (fullscreenImage) {
            fullscreenImage.src = `/api/gallery-image/${photo.id}`;
            fullscreenImage.alt = photo.original_filename;
            fullscreenImage.classList.remove('d-none');
        }
        if (fullscreenVideo) {
            fullscreenVideo.classList.add('d-none');
        }
    } else {
        if (fullscreenVideo) {
            const source = fullscreenVideo.querySelector('source');
            if (source) {
                source.src = `/api/gallery-image/${photo.id}`;
                source.type = photo.mime_type;
            }
            fullscreenVideo.load();
            fullscreenVideo.classList.remove('d-none');
        }
        if (fullscreenImage) {
            fullscreenImage.classList.add('d-none');
        }
    }
    
    // Show modal
    const modal = document.getElementById('fullscreenModal');
    if (modal && typeof bootstrap !== 'undefined') {
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }
}

/**
 * Setup keyboard navigation for modal
 */
function setupKeyboardNavigation() {
    console.log('⌨️ Photo Gallery: Setting up keyboard navigation...');
    
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('fullscreenModal');
        if (modal && modal.classList.contains('show')) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigatePhoto(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigatePhoto(1);
            }
        }
    });
}

/**
 * Navigate to previous/next photo in modal
 */
function navigatePhoto(direction) {
    const newIndex = currentModalIndex + direction;
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
        openFullscreen(newIndex);
    }
}

/**
 * Download current photo
 */
function downloadFile() {
    console.log('💾 Photo Gallery: Downloading file...');
    
    if (currentModalIndex >= 0 && currentModalIndex < filteredPhotos.length) {
        const photo = filteredPhotos[currentModalIndex];
        const link = document.createElement('a');
        link.href = `/api/gallery-image/${photo.id}`;
        link.download = photo.original_filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('💾 Photo Gallery: Download initiated for:', photo.original_filename);
    }
}

/**
 * Share current photo
 */
function shareFile() {
    console.log('📤 Photo Gallery: Sharing file...');
    
    if (currentModalIndex >= 0 && currentModalIndex < filteredPhotos.length) {
        const photo = filteredPhotos[currentModalIndex];
        const url = `${window.location.origin}/api/gallery-image/${photo.id}`;
        
        if (navigator.share) {
            navigator.share({
                title: photo.original_filename,
                text: `Foto von ${photo.gast_vorname || ''} ${photo.gast_nachname || ''}`,
                url: url
            });
        } else {
            // Fallback: Copy URL to clipboard
            navigator.clipboard.writeText(url).then(() => {
                showNotification('Link in Zwischenablage kopiert', 'success');
            });
        }
    }
}

/**
 * Show loading state
 */
function showLoading() {
    console.log('⏳ Photo Gallery: Showing loading animation');
    
    const loadingElement = document.getElementById('loadingAnimation');
    const galleryContainer = document.getElementById('galleryContainer');
    const noPhotosMessage = document.getElementById('noPhotosMessage');
    
    if (loadingElement) {
        loadingElement.classList.remove('d-none');
    } else {
        console.error('❌ Photo Gallery: loadingAnimation element not found!');
    }
    
    if (galleryContainer) {
        galleryContainer.innerHTML = '';
    }
    
    if (noPhotosMessage) {
        noPhotosMessage.classList.add('d-none');
    }
}

/**
 * Hide loading state
 */
function hideLoading() {
    console.log('✅ Photo Gallery: Hiding loading animation');
    
    const loadingElement = document.getElementById('loadingAnimation');
    if (loadingElement) {
        loadingElement.classList.add('d-none');
    } else {
        console.error('❌ Photo Gallery: loadingAnimation element not found!');
    }
}

/**
 * Show error message
 */
function showError(message) {
    console.error('❌ Photo Gallery: Showing error:', message);
    showNotification(message, 'danger');
}

/**
 * Format date string
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('❌ Photo Gallery: Error formatting date:', error);
        return dateString;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    console.log(`📢 Photo Gallery: Notification (${type}):`, message);
    
    // Use existing notification system if available
    if (typeof addNotification === 'function') {
        addNotification(message, type);
    } else if (typeof HochzeitsplanerApp !== 'undefined' && HochzeitsplanerApp.showAlert) {
        HochzeitsplanerApp.showAlert(message, type);
    } else {
        // Fallback to alert
        alert(message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Photo Gallery: DOM loaded, starting initialization...');
    console.log('🔍 Photo Gallery: Current URL:', window.location.href);
    console.log('🔍 Photo Gallery: Current pathname:', window.location.pathname);
    
    // Add small delay to ensure all elements are ready
    setTimeout(() => {
        console.log('⏰ Photo Gallery: Timeout reached, starting init...');
        initPhotoGallery();
    }, 100);
});

// Export functions for global access
window.refreshGallery = refreshGallery;
window.filterPhotos = filterPhotos;
window.toggleViewMode = toggleViewMode;
window.openFullscreen = openFullscreen;
window.downloadFile = downloadFile;
window.shareFile = shareFile;
