/**
 * Hochzeitstag-Checkliste Management
 * Handles wedding day checklist with priorities, completion tracking, and archive functionality
 * Uses Wedding Theme containers instead of browser popups
 */

let checklisteData = [];
let showArchive = false;

// =============================================================================
// Wedding Theme Dialog Functions
// =============================================================================

function showWeddingNotification(message, type = 'info', duration = 5000) {
    // Container erstellen falls nicht vorhanden
    let container = document.getElementById('wedding-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'wedding-notification-container';
        container.className = 'wedding-notification-container';
        document.body.appendChild(container);
    }

    // Notification erstellen
    const notification = document.createElement('div');
    notification.className = `wedding-notification ${type}`;
    
    const typeIcons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const typeLabels = {
        success: 'Erfolgreich',
        error: 'Fehler',
        warning: 'Warnung',
        info: 'Information'
    };

    notification.innerHTML = `
        <div class="wedding-notification-header">
            <span>${typeIcons[type]} ${typeLabels[type]}</span>
            <button class="wedding-notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="bi bi-x"></i>
            </button>
        </div>
        <div class="wedding-notification-body">${message}</div>
    `;

    container.appendChild(notification);

    // Auto-remove nach Duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
}

function showWeddingConfirm(title, message, onConfirm, onCancel = null) {
    console.log('🎭 Wedding Dialog erstellen:', title);
    
    // Entferne existierende Dialoge
    const existingOverlays = document.querySelectorAll('.wedding-dialog-overlay');
    existingOverlays.forEach(overlay => overlay.remove());
    
    const overlay = document.createElement('div');
    overlay.className = 'wedding-dialog-overlay';
    
    // Explicit style für z-index und position
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1060;
        backdrop-filter: blur(3px);
    `;
    
    const dialog = document.createElement('div');
    dialog.className = 'wedding-dialog';
    dialog.style.cssText = `
        background: linear-gradient(135deg, #f8f9fa, #f4e4bc);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        margin: 20px;
        border: 3px solid #d4af37;
        animation: wedding-slideIn 0.3s ease-out;
    `;
    
    dialog.innerHTML = `
        <div class="wedding-dialog-header" style="background: linear-gradient(135deg, #d4af37, #e8d5a3); color: #6b5a47; padding: 1.5rem; border-radius: 17px 17px 0 0; border-bottom: 2px solid #d4af37; text-align: center;">
            <h5 style="margin: 0; font-weight: 600; font-size: 1.3rem; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">${title}</h5>
        </div>
        <div class="wedding-dialog-body" style="padding: 2rem 1.5rem; color: #6b5a47; text-align: center; line-height: 1.6; font-size: 1rem;">
            ${message}
        </div>
        <div class="wedding-dialog-footer" style="padding: 1rem 1.5rem 1.5rem; display: flex; justify-content: center; gap: 1rem; border-top: 1px solid #e8d5a3;">
            <button class="btn btn-wedding-secondary wedding-cancel-btn" style="background: linear-gradient(135deg, #e8d5a3, #f4e4bc); border: none; color: #8b7355; border-radius: 12px; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2); transition: all 0.3s ease; padding: 0.5rem 1rem;">
                <i class="bi bi-x-circle me-1"></i> Abbrechen
            </button>
            <button class="btn btn-wedding-primary wedding-confirm-btn" style="background: linear-gradient(135deg, #d4af37, #f4e4bc); border: none; color: #8b7355; border-radius: 12px; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2); transition: all 0.3s ease; padding: 0.5rem 1rem;">
                <i class="bi bi-check-circle me-1"></i> Bestätigen
            </button>
        </div>
    `;

    overlay.appendChild(dialog);

    // Event handlers speichern
    overlay.onConfirm = onConfirm;
    overlay.onCancel = onCancel;

    // Button event listeners
    const cancelBtn = dialog.querySelector('.wedding-cancel-btn');
    const confirmBtn = dialog.querySelector('.wedding-confirm-btn');
    
    cancelBtn.addEventListener('click', () => cancelWeddingDialog(overlay));
    confirmBtn.addEventListener('click', () => confirmWeddingDialog(overlay));

    // Click outside to close
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            cancelWeddingDialog(overlay);
        }
    });

    // Escape key to close
    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            cancelWeddingDialog(overlay);
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    document.body.appendChild(overlay);
    
    console.log('🎭 Dialog hinzugefügt zu body, z-index:', overlay.style.zIndex);
    
    // Force reflow
    overlay.offsetHeight;
}

function confirmWeddingDialog(overlay) {
    console.log('✅ Wedding Dialog bestätigt');
    if (overlay && overlay.onConfirm) {
        overlay.onConfirm();
    }
    if (overlay && overlay.parentElement) {
        overlay.remove();
    }
}

function cancelWeddingDialog(overlay) {
    console.log('❌ Wedding Dialog abgebrochen');
    if (overlay && overlay.onCancel) {
        overlay.onCancel();
    }
    if (overlay && overlay.parentElement) {
        overlay.remove();
    }
}

// Legacy showNotification function - redirect to Wedding Theme
function showNotification(message, type = 'info') {
    showWeddingNotification(message, type);
}

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Nur initialisieren wenn wir auf dem Dashboard sind
    if (document.getElementById('checkliste-container')) {
        initializeCheckliste();
    }
});

function initializeCheckliste() {
    console.log('🚀 Initialisiere Hochzeitstag-Checkliste...');
    
    // Event Listeners
    setupEventListeners();
    
    // Daten laden
    loadCheckliste();
}

function setupEventListeners() {
    // Toggle Archive Button
    const archiveToggle = document.getElementById('checkliste-archive-toggle');
    if (archiveToggle) {
        archiveToggle.addEventListener('click', toggleArchiveView);
    }
    
    // Add New Item Button
    const addButton = document.getElementById('checkliste-add-btn');
    if (addButton) {
        addButton.addEventListener('click', openAddModal);
    }
    
    // Save Modal Button
    const saveButton = document.getElementById('checkliste-save-btn');
    if (saveButton) {
        saveButton.addEventListener('click', saveChecklisteItem);
    }
    
    // Modal Close Events
    const modal = document.getElementById('checklisteModal');
    if (modal) {
        modal.addEventListener('hidden.bs.modal', resetModal);
    }
}

// =============================================================================
// Data Loading
// =============================================================================

function loadCheckliste() {
    console.log('📋 Lade Checkliste...', showArchive ? '(Archiv)' : '(Aktiv)');
    
    const url = showArchive ? '/api/checkliste/archive' : '/api/checkliste/list';
    console.log('🌐 API URL:', url);
    
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                checklisteData = data.items || [];
                console.log(`✅ Checkliste geladen: ${checklisteData.length} Einträge`);
                console.log('📋 Items:', checklisteData.map(item => ({ id: item.id, titel: item.titel })));
                renderCheckliste();
                updateCounter();
                return data; // Return data for promise chaining
            } else {
                console.error('❌ Fehler beim Laden:', data.error);
                showNotification('Fehler beim Laden der Checkliste', 'error');
                throw new Error(data.error);
            }
        })
        .catch(error => {
            console.error('❌ Netzwerkfehler:', error);
            showNotification('Netzwerkfehler beim Laden der Checkliste', 'error');
            throw error;
        });
}

// =============================================================================
// Rendering
// =============================================================================

function renderCheckliste() {
    const container = document.getElementById('checkliste-items');
    if (!container) return;
    
    if (checklisteData.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-clipboard-list fa-3x mb-3"></i>
                <p>${showArchive ? 'Keine archivierten Aufgaben vorhanden' : 'Keine Aufgaben für den Hochzeitstag erstellt'}</p>
                ${!showArchive ? `
                    <div class="d-flex gap-2 justify-content-center">
                        <button class="btn btn-primary" onclick="openAddModal()">
                            <i class="fas fa-plus me-1"></i> Erste Aufgabe hinzufügen
                        </button>
                        <button class="btn btn-outline-secondary" onclick="createDefaultChecklist()">
                            <i class="fas fa-magic me-1"></i> Standard-Checkliste erstellen
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = checklisteData.map(item => createChecklisteItemHTML(item)).join('');
}

function createChecklisteItemHTML(item) {
    const priorityClass = getPriorityClass(item.prioritaet);
    const priorityIcon = getPriorityIcon(item.prioritaet);
    const timeDisplay = item.uhrzeit ? `<span class="time-badge">${item.uhrzeit}</span>` : '';
    
    return `
        <div class="checkliste-item ${item.erledigt ? 'completed' : ''}" data-id="${item.id}">
            <div class="d-flex align-items-center">
                <!-- Checkbox -->
                <div class="form-check me-3">
                    <input class="form-check-input" type="checkbox" 
                           id="check-${item.id}" 
                           ${item.erledigt ? 'checked' : ''}
                           ${showArchive ? 'disabled' : ''}
                           onchange="toggleChecklisteItem(${item.id})">
                </div>
                
                <!-- Priority Icon -->
                <div class="priority-indicator ${priorityClass} me-2" title="Priorität ${item.prioritaet}">
                    <i class="${priorityIcon}"></i>
                </div>
                
                <!-- Content -->
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-1">
                        <h6 class="mb-0 me-2 ${item.erledigt ? 'text-decoration-line-through text-muted' : ''}">${item.titel}</h6>
                        ${timeDisplay}
                        <span class="badge bg-secondary ms-2">${item.kategorie}</span>
                    </div>
                    
                    ${item.beschreibung ? `<p class="text-muted small mb-1">${item.beschreibung}</p>` : ''}
                    
                    ${item.erledigt ? `
                        <small class="text-success">
                            <i class="fas fa-check-circle"></i>
                            Erledigt ${item.erledigt_am ? formatDateTime(item.erledigt_am) : ''} 
                            ${item.erledigt_von ? `von ${item.erledigt_von}` : ''}
                        </small>
                    ` : ''}
                </div>
                
                <!-- Actions -->
                <div class="checkliste-actions">
                    ${!showArchive ? `
                        <button class="btn btn-sm btn-outline-primary me-1" 
                                onclick="editChecklisteItem(${item.id})" 
                                title="Bearbeiten">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="showDeleteConfirmation(${item.id})" 
                                title="Löschen">
                            <i class="bi bi-x"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline-success me-1" 
                                onclick="reactivateChecklisteItem(${item.id})" 
                                title="Wieder aktivieren">
                            <i class="bi bi-arrow-counterclockwise"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="showDeleteConfirmation(${item.id})" 
                                title="Endgültig löschen">
                            <i class="bi bi-x"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

function getPriorityClass(prioritaet) {
    switch (prioritaet) {
        case 4: return 'priority-critical';
        case 3: return 'priority-high';
        case 2: return 'priority-medium';
        case 1: return 'priority-low';
        default: return 'priority-medium';
    }
}

function getPriorityIcon(prioritaet) {
    switch (prioritaet) {
        case 4: return 'bi bi-exclamation-triangle-fill';
        case 3: return 'bi bi-exclamation-circle-fill';
        case 2: return 'bi bi-circle-fill';
        case 1: return 'bi bi-dash-circle';
        default: return 'bi bi-circle-fill';
    }
}

// =============================================================================
// CRUD Operations
// =============================================================================

function toggleChecklisteItem(itemId) {
    console.log('🔄 Toggle Checkliste Item:', itemId);
    
    fetch(`/api/checkliste/toggle/${itemId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('✅ Status geändert');
            showNotification('Status aktualisiert', 'success');
            
            // Nach kurzer Verzögerung neu laden (für Animation)
            setTimeout(() => {
                loadCheckliste();
            }, 300);
        } else {
            console.error('❌ Fehler beim Ändern:', data.error);
            showNotification('Fehler beim Aktualisieren', 'error');
            // Checkbox zurücksetzen
            const checkbox = document.getElementById(`check-${itemId}`);
            if (checkbox) checkbox.checked = !checkbox.checked;
        }
    })
    .catch(error => {
        console.error('❌ Netzwerkfehler:', error);
        showNotification('Netzwerkfehler', 'error');
        // Checkbox zurücksetzen
        const checkbox = document.getElementById(`check-${itemId}`);
        if (checkbox) checkbox.checked = !checkbox.checked;
    });
}

function openAddModal() {
    resetModal();
    
    document.getElementById('checklisteModalLabel').textContent = 'Neue Checkliste-Aufgabe';
    document.getElementById('checkliste-save-btn').textContent = 'Hinzufügen';
    
    const modal = new bootstrap.Modal(document.getElementById('checklisteModal'));
    modal.show();
}

function editChecklisteItem(itemId) {
    const item = checklisteData.find(item => item.id === itemId);
    if (!item) return;
    
    // Modal füllen
    document.getElementById('checkliste-item-id').value = item.id;
    document.getElementById('checkliste-titel').value = item.titel;
    document.getElementById('checkliste-beschreibung').value = item.beschreibung || '';
    document.getElementById('checkliste-kategorie').value = item.kategorie;
    document.getElementById('checkliste-prioritaet').value = item.prioritaet;
    document.getElementById('checkliste-uhrzeit').value = item.uhrzeit || '';
    
    document.getElementById('checklisteModalLabel').textContent = 'Aufgabe bearbeiten';
    document.getElementById('checkliste-save-btn').textContent = 'Speichern';
    
    const modal = new bootstrap.Modal(document.getElementById('checklisteModal'));
    modal.show();
}

function saveChecklisteItem() {
    const itemId = document.getElementById('checkliste-item-id').value;
    const titel = document.getElementById('checkliste-titel').value.trim();
    const beschreibung = document.getElementById('checkliste-beschreibung').value.trim();
    const kategorie = document.getElementById('checkliste-kategorie').value;
    const prioritaet = parseInt(document.getElementById('checkliste-prioritaet').value);
    const uhrzeit = document.getElementById('checkliste-uhrzeit').value.trim();
    
    if (!titel) {
        showNotification('Titel ist erforderlich', 'error');
        return;
    }
    
    const data = {
        titel,
        beschreibung,
        kategorie,
        prioritaet,
        uhrzeit
    };
    
    const isEdit = itemId && itemId !== '';
    const url = isEdit ? `/api/checkliste/update/${itemId}` : '/api/checkliste/add';
    const method = isEdit ? 'PUT' : 'POST';
    
    console.log(`💾 ${isEdit ? 'Aktualisiere' : 'Erstelle'} Checkliste-Item:`, data);
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('✅ Gespeichert');
            showNotification(isEdit ? 'Aufgabe aktualisiert' : 'Aufgabe hinzugefügt', 'success');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('checklisteModal'));
            modal.hide();
            
            // Daten neu laden
            loadCheckliste();
        } else {
            console.error('❌ Fehler beim Speichern:', data.error);
            showNotification(data.error || 'Fehler beim Speichern', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Netzwerkfehler:', error);
        showNotification('Netzwerkfehler beim Speichern', 'error');
    });
}

function showDeleteConfirmation(itemId) {
    const item = checklisteData.find(item => item.id === itemId);
    if (!item) return;
    
    // Unterschiedliche Texte für Archive vs. Aktive Einträge
    const isArchive = showArchive;
    const deleteTitle = isArchive ? '🗑️ Aufgabe endgültig löschen' : '🗑️ Aufgabe löschen';
    const deleteQuestion = isArchive 
        ? 'Soll diese archivierte Aufgabe endgültig gelöscht werden?' 
        : 'Soll diese Aufgabe wirklich gelöscht werden?';
    const deleteWarning = isArchive
        ? 'Diese Aktion kann nicht rückgängig gemacht werden. Die Aufgabe wird permanent gelöscht.'
        : 'Diese Aktion kann nicht rückgängig gemacht werden.';
    
    const messageContent = `
        <p class="mb-3">${deleteQuestion}</p>
        <div class="p-3 mb-3" style="background: linear-gradient(135deg, var(--wedding-white), var(--wedding-light-gold)); border: 2px solid var(--wedding-cream); border-radius: 10px;">
            <strong style="color: var(--wedding-text-dark);">${item.titel}</strong>
            ${item.beschreibung ? `<br><small style="color: var(--wedding-text);">${item.beschreibung}</small>` : ''}
            ${isArchive ? `<br><small style="color: #28a745;"><i class="bi bi-check-circle me-1"></i>Archiviert</small>` : ''}
        </div>
        <p class="text-danger mb-0">
            <small><i class="bi bi-info-circle me-1"></i>${deleteWarning}</small>
        </p>
    `;
    
    showWeddingConfirm(
        deleteTitle,
        messageContent,
        function() {
            // Führe Löschung durch
            deleteChecklisteItem(itemId);
        }
    );
}

function deleteChecklisteItem(itemId) {
    console.log('🗑️ Lösche Checkliste-Item:', itemId);
    console.log('📂 Aktueller Modus:', showArchive ? 'Archiv' : 'Aktiv');
    
    fetch(`/api/checkliste/delete/${itemId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('🗑️ Response Status:', response.status, response.statusText);
        
        if (!response.ok) {
            // 404 bedeutet Item nicht gefunden - spezieller Fall
            if (response.status === 404) {
                return response.json().then(data => {
                    throw new Error(`Item nicht gefunden: ${data.error || 'Aufgabe existiert nicht mehr'}`);
                });
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(data => {
        console.log('🗑️ Response Data:', data);
        
        if (data.success) {
            console.log('✅ Gelöscht');
            showNotification('Aufgabe gelöscht', 'success');
            
            // Kurze Verzögerung für Datenbank-Synchronisation
            setTimeout(() => {
                console.log('🔄 Lade Liste neu...');
                loadCheckliste();
            }, 200);
        } else {
            console.error('❌ Fehler beim Löschen:', data.error);
            showNotification(`Fehler beim Löschen: ${data.error || 'Unbekannter Fehler'}`, 'error');
        }
    })
    .catch(error => {
        console.error('❌ Netzwerkfehler beim Löschen:', error);
        showNotification(`Netzwerkfehler beim Löschen: ${error.message}`, 'error');
    });
}

// =============================================================================
// Archive Functions
// =============================================================================

function reactivateChecklisteItem(itemId) {
    const item = checklisteData.find(item => item.id === itemId);
    if (!item) return;
    
    console.log('🔄 Reaktiviere Checkliste-Item:', itemId, item.titel);
    
    fetch(`/api/checkliste/reactivate/${itemId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('🔄 Response Status:', response.status, response.statusText);
        
        if (!response.ok) {
            // 404 bedeutet Item nicht gefunden - spezieller Fall
            if (response.status === 404) {
                return response.json().then(data => {
                    throw new Error(`Item nicht gefunden: ${data.error || 'Aufgabe existiert nicht mehr'}`);
                });
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(data => {
        console.log('🔄 Response Data:', data);
        
        if (data.success) {
            console.log('✅ Reaktiviert');
            showNotification('Aufgabe wieder aktiviert', 'success');
            
            // Kurze Verzögerung für Datenbank-Synchronisation
            setTimeout(() => {
                console.log('🔄 Lade Archiv neu nach Reaktivierung...');
                loadCheckliste();
            }, 200);
        } else {
            console.error('❌ Fehler beim Reaktivieren:', data.error);
            showNotification(`Fehler beim Reaktivieren: ${data.error || 'Unbekannter Fehler'}`, 'error');
        }
    })
    .catch(error => {
        console.error('❌ Netzwerkfehler beim Reaktivieren:', error);
        showNotification(`Netzwerkfehler beim Reaktivieren: ${error.message}`, 'error');
    });
}

// =============================================================================
// UI Functions
// =============================================================================

function toggleArchiveView() {
    showArchive = !showArchive;
    
    const button = document.getElementById('checkliste-archive-toggle');
    if (button) {
        button.innerHTML = showArchive 
            ? '<i class="fas fa-clipboard-list me-1"></i> Aktive Aufgaben'
            : '<i class="fas fa-archive me-1"></i> Archiv anzeigen';
    }
    
    // Lade Checkliste und scrolle automatisch zum Archiv-Bereich
    loadCheckliste().then(() => {
        if (showArchive) {
            // Kurze Verzögerung um sicherzustellen, dass der Inhalt geladen ist
            setTimeout(() => {
                const checklisteContainer = document.getElementById('checkliste-container');
                if (checklisteContainer) {
                    // Smooth scroll to the checklist container
                    checklisteContainer.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                    
                    // Alternative: Scroll to bottom of page if content is cut off
                    setTimeout(() => {
                        const pageHeight = document.documentElement.scrollHeight;
                        const viewportHeight = window.innerHeight;
                        const currentScroll = window.pageYOffset;
                        
                        // If we can't see the full content, scroll to show more
                        if (pageHeight - currentScroll > viewportHeight) {
                            window.scrollTo({
                                top: Math.max(0, pageHeight - viewportHeight),
                                behavior: 'smooth'
                            });
                        }
                    }, 100);
                }
            }, 200);
        }
    });
}

function updateCounter() {
    const counter = document.getElementById('checkliste-counter');
    if (counter) {
        if (showArchive) {
            counter.textContent = `${checklisteData.length} archivierte Aufgaben`;
        } else {
            const openCount = checklisteData.filter(item => !item.erledigt).length;
            const completedCount = checklisteData.filter(item => item.erledigt).length;
            counter.textContent = `${openCount} offene, ${completedCount} erledigte Aufgaben`;
        }
    }
}

function resetModal() {
    document.getElementById('checkliste-item-id').value = '';
    document.getElementById('checkliste-titel').value = '';
    document.getElementById('checkliste-beschreibung').value = '';
    document.getElementById('checkliste-kategorie').value = 'Allgemein';
    document.getElementById('checkliste-prioritaet').value = '2';
    document.getElementById('checkliste-uhrzeit').value = '';
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    
    try {
        const date = new Date(dateTimeString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateTimeString;
    }
}

function createDefaultChecklist() {
    showWeddingConfirm(
        '🎩 Standard-Checkliste erstellen', 
        'Möchten Sie eine Standard-Checkliste für den Hochzeitstag erstellen?<br><br>Diese enthält typische Aufgaben wie:<br>• Brautstrauß abholen<br>• Friseur-Termin<br>• Anzug/Kleid fertigmachen<br>• Ringe überprüfen<br>• und weitere wichtige Aufgaben',
        function() {
            console.log('📝 Erstelle Standard-Checkliste...');
            
            fetch('/api/checkliste/create-defaults', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showWeddingNotification(`${data.created_count} Standard-Aufgaben erstellt`, 'success');
                    loadCheckliste(); // Neu laden
                } else {
                    showWeddingNotification(data.error || 'Fehler beim Erstellen der Standard-Checkliste', 'error');
                }
            })
            .catch(error => {
                console.error('❌ Fehler:', error);
                showWeddingNotification('Netzwerkfehler beim Erstellen der Standard-Checkliste', 'error');
            });
        }
    );
}
