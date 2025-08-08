// Aufgabenplaner spezifische Funktionen

document.addEventListener('DOMContentLoaded', function() {

    
    // Event Listeners
    setupEventListeners();
    
    // Daten laden
    try {
        loadAufgaben();
    } catch (error) {

    }
    
    try {
        loadStatistics();
    } catch (error) {

    }
});

function setupEventListeners() {
    // Speichern Button
    document.getElementById('saveAufgabeBtn').addEventListener('click', saveAufgabe);
    
    // Löschen Button
    document.getElementById('deleteAufgabeBtn').addEventListener('click', showDeleteConfirmation);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteAufgabe);
    
    // E-Mail Event Listeners
    document.getElementById('sendEmailBtn').addEventListener('click', sendTaskEmail);
    document.getElementById('viewEmailHistoryBtn').addEventListener('click', showEmailHistory);
    
    // Filter Event Listeners
    document.getElementById('filterStatus').addEventListener('change', filterAufgaben);
    document.getElementById('filterZustaendig').addEventListener('change', filterAufgaben);
    document.getElementById('filterPrioritaet').addEventListener('change', filterAufgaben);
    document.getElementById('searchAufgaben').addEventListener('input', filterAufgaben);
    
    // Modal Reset
    document.getElementById('aufgabeModal').addEventListener('hidden.bs.modal', resetForm);
    document.getElementById('emailModal').addEventListener('hidden.bs.modal', resetEmailForm);
}

// Hilfsfunktionen für Status und Priorität
function getStatusColor(status) {
    switch(status) {
        case 'Offen': return 'danger';
        case 'In Bearbeitung': return 'warning';
        case 'Abgeschlossen': return 'success';
        case 'Verschoben': return 'secondary';
        default: return 'secondary';
    }
}

function getStatusText(status) {
    return status || 'Unbekannt';
}

function getPriorityColor(prioritaet) {
    switch(prioritaet) {
        case 'Hoch': return 'danger';
        case 'Mittel': return 'warning'; 
        case 'Niedrig': return 'success';
        default: return 'secondary';
    }
}

function getPriorityText(prioritaet) {
    return prioritaet || 'Unbekannt';
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

        showAlert('Aufgaben konnten nicht geladen werden.', 'danger');
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/aufgaben/statistics');
        const data = await response.json();
        
        if (data.success) {
            updateStatistics(data.statistics);
        } else {

        }
    } catch (error) {

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
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Keine Aufgaben vorhanden</td></tr>';
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
    
    // E-Mail-Anzahl anzeigen
    const emailCount = (aufgabe.emails && aufgabe.emails.length) || 0;
    const emailRepliesCount = (aufgabe.email_replies && aufgabe.email_replies.length) || 0;
    const totalEmails = emailCount + emailRepliesCount;
    
    const emailBadge = totalEmails > 0 ? 
        `<button class="btn btn-sm btn-outline-info" onclick="showTaskEmailHistory(${aufgabe.id})" title="${emailCount} gesendete, ${emailRepliesCount} empfangene E-Mails">
            <i class="bi bi-envelope me-1"></i>${totalEmails}
        </button>` :
        `<button class="btn btn-sm btn-outline-secondary" onclick="sendEmailToTask(${aufgabe.id})" title="E-Mail senden">
            <i class="bi bi-envelope"></i>
        </button>`;
    
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
        <td>${emailBadge}</td>
        <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editAufgabe(${aufgabe.id})" title="Bearbeiten">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-success me-1" onclick="sendEmailToTask(${aufgabe.id})" title="E-Mail senden">
                <i class="bi bi-envelope"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="prepareDeleteAufgabe(${aufgabe.id})" title="Löschen">
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
        'Offen': '<span class="badge" style="background: linear-gradient(135deg, #f39c12, #e67e22); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Offen</span>',
        'In Bearbeitung': '<span class="badge" style="background: linear-gradient(135deg, var(--wedding-gold), var(--wedding-light-gold)); color: var(--wedding-text-dark); padding: 6px 12px; border-radius: 12px; font-weight: 500;">In Bearbeitung</span>',
        'Abgeschlossen': '<span class="badge" style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Abgeschlossen</span>'
    };
    return badges[status] || '<span class="badge" style="background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">' + status + '</span>';
}

