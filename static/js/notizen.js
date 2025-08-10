// Globale Variablen
let notizen = [];
let currentNotizId = null;
let currentFilter = 'alle';
let currentSort = 'prioritaet';

// Globale Funktion für Submit Button - MUSS außerhalb von DOMContentLoaded sein
function submitNotizForm() {
    try {
        // Prüfe ob DOM-Elemente existieren
        const titelElement = document.getElementById('notiz-titel');
        const kategorieElement = document.getElementById('notiz-kategorie');
        const prioritaetElement = document.getElementById('notiz-prioritaet');
        const inhaltElement = document.getElementById('notiz-inhalt');
        const notizIdElement = document.getElementById('notiz-id');
        
        if (!titelElement || !kategorieElement || !prioritaetElement || !inhaltElement || !notizIdElement) {
            console.error('FEHLER: Nicht alle DOM-Elemente gefunden!');
            showError('Formular nicht vollständig geladen. Bitte versuchen Sie es erneut.');
            return;
        }
        
        // Daten direkt aus den Input-Feldern holen
        const titel = titelElement.value.trim();
        const kategorie = kategorieElement.value.trim() || 'Allgemein';
        const prioritaet = prioritaetElement.value;
        const inhalt = inhaltElement.value.trim();
        const notizId = notizIdElement.value;
        
        const notizData = {
            titel: titel,
            kategorie: kategorie,
            prioritaet: prioritaet,
            inhalt: inhalt
        };
        
        // Validierung
        if (!notizData.titel) {
            showError('Bitte geben Sie einen Titel ein.');
            return;
        }
        
        // API-Call
        const isEdit = notizId && notizId !== '';
        const url = isEdit ? `/api/notizen/update/${notizId}` : '/api/notizen/add';
        const method = isEdit ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notizData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(result => {
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('notizModal'));
            if (modal) {
                modal.hide();
            }
            
            // Notizen neu laden
            loadNotizen();
            
            // Erfolgsmeldung
            showSuccess(isEdit ? 'Notiz erfolgreich aktualisiert!' : 'Notiz erfolgreich hinzugefügt!');
            
            // Form zurücksetzen
            document.getElementById('notizForm').reset();
            document.getElementById('notiz-id').value = '';
            currentNotizId = null;
            
        })
        .catch(error => {
            showError('Fehler beim Speichern: ' + error.message);
        });
    
    } catch (error) {
        console.error('FEHLER in submitNotizForm:', error);
        showError('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
    }
}

// Zusätzlich im window-Objekt verfügbar machen für inline onclick
window.submitNotizForm = submitNotizForm;

// DOM Ready mit zusätzlicher Überprüfung
document.addEventListener('DOMContentLoaded', function() {
    // Warten bis Bootstrap vollständig geladen ist
    if (typeof bootstrap === 'undefined') {
        setTimeout(initializeNotizen, 100);
    } else {
        initializeNotizen();
    }
});

// Initialisierung
function initializeNotizen() {
    // Prüfe ob wichtige Elemente existieren
    const notizForm = document.getElementById('notizForm');
    const notizModal = document.getElementById('notizModal');
    const notizenContainer = document.getElementById('notizen-container');
    
    if (!notizForm) {
        console.error('notizForm Element nicht gefunden!');
        return;
    }
    
    if (!notizModal) {
        console.error('notizModal Element nicht gefunden!');
        return;
    }
    
    if (!notizenContainer) {
        console.error('notizen-container Element nicht gefunden!');
        return;
    }
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Notizen laden
    loadNotizen();
}

