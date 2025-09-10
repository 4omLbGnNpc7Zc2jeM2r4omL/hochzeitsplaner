// Playlist Management JavaScript für Guest Dashboard mit Spotify Integration

let spotifySearchTimeout;
let currentAudio = null;
let currentGuestId = null;

// Alias for showDashboardToast function
function showToast(message, type) {
    if (typeof showDashboardToast === 'function') {
        showDashboardToast(message, type);
    } else {
        console.error('showDashboardToast function not available');
    }
}

// Playlist Tab laden
function loadPlaylistTab() {
    fetch('/api/playlist/vorschlaege')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentGuestId = data.current_guest_id;
                displayPlaylistVorschlaege(data.vorschlaege);
                updateVoteCounts();
            }
        })
        .catch(error => /* console.error('Fehler beim Laden der Playlist:', error) */ null); // Guest console logs disabled
}

// Spotify Search Setup
function setupSpotifySearch() {
    const searchInput = document.getElementById('spotify-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Clear previous timeout
        if (spotifySearchTimeout) {
            clearTimeout(spotifySearchTimeout);
        }
        
        // Clear results if query is too short
        if (query.length < 3) {
            document.getElementById('spotify-results').innerHTML = '';
            return;
        }
        
        // Debounce search
        spotifySearchTimeout = setTimeout(() => {
            searchSpotifyTracks(query);
        }, 500);
    });
}

