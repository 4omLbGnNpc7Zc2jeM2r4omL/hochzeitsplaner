// Hochzeitstag Checkliste JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('💕 Hochzeitstag Checkliste JavaScript geladen');
    
    // Checkliste-Funktionalität initialisieren
    initializeChecklistePage();
});

function initializeChecklistePage() {
    try {
        // Prüfe ob wir auf der Checkliste-Seite sind
        if (document.querySelector('#checklist-container') || 
            document.querySelector('[data-page="checkliste"]') ||
            window.location.pathname.includes('checkliste')) {
            
            loadChecklisteData();
        }
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren der Checkliste:', error);
    }
}

async function loadChecklisteData() {
    try {
        console.log('📋 Lade Checkliste-Daten...');
        
        const response = await fetch('/api/aufgaben/list', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Checkliste-Daten erfolgreich geladen:', data.aufgaben.length + ' Aufgaben');
            displayChecklisteItems(data.aufgaben);
        } else {
            throw new Error(data.error || 'Unbekannter Fehler beim Laden der Checkliste');
        }
        
    } catch (error) {
        console.error('❌ Netzwerkfehler:', error);
        showChecklisteError('Fehler beim Laden der Checkliste: ' + error.message);
    }
}

function displayChecklisteItems(aufgaben) {
    console.log('📋 Zeige Checkliste-Einträge an:', aufgaben.length);
    
    // Suche nach Container-Elementen
    const container = document.querySelector('#checklist-container') ||
                     document.querySelector('#aufgaben-container') ||
                     document.querySelector('.checklist-items') ||
                     document.querySelector('#checklist-table tbody');
    
    if (!container) {
        console.warn('⚠️ Kein Checkliste-Container gefunden');
        return;
    }
    
    // Container leeren
    container.innerHTML = '';
    
    if (!aufgaben || aufgaben.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Keine Aufgaben vorhanden</td></tr>';
        return;
    }
    
    // Aufgaben anzeigen
    aufgaben.forEach(aufgabe => {
        const row = createChecklistRow(aufgabe);
        container.appendChild(row);
    });
    
    // Statistiken aktualisieren falls vorhanden
    updateChecklistStatistics(aufgaben);
}

function createChecklistRow(aufgabe) {
    const row = document.createElement('tr');
    
    const statusClass = getStatusClass(aufgabe.status);
    const priorityClass = getPriorityClass(aufgabe.prioritaet);
    
    row.innerHTML = `
        <td>
            <span class="badge bg-${statusClass}">${aufgabe.status || 'Offen'}</span>
        </td>
        <td>
            <strong>${aufgabe.titel || 'Unbenannte Aufgabe'}</strong>
            ${aufgabe.beschreibung ? '<br><small class="text-muted">' + aufgabe.beschreibung + '</small>' : ''}
        </td>
        <td>
            ${aufgabe.zustaendig ? '<span class="badge bg-secondary">' + aufgabe.zustaendig + '</span>' : '-'}
        </td>
        <td>
            <span class="badge bg-${priorityClass}">${aufgabe.prioritaet || 'Mittel'}</span>
        </td>
        <td>
            ${aufgabe.faelligkeitsdatum || '-'}
        </td>
        <td>
            ${aufgabe.kategorie || 'Allgemein'}
        </td>
    `;
    
    // Status-spezifische Styling
    if (aufgabe.status === 'Abgeschlossen') {
        row.classList.add('table-success', 'opacity-75');
    }
    
    return row;
}

function getStatusClass(status) {
    switch(status) {
        case 'Offen': return 'danger';
        case 'In Bearbeitung': return 'warning';
        case 'Abgeschlossen': return 'success';
        case 'Verschoben': return 'secondary';
        default: return 'secondary';
    }
}

function getPriorityClass(prioritaet) {
    switch(prioritaet) {
        case 'Hoch': return 'danger';
        case 'Mittel': return 'warning';
        case 'Niedrig': return 'success';
        default: return 'secondary';
    }
}

function updateChecklistStatistics(aufgaben) {
    const total = aufgaben.length;
    const completed = aufgaben.filter(a => a.status === 'Abgeschlossen').length;
    const inProgress = aufgaben.filter(a => a.status === 'In Bearbeitung').length;
    const open = aufgaben.filter(a => a.status === 'Offen').length;
    
    // Statistik-Container aktualisieren falls vorhanden
    const statsElements = {
        '#total-tasks': total,
        '#completed-tasks': completed,
        '#in-progress-tasks': inProgress,
        '#open-tasks': open,
        '#completion-rate': total > 0 ? Math.round((completed / total) * 100) + '%' : '0%'
    };
    
    Object.entries(statsElements).forEach(([selector, value]) => {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    });
    
    console.log('📊 Checkliste-Statistiken aktualisiert:', {
        total, completed, inProgress, open
    });
}

function showChecklisteError(message) {
    console.error('❌ Checkliste-Fehler:', message);
    
    // Suche nach Error-Container
    const errorContainer = document.querySelector('#checklist-error') ||
                          document.querySelector('.alert-container') ||
                          document.querySelector('#error-messages');
    
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
    
    // Fallback: Browser-Alert
    if (!errorContainer) {
        alert('Checkliste-Fehler: ' + message);
    }
}

// Globale Funktionen für andere Scripts
window.checklisteFunctions = {
    loadChecklisteData,
    displayChecklisteItems,
    updateChecklistStatistics,
    showChecklisteError
};

console.log('✅ Hochzeitstag Checkliste JavaScript vollständig geladen');
