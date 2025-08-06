// Hochzeitsplaner - Einheitliche Chart-Farben
// Diese Datei stellt einheitliche Farben für alle Charts bereit

window.WeddingColors = {
    primary: '#d4af37',
    secondary: '#f4e4bc',
    tertiary: '#e8d5a3',
    accent: '#8b7355',
    light: '#f8f9fa',
    white: '#ffffff',
    
    // Chart-spezifische Farbpaletten
    chartPalette: [
        '#d4af37', // Gold
        '#f4e4bc', // Hell Gold
        '#e8d5a3', // Creme
        '#8b7355', // Braun
        '#c4a464', // Mittleres Gold
        '#f7e8c7', // Sehr helles Gold
        '#b5994a', // Dunkles Gold
        '#a68660'  // Dunkles Braun
    ],
    
    // Gradient-Definitionen für Charts
    gradients: {
        primary: {
            start: '#d4af37',
            end: '#f4e4bc'
        },
        secondary: {
            start: '#e8d5a3',
            end: '#f4e4bc'
        },
        accent: {
            start: '#8b7355',
            end: '#a68660'
        }
    },
    
    // Chart.js kompatible Konfiguration
    chartConfig: {
        backgroundColor: [
            'rgba(212, 175, 55, 0.8)',   // Gold mit Transparenz
            'rgba(244, 228, 188, 0.8)',  // Hell Gold mit Transparenz
            'rgba(232, 213, 163, 0.8)',  // Creme mit Transparenz
            'rgba(139, 115, 85, 0.8)',   // Braun mit Transparenz
            'rgba(196, 164, 100, 0.8)',  // Mittleres Gold mit Transparenz
            'rgba(247, 232, 199, 0.8)',  // Sehr helles Gold mit Transparenz
            'rgba(181, 153, 74, 0.8)',   // Dunkles Gold mit Transparenz
            'rgba(166, 134, 96, 0.8)'    // Dunkles Braun mit Transparenz
        ],
        borderColor: [
            '#d4af37',
            '#f4e4bc',
            '#e8d5a3',
            '#8b7355',
            '#c4a464',
            '#f7e8c7',
            '#b5994a',
            '#a68660'
        ],
        borderWidth: 2
    }
};

// Funktion zum Anwenden der Hochzeitsfarben auf Chart.js Charts
window.applyWeddingThemeToChart = function(chart) {
    if (!chart || !chart.data) return;
    
    const datasets = chart.data.datasets;
    if (datasets && datasets.length > 0) {
        datasets.forEach((dataset, index) => {
            const colorIndex = index % WeddingColors.chartPalette.length;
            
            // Hintergrundfarbe mit Transparenz
            dataset.backgroundColor = dataset.backgroundColor || 
                `rgba(${hexToRgb(WeddingColors.chartPalette[colorIndex])}, 0.8)`;
            
            // Randfarbe
            dataset.borderColor = dataset.borderColor || 
                WeddingColors.chartPalette[colorIndex];
            
            // Randbreite
            dataset.borderWidth = dataset.borderWidth || 2;
        });
        
        chart.update();
    }
};

// Hilfsfunktion: Hex zu RGB konvertieren
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
        '0, 0, 0';
}

// Standard Chart.js Konfiguration mit Hochzeitsthema
window.getWeddingChartDefaults = function() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: WeddingColors.accent,
                    font: {
                        family: 'system-ui, -apple-system, sans-serif',
                        size: 12
                    },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(139, 115, 85, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: WeddingColors.primary,
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                ticks: {
                    color: WeddingColors.accent
                },
                grid: {
                    color: 'rgba(212, 175, 55, 0.1)'
                }
            },
            y: {
                ticks: {
                    color: WeddingColors.accent
                },
                grid: {
                    color: 'rgba(212, 175, 55, 0.1)'
                }
            }
        }
    };
};

// Event-Listener für automatische Chart-Theming
document.addEventListener('DOMContentLoaded', function() {
    // Warte kurz, damit Charts geladen werden können
    setTimeout(() => {
        // Versuche alle Chart.js Instanzen zu finden und zu themisieren
        if (window.Chart && window.Chart.instances) {
            Object.values(window.Chart.instances).forEach(chart => {
                applyWeddingThemeToChart(chart);
            });
        }
    }, 1000);
});

console.log('🎨 Hochzeits-Farbthema geladen - Harmonische Farben aktiviert');