// Spotify Search Function
function searchSpotifyTracks(query) {
    const resultsContainer = document.getElementById('spotify-results');
    
    // Show loading
    resultsContainer.innerHTML = `
        <div class="text-center py-2">
            <div class="spinner-border spinner-border-sm text-success" role="status">
                <span class="visually-hidden">Suche...</span>
            </div>
            <small class="ms-2 text-muted">Suche bei Spotify...</small>
        </div>
    `;
    
    fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=8`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displaySpotifyResults(data.tracks);
            } else {
                resultsContainer.innerHTML = `
                    <div class="alert alert-warning alert-sm">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        ${data.error || 'Spotify-Suche nicht verfügbar'}
                    </div>
                `;
            }
        })
        .catch(error => {
            // console.error('Spotify search error:', error); // Guest console logs disabled
            resultsContainer.innerHTML = `
                <div class="alert alert-warning alert-sm">
                    <i class="bi bi-wifi-off me-1"></i>
                    Spotify-Suche derzeit nicht verfügbar
                </div>
            `;
        });
}

// Display Spotify Search Results
function displaySpotifyResults(tracks) {
    const resultsContainer = document.getElementById('spotify-results');
    
    if (!tracks || tracks.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-2 text-muted">
                <i class="bi bi-search me-1"></i>
                Keine Ergebnisse gefunden
            </div>
        `;
        return;
    }
    
    let html = '<div class="spotify-results-list">';
    
    tracks.forEach(track => {
        const duration = track.duration_ms ? formatDuration(track.duration_ms) : '';
        const year = track.release_date ? track.release_date.substring(0, 4) : '';
        
        html += `
            <div class="spotify-result-item" onclick="selectSpotifyTrack('${track.spotify_id}')">
                <div class="row align-items-center">
                    <div class="col-2">
                        ${track.image_url ? 
                            `<img src="${track.image_url}" alt="Cover" class="img-fluid rounded" style="max-height: 40px;">` :
                            `<div class="bg-light rounded d-flex align-items-center justify-content-center" style="height: 40px; width: 40px;"><i class="bi bi-music-note"></i></div>`
                        }
                    </div>
                    <div class="col-8">
                        <div class="fw-bold text-truncate">${track.name}</div>
                        <div class="text-muted small text-truncate">${track.artist}</div>
                        <div class="text-muted small text-truncate">${track.album} ${year ? `(${year})` : ''}</div>
                    </div>
                    <div class="col-2 text-end">
                        ${track.preview_url ? 
                            `<button type="button" class="btn btn-sm btn-outline-success spotify-preview-btn" data-preview-url="${track.preview_url}">
                                <i class="bi bi-play-fill"></i>
                            </button>` : ''
                        }
                        ${duration ? `<small class="d-block text-muted">${duration}</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    resultsContainer.innerHTML = html;
    
    // Event Listeners für Spotify Preview Buttons
    resultsContainer.querySelectorAll('.spotify-preview-btn').forEach(btn => {
        btn.addEventListener('click', function(event) {
            event.stopPropagation();
            playPreview(this.dataset.previewUrl, this);
        });
    });
}

// Select Spotify Track
function selectSpotifyTrack(spotifyId) {
    fetch(`/api/spotify/track/${spotifyId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const track = data.track;
                
                // Fill hidden Spotify fields
                document.getElementById('spotify-id').value = track.spotify_id;
                document.getElementById('spotify-url').value = track.spotify_url || '';
                document.getElementById('preview-url').value = track.preview_url || '';
                document.getElementById('image-url').value = track.image_url || '';
                document.getElementById('duration-ms').value = track.duration_ms || '';
                document.getElementById('release-date').value = track.release_date || '';
                document.getElementById('popularity').value = track.popularity || '';
                
                // Show selected song
                showSelectedSong(track);
                
                // Clear search
                document.getElementById('spotify-search').value = '';
                document.getElementById('spotify-results').innerHTML = '';
            }
        })
        .catch(error => {
            // console.error('Error fetching track details:', error); // Guest console logs disabled
            showDashboardToast('Fehler beim Laden der Track-Details', 'error');
        });
}

// Show Selected Song
function showSelectedSong(track) {
    const display = document.getElementById('selected-song-display');
    
    document.getElementById('selected-title').textContent = track.name;
    document.getElementById('selected-artist').textContent = track.artist;
    document.getElementById('selected-album').textContent = track.album;
    
    if (track.image_url) {
        document.getElementById('selected-cover').src = track.image_url;
        document.getElementById('selected-cover').style.display = 'block';
    } else {
        document.getElementById('selected-cover').style.display = 'none';
    }
    
    if (track.preview_url) {
        const previewBtn = document.getElementById('preview-btn');
        previewBtn.style.display = 'block';
        previewBtn.onclick = () => playPreview(track.preview_url, previewBtn);
    } else {
        document.getElementById('preview-btn').style.display = 'none';
    }
    
    display.style.display = 'block';
}

// Clear Spotify Selection
function clearSpotifySelection() {
    // Clear hidden fields
    document.getElementById('spotify-id').value = '';
    document.getElementById('spotify-url').value = '';
    document.getElementById('preview-url').value = '';
    document.getElementById('image-url').value = '';
    document.getElementById('duration-ms').value = '';
    document.getElementById('release-date').value = '';
    document.getElementById('popularity').value = '';
    
    // Hide selected song display
    document.getElementById('selected-song-display').style.display = 'none';
    
    // Stop any playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}

// Play Preview
function playPreview(previewUrl, button) {
    // Stop any currently playing audio
    if (currentAudio) {
        currentAudio.pause();
        // Reset all play buttons
        document.querySelectorAll('.btn-success').forEach(btn => {
            btn.innerHTML = '<i class="bi bi-play-fill"></i>';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-success');
        });
    }
    
    if (currentAudio && currentAudio.src === previewUrl) {
        // If same track, just toggle
        currentAudio = null;
        return;
    }
    
    // Play new track
    currentAudio = new Audio(previewUrl);
    button.innerHTML = '<i class="bi bi-stop-fill"></i>';
    button.classList.remove('btn-success');
    button.classList.add('btn-danger');
    
    currentAudio.play().catch(error => {
        // console.error('Error playing preview:', error); // Guest console logs disabled
        button.innerHTML = '<i class="bi bi-play-fill"></i>';
        button.classList.remove('btn-danger');
        button.classList.add('btn-success');
    });
    
    currentAudio.onended = () => {
        button.innerHTML = '<i class="bi bi-play-fill"></i>';
        button.classList.remove('btn-danger');
        button.classList.add('btn-success');
        currentAudio = null;
    };
}

// Format Duration
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Playlist Vorschläge anzeigen
function displayPlaylistVorschlaege(vorschlaege) {
    const container = document.getElementById('playlist-vorschlaege');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (vorschlaege.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-music-note-beamed" style="font-size: 3rem; color: var(--wedding-gold);"></i>
                <p class="text-muted mt-2">Noch keine Musikwünsche vorhanden.<br>Sei der Erste und teile deine Lieblingssongs!</p>
            </div>
        `;
        return;
    }
    
    // Gruppiere nach Anlass
    const gruppiert = {};
    vorschlaege.forEach(v => {
        if (!gruppiert[v.anlass]) gruppiert[v.anlass] = [];
        gruppiert[v.anlass].push(v);
    });
    
    Object.keys(gruppiert).forEach(anlass => {
        const gruppe = document.createElement('div');
        gruppe.className = 'mb-4';
        
        gruppe.innerHTML = `
            <h6 class="mb-3" style="color: var(--wedding-text); border-bottom: 2px solid var(--wedding-gold); padding-bottom: 5px;">
                <i class="bi bi-music-note me-2"></i>${anlass}
            </h6>
            <div class="row" id="vorschlaege-${anlass.replace(/\s+/g, '-')}">
            </div>
        `;
        
        container.appendChild(gruppe);
        
        const vorschlaegeContainer = document.getElementById(`vorschlaege-${anlass.replace(/\s+/g, '-')}`);
        
        gruppiert[anlass].forEach(vorschlag => {
            const card = createPlaylistCard(vorschlag);
            vorschlaegeContainer.appendChild(card);
        });
    });
}

// Playlist Card erstellen
function createPlaylistCard(vorschlag) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-3';
    
    const statusBadge = getStatusBadge(vorschlag.status);
    const hasVoted = vorschlag.user_has_voted;
    const hasSpotify = vorschlag.spotify_id;
    const hasPreview = vorschlag.preview_url;
    
    col.innerHTML = `
        <div class="card h-100 playlist-card" style="border: 1px solid var(--wedding-gold); transition: transform 0.2s;">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="flex-grow-1">
                        <h6 class="card-title mb-0" style="color: var(--wedding-text);">${vorschlag.titel}</h6>
                        ${hasSpotify ? '<small class="text-success"><i class="bi bi-spotify"></i> Spotify</small>' : ''}
                    </div>
                    ${statusBadge}
                </div>
                
                <div class="d-flex align-items-center mb-2">
                    ${vorschlag.image_url ? 
                        `<img src="${vorschlag.image_url}" alt="Cover" class="me-2 rounded" style="width: 50px; height: 50px; object-fit: cover;">` : 
                        `<div class="me-2 bg-light rounded d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;"><i class="bi bi-music-note"></i></div>`
                    }
                    <div class="flex-grow-1">
                        <p class="card-text mb-0">
                            <strong>${vorschlag.kuenstler}</strong>
                            ${vorschlag.album ? `<br><small class="text-muted">${vorschlag.album}</small>` : ''}
                        </p>
                    </div>
                </div>
                
                ${vorschlag.kommentar ? `<p class="small text-muted mb-2"><em>"${vorschlag.kommentar}"</em></p>` : ''}
                
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div class="d-flex align-items-center">
                        <small class="text-muted me-2">von ${vorschlag.gast_name || 'Anonymer Gast'}</small>
                        ${hasSpotify && vorschlag.spotify_url ? 
                            `<a href="${vorschlag.spotify_url}" target="_blank" class="btn btn-sm btn-success me-1" title="Auf Spotify öffnen">
                                <i class="bi bi-spotify"></i>
                            </a>` : ''
                        }
                        ${hasPreview ? 
                            `<button class="btn btn-sm btn-outline-success me-1 preview-btn" data-preview-url="${vorschlag.preview_url}" title="30s Vorschau">
                                <i class="bi bi-play-fill"></i>
                            </button>` : ''
                        }
                    </div>
                    <div class="d-flex align-items-center">
                        ${currentGuestId && vorschlag.gast_id === currentGuestId ? 
                            `<button class="btn btn-sm btn-outline-danger me-2 delete-own-btn" data-vorschlag-id="${vorschlag.id}" title="Löschen">
                                <i class="bi bi-trash"></i>
                            </button>` : ''
                        }
                        <button class="btn btn-sm ${hasVoted ? 'btn-primary' : 'btn-outline-primary'} vote-btn" 
                                data-vorschlag-id="${vorschlag.id}"
                                ${hasVoted ? 'data-voted="true"' : ''}>
                            <i class="bi bi-heart${hasVoted ? '-fill' : ''}"></i>
                            <span class="vote-count">${vorschlag.vote_count || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Event Listeners für die Buttons hinzufügen
    setTimeout(() => {
        // Preview Button Event Listener
        const previewBtn = col.querySelector('.preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', function() {
                playPreview(this.dataset.previewUrl, this);
            });
        }
        
        // Delete Button Event Listener
        const deleteBtn = col.querySelector('.delete-own-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                deleteOwnVorschlag(this.dataset.vorschlagId, this);
            });
        }
        
        // Vote Button Event Listener
        const voteBtn = col.querySelector('.vote-btn');
        if (voteBtn) {
            voteBtn.addEventListener('click', function() {
                toggleVote(this.dataset.vorschlagId, this);
            });
        }
    }, 0);
    
    return col;
}

// Status Badge
function getStatusBadge(status) {
    switch(status) {
        case 'Akzeptiert':
            return '<span class="badge bg-success">Akzeptiert</span>';
        case 'Abgelehnt':
            return '<span class="badge bg-danger">Abgelehnt</span>';
        default:
            return '<span class="badge bg-warning">Vorgeschlagen</span>';
    }
}

// Vote Toggle
function toggleVote(vorschlagId, button) {
    const hasVoted = button.dataset.voted === 'true';
    
    fetch('/api/playlist/vote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            vorschlag_id: vorschlagId,
            action: hasVoted ? 'remove' : 'add'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const icon = button.querySelector('i');
            const countSpan = button.querySelector('.vote-count');
            
            if (hasVoted) {
                // Vote entfernen
                button.className = 'btn btn-sm btn-outline-primary';
                button.dataset.voted = 'false';
                icon.className = 'bi bi-heart';
                countSpan.textContent = parseInt(countSpan.textContent) - 1;
            } else {
                // Vote hinzufügen
                button.className = 'btn btn-sm btn-primary';
                button.dataset.voted = 'true';
                icon.className = 'bi bi-heart-fill';
                countSpan.textContent = parseInt(countSpan.textContent) + 1;
            }
        } else {
            showDashboardToast('Fehler beim Voten: ' + (data.error || 'Unbekannter Fehler'), 'error');
        }
    })
    .catch(error => {
        // console.error('Voting error:', error); // Guest console logs disabled
        showDashboardToast('Fehler beim Voten', 'error');
    });
}

// Playlist Vorschlag hinzufügen
function submitPlaylistVorschlag() {
    const form = document.getElementById('playlistForm');
    
    // Spotify-Daten prüfen
    const spotifyId = document.getElementById('spotify-id').value;
    if (!spotifyId) {
        showDashboardToast('Bitte suchen Sie einen Song über die Spotify-Suche aus.', 'warning');
        return;
    }
    
    const data = {
        kommentar: document.getElementById('playlist-kommentar').value || '',
        spotify_data: {
            spotify_id: spotifyId,
            spotify_url: document.getElementById('spotify-url').value,
            preview_url: document.getElementById('preview-url').value,
            image_url: document.getElementById('image-url').value,
            duration_ms: parseInt(document.getElementById('duration-ms').value) || null,
            release_date: document.getElementById('release-date').value,
            popularity: parseInt(document.getElementById('popularity').value) || null
        }
    };
    
    fetch('/api/playlist/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Form zurücksetzen
            form.reset();
            clearSpotifySelection();
            
            // Erfolg anzeigen
            showSuccessMessage('Musikwunsch erfolgreich hinzugefügt!');
            
            // Playlist neu laden
            loadPlaylistTab();
        } else {
            showDashboardToast('Fehler beim Hinzufügen: ' + (data.error || 'Unbekannter Fehler'), 'error');
        }
    })
    .catch(error => {
        // console.error('Submit error:', error); // Guest console logs disabled
        showDashboardToast('Fehler beim Senden des Musikwunsches', 'error');
    });
}

// Erfolgs-Message anzeigen
function showSuccessMessage(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 1060; min-width: 300px;';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-hide nach 3 Sekunden
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

// Vote Counts aktualisieren
function updateVoteCounts() {
    const voteButtons = document.querySelectorAll('[onclick^="toggleVote"]');
    voteButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

// Search Funktionalität
function setupPlaylistSearch() {
    const searchInput = document.getElementById('playlist-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const cards = document.querySelectorAll('.playlist-card');
            
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                const col = card.closest('.col-md-6');
                
                if (text.includes(searchTerm)) {
                    col.style.display = '';
                } else {
                    col.style.display = 'none';
                }
            });
        });
    }
}

// Filter Funktionalität
function setupPlaylistFilter() {
    const statusFilter = document.getElementById('playlist-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            const selectedStatus = this.value;
            const cards = document.querySelectorAll('.playlist-card');
            
            cards.forEach(card => {
                const statusBadge = card.querySelector('.badge');
                const cardStatus = statusBadge ? statusBadge.textContent : '';
                const col = card.closest('.col-md-6');
                
                if (!selectedStatus || cardStatus === selectedStatus) {
                    col.style.display = '';
                } else {
                    col.style.display = 'none';
                }
            });
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupPlaylistSearch();
    setupPlaylistFilter();
    setupSpotifySearch();
    
    // Form submit handler
    const playlistForm = document.getElementById('playlistForm');
    if (playlistForm) {
        playlistForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitPlaylistVorschlag();
        });
    }
    
    // Card Hover Effects
    document.addEventListener('mouseenter', function(e) {
        if (e.target && typeof e.target.closest === 'function') {
            const card = e.target.closest('.playlist-card');
            if (card) {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 4px 8px rgba(212, 175, 55, 0.3)';
            }
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target && typeof e.target.closest === 'function') {
            const card = e.target.closest('.playlist-card');
            if (card) {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '';
            }
        }
    }, true);
});

// Add CSS for Spotify results
if (!document.getElementById('spotify-styles')) {
    const style = document.createElement('style');
    style.id = 'spotify-styles';
    style.textContent = `
        .spotify-results-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #d4af37;
            border-radius: 8px;
            background: white;
        }
        
        .spotify-result-item {
            padding: 8px 12px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .spotify-result-item:hover {
            background-color: rgba(212, 175, 55, 0.1);
        }
        
        .spotify-result-item:last-child {
            border-bottom: none;
        }
        
        .alert-sm {
            padding: 8px 12px;
            font-size: 0.875rem;
        }
        
        #selected-song-display .card {
            transition: all 0.3s ease;
        }
        
        #manual-entry-section {
            transition: opacity 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}

