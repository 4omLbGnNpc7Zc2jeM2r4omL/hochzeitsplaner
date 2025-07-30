// Dashboard spezifische Funktionen

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard wird geladen...');
    
    try {
        // Dashboard-Daten laden
        const data = await HochzeitsplanerApp.loadDashboardStats();
        
        if (data) {
            // Charts erstellen
            HochzeitsplanerApp.createGuestsChart(data);
            HochzeitsplanerApp.createBudgetChart(data);
            
            console.log('Dashboard erfolgreich geladen');
        }
    } catch (error) {
        console.error('Fehler beim Laden des Dashboards:', error);
        HochzeitsplanerApp.showAlert('Dashboard konnte nicht geladen werden.', 'danger');
    }
});
