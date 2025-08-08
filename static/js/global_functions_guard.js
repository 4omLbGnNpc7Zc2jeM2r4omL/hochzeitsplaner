// Global Functions Guard - Sicherstellen dass Template-Button-Funktionen verfügbar sind


// SOFORTIGE Definition der wichtigsten Funktionen (kritisch für onclick-Handler)
window.selectTemplate = function(templateName) {

    if (window.einladungsGenerator && window.einladungsGenerator.selectTemplate) {
        window.einladungsGenerator.selectTemplate(templateName);
    } else {

        setTimeout(() => {
            if (window.einladungsGenerator && window.einladungsGenerator.selectTemplate) {
                window.einladungsGenerator.selectTemplate(templateName);
            } else {

            }
        }, 500);
    }
};

window.generateTestCard = function() {

    if (window.einladungsGenerator && window.einladungsGenerator.generateTestCard) {
        window.einladungsGenerator.generateTestCard();
    } else {

    }
};

window.generateAllCards = function() {

    if (window.einladungsGenerator && window.einladungsGenerator.generateAllCards) {
        window.einladungsGenerator.generateAllCards();
    } else {

    }
};

window.downloadTestCard = function() {

    if (window.einladungsGenerator && window.einladungsGenerator.downloadTestCard) {
        window.einladungsGenerator.downloadTestCard();
    } else {

    }
};

window.updatePreview = function() {

    if (window.einladungsGenerator && window.einladungsGenerator.updatePreview) {
        window.einladungsGenerator.updatePreview();
    } else {

    }
};

// Auch direkt im globalen Scope verfügbar machen (für onclick)
selectTemplate = window.selectTemplate;
generateTestCard = window.generateTestCard;
generateAllCards = window.generateAllCards;
downloadTestCard = window.downloadTestCard;
updatePreview = window.updatePreview;



// Periodische Überprüfung der globalen Funktionen
function ensureGlobalFunctions() {
    const requiredFunctionNames = ['selectTemplate', 'generateTestCard', 'generateAllCards', 'downloadTestCard', 'updatePreview'];
    
    requiredFunctionNames.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {

            // Hier könnten wir die Funktionen neu definieren, aber da sie oben bereits definiert sind,
            // sollte das nicht nötig sein
        }
    });
}

// Sofort ausführen
ensureGlobalFunctions();

// Bei DOM-Ready nochmals überprüfen
document.addEventListener('DOMContentLoaded', function() {

    ensureGlobalFunctions();
    
    // Status-Report
    const requiredFunctionNames = ['selectTemplate', 'generateTestCard', 'generateAllCards', 'downloadTestCard', 'updatePreview'];
    const status = requiredFunctionNames.map(funcName => {
        const available = typeof window[funcName] === 'function';
        return `${funcName}: ${available ? '✅' : '❌'}`;
    }).join('\n- ');
    

});

// Periodische Überprüfung alle 2 Sekunden
setInterval(() => {
    const requiredFunctionNames = ['selectTemplate', 'generateTestCard', 'generateAllCards', 'downloadTestCard', 'updatePreview'];
    let missingCount = 0;
    
    requiredFunctionNames.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {
            missingCount++;
        }
    });
    
    if (missingCount > 0) {

        ensureGlobalFunctions();
    }
}, 2000);