// Eigenen Playlist-Vorschlag löschen
function deleteOwnVorschlag(vorschlagId, button) {
    // Wedding-themed confirmation modal instead of browser popup
    showMusikLoeschenModal(vorschlagId, button);
}

// Wedding-themed modal for music deletion confirmation
function showMusikLoeschenModal(vorschlagId, button) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('musikLoeschenModal');
    if (!modal) {
        const modalHtml = `
            <div class="modal fade" id="musikLoeschenModal" tabindex="-1" aria-labelledby="musikLoeschenModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="background: linear-gradient(135deg, #f8f4e6 0%, #fff5f5 100%); border: 2px solid #d4a574;">
                        <div class="modal-header" style="border-bottom: 2px solid #d4a574; background: linear-gradient(135deg, #8b7355 0%, #a0616a 100%);">
                            <h5 class="modal-title" id="musikLoeschenModalLabel" style="color: white; font-family: 'Dancing Script', cursive; font-size: 1.8rem;">
                                <i class="bi bi-music-note me-2"></i>Musikwunsch löschen
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center" style="padding: 2rem;">
                            <div style="font-size: 3rem; color: #d4a574; margin-bottom: 1rem;">💕</div>
                            <p style="font-size: 1.1rem; color: #5d4037; margin-bottom: 1.5rem;">
                                Möchten Sie diesen Musikwunsch wirklich von Ihrer Liste entfernen?
                            </p>
                            <p style="color: #8b7355; font-style: italic;">
                                Diese Aktion kann nicht rückgängig gemacht werden.
                            </p>
                        </div>
                        <div class="modal-footer" style="border-top: 2px solid #d4a574; background: rgba(212, 165, 116, 0.1);">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="background: #9e9e9e;">
                                <i class="bi bi-x-circle me-1"></i>Abbrechen
                            </button>
                            <button type="button" class="btn" id="confirmMusikLoeschen" 
                                    style="background: linear-gradient(135deg, #8b7355 0%, #a0616a 100%); color: white; border: none;">
                                <i class="bi bi-trash me-1"></i>Löschen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('musikLoeschenModal');
    }
    
    // Set up the confirmation handler
    const confirmBtn = document.getElementById('confirmMusikLoeschen');
    confirmBtn.onclick = function() {
        performMusikLoeschen(vorschlagId, button);
        bootstrap.Modal.getInstance(modal).hide();
    };
    
    // Show the modal
    new bootstrap.Modal(modal).show();
}

// Perform the actual deletion
function performMusikLoeschen(vorschlagId, button) {
    
    // Button deaktivieren während der Anfrage
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    
    fetch(`/api/playlist/delete/${vorschlagId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Karte entfernen
            const card = button.closest('.col-md-6');
            if (card) {
                card.style.transition = 'opacity 0.3s ease';
                card.style.opacity = '0';
                setTimeout(() => {
                    card.remove();
                    // Prüfe, ob Gruppe leer ist
                    checkEmptyGroups();
                }, 300);
            }
            
            showDashboardToast('Musikwunsch erfolgreich gelöscht!', 'success');
        } else {
            showDashboardToast(data.error || 'Fehler beim Löschen', 'error');
            // Button wieder aktivieren
            button.disabled = false;
            button.innerHTML = originalText;
        }
    })
    .catch(error => {
        // console.error('Fehler beim Löschen:', error); // Guest console logs disabled
        showDashboardToast('Netzwerkfehler beim Löschen', 'error');
        // Button wieder aktivieren
        button.disabled = false;
        button.innerHTML = originalText;
    });
}

// Prüfe, ob Gruppen leer sind und entferne sie
function checkEmptyGroups() {
    const container = document.getElementById('playlist-vorschlaege');
    if (!container) return;
    
    const groups = container.children;
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i];
        const vorschlaegeContainer = group.querySelector('[id^="vorschlaege-"]');
        if (vorschlaegeContainer && vorschlaegeContainer.children.length === 0) {
            group.remove();
        }
    }
    
    // Zeige "Keine Musikwünsche" Nachricht wenn alles leer ist
    if (container.children.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-music-note-beamed" style="font-size: 3rem; color: var(--wedding-gold);"></i>
                <p class="text-muted mt-2">Noch keine Musikwünsche vorhanden.<br>Sei der Erste und teile deine Lieblingssongs!</p>
            </div>
        `;
    }
}
