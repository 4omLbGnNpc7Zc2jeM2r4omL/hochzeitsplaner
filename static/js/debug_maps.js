// Test Script zum Debuggen der Kartenvorschau

console.log('=== DEBUG KARTENVORSCHAU ===');

// Alle relevanten Elemente finden
const elements = {
    standesamtAdresse: document.getElementById('standesamtAdresse'),
    standesamtMapPreview: document.getElementById('standesamtMapPreview'),
    standesamtMapFrame: document.getElementById('standesamtMapFrame'),
    hochzeitslocationAdresse: document.getElementById('hochzeitslocationAdresse'),
    hochzeitslocationMapPreview: document.getElementById('hochzeitslocationMapPreview'),
    hochzeitslocationMapFrame: document.getElementById('hochzeitslocationMapFrame')
};

console.log('Elemente gefunden:', elements);

// Teste ob die Elemente existieren
Object.keys(elements).forEach(key => {
    if (elements[key]) {
        console.log(`✅ ${key} gefunden`);
    } else {
        console.log(`❌ ${key} NICHT gefunden`);
    }
});

// Wenn Adressen vorhanden sind, Karten anzeigen
if (elements.standesamtAdresse && elements.standesamtAdresse.value) {
    console.log('Standesamt Adresse vorhanden:', elements.standesamtAdresse.value);
    
    if (elements.standesamtMapPreview && elements.standesamtMapFrame) {
        const encodedAddress = encodeURIComponent(elements.standesamtAdresse.value);
        const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&output=embed`;
        
        elements.standesamtMapFrame.src = mapUrl;
        elements.standesamtMapPreview.style.display = 'block';
        
        console.log('✅ Standesamt Karte angezeigt');
    }
}

if (elements.hochzeitslocationAdresse && elements.hochzeitslocationAdresse.value) {
    console.log('Hochzeitslocation Adresse vorhanden:', elements.hochzeitslocationAdresse.value);
    
    if (elements.hochzeitslocationMapPreview && elements.hochzeitslocationMapFrame) {
        const encodedAddress = encodeURIComponent(elements.hochzeitslocationAdresse.value);
        const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&output=embed`;
        
        elements.hochzeitslocationMapFrame.src = mapUrl;
        elements.hochzeitslocationMapPreview.style.display = 'block';
        
        console.log('✅ Hochzeitslocation Karte angezeigt');
    }
}

console.log('=== DEBUG ENDE ===');
