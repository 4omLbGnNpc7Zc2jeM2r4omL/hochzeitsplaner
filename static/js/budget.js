// Budget Management JavaScript

let currentBudget = [];
let editingIndex = -1;

document.addEventListener('DOMContentLoaded', async function() {

    
    // Event Listeners
    setupEventListeners();
    
    // Budget laden
    await loadAndDisplayBudget();
});

function setupEventListeners() {
    // Budget automatisch generieren
    const generateBtn = document.getElementById('generateBudgetBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerateBudget);
    }
    
    // Position hinzufügen
    const addBtn = document.getElementById('addBudgetBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openBudgetModal());
    }
    
    // Position speichern
    const saveBudgetBtn = document.getElementById('saveBudgetBtn');
    if (saveBudgetBtn) {
        saveBudgetBtn.addEventListener('click', handleSaveBudgetItem);
    }
    
    // Löschen bestätigen
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }
    
    // Automatische Berechnung des Gesamtpreises
    const mengeInput = document.getElementById('budgetMenge');
    const einzelpreisInput = document.getElementById('budgetEinzelpreis');
    if (mengeInput && einzelpreisInput) {
        mengeInput.addEventListener('input', updateGesamtpreis);
        einzelpreisInput.addEventListener('input', updateGesamtpreis);
    }
}

