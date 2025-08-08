// Dashboard spezifische Funktionen

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

        HochzeitsplanerApp.showAlert('Dashboard konnte nicht geladen werden.', 'danger');
    }
});

