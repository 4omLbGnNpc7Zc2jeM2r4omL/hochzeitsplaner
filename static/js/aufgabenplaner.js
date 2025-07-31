// Aufgabenplaner spezifische Funktionen

document.addEventListener('DOMContentLoaded', function() {
    console.log('Aufgabenplaner wird geladen...');
    
    // Event Listeners
    setupEventListeners();
    
    // Daten laden
    loadAufgaben();
    loadStatistics();
});

function setupEventListeners() {
    // Speichern Button
    document.getElementById('saveAufgabeBtn').addEventListener('click', saveAufgabe);
    
    // Löschen Button
    document.getElementById('deleteAufgabeBtn').addEventListener('click', showDeleteConfirmation);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteAufgabe);
    
    // Filter Event Listeners
    document.getElementById('filterStatus').addEventListener('change', filterAufgaben);
    document.getElementById('filterZustaendig').addEventListener('change', filterAufgaben);
    document.getElementById('filterPrioritaet').addEventListener('change', filterAufgaben);
    document.getElementById('searchAufgaben').addEventListener('input', filterAufgaben);
    
    // Modal Reset
    document.getElementById('aufgabeModal').addEventListener('hidden.bs.modal', resetForm);
}

async function loadAufgaben() {
    try {
        const response = await fetch('/api/aufgaben/list');
        const data = await response.json();
        
        if (data.success) {
            renderAufgabenTable(data.aufgaben);
        } else {
            showAlert('Fehler beim Laden der Aufgaben: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Laden der Aufgaben:', error);
        showAlert('Aufgaben konnten nicht geladen werden.', 'danger');
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/aufgaben/statistics');
        const data = await response.json();
        
        if (data.success) {
            updateStatistics(data.statistics);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
    }
}

function updateStatistics(stats) {
    document.getElementById('aufgabenGesamt').textContent = stats.gesamt || 0;
    document.getElementById('aufgabenOffen').textContent = stats.offen || 0;
    document.getElementById('aufgabenInBearbeitung').textContent = stats.in_bearbeitung || 0;
    document.getElementById('aufgabenAbgeschlossen').textContent = stats.abgeschlossen || 0;
    document.getElementById('aufgabenUeberfaellig').textContent = stats.ueberfaellig || 0;
    document.getElementById('aufgabenFortschritt').textContent = (stats.fortschritt_prozent || 0) + '%';
}

function renderAufgabenTable(aufgaben) {
    const tbody = document.getElementById('aufgabenTableBody');
    tbody.innerHTML = '';
    
    if (!aufgaben || aufgaben.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Keine Aufgaben vorhanden</td></tr>';
        return;
    }
    
    aufgaben.forEach(aufgabe => {
        const row = createAufgabeRow(aufgabe);
        tbody.appendChild(row);
    });
}

function createAufgabeRow(aufgabe) {
    const tr = document.createElement('tr');
    
    // Status Badge
    const statusBadge = getStatusBadge(aufgabe.status);
    
    // Priorität Badge
    const prioritaetBadge = getPrioritaetBadge(aufgabe.prioritaet);
    
    // Zuständig Badge
    const zustaendigBadge = getZustaendigBadge(aufgabe.zustaendig);
    
    // Fälligkeitsdatum formatieren
    const faelligkeitsdatum = aufgabe.faelligkeitsdatum ? 
        new Date(aufgabe.faelligkeitsdatum).toLocaleDateString('de-DE') : '-';
    
    // Überfällig prüfen
    const isUeberfaellig = aufgabe.faelligkeitsdatum && 
        aufgabe.status !== 'Abgeschlossen' &&
        new Date(aufgabe.faelligkeitsdatum) < new Date();
    
    tr.innerHTML = `
        <td>${statusBadge}</td>
        <td>
            <strong>${aufgabe.titel}</strong>
            ${aufgabe.beschreibung ? '<br><small class="text-muted">' + aufgabe.beschreibung + '</small>' : ''}
        </td>
        <td>${zustaendigBadge}</td>
        <td>${prioritaetBadge}</td>
        <td ${isUeberfaellig ? 'class="text-danger"' : ''}>
            ${faelligkeitsdatum}
            ${isUeberfaellig ? '<i class="bi bi-exclamation-triangle ms-1"></i>' : ''}
        </td>
        <td>
            ${aufgabe.kategorie ? '<span class="badge bg-light text-dark">' + aufgabe.kategorie + '</span>' : '-'}
        </td>
        <td>
            <button class="btn btn-sm btn-outline-primary" onclick="editAufgabe(${aufgabe.id})">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger ms-1" onclick="prepareDeleteAufgabe(${aufgabe.id})">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    
    // Row-Klasse für abgeschlossene Aufgaben
    if (aufgabe.status === 'Abgeschlossen') {
        tr.classList.add('table-success', 'opacity-75');
    } else if (isUeberfaellig) {
        tr.classList.add('table-danger');
    }
    
    return tr;
}

function getStatusBadge(status) {
    const badges = {
        'Offen': '<span class="badge bg-warning">Offen</span>',
        'In Bearbeitung': '<span class="badge bg-primary">In Bearbeitung</span>',
        'Abgeschlossen': '<span class="badge bg-success">Abgeschlossen</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">' + status + '</span>';
}

function getPrioritaetBadge(prioritaet) {
    const badges = {
        'Hoch': '<span class="badge bg-danger">Hoch</span>',
        'Mittel': '<span class="badge bg-warning">Mittel</span>',
        'Niedrig': '<span class="badge bg-success">Niedrig</span>'
    };
    return badges[prioritaet] || '<span class="badge bg-secondary">' + prioritaet + '</span>';
}

function getZustaendigBadge(zustaendig) {
    const badges = {
        'Braut': '<span class="badge bg-pink">Braut</span>',
        'Bräutigam': '<span class="badge bg-blue">Bräutigam</span>',
        'Beide': '<span class="badge bg-purple">Beide</span>'
    };
    return badges[zustaendig] || '<span class="badge bg-secondary">' + zustaendig + '</span>';
}

function filterAufgaben() {
    const statusFilter = document.getElementById('filterStatus').value;
    const zustaendigFilter = document.getElementById('filterZustaendig').value;
    const prioritaetFilter = document.getElementById('filterPrioritaet').value;
    const searchTerm = document.getElementById('searchAufgaben').value.toLowerCase();
    
    const rows = document.querySelectorAll('#aufgabenTableBody tr');
    
    rows.forEach(row => {
        if (row.cells.length === 1) return; // Skip "keine Aufgaben" row
        
        const status = row.cells[0].textContent.trim();
        const titel = row.cells[1].querySelector('strong').textContent.toLowerCase();
        const beschreibung = row.cells[1].querySelector('small')?.textContent.toLowerCase() || '';
        const zustaendig = row.cells[2].textContent.trim();
        const prioritaet = row.cells[3].textContent.trim();
        
        const statusMatch = !statusFilter || status === statusFilter;
        const zustaendigMatch = !zustaendigFilter || zustaendig === zustaendigFilter;
        const prioritaetMatch = !prioritaetFilter || prioritaet === prioritaetFilter;
        const searchMatch = !searchTerm || titel.includes(searchTerm) || beschreibung.includes(searchTerm);
        
        row.style.display = statusMatch && zustaendigMatch && prioritaetMatch && searchMatch ? '' : 'none';
    });
}

function editAufgabe(id) {
    // Finde die Aufgabe in den geladenen Daten
    fetch(`/api/aufgaben/get/${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fillForm(data.aufgabe);
                document.getElementById('aufgabeModalLabel').textContent = 'Aufgabe bearbeiten';
                document.getElementById('deleteAufgabeBtn').style.display = 'inline-block';
                
                const modal = new bootstrap.Modal(document.getElementById('aufgabeModal'));
                modal.show();
            } else {
                showAlert('Fehler beim Laden der Aufgabe: ' + data.error, 'danger');
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            showAlert('Aufgabe konnte nicht geladen werden.', 'danger');
        });
}

function fillForm(aufgabe) {
    document.getElementById('aufgabeId').value = aufgabe.id || '';
    document.getElementById('aufgabeTitel').value = aufgabe.titel || '';
    document.getElementById('aufgabeBeschreibung').value = aufgabe.beschreibung || '';
    document.getElementById('aufgabeZustaendig').value = aufgabe.zustaendig || 'Braut';
    document.getElementById('aufgabeStatus').value = aufgabe.status || 'Offen';
    document.getElementById('aufgabePrioritaet').value = aufgabe.prioritaet || 'Mittel';
    document.getElementById('aufgabeFaelligkeitsdatum').value = aufgabe.faelligkeitsdatum || '';
    document.getElementById('aufgabeKategorie').value = aufgabe.kategorie || '';
    document.getElementById('aufgabeNotizen').value = aufgabe.notizen || '';
}

function resetForm() {
    document.getElementById('aufgabeForm').reset();
    document.getElementById('aufgabeId').value = '';
    document.getElementById('aufgabeModalLabel').textContent = 'Neue Aufgabe';
    document.getElementById('deleteAufgabeBtn').style.display = 'none';
}

async function saveAufgabe() {
    const form = document.getElementById('aufgabeForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const aufgabeData = {
        titel: document.getElementById('aufgabeTitel').value,
        beschreibung: document.getElementById('aufgabeBeschreibung').value,
        zustaendig: document.getElementById('aufgabeZustaendig').value,
        status: document.getElementById('aufgabeStatus').value,
        prioritaet: document.getElementById('aufgabePrioritaet').value,
        faelligkeitsdatum: document.getElementById('aufgabeFaelligkeitsdatum').value,
        kategorie: document.getElementById('aufgabeKategorie').value,
        notizen: document.getElementById('aufgabeNotizen').value
    };
    
    const aufgabeId = document.getElementById('aufgabeId').value;
    const isEdit = aufgabeId !== '';
    
    try {
        const url = isEdit ? `/api/aufgaben/update/${aufgabeId}` : '/api/aufgaben/add';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(aufgabeData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(isEdit ? 'Aufgabe erfolgreich aktualisiert!' : 'Aufgabe erfolgreich erstellt!', 'success');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('aufgabeModal'));
            modal.hide();
            
            // Daten neu laden
            loadAufgaben();
            loadStatistics();
        } else {
            showAlert('Fehler beim Speichern: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Aufgabe:', error);
        showAlert('Aufgabe konnte nicht gespeichert werden.', 'danger');
    }
}

let deleteAufgabeId = null;

function prepareDeleteAufgabe(id) {
    deleteAufgabeId = id;
    const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    modal.show();
}

function showDeleteConfirmation() {
    const aufgabeId = document.getElementById('aufgabeId').value;
    if (aufgabeId) {
        prepareDeleteAufgabe(parseInt(aufgabeId));
    }
}

async function deleteAufgabe() {
    if (!deleteAufgabeId) return;
    
    try {
        const response = await fetch(`/api/aufgaben/delete/${deleteAufgabeId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Aufgabe erfolgreich gelöscht!', 'success');
            
            // Modals schließen
            const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
            confirmModal.hide();
            
            const aufgabeModal = bootstrap.Modal.getInstance(document.getElementById('aufgabeModal'));
            if (aufgabeModal) aufgabeModal.hide();
            
            // Daten neu laden
            loadAufgaben();
            loadStatistics();
        } else {
            showAlert('Fehler beim Löschen: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Fehler beim Löschen der Aufgabe:', error);
        showAlert('Aufgabe konnte nicht gelöscht werden.', 'danger');
    }
    
    deleteAufgabeId = null;
}

function showAlert(message, type) {
    // Verwende den festen Alert-Container
    const alertContainer = document.getElementById('aufgabenAlertContainer');
    if (!alertContainer) {
        console.error('Alert-Container nicht gefunden');
        return;
    }
    
    // Erstelle Alert-Element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Füge Alert zum festen Container hinzu
    alertContainer.appendChild(alertDiv);
    
    // Automatisch nach 5 Sekunden ausblenden mit Fadeout-Effekt
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.classList.remove('show');
            alertDiv.classList.add('fade');
            // Nach der Fade-Animation entfernen
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 150);
        }
    }, 5000);
}
