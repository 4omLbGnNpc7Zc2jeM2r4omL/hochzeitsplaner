// Hochzeitsplaner Web - Main JavaScript

// Globale Variablen
let currentData = null;

// Google Maps Integration initialisieren
document.addEventListener('DOMContentLoaded', function() {
    if (window.GoogleMapsIntegration && !window.googleMaps) {
        window.googleMaps = new GoogleMapsIntegration();

    }
});

// Utility Funktionen
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('d-none');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('d-none');
}

function showAlert(message, type = 'success') {
    // Prüfe zuerst, ob ein spezifischer Alert-Container für die Seite existiert
    let alertContainer = document.getElementById('aufgabenAlertContainer') || 
                        document.getElementById('globalAlertContainer');
    
    // Falls kein spezifischer Container vorhanden ist, verwende globalen festen Container
    if (!alertContainer) {
        alertContainer = document.getElementById('globalAlertContainer');
        if (!alertContainer) {
            // Erstelle globalen festen Alert-Container
            alertContainer = document.createElement('div');
            alertContainer.id = 'globalAlertContainer';
            alertContainer.className = 'alert-container-fixed';
            document.body.appendChild(alertContainer);
        }
    }
    
    // Erstelle Alert-Element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Füge Alert zum Container hinzu
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

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

// API Request Funktion (Alias für apiCall)
async function apiRequest(endpoint, options = {}) {
    return await apiCall(endpoint, options);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
}

// API Funktionen
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(endpoint, finalOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API-Fehler');
        }
        
        return data;
    } catch (error) {

        throw error;
    }
}

