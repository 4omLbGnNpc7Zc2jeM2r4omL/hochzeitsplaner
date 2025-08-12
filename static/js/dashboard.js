// Dashboard spezifische Funktionen

// CSS für Spinning-Animation hinzufügen
const spinningCSS = `
<style>
.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
</style>
`;
document.head.insertAdjacentHTML('beforeend', spinningCSS);

// Wedding-Theme Modal Funktionen
function showWeddingConfirm(title, message, onConfirm, onCancel = null) {
    return new Promise((resolve) => {
        // Erstelle Modal HTML
        const modalHtml = `
            <div class="modal fade" id="weddingConfirmModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content modal-wedding">
                        <div class="modal-header">
                            <h5 class="modal-title text-wedding-gold">
                                <i class="bi bi-question-circle me-2"></i>${title}
                            </h5>
                        </div>
                        <div class="modal-body">
                            <p class="mb-3">${message}</p>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-outline-secondary" id="cancelBtn">
                                <i class="bi bi-x-circle me-1"></i>Abbrechen
                            </button>
                            <button type="button" class="btn btn-wedding-primary" id="confirmBtn">
                                <i class="bi bi-check-circle me-1"></i>Bestätigen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Füge Modal zum DOM hinzu
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('weddingConfirmModal'));
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        
        // Event-Handler
        confirmBtn.addEventListener('click', () => {
            modal.hide();
            resolve(true);
            if (onConfirm) onConfirm();
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.hide();
            resolve(false);
            if (onCancel) onCancel();
        });
        
        // Modal aufräumen nach dem Schließen
        document.getElementById('weddingConfirmModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('weddingConfirmModal').remove();
        });
        
        modal.show();
    });
}

function showWeddingAlert(title, message, type = 'info') {
    // Icon basierend auf Typ
    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
    };
    
    const colors = {
        success: 'text-success',
        error: 'text-danger',
        warning: 'text-warning',
        info: 'text-wedding-gold'
    };
    
    const icon = icons[type] || icons.info;
    const color = colors[type] || colors.info;
    
    // Erstelle Modal HTML
    const modalHtml = `
        <div class="modal fade" id="weddingAlertModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content modal-wedding">
                    <div class="modal-header">
                        <h5 class="modal-title ${color}">
                            <i class="bi ${icon} me-2"></i>${title}
                        </h5>
                    </div>
                    <div class="modal-body">
                        <p class="mb-0">${message}</p>
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-wedding-primary" data-bs-dismiss="modal">
                            <i class="bi bi-check me-1"></i>OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Füge Modal zum DOM hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = new bootstrap.Modal(document.getElementById('weddingAlertModal'));
    
    // Modal aufräumen nach dem Schließen
    document.getElementById('weddingAlertModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('weddingAlertModal').remove();
    });
    
    modal.show();
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Dashboard-Daten laden
        const data = await HochzeitsplanerApp.loadDashboardStats();
        
        if (data) {
            // Charts erstellen
            HochzeitsplanerApp.createGuestsChart(data);
            HochzeitsplanerApp.createBudgetChart(data);
        }
        
    } catch (error) {
        showWeddingAlert(
            'Dashboard Fehler',
            'Das Dashboard konnte nicht geladen werden. Bitte aktualisieren Sie die Seite.',
            'error'
        );
    }
    
    // Checkliste laden
    try {
        loadDashboardChecklist();
    } catch (error) {
        console.error('Fehler beim Laden der Checkliste:', error);
    }
});