// Event Listeners Setup
function setupEventListeners() {
    // Filter Buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            filterNotizen(filter);
            
            // Button Zustand aktualisieren
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Search Input
    const searchInput = document.getElementById('notiz-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value;
            filterNotizen(currentFilter, searchTerm);
        });
    }

    // Sort Select
    const sortSelect = document.getElementById('notiz-sort');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            sortAndDisplayNotizen();
        });
    }

    // Form Handling
    const notizForm = document.getElementById('notizForm');
    if (notizForm) {
        // Kein submit Event Listener mehr nötig, da onclick verwendet wird
    }

    // Submit Button explizit suchen und Event Listener hinzufügen
    const submitButton = document.querySelector('[onclick="submitNotizForm()"]');
    if (submitButton) {
        submitButton.addEventListener('click', function(e) {
            e.preventDefault();
            submitNotizForm();
        });
    } else {
        // Fallback: alle Buttons in der Modal durchsuchen
        const allButtons = document.querySelectorAll('#notizModal button');
        allButtons.forEach((btn, index) => {
            if (btn.textContent && btn.textContent.includes('Speichern')) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    submitNotizForm();
                });
            }
        });
    }

    // Modal Event Listeners
    const notizModal = document.getElementById('notizModal');
    if (notizModal) {
        notizModal.addEventListener('show.bs.modal', function(event) {
            // Nur leeren wenn es eine neue Notiz ist (nicht beim Bearbeiten)
            if (!currentNotizId) {
                clearNotizForm();
            }
        });
        
        notizModal.addEventListener('hidden.bs.modal', function() {
            // Nach dem Schließen immer leeren
            clearNotizForm();
        });
    }
}

// Notizen laden
function loadNotizen() {
    fetch('/api/notizen')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // API gibt jetzt direkt ein Array zurück
            if (Array.isArray(data)) {
                notizen = data;
            } else {
                console.error('API Response ist kein Array:', data);
                notizen = [];
            }
            displayNotizen(notizen);
            updateStatistics();
        })
        .catch(error => {
            console.error('Fehler beim Laden der Notizen:', error);
            showError('Fehler beim Laden der Notizen');
            notizen = []; // Fallback auf leeres Array
            displayNotizen(notizen);
            
            // Loading-State auch bei Fehlern verstecken
            const loadingState = document.getElementById('loading-state');
            if (loadingState) {
                loadingState.style.display = 'none';
            }
        });
}

// Notizen anzeigen
function displayNotizen(notizenToShow) {
    const container = document.getElementById('notizen-container');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    
    // Loading-State verstecken
    if (loadingState) {
        loadingState.style.display = 'none';
    }
    
    // Prüfe ob Container existiert
    if (!container) {
        console.error('notizen-container Element nicht gefunden!');
        return;
    }
    
    // Sicherheitscheck: Stelle sicher, dass notizenToShow ein Array ist
    if (!Array.isArray(notizenToShow)) {
        console.error('displayNotizen: Parameter ist kein Array:', notizenToShow);
        notizenToShow = [];
    }
    
    if (notizenToShow.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'block';
        } else {
            container.innerHTML = '<div class="col-12"><div class="alert alert-info">Keine Notizen vorhanden.</div></div>';
        }
        return;
    }
    
    // Empty-State verstecken wenn Notizen vorhanden
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    container.innerHTML = notizenToShow.map(notiz => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card h-100 shadow-sm notiz-card" data-kategorie="${notiz.kategorie}" data-prioritaet="${notiz.prioritaet}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${escapeHtml(notiz.titel)}</h6>
                    <span class="badge badge-priority-${notiz.prioritaet}">${getPrioritaetText(notiz.prioritaet)}</span>
                </div>
                <div class="card-body">
                    <p class="card-text" style="white-space: pre-line;">${escapeHtml(notiz.inhalt).substring(0, 100)}${notiz.inhalt.length > 100 ? '...' : ''}</p>
                    <small class="text-muted">
                        <i class="fas fa-tag"></i> ${escapeHtml(notiz.kategorie)}<br>
                        <i class="fas fa-calendar"></i> ${formatDate(notiz.erstellt_am)}
                    </small>
                </div>
                <div class="card-footer">
                    <div class="btn-group w-100" role="group">
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="showNotizDetails(${notiz.id})">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="editNotiz(${notiz.id})">
                            <i class="fas fa-edit"></i> Bearbeiten
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteNotiz(${notiz.id})">
                            <i class="fas fa-trash"></i> Löschen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Notizen filtern
function filterNotizen(filter, searchTerm = '') {
    currentFilter = filter;
    let filteredNotizen = notizen;
    
    // Filter nach Kategorie/Priorität
    if (filter !== 'alle') {
        if (['hoch', 'mittel', 'niedrig'].includes(filter)) {
            filteredNotizen = filteredNotizen.filter(notiz => notiz.prioritaet === filter);
        } else {
            filteredNotizen = filteredNotizen.filter(notiz => notiz.kategorie.toLowerCase() === filter.toLowerCase());
        }
    }
    
    // Such-Filter
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredNotizen = filteredNotizen.filter(notiz => 
            notiz.titel.toLowerCase().includes(term) || 
            notiz.inhalt.toLowerCase().includes(term) ||
            notiz.kategorie.toLowerCase().includes(term)
        );
    }
    
    // Sortieren und anzeigen
    sortNotizen(filteredNotizen);
    displayNotizen(filteredNotizen);
}

