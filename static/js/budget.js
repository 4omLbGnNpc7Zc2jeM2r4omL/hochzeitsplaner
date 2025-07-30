// Budget Management JavaScript

let currentBudget = [];
let editingIndex = -1;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Budget wird geladen...');
    
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
        
        const response = await fetch('/api/budget/list');
        const data = await response.json();
        
        if (data.success) {
            currentBudget = data.budget || [];
            displayBudget(currentBudget);
            updateBudgetSummary();
        } else {
            throw new Error(data.error || 'Unbekannter Fehler');
        }
    } catch (error) {
        console.error('Fehler beim Laden des Budgets:', error);
        HochzeitsplanerApp.showAlert('Fehler beim Laden des Budgets: ' + error.message, 'danger');
        
        // Fallback: Leere Anzeige
        currentBudget = [];
        displayBudget([]);
        updateBudgetSummary();
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

function displayBudget() {
    const tbody = document.getElementById('budgetTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = currentBudget.map((item, index) => {
        const kategorie = item.kategorie || 'Unbekannt';
        const beschreibung = item.beschreibung || 'Ohne Beschreibung';
        const details = item.details || '';
        const menge = parseFloat(item.menge || 0);
        const einzelpreis = parseFloat(item.einzelpreis || 0);
        const gesamtpreis = parseFloat(item.gesamtpreis || 0);
        const ausgegeben = parseFloat(item.ausgegeben || 0);
        
        // Status berechnen
        let statusBadge = '';
        let statusClass = '';
        if (ausgegeben === 0) {
            statusBadge = 'Geplant';
            statusClass = 'bg-secondary';
        } else if (ausgegeben < gesamtpreis) {
            statusBadge = 'Teilweise';
            statusClass = 'bg-warning';
        } else if (ausgegeben === gesamtpreis) {
            statusBadge = 'Bezahlt';
            statusClass = 'bg-success';
        } else {
            statusBadge = 'Überzogen';
            statusClass = 'bg-danger';
        }
        
        return `
            <tr>
                <td><span class="badge bg-secondary">${kategorie}</span></td>
                <td><strong>${beschreibung}</strong></td>
                <td><small class="text-muted">${details}</small></td>
                <td class="text-center">${menge}</td>
                <td class="text-end">${formatCurrency(einzelpreis)}</td>
                <td class="text-end"><strong>${formatCurrency(gesamtpreis)}</strong></td>
                <td class="text-end">${formatCurrency(ausgegeben)}</td>
                <td><span class="badge ${statusClass}">${statusBadge}</span></td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="editBudgetItem(${index})" 
                                title="Bearbeiten">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteBudgetItem(${index})" 
                                title="Löschen">
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
    
    if (plannedElement) plannedElement.textContent = formatCurrency(gesamtgeplant);
    if (spentElement) spentElement.textContent = formatCurrency(gesamtausgegeben);
    if (remainingElement) {
        remainingElement.textContent = formatCurrency(verbleibend);
        // Färbe die Karte je nach verbleibendem Budget
        const card = remainingElement.closest('.card');
        if (card) {
            card.className = 'card text-white ' + (verbleibend >= 0 ? 'bg-success' : 'bg-danger');
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
        
        const response = await fetch('/api/budget/auto-generate', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Budget automatisch speichern
            if (result.budget && result.budget.length > 0) {
                await saveBudgetData(result.budget);
            }
            
            // Budget neu laden und anzeigen
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
        console.error('Fehler beim Generieren des Budgets:', error);
        HochzeitsplanerApp.showAlert('Fehler beim Generieren: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

async function saveBudgetData(budgetData) {
    const response = await fetch('/api/budget/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ budget: budgetData })
    });
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error);
    }
}

function openBudgetModal(index = -1) {
    editingIndex = index;
    const modal = new bootstrap.Modal(document.getElementById('budgetModal'));
    const form = document.getElementById('budgetForm');
    const title = document.getElementById('budgetModalTitle');
    
    if (index >= 0 && index < currentBudget.length) {
        // Bearbeiten
        const item = currentBudget[index];
        title.textContent = 'Budget Position bearbeiten';
        
        document.getElementById('budgetKategorie').value = item.kategorie || '';
        document.getElementById('budgetBeschreibung').value = item.beschreibung || '';
        document.getElementById('budgetDetails').value = item.details || '';
        document.getElementById('budgetMenge').value = item.menge || 1;
        document.getElementById('budgetEinzelpreis').value = item.einzelpreis || 0;
        document.getElementById('budgetAusgegeben').value = item.ausgegeben || 0;
        updateGesamtpreis();
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
        if (editingIndex >= 0) {
            // Bearbeiten
            response = await fetch(`/api/budget/edit/${editingIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(budgetData)
            });
        } else {
            // Hinzufügen
            response = await fetch('/api/budget/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(budgetData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            const action = editingIndex >= 0 ? 'aktualisiert' : 'hinzugefügt';
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
        console.error('Fehler beim Speichern:', error);
        HochzeitsplanerApp.showAlert('Fehler beim Speichern: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

function editBudgetItem(index) {
    openBudgetModal(index);
}

function deleteBudgetItem(index) {
    if (index >= 0 && index < currentBudget.length) {
        const item = currentBudget[index];
        
        // Zeige Löschen-Modal
        document.getElementById('deleteItemName').textContent = `${item.kategorie}: ${item.beschreibung}`;
        
        // Speichere Index für Löschen
        document.getElementById('confirmDeleteBtn').dataset.index = index;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteBudgetModal'));
        modal.show();
    }
}

async function handleConfirmDelete() {
    const index = parseInt(document.getElementById('confirmDeleteBtn').dataset.index);
    
    try {
        HochzeitsplanerApp.showLoading();
        
        const response = await fetch(`/api/budget/delete/${index}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
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
        console.error('Fehler beim Löschen:', error);
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