async function loadAndDisplayBudget() {
    try {
        HochzeitsplanerApp.showLoading();
        
        const data = await apiRequest('/budget/list');
        
        if (data.success) {
            currentBudget = data.budget || [];
            displayBudget(currentBudget, data.isEmpty);
            updateBudgetSummary();
            
            // Die empty message wird bereits in displayBudget() behandelt
        } else {
            throw new Error(data.error || 'Unbekannter Fehler');
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler beim Laden des Budgets: ' + error.message, 'danger');
        
        // Fallback: Leere Anzeige
        currentBudget = [];
        displayBudget([], true); // Zeige als leer an
        updateBudgetSummary();
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

function displayBudget(budgetItems = null, isEmpty = false) {
    const tbody = document.getElementById('budgetTableBody');
    if (!tbody) return;
    
    const items = budgetItems || currentBudget;
    
    // Verstecke/zeige leere Budget-Nachricht
    if (isEmpty || items.length === 0) {
        hideEmptyBudgetMessage(); // Entferne alte Nachricht falls vorhanden
        if (isEmpty) {
            showEmptyBudgetMessage();
        }
    } else {
        hideEmptyBudgetMessage();
    }
    
    tbody.innerHTML = items.map((item, index) => {
        const id = item.id || index; // Fallback auf Index falls keine ID vorhanden
        const kategorie = item.kategorie || 'Unbekannt';
        const beschreibung = item.beschreibung || 'Ohne Beschreibung';
        const details = item.details || '';
        const menge = parseFloat(item.menge || 0);
        const einzelpreis = parseFloat(item.einzelpreis || 0);
        const gesamtpreis = parseFloat(item.gesamtpreis || 0);
        const ausgegeben = parseFloat(item.ausgegeben || 0);
        
        // Status berechnen
        let statusBadge = '';
        let statusStyle = '';
        if (ausgegeben === 0) {
            statusBadge = 'Geplant';
            statusStyle = 'background: linear-gradient(135deg, #6c757d, #495057); color: white;';
        } else if (ausgegeben < gesamtpreis) {
            statusBadge = 'Teilweise';
            statusStyle = 'background: linear-gradient(135deg, #ffc107, #e0a800); color: var(--wedding-text-dark);';
        } else if (ausgegeben === gesamtpreis) {
            statusBadge = 'Bezahlt';
            statusStyle = 'background: linear-gradient(135deg, #28a745, #20c997); color: white;';
        } else {
            statusBadge = 'Überzogen';
            statusStyle = 'background: linear-gradient(135deg, #dc3545, #c82333); color: white;';
        }
        
        return `
            <tr style="border: none;">
                <td style="border: none; padding: 12px 8px;">
                    <span class="badge" style="background: linear-gradient(135deg, var(--wedding-gold), var(--wedding-light-gold)); color: var(--wedding-text-dark); border-radius: 12px; padding: 6px 12px; font-weight: 500;">${kategorie}</span>
                </td>
                <td style="border: none; padding: 12px 8px;">
                    <strong style="color: var(--wedding-text-dark);">${beschreibung}</strong>
                </td>
                <td style="border: none; padding: 12px 8px;">
                    <small class="text-muted" style="color: var(--wedding-text);">${details}</small>
                </td>
                <td class="text-center" style="border: none; padding: 12px 8px; color: var(--wedding-text-dark);">${menge}</td>
                <td class="text-end" style="border: none; padding: 12px 8px; color: var(--wedding-text-dark);">${formatCurrency(einzelpreis)}</td>
                <td class="text-end" style="border: none; padding: 12px 8px;">
                    <strong style="color: var(--wedding-text-dark);">${formatCurrency(gesamtpreis)}</strong>
                </td>
                <td class="text-end" style="border: none; padding: 12px 8px; color: var(--wedding-text-dark);">${formatCurrency(ausgegeben)}</td>
                <td style="border: none; padding: 12px 8px; text-align: center;">
                    <span class="badge" style="${statusStyle} border-radius: 12px; padding: 6px 12px; font-weight: 500;">${statusBadge}</span>
                </td>
                <td style="border: none; padding: 12px 8px;">
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-wedding-secondary" 
                                onclick="editBudgetItem(${id})" 
                                title="Bearbeiten"
                                style="padding: 6px 10px; margin-right: 4px;">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteBudgetItem(${id})" 
                                title="Löschen"
                                style="padding: 6px 10px; border-radius: 8px;">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateBudgetSummary() {
    const gesamtgeplant = currentBudget.reduce((sum, item) => sum + (parseFloat(item.gesamtpreis) || 0), 0);
    const gesamtausgegeben = currentBudget.reduce((sum, item) => sum + (parseFloat(item.ausgegeben) || 0), 0);
    const verbleibend = gesamtgeplant - gesamtausgegeben;
    const anzahlPositionen = currentBudget.length;
    
    // Update Budget-Karten
    const plannedElement = document.getElementById('budgetPlanned');
    const spentElement = document.getElementById('budgetSpent');
    const remainingElement = document.getElementById('budgetRemaining');
    const remainingCard = document.getElementById('remainingCard');
    
    if (plannedElement) plannedElement.textContent = formatCurrency(gesamtgeplant);
    if (spentElement) spentElement.textContent = formatCurrency(gesamtausgegeben);
    if (remainingElement) {
        remainingElement.textContent = formatCurrency(verbleibend);
        
        // Färbe die Verbleibend-Karte je nach verbleibendem Budget
        if (remainingCard) {
            const cardBody = remainingCard.querySelector('.card-body');
            if (cardBody) {
                if (verbleibend >= 0) {
                    // Positives Budget - Wedding-Theme grüne Töne
                    cardBody.style.background = 'linear-gradient(135deg, #d4edda, #c3e6cb)';
                    cardBody.style.color = '#155724';
                    const icon = cardBody.querySelector('i');
                    if (icon) icon.style.color = '#155724';
                } else {
                    // Negatives Budget - Wedding-Theme rote Töne
                    cardBody.style.background = 'linear-gradient(135deg, #f8d7da, #f1b0b7)';
                    cardBody.style.color = '#721c24';
                    const icon = cardBody.querySelector('i');
                    if (icon) icon.style.color = '#721c24';
                }
            }
        }
    }
    
    // Update Summary Badge
    const summaryElement = document.getElementById('budgetSummary');
    if (summaryElement) {
        summaryElement.textContent = `${anzahlPositionen} Positionen - Geplant: ${formatCurrency(gesamtgeplant)}`;
    }
}

async function handleGenerateBudget() {
    try {
        HochzeitsplanerApp.showLoading();
        
        const result = await apiRequest('/budget/auto-generate', {
            method: 'POST'
        });
        
        if (result.success) {
            // Budget wurde bereits serverseitig gespeichert, nur neu laden
            await loadAndDisplayBudget();
            
            // Erfolgs-Message mit Statistiken
            const stats = result.summary?.gaeste_statistiken;
            let message = `Budget wurde automatisch erstellt und gespeichert!\n\nGesamtsumme: ${formatCurrency(result.summary?.gesamtsumme || 0)}`;
            
            if (stats) {
                message += `\n\nGästeverteilung:\n`;
                message += `• Weißer Saal: ${stats.weisser_saal} Personen\n`;
                message += `• Essen: ${stats.essen} Personen\n`;
                message += `• Party: ${stats.party} Personen`;
                if (stats.kinder > 0) message += `\n• Kinder: ${stats.kinder}`;
            }
            
            HochzeitsplanerApp.showAlert(message, 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler beim Generieren: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

async function saveBudgetData(budgetData) {
    const result = await apiRequest('/budget/save', {
        method: 'POST',
        body: JSON.stringify({ budget: budgetData })
    });
    
    if (!result.success) {
        throw new Error(result.error);
    }
}

function openBudgetModal(itemId = -1) {
    editingIndex = itemId; // Jetzt speichern wir die ID statt des Index
    const modal = new bootstrap.Modal(document.getElementById('budgetModal'));
    const form = document.getElementById('budgetForm');
    const title = document.getElementById('budgetModalTitle');
    
    if (itemId != -1) {
        // Bearbeiten - finde Item basierend auf ID
        const item = currentBudget.find(item => item.id == itemId);
        
        if (item) {
            title.textContent = 'Budget Position bearbeiten';
            
            document.getElementById('budgetKategorie').value = item.kategorie || '';
            document.getElementById('budgetBeschreibung').value = item.beschreibung || '';
            document.getElementById('budgetDetails').value = item.details || '';
            document.getElementById('budgetMenge').value = item.menge || 1;
            document.getElementById('budgetEinzelpreis').value = item.einzelpreis || 0;
            document.getElementById('budgetAusgegeben').value = item.ausgegeben || 0;
            updateGesamtpreis();
        } else {

            return;
        }
    } else {
        // Hinzufügen
        title.textContent = 'Budget Position hinzufügen';
        form.reset();
        document.getElementById('budgetMenge').value = 1;
        document.getElementById('budgetEinzelpreis').value = 0;
        document.getElementById('budgetAusgegeben').value = 0;
        updateGesamtpreis();
    }
    
    modal.show();
}

function updateGesamtpreis() {
    const menge = parseFloat(document.getElementById('budgetMenge').value) || 0;
    const einzelpreis = parseFloat(document.getElementById('budgetEinzelpreis').value) || 0;
    const gesamtpreis = menge * einzelpreis;
    
    document.getElementById('budgetGesamtpreis').value = formatCurrency(gesamtpreis);
}

async function handleSaveBudgetItem() {
    const form = document.getElementById('budgetForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const budgetData = {
        kategorie: document.getElementById('budgetKategorie').value,
        beschreibung: document.getElementById('budgetBeschreibung').value,
        details: document.getElementById('budgetDetails').value,
        menge: parseFloat(document.getElementById('budgetMenge').value),
        einzelpreis: parseFloat(document.getElementById('budgetEinzelpreis').value),
        ausgegeben: parseFloat(document.getElementById('budgetAusgegeben').value) || 0
    };
    
    try {
        HochzeitsplanerApp.showLoading();
        
        let response;
        if (editingIndex != -1) {
            // Bearbeiten - editingIndex enthält jetzt die Item-ID
            result = await apiRequest(`/budget/edit/${editingIndex}`, {
                method: 'PUT',
                body: JSON.stringify(budgetData)
            });
        } else {
            // Hinzufügen
            result = await apiRequest('/budget/add', {
                method: 'POST',
                body: JSON.stringify(budgetData)
            });
        }
        
        if (result.success) {
            const action = editingIndex != -1 ? 'aktualisiert' : 'hinzugefügt';
            HochzeitsplanerApp.showAlert(`Budget-Position ${action}!`, 'success');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('budgetModal'));
            modal.hide();
            
            // Budget neu laden
            await loadAndDisplayBudget();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler beim Speichern: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

function editBudgetItem(itemId) {
    openBudgetModal(itemId);
}

function deleteBudgetItem(itemId) {
    // Finde das Item basierend auf der ID
    const item = currentBudget.find(item => item.id == itemId);
    
    if (item) {
        // Zeige Löschen-Modal
        document.getElementById('deleteItemName').textContent = `${item.kategorie}: ${item.beschreibung}`;
        
        // Speichere ID für Löschen (nicht Index!)
        document.getElementById('confirmDeleteBtn').dataset.itemId = itemId;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteBudgetModal'));
        modal.show();
    } else {

    }
}

async function handleConfirmDelete() {
    const itemId = parseInt(document.getElementById('confirmDeleteBtn').dataset.itemId);
    
    try {
        HochzeitsplanerApp.showLoading();
        
        const result = await apiRequest(`/budget/delete/${itemId}`, {
            method: 'DELETE'
        });
        
        if (result.success) {
            HochzeitsplanerApp.showAlert('Budget-Position wurde gelöscht!', 'success');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteBudgetModal'));
            modal.hide();
            
            // Budget neu laden
            await loadAndDisplayBudget();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler beim Löschen: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount || 0);
}

function showEmptyBudgetMessage() {
    // Prüfe ob bereits eine Nachricht angezeigt wird
    if (document.getElementById('emptyBudgetMessage')) return;
    
    const container = document.querySelector('.card-body');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'emptyBudgetMessage';
    messageDiv.className = 'alert alert-info mt-3';
    messageDiv.style.background = 'linear-gradient(135deg, var(--wedding-light-gold), var(--wedding-cream))';
    messageDiv.style.border = '2px solid var(--wedding-gold)';
    messageDiv.style.borderRadius = '15px';
    messageDiv.style.color = 'var(--wedding-text-dark)';
    messageDiv.innerHTML = `
        <h5><i class="bi bi-info-circle me-2" style="color: var(--wedding-gold);"></i>Noch keine Budget-Einträge vorhanden</h5>
        <p class="mb-3" style="color: var(--wedding-text-dark);">Sie haben noch keine Budget-Einträge erstellt. Hier sind einige Optionen um zu starten:</p>
        <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-wedding-primary btn-sm" onclick="openBudgetModal()" style="padding: 8px 16px;">
                <i class="bi bi-plus-circle me-2"></i>Ersten Eintrag hinzufügen
            </button>
            <button class="btn btn-wedding-secondary btn-sm" onclick="handleGenerateBudget()" style="padding: 8px 16px;">
                <i class="bi bi-calculator me-2"></i>Budget automatisch generieren
            </button>
        </div>
        <hr style="border-color: var(--wedding-gold); margin: 15px 0;">
        <small style="color: var(--wedding-text);">
            💡 <strong>Tipp:</strong> Mit "Budget automatisch generieren" erstellen Sie automatisch Einträge basierend auf Ihren Gästedaten und Kostenkonfiguration.
        </small>
    `;
    
    // Sichere Einfügung der Nachricht
    try {
        const table = document.querySelector('.table-responsive');
        if (table && table.parentNode === container) {
            // Füge nach der Tabelle ein, wenn sie ein direktes Kind des Containers ist
            container.insertBefore(messageDiv, table.nextSibling);
        } else {
            // Fallback: Am Ende des Containers anhängen
            container.appendChild(messageDiv);
        }
    } catch (error) {

        // Sicherer Fallback
        container.appendChild(messageDiv);
    }
}

function hideEmptyBudgetMessage() {
    const message = document.getElementById('emptyBudgetMessage');
    if (message) {
        message.remove();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