// Notizen sortieren
function sortNotizen(notizenArray) {
    notizenArray.sort((a, b) => {
        switch (currentSort) {
            case 'prioritaet':
                const prioritaetOrder = { 'hoch': 3, 'mittel': 2, 'niedrig': 1 };
                return prioritaetOrder[b.prioritaet] - prioritaetOrder[a.prioritaet];
            case 'datum':
                return new Date(b.erstellt_am) - new Date(a.erstellt_am);
            case 'titel':
                return a.titel.localeCompare(b.titel);
            case 'kategorie':
                return a.kategorie.localeCompare(b.kategorie);
            default:
                return 0;
        }
    });
}

// Sortieren und anzeigen
function sortAndDisplayNotizen() {
    filterNotizen(currentFilter, document.getElementById('notiz-search')?.value || '');
}

// Statistiken aktualisieren
function updateStatistics() {
    const totalCount = notizen.length;
    const hochCount = notizen.filter(n => n.prioritaet === 'hoch').length;
    const mittelCount = notizen.filter(n => n.prioritaet === 'mittel').length;
    const niedrigCount = notizen.filter(n => n.prioritaet === 'niedrig').length;
    
    // Kategorien zählen
    const kategorien = {};
    notizen.forEach(notiz => {
        kategorien[notiz.kategorie] = (kategorien[notiz.kategorie] || 0) + 1;
    });
    
    // Sichere Update der Statistik-Elemente (nur wenn sie existieren)
    const totalElement = document.getElementById('total-notizen');
    const hochElement = document.getElementById('hoch-prioritaet');
    const mittelElement = document.getElementById('mittel-prioritaet');
    const niedrigElement = document.getElementById('niedrig-prioritaet');
    
    if (totalElement) totalElement.textContent = totalCount;
    if (hochElement) hochElement.textContent = hochCount;
    if (mittelElement) mittelElement.textContent = mittelCount;
    if (niedrigElement) niedrigElement.textContent = niedrigCount;
}

// Neue Notiz erstellen
function newNotiz() {
    currentNotizId = null;
    clearNotizForm();
    
    // Modal-Titel setzen
    const modalTitle = document.getElementById('notizModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Neue Notiz erstellen';
    }
}

// Notiz bearbeiten
function editNotiz(id) {
    const notiz = notizen.find(n => n.id === id);
    if (!notiz) {
        console.error('Notiz mit ID', id, 'nicht gefunden');
        return;
    }
    
    // Formular-Felder füllen
    const titelElement = document.getElementById('notiz-titel');
    const kategorieElement = document.getElementById('notiz-kategorie');
    const prioritaetElement = document.getElementById('notiz-prioritaet');
    const inhaltElement = document.getElementById('notiz-inhalt');
    const notizIdElement = document.getElementById('notiz-id');
    
    if (titelElement) titelElement.value = notiz.titel;
    if (kategorieElement) kategorieElement.value = notiz.kategorie;
    if (prioritaetElement) prioritaetElement.value = notiz.prioritaet;
    if (inhaltElement) inhaltElement.value = notiz.inhalt;
    if (notizIdElement) notizIdElement.value = notiz.id;
    
    currentNotizId = id;
    
    // Modal-Titel ändern
    const modalTitle = document.getElementById('notizModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Notiz bearbeiten';
    }
    
    // Modal öffnen
    const modal = new bootstrap.Modal(document.getElementById('notizModal'));
    modal.show();
}

