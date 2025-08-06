// Debug-Skript um zu testen ob die Funktionen verfügbar sind
console.log('🔍 Debug: Prüfe verfügbare Funktionen...');

// Prüfe ob Funktionen auf window verfügbar sind
console.log('showTableOverview auf window:', typeof window.showTableOverview);
console.log('showStatistics auf window:', typeof window.showStatistics);

// Teste die Funktionen direkt
if (typeof window.showTableOverview === 'function') {
    console.log('✅ showTableOverview ist verfügbar');
    // window.showTableOverview(); // Kommentiert aus für Test
} else {
    console.log('❌ showTableOverview ist NICHT verfügbar');
}

if (typeof window.showStatistics === 'function') {
    console.log('✅ showStatistics ist verfügbar');
    // window.showStatistics(); // Kommentiert aus für Test
} else {
    console.log('❌ showStatistics ist NICHT verfügbar');
}

// Prüfe DOM-Elemente
console.log('tableOverviewRow Element:', document.getElementById('tableOverviewRow'));
console.log('statisticsRow Element:', document.getElementById('statisticsRow'));

// Prüfe globale Variablen
console.log('tables Variable:', typeof tables !== 'undefined' ? tables : 'undefined');
console.log('guests Variable:', typeof guests !== 'undefined' ? guests : 'undefined');