// Dashboard API
async function loadDashboardStats() {
    try {
        showLoading();
        const data = await apiCall('/api/dashboard/stats');
        
        if (data.success) {
            currentData = data;
            updateDashboardStats(data);
            return data;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        showAlert('Fehler beim Laden der Dashboard-Daten: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

function updateDashboardStats(data) {
    // Berechne Budget-Werte
    const planned = data.budget?.planned || 0;
    const spent = data.budget?.spent || 0;
    const remaining = planned - spent;
    const percentage = planned > 0 ? Math.round((spent / planned) * 100) : 0;
    
    // Statistik-Karten aktualisieren (ohne doppeltes Euro-Zeichen)
    const elements = {
        gaesteZugesagt: data.gaeste?.personen_zusagen || 0,
        gaesteOffen: data.gaeste?.personen_offen || 0,
        budgetGeplant: formatCurrency(planned).replace('€', '').trim() + ' €',
        budgetAusgegeben: formatCurrency(spent).replace('€', '').trim() + ' €'
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
    
    // Budget Status aktualisieren
    const budgetVerbleibtElement = document.getElementById('budgetVerbleibt');
    const budgetStatusElement = document.getElementById('budgetStatus');
    const budgetStatusCard = document.getElementById('budgetStatusCard');
    const budgetIcon = document.getElementById('budgetIcon');
    
    if (budgetVerbleibtElement && budgetStatusElement && budgetStatusCard && budgetIcon) {
        if (remaining >= 0) {
            budgetVerbleibtElement.textContent = formatCurrency(remaining);
            budgetStatusElement.textContent = 'verbleibt';
            budgetStatusCard.className = 'card budget-status-card';
            budgetIcon.className = 'bi bi-check-circle';
        } else {
            budgetVerbleibtElement.textContent = formatCurrency(Math.abs(remaining));
            budgetStatusElement.textContent = 'überzogen';
            budgetStatusCard.className = 'card budget-status-card budget-exceeded';
            budgetIcon.className = 'bi bi-exclamation-triangle';
        }
    }
    
    // Budget Fortschritt aktualisieren
    const budgetProgress = document.getElementById('budgetProgress');
    const budgetProgressText = document.getElementById('budgetProgressText');
    
    if (budgetProgress && budgetProgressText) {
        const progressClass = percentage > 100 ? 'bg-danger' : 
                            percentage > 80 ? 'bg-warning' : 'bg-success';
        
        budgetProgress.style.width = `${Math.min(percentage, 100)}%`;
        budgetProgress.className = `progress-bar ${progressClass}`;
        budgetProgressText.textContent = `${percentage}% ausgegeben`;
        
        if (percentage > 100) {
            budgetProgressText.textContent += ` (${percentage - 100}% Überschreitung)`;
        }
    }
    
    // Event-spezifische Statistiken aktualisieren
    const eventElements = {
        weisserSaalCount: data.gaeste?.weisser_saal || 0,
        essenCount: data.gaeste?.essen || 0,
        partyCount: data.gaeste?.party || 0,
        kinderCount: data.gaeste?.kinder || 0
    };
    
    Object.entries(eventElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Gäste API
async function loadGuests() {
    try {
        showLoading();
        const data = await apiCall('/api/gaeste/list');
        
        if (data.success) {
            return data.gaeste;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        showAlert('Fehler beim Laden der Gästeliste: ' + error.message, 'danger');
        return [];
    } finally {
        hideLoading();
    }
}

async function addGuest(guestData) {
    try {
        showLoading();
        const data = await apiCall('/api/gaeste/add', {
            method: 'POST',
            body: JSON.stringify(guestData)
        });
        
        if (data.success) {
            showAlert('Gast erfolgreich hinzugefügt!');
            return true;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        showAlert('Fehler beim Hinzufügen: ' + error.message, 'danger');
        return false;
    } finally {
        hideLoading();
    }
}

// Settings API
async function loadSettings() {
    try {
        const data = await apiCall('/api/settings/get');
        
        if (data.success) {
            return data.settings;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        return {};
    }
}

async function saveSettings(settings) {
    try {
        showLoading();
        const response = await apiCall('/api/settings/save', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        
        if (response.success) {
            showSuccess('Einstellungen erfolgreich gespeichert!');
            return true;
        } else {
            throw new Error(response.error || 'Fehler beim Speichern');
        }
    } catch (error) {

        showError('Fehler beim Speichern der Einstellungen: ' + error.message);
        return false;
    } finally {
        hideLoading();
    }
}

// Google Maps Funktionen
function openGoogleMaps(inputId) {
    const addressInput = document.getElementById(inputId);
    if (!addressInput || !addressInput.value.trim()) {
        showError('Bitte gib zuerst eine Adresse ein');
        return;
    }
    
    const address = encodeURIComponent(addressInput.value.trim());
    const mapsUrl = `https://maps.google.com/maps?q=${address}`;
    window.open(mapsUrl, '_blank');
}

// Locations laden und in Formular füllen
async function loadLocations() {
    try {
        const settings = await loadSettings();
        
        // Standesamt laden
        if (settings.locations && settings.locations.standesamt) {
            const standesamt = settings.locations.standesamt;
            document.getElementById('standesamtName').value = standesamt.name || '';
            document.getElementById('standesamtAdresse').value = standesamt.adresse || '';
            document.getElementById('standesamtBeschreibung').value = standesamt.beschreibung || '';
        }
        
        // Hochzeitslocation laden
        if (settings.locations && settings.locations.hochzeitslocation) {
            const hochzeitslocation = settings.locations.hochzeitslocation;
            document.getElementById('hochzeitslocationName').value = hochzeitslocation.name || '';
            document.getElementById('hochzeitslocationAdresse').value = hochzeitslocation.adresse || '';
            document.getElementById('hochzeitslocationBeschreibung').value = hochzeitslocation.beschreibung || '';
        }
        
        // Legacy hochzeitsort für Kompatibilität (unsichtbar)
        if (settings.hochzeitsort) {
            document.getElementById('hochzeitsort').value = settings.hochzeitsort;
        }
        
    } catch (error) {

        showError('Fehler beim Laden der Location-Daten');
    }
}

// Locations speichern
async function saveLocations() {
    try {
        // Nur die spezifischen Location-Daten sammeln, nicht alle Einstellungen laden
        const locationSettings = {
            locations: {
                standesamt: {
                    name: document.getElementById('standesamtName').value.trim(),
                    adresse: document.getElementById('standesamtAdresse').value.trim(),
                    beschreibung: document.getElementById('standesamtBeschreibung').value.trim()
                },
                hochzeitslocation: {
                    name: document.getElementById('hochzeitslocationName').value.trim(),
                    adresse: document.getElementById('hochzeitslocationAdresse').value.trim(),
                    beschreibung: document.getElementById('hochzeitslocationBeschreibung').value.trim()
                }
            }
        };
        
        // Legacy Feld für Kompatibilität beibehalten
        const hochzeitsortValue = document.getElementById('hochzeitsort').value.trim();
        if (hochzeitsortValue) {
            locationSettings.hochzeitsort = hochzeitsortValue;
        }
        
        // Nur Location-Daten speichern (ohne first_login Felder)
        const success = await saveSettings(locationSettings);
        return success;
        
    } catch (error) {

        showError('Fehler beim Speichern der Location-Daten');
        return false;
    }
}

// Chart Funktionen
function createGuestsChart(data) {
    const ctx = document.getElementById('gaesteChart');
    if (!ctx || !data.gaeste) return;
    
    const zusagen = data.gaeste.personen_zusagen || 0;
    const absagen = data.gaeste.personen_absagen || 0;
    const offen = data.gaeste.personen_offen || 0;
    const gesamt = zusagen + absagen + offen;
    
    // Äußerer Ring: Gesamtanzahl Gäste - Hochzeits-Theme
    const outerData = [gesamt];
    const outerLabels = [`Gäste gesamt (${gesamt})`];
    const outerColors = [WeddingColors.primary]; // Gold statt blau
    
    // Innerer Ring: Status-Verteilung - Hochzeits-Theme
    const innerData = [];
    const innerLabels = [];
    const innerColors = [];
    
    if (zusagen > 0) {
        innerData.push(zusagen);
        innerLabels.push(`Zugesagt (${zusagen})`);
        innerColors.push(WeddingColors.success); // Hochzeits-Grün
    }
    if (absagen > 0) {
        innerData.push(absagen);
        innerLabels.push(`Abgesagt (${absagen})`);
        innerColors.push(WeddingColors.danger); // Hochzeits-Rot
    }
    if (offen > 0) {
        innerData.push(offen);
        innerLabels.push(`Offen (${offen})`);
        innerColors.push(WeddingColors.warning); // Hochzeits-Gelb
    }
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [...outerLabels, ...innerLabels],
            datasets: [
                {
                    label: 'Gesamtgäste',
                    data: outerData,
                    backgroundColor: outerColors,
                    borderWidth: 3,
                    borderColor: '#fff',
                    radius: '90%',
                    weight: 1
                },
                {
                    label: 'Gästestatus',
                    data: innerData,
                    backgroundColor: innerColors,
                    borderWidth: 2,
                    borderColor: '#fff',
                    radius: '70%',
                    weight: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '40%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            family: 'Dancing Script, cursive',
                            weight: 'bold'
                        },
                        color: '#8b7355', // Hochzeits-Textfarbe
                        generateLabels: function(chart) {
                            const datasets = chart.data.datasets;
                            const labels = [];
                            
                            // Äußerer Ring Label
                            labels.push({
                                text: outerLabels[0],
                                fillStyle: outerColors[0],
                                strokeStyle: outerColors[0],
                                lineWidth: 2,
                                pointStyle: 'circle'
                            });
                            
                            // Innerer Ring Labels
                            innerLabels.forEach((label, index) => {
                                labels.push({
                                    text: label,
                                    fillStyle: innerColors[index],
                                    strokeStyle: innerColors[index],
                                    lineWidth: 2,
                                    pointStyle: 'circle'
                                });
                            });
                            
                            return labels;
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(139, 115, 85, 0.9)', // Wedding-Brown
                    titleColor: '#f4e4bc', // Light Gold
                    bodyColor: '#f4e4bc',
                    borderColor: '#d4af37',
                    borderWidth: 1,
                    titleFont: {
                        family: 'Dancing Script, cursive'
                    },
                    bodyFont: {
                        family: 'Dancing Script, cursive'
                    },
                    callbacks: {
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            
                            if (datasetIndex === 0) {
                                // Äußerer Ring (Gesamtgäste)
                                return `${label}`;
                            } else {
                                // Innerer Ring (Status-Verteilung)
                                const total = gesamt;
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label} (${percentage}% aller Gäste)`;
                            }
                        }
                    }
                }
            }
        }
    });
}

function createBudgetChart(data) {
    const ctx = document.getElementById('budgetChart');
    if (!ctx || !data.budget) return;
    
    const planned = data.budget.planned || 0;
    const spent = data.budget.spent || 0;
    const remaining = Math.max(0, planned - spent);
    const overspent = spent > planned ? spent - planned : 0;
    
    // Äußerer Ring: Gesamtbudget - Hochzeits-Theme
    const outerData = [planned];
    const outerLabels = [`Gesamtbudget (${formatCurrency(planned)})`];
    const outerColors = [WeddingColors.primary]; // Gold statt blau
    
    // Innerer Ring: Verteilung Ausgegeben/Verbleibt - Hochzeits-Theme
    const innerData = [];
    const innerLabels = [];
    const innerColors = [];
    
    if (spent > 0) {
        innerData.push(spent);
        innerLabels.push(`Ausgegeben (${formatCurrency(spent)})`);
        innerColors.push(overspent > 0 ? WeddingColors.danger : WeddingColors.success); // Hochzeits-Farben
    }
    
    if (remaining > 0) {
        innerData.push(remaining);
        innerLabels.push(`Verbleibt (${formatCurrency(remaining)})`);
        innerColors.push(WeddingColors.warning); // Hochzeits-Gelb
    }
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [...outerLabels, ...innerLabels],
            datasets: [
                {
                    label: 'Gesamtbudget',
                    data: outerData,
                    backgroundColor: outerColors,
                    borderWidth: 3,
                    borderColor: '#fff',
                    radius: '90%',
                    weight: 1
                },
                {
                    label: 'Budgetverteilung',
                    data: innerData,
                    backgroundColor: innerColors,
                    borderWidth: 2,
                    borderColor: '#fff',
                    radius: '70%',
                    weight: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '40%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            family: 'Dancing Script, cursive',
                            weight: 'bold'
                        },
                        color: '#8b7355', // Hochzeits-Textfarbe
                        generateLabels: function(chart) {
                            const labels = [];
                            
                            // Äußerer Ring Label
                            labels.push({
                                text: outerLabels[0],
                                fillStyle: outerColors[0],
                                strokeStyle: outerColors[0],
                                lineWidth: 2,
                                pointStyle: 'circle'
                            });
                            
                            // Innerer Ring Labels
                            innerLabels.forEach((label, index) => {
                                labels.push({
                                    text: label,
                                    fillStyle: innerColors[index],
                                    strokeStyle: innerColors[index],
                                    lineWidth: 2,
                                    pointStyle: 'circle'
                                });
                            });
                            
                            return labels;
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(139, 115, 85, 0.9)', // Wedding-Brown
                    titleColor: '#f4e4bc', // Light Gold
                    bodyColor: '#f4e4bc',
                    borderColor: '#d4af37',
                    borderWidth: 1,
                    titleFont: {
                        family: 'Dancing Script, cursive'
                    },
                    bodyFont: {
                        family: 'Dancing Script, cursive'
                    },
                    callbacks: {
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            
                            if (datasetIndex === 0) {
                                // Äußerer Ring (Gesamtbudget)
                                return `${label}`;
                            } else {
                                // Innerer Ring (Verteilung)
                                const total = planned;
                                if (overspent > 0 && context.dataIndex === 0) {
                                    const budgetPercentage = total > 0 ? Math.round((spent / total) * 100) : 0;
                                    return [
                                        `${label} (${budgetPercentage}% des Budgets)`,
                                        `Überschreitung: ${formatCurrency(overspent)}`
                                    ];
                                } else {
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label} (${percentage}% des Budgets)`;
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    
    
    // Bootstrap Tooltips aktivieren
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Globale Error Handler
    window.addEventListener('error', function(e) {

        showAlert('Ein unerwarteter Fehler ist aufgetreten.', 'danger');
    });
    
    // Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', function(e) {

        showAlert('Ein unerwarteter Fehler ist aufgetreten.', 'danger');
    });
});

// Export für andere Skripte
window.HochzeitsplanerApp = {
    apiCall,
    showLoading,
    hideLoading,
    showAlert,
    formatCurrency,
    formatDate,
    loadDashboardStats,
    updateDashboardStats,
    loadGuests,
    addGuest,
    loadSettings,
    saveSettings,
    openGoogleMaps,
    loadLocations,
    saveLocations,
    createGuestsChart,
    createBudgetChart,
    refreshDashboard: loadDashboardStats  // Alias für Dashboard-Refresh
};