// Checkliste-Funktionen für Dashboard
async function loadDashboardChecklist() {
    console.log('🔄 Lade Dashboard-Checkliste...');
    
    try {
        const response = await fetch('/api/checkliste/list', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            renderDashboardChecklist(data.data);
        } else {
            throw new Error(data.error || 'Fehler beim Laden der Checkliste');
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der Checkliste:', error);
        
        const container = document.getElementById('checklistContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-exclamation-triangle fs-1 mb-2"></i>
                    <p>Fehler beim Laden der Checkliste</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="loadDashboardChecklist()">
                        <i class="bi bi-arrow-clockwise me-1"></i>Erneut versuchen
                    </button>
                </div>
            `;
        }
    }
}

function renderDashboardChecklist(checkliste) {
    console.log('📋 Rendere Dashboard-Checkliste:', checkliste.length, 'Einträge');
    
    const container = document.getElementById('checklistContainer');
    if (!container) {
        console.warn('❌ checklistContainer nicht gefunden');
        return;
    }
    
    if (!checkliste || checkliste.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-clipboard-check fs-1 mb-3 text-wedding-gold"></i>
                <h6 class="mb-3">Noch keine Checkliste vorhanden</h6>
                <p class="mb-3 text-muted">Erstellen Sie eine Standard-Checkliste mit den wichtigsten Hochzeitsaufgaben</p>
                <button class="btn btn-wedding-primary" onclick="createStandardChecklist()" id="createStandardBtn">
                    <i class="bi bi-plus-circle me-2"></i>Standard Checkliste erstellen
                </button>
            </div>
        `;
        return;
    }
    
    // Alle Einträge anzeigen, sortiert nach Status
    const activeItems = checkliste.filter(item => !item.erledigt);
    const completedItems = checkliste.filter(item => item.erledigt);
    
    // Dashboard: Nur ersten 5 aktive Einträge anzeigen
    const dashboardActiveItems = activeItems.slice(0, 5);
    const remainingActiveItems = activeItems.slice(5);
    
    // Action Buttons HTML mit erweiterten Optionen
    const actionButtonsHtml = `
        <div class="row mb-3">
            <div class="col-md-8">
                <button class="btn btn-wedding-primary btn-sm" onclick="showAddChecklistModal()">
                    <i class="bi bi-plus-circle me-1"></i>Neue Aufgabe
                </button>
                <button class="btn btn-outline-secondary btn-sm ms-2" onclick="window.location.href='/aufgabenplaner'">
                    <i class="bi bi-list-ul me-1"></i>Alle verwalten
                </button>
                ${remainingActiveItems.length > 0 ? `
                    <button class="btn btn-outline-wedding-primary btn-sm ms-2" onclick="toggleMoreItems()" id="toggleMoreBtn">
                        <i class="bi bi-chevron-down me-1"></i>Weitere ${remainingActiveItems.length} anzeigen
                    </button>
                ` : ''}
            </div>
            <div class="col-md-4 text-end">
                <small class="text-muted">
                    ${checkliste.length} Einträge • ${activeItems.length} offen • ${completedItems.length} erledigt
                </small>
            </div>
        </div>
    `;
    
    // Aktive Aufgaben HTML - nur ersten 5 für Dashboard
    let activeItemsHtml = '';
    if (activeItems.length > 0) {
        // Funktion zum Generieren von Checkliste-Items
        const generateItemHtml = (items) => {
            return items.map(item => {
                const itemTitle = (item.titel || 'Unbenannter Eintrag').replace(/'/g, "\\'");
                return `
                    <div class="col-12 mb-2">
                        <div class="card wedding-card">
                            <div class="card-body py-3">
                                <div class="d-flex align-items-center justify-content-between">
                                    <div class="d-flex align-items-center flex-grow-1">
                                        <button class="btn btn-sm btn-outline-success me-3" onclick="toggleChecklistItem(${item.id})" 
                                                title="Als erledigt markieren">
                                            <i class="bi bi-square"></i>
                                        </button>
                                        <div class="flex-grow-1">
                                            <div class="d-flex align-items-center">
                                                <strong class="me-2">${item.titel || 'Unbenannter Eintrag'}</strong>
                                                <span class="badge ${getPriorityBadgeClass(item.prioritaet)} me-2">${getPriorityText(item.prioritaet)}</span>
                                                ${item.uhrzeit ? `<span class="badge bg-light text-dark"><i class="bi bi-clock me-1"></i>${item.uhrzeit}</span>` : ''}
                                            </div>
                                            ${item.beschreibung ? `<small class="text-muted d-block mt-1">${item.beschreibung}</small>` : ''}
                                            <small class="text-muted">
                                                <i class="bi bi-tag me-1"></i>${item.kategorie || 'Allgemein'}
                                            </small>
                                        </div>
                                    </div>
                                    <div class="text-end">
                                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editChecklistItem(${item.id})" 
                                                title="Bearbeiten">
                                            <i class="bi bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteChecklistItem(${item.id}, '${itemTitle}')" 
                                                title="Löschen">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        };
        
        // Dashboard Items (erste 5)
        const dashboardItemsHtml = generateItemHtml(dashboardActiveItems);
        
        // Weitere Items (ausblendbar)
        const moreItemsHtml = remainingActiveItems.length > 0 ? 
            `<div id="moreChecklistItems" style="display: none;">
                ${generateItemHtml(remainingActiveItems)}
            </div>` : '';
        
        activeItemsHtml = `
            <div class="mb-4">
                <h6 class="text-wedding-gold mb-3">
                    <i class="bi bi-clock me-2"></i>Nächste Aufgaben 
                    <span class="badge bg-wedding-secondary ms-2">${dashboardActiveItems.length}${remainingActiveItems.length > 0 ? ' von ' + activeItems.length : ''}</span>
                </h6>
                <div class="row">
                    ${dashboardItemsHtml}
                    ${moreItemsHtml}
                </div>
            </div>
        `;
    }
    
    // Archivierte Aufgaben HTML
    let completedItemsHtml = '';
    if (completedItems.length > 0) {
        const completedItemsList = completedItems.map(item => {
            const itemTitle = (item.titel || 'Unbenannter Eintrag').replace(/'/g, "\\'");
            const completedDate = item.erledigt_am ? new Date(item.erledigt_am).toLocaleDateString('de-DE') : '';
            
            return `
                <div class="col-12 mb-2">
                    <div class="card wedding-card" style="opacity: 0.8;">
                        <div class="card-body py-2">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center flex-grow-1">
                                    <button class="btn btn-sm btn-outline-warning me-3" onclick="toggleChecklistItem(${item.id})" 
                                            title="Wieder als offen markieren">
                                        <i class="bi bi-check-square-fill"></i>
                                    </button>
                                    <div class="flex-grow-1">
                                        <div class="d-flex align-items-center">
                                            <strong class="me-2 text-decoration-line-through text-muted">${item.titel || 'Unbenannter Eintrag'}</strong>
                                            <span class="badge bg-success me-2">Erledigt</span>
                                            ${completedDate ? `<small class="text-muted"><i class="bi bi-calendar-check me-1"></i>${completedDate}</small>` : ''}
                                        </div>
                                        ${item.beschreibung ? `<small class="text-muted d-block mt-1 text-decoration-line-through">${item.beschreibung}</small>` : ''}
                                    </div>
                                </div>
                                <div class="text-end">
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editChecklistItem(${item.id})" 
                                            title="Bearbeiten">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteChecklistItem(${item.id}, '${itemTitle}')" 
                                            title="Löschen">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        completedItemsHtml = `
            <div class="mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="text-wedding-gold mb-0"><i class="bi bi-check-circle me-2"></i>Erledigte Aufgaben (${completedItems.length})</h6>
                    <button class="btn btn-outline-secondary btn-sm" onclick="toggleArchivedView()" id="toggleArchiveBtn">
                        <i class="bi bi-eye me-1"></i>Anzeigen
                    </button>
                </div>
                <div id="archivedItems" style="display: none;">
                    <div class="row">
                        ${completedItemsList}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Final HTML zusammensetzen
    const finalHtml = actionButtonsHtml + activeItemsHtml + completedItemsHtml;
    container.innerHTML = finalHtml;
}

// Toggle-Funktion für weitere Checkliste-Items
function toggleMoreItems() {
    const moreItems = document.getElementById('moreChecklistItems');
    const toggleBtn = document.getElementById('toggleMoreBtn');
    
    if (!moreItems || !toggleBtn) return;
    
    if (moreItems.style.display === 'none') {
        moreItems.style.display = 'block';
        toggleBtn.innerHTML = '<i class="bi bi-chevron-up me-1"></i>Weniger anzeigen';
        toggleBtn.classList.remove('btn-outline-wedding-primary');
        toggleBtn.classList.add('btn-outline-secondary');
    } else {
        moreItems.style.display = 'none';
        const remainingCount = moreItems.children.length;
        toggleBtn.innerHTML = `<i class="bi bi-chevron-down me-1"></i>Weitere ${remainingCount} anzeigen`;
        toggleBtn.classList.remove('btn-outline-secondary');
        toggleBtn.classList.add('btn-outline-wedding-primary');
    }
}

// Archiv Toggle-Funktion
function toggleArchivedView() {
    const archivedItems = document.getElementById('archivedItems');
    const toggleBtn = document.getElementById('toggleArchiveBtn');
    
    if (archivedItems.style.display === 'none') {
        archivedItems.style.display = 'block';
        toggleBtn.innerHTML = '<i class="bi bi-eye-slash me-1"></i>Verbergen';
    } else {
        archivedItems.style.display = 'none';
        toggleBtn.innerHTML = '<i class="bi bi-eye me-1"></i>Anzeigen';
    }
}

// Alle Checkliste-Einträge anzeigen
function showAllChecklistItems() {
    // Funktion ist bereits implementiert - alle Einträge werden angezeigt
    console.log('Alle Einträge werden bereits angezeigt');
}

// Modal für neue Aufgabe
function showAddChecklistModal() {
    // Verwende das neue Wedding-Theme Modal
    showNewChecklistItemModal();
}

// Dashboard-spezifische Funktionen für HTML-Buttons
function openTaskModal() {
    // Öffne Modal für neue Checkliste-Aufgabe
    showNewChecklistItemModal();
}

function showNewChecklistItemModal() {
    // Erstelle Wedding-Theme Modal für neue Checkliste-Aufgabe
    const modalHtml = `
        <div class="modal fade" id="newChecklistItemModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content modal-wedding">
                    <div class="modal-header">
                        <h5 class="modal-title" style="color: var(--wedding-text-dark);">
                            <i class="bi bi-plus-circle me-2"></i>Neue Checkliste-Aufgabe
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                    </div>
                    <div class="modal-body" style="color: var(--wedding-text-dark);">
                        <style>
                            #newChecklistItemModal .form-label {
                                color: var(--wedding-text-dark) !important;
                            }
                            #newChecklistItemModal .form-control {
                                color: var(--wedding-text-dark);
                            }
                            #newChecklistItemModal .form-select {
                                color: var(--wedding-text-dark);
                            }
                        </style>
                        <form id="newChecklistItemForm">
                            <div class="row">
                                <div class="col-md-8 mb-3">
                                    <label for="checklistTitel" class="form-label">Titel <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="checklistTitel" required 
                                           placeholder="z.B. Blumen für Kirche bestellen">
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label for="checklistPriorität" class="form-label">Priorität</label>
                                    <select class="form-select" id="checklistPriorität">
                                        <option value="2" selected>Normal</option>
                                        <option value="1">Niedrig</option>
                                        <option value="3">Hoch</option>
                                        <option value="4">Kritisch</option>
                                    </select>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="checklistKategorie" class="form-label">Kategorie</label>
                                    <select class="form-select" id="checklistKategorie">
                                        <option value="Allgemein" selected>Allgemein</option>
                                        <option value="Dekoration">Dekoration</option>
                                        <option value="Catering">Catering</option>
                                        <option value="Musik">Musik</option>
                                        <option value="Kleidung">Kleidung</option>
                                        <option value="Blumen">Blumen</option>
                                        <option value="Fotografie">Fotografie</option>
                                        <option value="Transport">Transport</option>
                                        <option value="Gäste">Gäste</option>
                                        <option value="Dokumente">Dokumente</option>
                                        <option value="Sonstiges">Sonstiges</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="checklistUhrzeit" class="form-label">Uhrzeit (optional)</label>
                                    <input type="time" class="form-control" id="checklistUhrzeit">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="checklistBeschreibung" class="form-label">Beschreibung (optional)</label>
                                <textarea class="form-control" id="checklistBeschreibung" rows="3" 
                                          placeholder="Zusätzliche Details, Notizen oder Anweisungen..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle me-1"></i>Abbrechen
                        </button>
                        <button type="button" class="btn btn-wedding-primary" onclick="saveNewChecklistItem()">
                            <i class="bi bi-check-circle me-1"></i>Aufgabe erstellen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Füge Modal zum DOM hinzu
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Öffne Modal
    const modal = new bootstrap.Modal(document.getElementById('newChecklistItemModal'));
    
    // Modal aufräumen nach dem Schließen
    document.getElementById('newChecklistItemModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('newChecklistItemModal').remove();
    });
    
    modal.show();
    
    // Focus auf Titel-Feld setzen
    setTimeout(() => {
        document.getElementById('checklistTitel').focus();
    }, 500);
}

async function saveNewChecklistItem() {
    console.log('💾 Speichere neue Checkliste-Aufgabe...');
    
    // Formular-Daten sammeln
    const titel = document.getElementById('checklistTitel').value.trim();
    const beschreibung = document.getElementById('checklistBeschreibung').value.trim();
    const kategorie = document.getElementById('checklistKategorie').value;
    const prioritaet = parseInt(document.getElementById('checklistPriorität').value);
    const uhrzeit = document.getElementById('checklistUhrzeit').value;
    
    // Validierung
    if (!titel) {
        showWeddingAlert(
            'Eingabe erforderlich',
            'Bitte geben Sie einen Titel für die Aufgabe ein.',
            'warning'
        );
        document.getElementById('checklistTitel').focus();
        return;
    }
    
    // Speicher-Button deaktivieren während der Anfrage
    const saveBtn = document.querySelector('#newChecklistItemModal .btn-wedding-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise spinning me-1"></i>Speichere...';
    
    try {
        const response = await fetch('/api/checkliste/add', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify({
                titel: titel,
                beschreibung: beschreibung,
                kategorie: kategorie,
                prioritaet: prioritaet,
                uhrzeit: uhrzeit
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Neue Checkliste-Aufgabe erstellt');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('newChecklistItemModal'));
            modal.hide();
            
            // Erfolgsmeldung anzeigen
            showWeddingAlert(
                'Aufgabe erstellt',
                `✅ "${titel}" wurde erfolgreich zur Checkliste hinzugefügt!`,
                'success'
            );
            
            // Checkliste neu laden
            await loadDashboardChecklist();
            
        } else {
            throw new Error(data.error || 'Fehler beim Erstellen der Aufgabe');
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Erstellen der Aufgabe:', error);
        
        showWeddingAlert(
            'Fehler beim Erstellen',
            `Die Aufgabe konnte nicht erstellt werden:<br><br><code>${error.message}</code>`,
            'error'
        );
        
        // Button zurücksetzen
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

function showDashboardArchive() {
    // Toggle zwischen Dashboard-Ansicht und vollständiger Checkliste
    const moreItems = document.getElementById('moreChecklistItems');
    const archivedItems = document.getElementById('archivedItems');
    
    // Zuerst alle ausgeblendeten Items anzeigen
    if (moreItems && moreItems.style.display === 'none') {
        toggleMoreItems();
    }
    
    // Dann das Archiv anzeigen
    if (archivedItems && archivedItems.style.display === 'none') {
        toggleArchivedView();
    }
    
    // Alternativ: Weiterleitung zum vollständigen Aufgabenplaner
    // window.location.href = '/aufgabenplaner';
}

// Checkliste-Eintrag bearbeiten
function editChecklistItem(itemId) {
    console.log('✏️ Bearbeite Checkliste-Eintrag:', itemId);
    
    // Für jetzt weiterleitung zum Aufgabenplaner mit Bearbeitungs-Hash
    window.location.href = `/aufgabenplaner#edit-${itemId}`;
}

// Checkliste-Eintrag löschen
async function deleteChecklistItem(itemId, itemTitle) {
    console.log('🗑️ Lösche Checkliste-Eintrag:', itemId, itemTitle);
    
    // Wedding-Theme Confirmation Modal anstatt Browser-Popup
    const confirmed = await showWeddingConfirm(
        'Eintrag löschen', 
        `Möchten Sie "<strong>${itemTitle}</strong>" wirklich löschen?<br><br><small class="text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</small>`
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`/api/checkliste/delete/${itemId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Checkliste-Eintrag gelöscht');
            // Checkliste neu laden
            await loadDashboardChecklist();
        } else {
            throw new Error(data.error || 'Fehler beim Löschen');
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Löschen:', error);
        
        showWeddingAlert(
            'Fehler beim Löschen',
            `Es gab einen Fehler beim Löschen des Eintrags:<br><br><code>${error.message}</code>`,
            'error'
        );
    }
}

// Neue Hilfsfunktionen für Checkliste
function getPriorityColor(prioritaet) {
    switch(prioritaet) {
        case 4: return '#dc3545';  // Kritisch
        case 3: return '#fd7e14';  // Hoch
        case 2: return '#6c757d';  // Normal
        case 1: return '#198754';  // Niedrig
        default: return '#6c757d';
    }
}

function getPriorityBadgeClass(prioritaet) {
    switch(prioritaet) {
        case 4: return 'bg-danger';       // Kritisch
        case 3: return 'bg-warning text-dark';  // Hoch
        case 2: return 'bg-secondary';    // Normal
        case 1: return 'bg-success';      // Niedrig
        default: return 'bg-secondary';
    }
}

function getPriorityText(prioritaet) {
    switch(prioritaet) {
        case 4: return 'Kritisch';
        case 3: return 'Hoch';
        case 2: return 'Normal';
        case 1: return 'Niedrig';
        default: return 'Normal';
    }
}

// Checkliste-Eintrag Status umschalten
async function toggleChecklistItem(itemId) {
    console.log('🔄 Toggle Checkliste-Eintrag:', itemId);
    
    try {
        const response = await fetch(`/api/checkliste/toggle/${itemId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Checkliste-Eintrag Status geändert');
            // Checkliste neu laden
            await loadDashboardChecklist();
        } else {
            throw new Error(data.error || 'Fehler beim Ändern des Status');
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Toggle:', error);
        
        showWeddingAlert(
            'Fehler beim Status ändern',
            `Der Status konnte nicht geändert werden:<br><br><code>${error.message}</code>`,
            'error'
        );
    }
}

// Standard-Checkliste erstellen
async function createStandardChecklist() {
    console.log('📝 Erstelle Standard-Checkliste...');
    
    const createBtn = document.getElementById('createStandardBtn');
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="bi bi-arrow-clockwise spinning me-2"></i>Erstelle...';
    }
    
    try {
        const response = await fetch('/api/checkliste/create-standard', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Standard-Checkliste erstellt');
            
            // Checkliste neu laden
            await loadDashboardChecklist();
            
            showWeddingAlert(
                'Checkliste erstellt',
                '✅ Standard-Checkliste mit 15 Einträgen wurde erfolgreich erstellt!',
                'success'
            );
        } else {
            throw new Error(data.error || 'Fehler beim Erstellen der Standard-Checkliste');
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Erstellen der Standard-Checkliste:', error);
        
        showWeddingAlert(
            'Fehler beim Erstellen',
            `Die Standard-Checkliste konnte nicht erstellt werden:<br><br><code>${error.message}</code>`,
            'error'
        );
        
        // Button zurücksetzen
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Standard Checkliste erstellen';
        }
    }
}