function getPrioritaetBadge(prioritaet) {
    const badges = {
        'Hoch': '<span class="badge" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Hoch</span>',
        'Mittel': '<span class="badge" style="background: linear-gradient(135deg, #ffc107, #e0a800); color: var(--wedding-text-dark); padding: 6px 12px; border-radius: 12px; font-weight: 500;">Mittel</span>',
        'Niedrig': '<span class="badge" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Niedrig</span>'
    };
    return badges[prioritaet] || '<span class="badge" style="background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">' + prioritaet + '</span>';
}

function getZustaendigBadge(zustaendig) {
    const badges = {
        'Braut': '<span class="badge" style="background: linear-gradient(135deg, #e91e63, #f06292); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Braut</span>',
        'Bräutigam': '<span class="badge" style="background: linear-gradient(135deg, #2196f3, #64b5f6); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Bräutigam</span>',
        'Beide': '<span class="badge" style="background: linear-gradient(135deg, #9c27b0, #ba68c8); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Beide</span>'
    };
    return badges[zustaendig] || '<span class="badge" style="background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">' + zustaendig + '</span>';
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
        .then(response => {

            return response.json();
        })
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
    
    // Debug: Log der zu sendenden Daten







    
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

        showAlert('Aufgabe konnte nicht gelöscht werden.', 'danger');
    }
    
    deleteAufgabeId = null;
}