// Notiz löschen
function deleteNotiz(id) {
    if (confirm('Sind Sie sicher, dass Sie diese Notiz löschen möchten?')) {
        fetch(`/api/notizen/delete/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                loadNotizen();
                showSuccess('Notiz erfolgreich gelöscht!');
            } else {
                showError('Fehler beim Löschen: ' + result.error);
            }
        })
        .catch(error => {
            console.error('Fehler beim Löschen:', error);
            showError('Fehler beim Löschen der Notiz');
        });
    }
}

// Notiz Details anzeigen
function showNotizDetails(id) {
    const notiz = notizen.find(n => n.id === id);
    if (!notiz) return;
    
    const titelElement = document.getElementById('detail-titel');
    const kategorieElement = document.getElementById('detail-kategorie');
    const prioritaetElement = document.getElementById('detail-prioritaet');
    const inhaltElement = document.getElementById('detail-inhalt');
    const erstelltElement = document.getElementById('detail-erstellt');
    
    if (titelElement) titelElement.textContent = notiz.titel;
    if (kategorieElement) kategorieElement.textContent = notiz.kategorie;
    if (prioritaetElement) prioritaetElement.textContent = getPrioritaetText(notiz.prioritaet);
    if (inhaltElement) {
        inhaltElement.innerHTML = escapeHtmlWithLineBreaks(notiz.inhalt);
        inhaltElement.style.whiteSpace = 'pre-line';
    }
    if (erstelltElement) erstelltElement.textContent = formatDate(notiz.erstellt_am);
    
    const modal = new bootstrap.Modal(document.getElementById('notizDetailModal'));
    modal.show();
}

// Formular leeren
function clearNotizForm() {
    const form = document.getElementById('notizForm');
    if (form) {
        form.reset();
    }
    
    const notizIdElement = document.getElementById('notiz-id');
    if (notizIdElement) {
        notizIdElement.value = '';
    }
    
    currentNotizId = null;
    
    // Modal-Titel zurücksetzen
    const modalTitle = document.getElementById('notizModalLabel');
    if (modalTitle) {
        modalTitle.textContent = 'Neue Notiz erstellen';
    }
}

// Hilfsfunktionen
function handleNotizSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const notizData = {
        titel: formData.get('titel'),
        kategorie: formData.get('kategorie') || 'Allgemein',
        prioritaet: formData.get('prioritaet'),
        inhalt: formData.get('inhalt')
    };
    
    if (!notizData.titel.trim()) {
        showError('Bitte geben Sie einen Titel ein.');
        return;
    }
    
    const isEdit = currentNotizId !== null;
    const url = isEdit ? `/api/notizen/update/${currentNotizId}` : '/api/notizen/add';
    const method = isEdit ? 'PUT' : 'POST';
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(notizData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('notizModal'));
            modal.hide();
            loadNotizen();
            showSuccess(isEdit ? 'Notiz erfolgreich aktualisiert!' : 'Notiz erfolgreich hinzugefügt!');
            clearNotizForm();
        } else {
            showError('Fehler beim Speichern: ' + result.error);
        }
    })
    .catch(error => {
        console.error('Fehler:', error);
        showError('Fehler beim Speichern der Notiz');
    });
}

function getPrioritaetText(prioritaet) {
    const texte = {
        'hoch': 'Hoch',
        'mittel': 'Mittel',
        'niedrig': 'Niedrig'
    };
    return texte[prioritaet] || prioritaet;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeHtmlWithLineBreaks(unsafe) {
    return escapeHtml(unsafe)
        .replace(/\n/g, "<br>")
        .replace(/\r\n/g, "<br>")
        .replace(/\r/g, "<br>");
}

function showSuccess(message) {
    // Toast oder Alert für Erfolgsmeldungen
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

function showError(message) {
    // Toast oder Alert für Fehlermeldungen
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Globale Funktionen für onclick Handler
window.newNotiz = newNotiz;
window.editNotiz = editNotiz;
window.deleteNotiz = deleteNotiz;
window.showNotizDetails = showNotizDetails;