function showAlert(message, type) {
    // Verwende den festen Alert-Container
    const alertContainer = document.getElementById('aufgabenAlertContainer');
    if (!alertContainer) {

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

// =============================================================================
// E-MAIL FUNKTIONEN
// =============================================================================

let currentTaskId = null;

function sendEmailToTask(taskId) {
    currentTaskId = taskId;
    
    // Aufgabe laden und E-Mail-Modal öffnen
    loadTaskForEmail(taskId).then(() => {
        const modal = new bootstrap.Modal(document.getElementById('emailModal'));
        modal.show();
    });
}

function showTaskEmailHistory(taskId) {
    currentTaskId = taskId;
    loadEmailHistory(taskId);
}

async function loadTaskForEmail(taskId) {
    try {
        const response = await fetch(`/api/aufgaben/get/${taskId}`);
        const data = await response.json();
        
        if (data.success) {
            const aufgabe = data.aufgabe;
            
            // Task-Info ins E-Mail-Modal setzen
            document.getElementById('emailTaskTitle').textContent = aufgabe.titel;
            document.getElementById('emailTaskId').textContent = taskId;
            document.getElementById('emailTaskIdHidden').value = taskId;
            
            // E-Mail-Anzahl aktualisieren
            const emailCount = (aufgabe.emails && aufgabe.emails.length) || 0;
            const repliesCount = (aufgabe.email_replies && aufgabe.email_replies.length) || 0;
            document.getElementById('emailCount').textContent = emailCount + repliesCount;
            
            // Betreff vorausfüllen
            if (!document.getElementById('emailSubject').value) {
                document.getElementById('emailSubject').value = `Bezüglich: ${aufgabe.titel}`;
            }
        }
    } catch (error) {

        showAlert('Aufgabe konnte nicht geladen werden.', 'danger');
    }
}

async function sendTaskEmail() {
    const taskId = document.getElementById('emailTaskIdHidden').value;
    if (!taskId) {
        showAlert('Keine Aufgabe ausgewählt.', 'danger');
        return;
    }
    
    // Form-Daten sammeln
    const emailTo = document.getElementById('emailTo').value.trim();
    const emailCc = document.getElementById('emailCc').value.trim();
    const emailSubject = document.getElementById('emailSubject').value.trim();
    const emailBody = document.getElementById('emailBody').value.trim();
    const emailHtmlBody = document.getElementById('emailHtmlBody').value.trim();
    
    // Validierung
    if (!emailTo) {
        showAlert('Empfänger-E-Mail ist erforderlich.', 'danger');
        return;
    }
    
    if (!emailSubject) {
        showAlert('E-Mail-Betreff ist erforderlich.', 'danger');
        return;
    }
    
    if (!emailBody) {
        showAlert('E-Mail-Text ist erforderlich.', 'danger');
        return;
    }
    
    // E-Mail-Adressen parsen
    const toEmails = emailTo.split(',').map(email => email.trim()).filter(email => email);
    const ccEmails = emailCc ? emailCc.split(',').map(email => email.trim()).filter(email => email) : [];
    
    const emailData = {
        to_emails: toEmails,
        cc_emails: ccEmails,
        subject: emailSubject,
        body: emailBody,
        html_body: emailHtmlBody || null
    };
    
    // Send-Button deaktivieren
    const sendBtn = document.getElementById('sendEmailBtn');
    const originalText = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Sende...';
    
    try {
        const response = await fetch(`/api/aufgaben/${taskId}/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('E-Mail erfolgreich gesendet!', 'success');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('emailModal'));
            modal.hide();
            
            // Aufgabenliste aktualisieren
            loadAufgaben();
        } else {
            showAlert('Fehler beim E-Mail-Versand: ' + data.message, 'danger');
        }
    } catch (error) {

        showAlert('E-Mail konnte nicht gesendet werden.', 'danger');
    } finally {
        // Send-Button wieder aktivieren
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
    }
}

async function loadEmailHistory(taskId) {
    try {
        // Verstecktes Input-Feld für Task-ID setzen (für E-Mail-Antworten)
        document.getElementById('emailTaskIdHidden').value = taskId;
        
        // History-Modal Info setzen
        const response = await fetch(`/api/aufgaben/get/${taskId}`);
        const data = await response.json();
        
        let aufgabe = null;
        if (data.success) {
            aufgabe = data.aufgabe;
            document.getElementById('historyTaskTitle').textContent = aufgabe.titel;
            document.getElementById('historyTaskId').textContent = taskId;
        }
        
        // E-Mail-Verlauf laden
        const emailResponse = await fetch(`/api/aufgaben/${taskId}/emails`);
        const emailData = await emailResponse.json();
        
        if (emailData.success) {
            renderEmailHistory(emailData.emails, aufgabe ? aufgabe.email_replies || [] : []);
        } else {
            throw new Error(emailData.message || 'Fehler beim Laden der E-Mails');
        }
        
        // Modal öffnen
        const modal = new bootstrap.Modal(document.getElementById('emailHistoryModal'));
        modal.show();
        
    } catch (error) {

        showAlert('E-Mail-Verlauf konnte nicht geladen werden.', 'danger');
    }
}

function renderEmailHistory(sentEmails, receivedEmails) {
    const container = document.getElementById('emailHistoryContent');
    
    // Alle E-Mails zusammenführen und sortieren
    const allEmails = [];
    
    sentEmails.forEach(email => {
        allEmails.push({
            ...email,
            type: 'sent',
            date: new Date(email.sent_at)
        });
    });
    
    receivedEmails.forEach(email => {
        allEmails.push({
            ...email,
            type: 'received',
            date: new Date(email.received_at)
        });
    });
    
    // Nach Datum sortieren (neueste zuerst)
    allEmails.sort((a, b) => b.date - a.date);
    
    if (allEmails.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="bi bi-envelope fs-1"></i>
                <p>Noch keine E-Mails zu dieser Aufgabe</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    allEmails.forEach(email => {
        const isSent = email.type === 'sent';
        const iconClass = isSent ? 'bi-send' : 'bi-reply';
        const cardClass = isSent ? 'border-primary' : 'border-success';
        const headerClass = isSent ? 'text-white' : 'text-white';
        const headerStyle = isSent ? 'background: linear-gradient(135deg, #007bff, #0056b3);' : 'background: linear-gradient(135deg, #28a745, #20c997);';
        const title = isSent ? 'Gesendet' : 'Empfangen';
        
        const dateStr = email.date.toLocaleString('de-DE');
        const recipients = isSent ? 
            `An: ${email.to ? email.to.join(', ') : 'Unbekannt'}` :
            `Von: ${email.from_email || 'Unbekannt'}`;
        
        html += `
            <div class="card mb-3 ${cardClass}">
                <div class="card-header ${headerClass}">
                    <div class="d-flex justify-content-between align-items-center">
                        <span><i class="bi ${iconClass} me-2"></i>${title}</span>
                        <small>${dateStr}</small>
                    </div>
                </div>
                <div class="card-body">
                    <h6 class="card-title">${email.subject || 'Kein Betreff'}</h6>
                    <p class="card-text"><small class="text-muted">${recipients}</small></p>
                    <div class="mt-2">
                        <details>
                            <summary class="btn btn-sm btn-outline-secondary">Nachricht anzeigen</summary>
                            <div class="mt-2 p-2 bg-light border rounded">
                                <pre style="white-space: pre-wrap; word-wrap: break-word;">${email.body || 'Kein Inhalt'}</pre>
                            </div>
                        </details>
                        ${!isSent ? `
                            <button type="button" class="btn btn-sm btn-primary mt-2" onclick="showReplyForm('${email.from_email}', '${email.subject}', '${email.message_id || ''}')">
                                <i class="bi bi-reply me-1"></i>Antworten
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showEmailHistory() {
    const taskId = document.getElementById('emailTaskIdHidden').value;
    if (taskId) {
        loadEmailHistory(taskId);
    }
}

function resetEmailForm() {
    document.getElementById('emailForm').reset();
    document.getElementById('emailTaskIdHidden').value = '';
    currentTaskId = null;
    
    // Status-Alert ausblenden
    const statusAlert = document.getElementById('emailStatusAlert');
    if (statusAlert) {
        statusAlert.style.display = 'none';
    }
}

// E-Mail-Antworten Funktionen
function showReplyForm(fromEmail, originalSubject, messageId) {
    // Aktuelle Aufgaben-Info abrufen
    const taskId = document.getElementById('emailTaskIdHidden').value;
    const taskTitle = document.getElementById('historyTaskTitle').textContent;
    
    // Modal-Felder setzen
    document.getElementById('replyTaskTitle').textContent = taskTitle;
    document.getElementById('replyTaskId').textContent = taskId;
    document.getElementById('replyTaskIdHidden').value = taskId;
    
    // E-Mail-Felder setzen
    document.getElementById('replyToEmails').value = fromEmail;
    document.getElementById('replyInReplyTo').value = messageId;
    
    // Betreff vorbereiten (Re: hinzufügen wenn noch nicht vorhanden)
    let replySubject = originalSubject;
    if (!replySubject.toLowerCase().startsWith('re:')) {
        replySubject = 'Re: ' + replySubject;
    }
    document.getElementById('replySubject').value = replySubject;
    
    // Body leer lassen für neue Antwort
    document.getElementById('replyBody').value = '';
    document.getElementById('replyCcEmails').value = '';
    
    // Modal öffnen
    const modal = new bootstrap.Modal(document.getElementById('emailReplyModal'));
    modal.show();
}

async function sendEmailReply() {
    const taskId = document.getElementById('replyTaskIdHidden').value;
    const toEmails = document.getElementById('replyToEmails').value.trim();
    const ccEmails = document.getElementById('replyCcEmails').value.trim();
    const subject = document.getElementById('replySubject').value.trim();
    const body = document.getElementById('replyBody').value.trim();
    const inReplyTo = document.getElementById('replyInReplyTo').value;
    
    // Validierung
    if (!toEmails || !subject || !body) {
        showAlert('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
        return;
    }
    
    // E-Mail-Adressen vorbereiten
    const toEmailList = [toEmails];
    const ccEmailList = ccEmails ? ccEmails.split(',').map(email => email.trim()).filter(email => email) : [];
    
    try {
        const response = await fetch(`/api/aufgaben/${taskId}/email/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to_emails: toEmailList,
                cc_emails: ccEmailList.length > 0 ? ccEmailList : undefined,
                subject: subject,
                body: body,
                in_reply_to: inReplyTo,
                references: inReplyTo  // Für E-Mail-Threading
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('E-Mail-Antwort erfolgreich gesendet!', 'success');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('emailReplyModal'));
            modal.hide();
            
            // E-Mail-Verlauf neu laden
            loadEmailHistory(taskId);
            
            // Form zurücksetzen
            document.getElementById('emailReplyForm').reset();
        } else {
            throw new Error(data.message || 'Unbekannter Fehler beim E-Mail-Versand');
        }
        
    } catch (error) {

        showAlert(`Fehler beim E-Mail-Versand: ${error.message}`, 'danger');
    }
}

function insertEmailTemplate(templateType) {
    const bodyField = document.getElementById('emailBody');
    const currentContent = bodyField.value;
    
    let template = '';
    
    switch (templateType) {
        case 'follow_up':
            template = `Hallo,

ich wollte nachfragen, wie der Stand zu dieser Aufgabe ist. Gibt es bereits Updates oder benötigen Sie Unterstützung?

Bitte lassen Sie mich wissen, falls es Fragen gibt.

Vielen Dank!`;
            break;
            
        case 'meeting_request':
            template = `Hallo,

für diese Aufgabe würde ich gerne einen Termin mit Ihnen vereinbaren, um die Details zu besprechen.

Wann würde es Ihnen passen? Ich bin flexibel und kann mich nach Ihrem Zeitplan richten.

Vielen Dank!`;
            break;
            
        case 'status_update':
            template = `Hallo,

hier ist ein kurzes Update zum Stand dieser Aufgabe:

[BITTE HIER DEN AKTUELLEN STATUS EINFÜGEN]

Falls Sie Fragen haben oder weitere Informationen benötigen, lassen Sie es mich wissen.

Beste Grüße`;
            break;
            
        case 'reminder':
            template = `Hallo,

ich möchte Sie freundlich an diese Aufgabe erinnern. Das Fälligkeitsdatum nähert sich.

Falls Sie Unterstützung benötigen oder es Probleme gibt, sprechen Sie mich gerne an.

Vielen Dank!`;
            break;
    }
    
    if (template) {
        if (currentContent.trim()) {
            bodyField.value = currentContent + '\n\n' + template;
        } else {
            bodyField.value = template;
        }
        
        // Fokus auf das Textfeld setzen
        bodyField.focus();
        bodyField.setSelectionRange(bodyField.value.length, bodyField.value.length);
    }
}

// =============================================================================
// E-MAIL ZUORDNUNG FUNKTIONEN
// =============================================================================

let selectedEmailForAssignment = null;

async function openEmailAssignment() {
    try {
        // Modal öffnen
        const modal = new bootstrap.Modal(document.getElementById('emailAssignmentModal'));
        modal.show();
        
        // Event Listener für Filter-Buttons hinzufügen
        document.querySelectorAll('input[name="emailFilter"]').forEach(radio => {
            radio.addEventListener('change', handleEmailFilterChange);
        });
        
        // Daten laden
        await loadEmailsByFilter();
        await loadTasksForAssignment();
        
    } catch (error) {

        showAlert('E-Mail-Zuordnung konnte nicht geöffnet werden.', 'danger');
    }
}

async function handleEmailFilterChange() {
    selectedEmailForAssignment = null;
    await loadEmailsByFilter();
    await loadTasksForAssignment();
}

async function loadEmailsByFilter() {
    const selectedFilter = document.querySelector('input[name="emailFilter"]:checked').value;
    
    try {
        let emails = [];
        let titleText = '';
        
        switch(selectedFilter) {
            case 'unassigned':
                const unassignedResponse = await fetch('/api/email/unassigned');
                const unassignedData = await unassignedResponse.json();
                if (unassignedData.success) {
                    emails = unassignedData.emails;
                    titleText = '(nicht zugeordnet)';
                }
                break;
                
            case 'all':
                const allResponse = await fetch('/api/email/all');
                const allData = await allResponse.json();
                if (allData.success) {
                    emails = allData.emails;
                    titleText = '(alle)';
                }
                break;
                
            case 'ignored':
                const ignoredResponse = await fetch('/api/email/all');
                const ignoredData = await ignoredResponse.json();
                if (ignoredData.success) {
                    emails = ignoredData.emails.filter(email => email.is_ignored);
                    titleText = '(ignorierte)';
                }
                break;
        }
        
        // Titel aktualisieren
        document.getElementById('emailListTitle').textContent = titleText;
        
        // E-Mails rendern
        renderUnassignedEmails(emails);
        
    } catch (error) {

        document.getElementById('unassignedEmailsList').innerHTML = `
            <div class="text-center text-danger">
                <i class="bi bi-exclamation-triangle fs-1"></i>
                <p>Fehler beim Laden der E-Mails</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

async function loadUnassignedEmails() {
    try {
        const response = await fetch('/api/email/unassigned');
        const data = await response.json();
        
        if (data.success) {
            renderUnassignedEmails(data.emails);
            // Badge nur mit ungelesenen, nicht ignorierten E-Mails aktualisieren
            const unreadCount = data.emails.filter(email => !email.is_read && !email.is_ignored).length;
            updateUnassignedEmailBadge(unreadCount);
        } else {
            throw new Error(data.message || 'Fehler beim Laden der E-Mails');
        }
        
    } catch (error) {

        document.getElementById('unassignedEmailsList').innerHTML = `
            <div class="text-center text-danger">
                <i class="bi bi-exclamation-triangle fs-1"></i>
                <p>Fehler beim Laden der E-Mails</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

function renderUnassignedEmails(emails) {
    const container = document.getElementById('unassignedEmailsList');
    
    if (emails.length === 0) {
        container.innerHTML = `
            <div class="text-center text-info">
                <i class="bi bi-inbox fs-1"></i>
                <p>Keine E-Mails gefunden</p>
                <small>E-Mail-Postfach ist leer</small>
            </div>
        `;
        return;
    }
    
    let html = '';
    emails.forEach((email, index) => {
        const shortSubject = email.subject.length > 50 ? 
            email.subject.substring(0, 50) + '...' : email.subject;
        const shortBody = email.body.length > 100 ? 
            email.body.substring(0, 100) + '...' : email.body;
        const fromEmail = email.from_email.includes('<') ? 
            email.from_email.match(/<(.+)>/)[1] : email.from_email;
        
        // Status-Badge basierend auf gelesen/ungelesen/ignoriert/zugeordnet
        let statusBadge = '';
        if (email.is_ignored) {
            statusBadge = '<span class="badge" style="background: linear-gradient(135deg, #ffc107, #e0a800); color: var(--wedding-text-dark); padding: 6px 12px; border-radius: 12px; font-weight: 500;">Ignoriert</span>';
        } else if (email.is_assigned) {
            statusBadge = `<span class="badge" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;" title="Zugeordnet an: ${email.assigned_task ? email.assigned_task.title : 'Unbekannte Aufgabe'}">Zugeordnet</span>`;
        } else if (email.is_read) {
            statusBadge = '<span class="badge" style="background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Gelesen</span>';
        } else {
            statusBadge = '<span class="badge" style="background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 6px 12px; border-radius: 12px; font-weight: 500;">Ungelesen</span>';
        }
        
        // Aktions-Buttons basierend auf Status
        let actionButtons = '';
        if (email.is_ignored) {
            actionButtons = `<button class="btn btn-sm btn-outline-success me-1" onclick="event.stopPropagation(); unignoreEmail('${email.email_id}')" title="Nicht mehr ignorieren">
                <i class="bi bi-arrow-counterclockwise"></i>
            </button>`;
        } else if (email.is_assigned) {
            actionButtons = `<button class="btn btn-sm btn-outline-danger me-1" onclick="event.stopPropagation(); unassignEmail('${email.email_id}')" title="Zuordnung entfernen">
                <i class="bi bi-x-circle"></i>
            </button>`;
        } else {
            actionButtons = `<button class="btn btn-sm btn-outline-warning me-1" onclick="event.stopPropagation(); ignoreEmail('${email.email_id}')" title="Ignorieren">
                <i class="bi bi-eye-slash"></i>
            </button>`;
        }
        
        html += `
            <div class="card mb-2 email-card ${selectedEmailForAssignment === email.email_id ? 'border-primary' : ''}" 
                 onclick="selectEmailForAssignment('${email.email_id}', this)">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-1 text-truncate">${shortSubject}</h6>
                            <p class="card-text mb-1">
                                <small class="text-muted">Von: ${fromEmail}</small>
                            </p>
                            <p class="card-text mb-0">
                                <small>${shortBody}</small>
                            </p>
                        </div>
                        <div class="ms-2 d-flex flex-column align-items-end">
                            <div class="mb-2">
                                ${statusBadge}
                            </div>
                            <div class="btn-group-vertical" role="group" onclick="event.stopPropagation();">
                                ${actionButtons}
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="bi bi-clock me-1"></i>${new Date(email.received_at).toLocaleString('de-DE')}
                        </small>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function selectEmailForAssignment(emailId, element) {
    // Vorherige Auswahl entfernen
    document.querySelectorAll('.email-card').forEach(card => {
        card.classList.remove('border-primary');
    });
    
    // Neue Auswahl setzen
    element.classList.add('border-primary');
    selectedEmailForAssignment = emailId;
    
    // Aufgaben-Liste aktivieren
    loadTasksForAssignment();
}

async function loadTasksForAssignment() {
    try {
        const response = await fetch('/api/aufgaben/list');
        const data = await response.json();
        
        if (data.success) {
            renderTasksForAssignment(data.aufgaben);
        } else {
            throw new Error(data.message || 'Fehler beim Laden der Aufgaben');
        }
        
    } catch (error) {

        document.getElementById('taskAssignmentList').innerHTML = `
            <div class="text-center text-danger">
                <i class="bi bi-exclamation-triangle fs-1"></i>
                <p>Fehler beim Laden der Aufgaben</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

function renderTasksForAssignment(tasks) {
    const container = document.getElementById('taskAssignmentList');
    
    if (!selectedEmailForAssignment) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="bi bi-arrow-left fs-1"></i>
                <p>Wählen Sie zuerst eine E-Mail aus</p>
            </div>
        `;
        return;
    }
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="text-center text-warning">
                <i class="bi bi-exclamation-triangle fs-1"></i>
                <p>Keine Aufgaben vorhanden</p>
                <small>Erstellen Sie zuerst eine Aufgabe</small>
            </div>
        `;
        return;
    }
    
    let html = '';
    tasks.forEach(task => {
        const statusColor = getStatusColor(task.status);
        const statusText = getStatusText(task.status);
        const priorityColor = getPriorityColor(task.prioritaet);
        const priorityText = getPriorityText(task.prioritaet);
        
        html += `
            <div class="card mb-2 task-assignment-card" onclick="assignEmailToTask(${task.id})">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="card-title mb-1">${task.titel}</h6>
                            <p class="card-text mb-2">
                                <small class="text-muted">${task.beschreibung || 'Keine Beschreibung'}</small>
                            </p>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-${statusColor}">${statusText}</span>
                                <span class="badge bg-${priorityColor}">${priorityText}</span>
                            </div>
                        </div>
                        <div class="ms-2">
                            <button class="btn btn-sm btn-outline-primary" type="button">
                                <i class="bi bi-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function assignEmailToTask(taskId) {
    if (!selectedEmailForAssignment) {
        showAlert('Bitte wählen Sie zuerst eine E-Mail aus.', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/email/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email_id: selectedEmailForAssignment,
                task_id: taskId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`E-Mail erfolgreich Aufgabe "${data.task_title}" zugeordnet!`, 'success');
            
            // Daten neu laden
            await loadUnassignedEmails();
            selectedEmailForAssignment = null;
            loadTasksForAssignment();
            
            // Aufgaben-Liste aktualisieren
            loadAufgaben();
            
        } else {
            throw new Error(data.message || 'Fehler beim Zuordnen');
        }
        
    } catch (error) {

        showAlert(`Fehler beim Zuordnen: ${error.message}`, 'danger');
    }
}

async function refreshEmailAssignment() {
    selectedEmailForAssignment = null;
    await loadUnassignedEmails();
    await loadTasksForAssignment();
}

function updateUnassignedEmailBadge(count) {
    const badge = document.getElementById('unassignedEmailBadge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

// =============================================================================
// E-MAIL IGNORIERUNG FUNKTIONEN
// =============================================================================

async function ignoreEmail(emailId) {
    if (!confirm('Möchten Sie diese E-Mail wirklich ignorieren? Sie wird dann nicht mehr in der Zuordnung angezeigt.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/email/ignore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email_id: emailId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('E-Mail erfolgreich ignoriert!', 'success');
            
            // E-Mail-Liste neu laden
            await loadUnassignedEmails();
            
            // Badge aktualisieren (ignorierte E-Mails zählen nicht als ungelesen)
            const emailResponse = await fetch('/api/email/unassigned');
            const emailData = await emailResponse.json();
            if (emailData.success) {
                const unreadCount = emailData.emails.filter(email => !email.is_read && !email.is_ignored).length;
                updateUnassignedEmailBadge(unreadCount);
            }
            
        } else {
            throw new Error(data.message || 'Fehler beim Ignorieren der E-Mail');
        }
        
    } catch (error) {

        showAlert(`Fehler beim Ignorieren: ${error.message}`, 'danger');
    }
}

async function unignoreEmail(emailId) {
    try {
        const response = await fetch('/api/email/unignore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email_id: emailId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('E-Mail-Ignorierung erfolgreich entfernt!', 'success');
            
            // E-Mail-Liste neu laden
            await loadUnassignedEmails();
            
            // Badge aktualisieren
            const emailResponse = await fetch('/api/email/unassigned');
            const emailData = await emailResponse.json();
            if (emailData.success) {
                const unreadCount = emailData.emails.filter(email => !email.is_read && !email.is_ignored).length;
                updateUnassignedEmailBadge(unreadCount);
            }
            
        } else {
            throw new Error(data.message || 'Fehler beim Entfernen der E-Mail-Ignorierung');
        }
        
    } catch (error) {

        showAlert(`Fehler beim Entfernen der Ignorierung: ${error.message}`, 'danger');
    }
}

// Neue Funktion: E-Mail-Zuordnung zu Aufgabe entfernen
async function unassignEmail(emailId) {
    try {
        const response = await fetch('/api/email/unassign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email_id: emailId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('E-Mail-Zuordnung erfolgreich entfernt!', 'success');
            
            // E-Mail-Liste neu laden
            loadEmailsByFilter();
            
        } else {
            throw new Error(data.message || 'Fehler beim Entfernen der E-Mail-Zuordnung');
        }
        
    } catch (error) {

        showAlert(`Fehler beim Entfernen der Zuordnung: ${error.message}`, 'danger');
    }
}

// Beim Laden der Seite ungelesene E-Mails prüfen
document.addEventListener('DOMContentLoaded', function() {
    // Nach kurzer Verzögerung prüfen
    setTimeout(async () => {
        try {
            const response = await fetch('/api/email/unassigned');
            const data = await response.json();
            if (data.success) {
                // Nur ungelesene, nicht ignorierte E-Mails zählen
                const unreadCount = data.emails.filter(email => !email.is_read && !email.is_ignored).length;
                updateUnassignedEmailBadge(unreadCount);
            }
        } catch (error) {

        }
    }, 2000);
});

