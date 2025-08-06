/* =============================================================================
   Tischplanung Beziehungsmanagement - Fehlerbehebung und Benachrichtigungen
   Überschreibt fehlerhafte Funktionen und integriert Website-Benachrichtigungen
   ============================================================================= */

// Nach dem Laden der ursprünglichen Funktionen diese verbesserten Versionen verwenden

// =============================================================================
// Überschreibe generateAddRelationshipForm für korrektes Trauzeuge-Dropdown
// =============================================================================

/**
 * Überschreibt die ursprüngliche generateAddRelationshipForm Funktion
 */
window.generateAddRelationshipForm = function(guests) {
    // Dropdown-Optionen für Gäste generieren
    let guestOptions = '<option value="">Gast wählen...</option>';
    
    // Funktion zur Bestimmung des Brautpaar-Namens zur Laufzeit
    function getWeddingCoupleDisplay() {
        // Prüfe Template-Variablen in verschiedenen Kombinationen
        let brideName = '';
        let groomName = '';
        
        // Versuche verschiedene Variablen-Namen
        if (window.BRIDE_NAME && window.BRIDE_NAME.trim() && !window.BRIDE_NAME.includes('{{')) {
            brideName = window.BRIDE_NAME.trim();
        } else if (window.BRAUT_NAME && window.BRAUT_NAME.trim() && !window.BRAUT_NAME.includes('{{')) {
            brideName = window.BRAUT_NAME.trim();
        }
        
        if (window.GROOM_NAME && window.GROOM_NAME.trim() && !window.GROOM_NAME.includes('{{')) {
            groomName = window.GROOM_NAME.trim();
        } else if (window.BRAEUTIGAM_NAME && window.BRAEUTIGAM_NAME.trim() && !window.BRAEUTIGAM_NAME.includes('{{')) {
            groomName = window.BRAEUTIGAM_NAME.trim();
        }
        
        // Wenn beide Namen verfügbar sind, kombiniere sie
        if (brideName && groomName) {
            return `${brideName} & ${groomName}`;
        }
        
        // Versuche vordefinierte kombinierte Variablen
        if (window.WEDDING_COUPLE_NAME && window.WEDDING_COUPLE_NAME.trim() && !window.WEDDING_COUPLE_NAME.includes('{{')) {
            return window.WEDDING_COUPLE_NAME.trim();
        }
        
        if (window.weddingCoupleName && window.weddingCoupleName.trim() && !window.weddingCoupleName.includes('{{')) {
            return window.weddingCoupleName.trim();
        }
        
        // Fallback
        return 'Brautpaar';
    }
    
    const weddingCoupleDisplay = getWeddingCoupleDisplay();
    guestOptions += `<option value="-1">💑 ${weddingCoupleDisplay}</option>`;
    
    // Normale Gäste hinzufügen
    guests.forEach(guest => {
        guestOptions += `<option value="${guest.id}">${guest.vorname} ${guest.nachname}</option>`;
    });

    return `
        <form id="addRelationshipForm" onsubmit="addRelationship(event)">
            <div class="mb-3">
                <label class="form-label">Erste Person</label>
                <select class="form-select" name="guest1_id" required>
                    ${guestOptions}
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">Beziehungstyp</label>
                <select class="form-select" name="relationship_type" required>
                    <option value="">Typ wählen...</option>
                    <option value="Trauzeuge/in">💒 Trauzeuge/in</option>
                    <option value="Eltern">👨‍👩‍👧‍👦 Eltern</option>
                    <option value="Geschwister">👫 Geschwister</option>
                    <option value="Großeltern">👴👵 Großeltern</option>
                    <option value="Tante/Onkel">👨‍👩‍👧 Tante/Onkel</option>
                    <option value="Cousin/Cousine">👥 Cousin/Cousine</option>
                    <option value="Freunde">🤝 Freunde</option>
                    <option value="Kollegen">💼 Kollegen</option>
                    <option value="Nachbarn">🏠 Nachbarn</option>
                    <option value="Partner">💕 Partner</option>
                    <option value="Kinder">👶 Kinder</option>
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">Beziehungsstärke</label>
                <select class="form-select" name="relationship_strength" required>
                    <option value="">Stärke wählen...</option>
                    <option value="2">+2 (Sehr positive Beziehung)</option>
                    <option value="1" selected>+1 (Positive Beziehung)</option>
                    <option value="0">0 (Neutrale Beziehung)</option>
                    <option value="-1">-1 (Leicht negative Beziehung)</option>
                    <option value="-2">-2 (Sehr negative Beziehung)</option>
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">Zweite Person</label>
                <select class="form-select" name="guest2_id" required>
                    ${guestOptions}
                </select>
            </div>
            <button type="submit" class="btn btn-primary w-100">
                <i class="fas fa-plus"></i> Beziehung hinzufügen
            </button>
        </form>
    `;
};

/**
 * Sichere Delete-Funktion mit verbesserter Fehlerbehandlung
 */
window.deleteRelationshipSafe = async function(relationshipId) {
    console.log('deleteRelationshipSafe aufgerufen mit ID:', relationshipId);
    
    // Bestätigung anfordern
    if (!confirm('Möchten Sie diese Beziehung wirklich löschen?')) {
        return;
    }
    
    try {
        // API prüfen
        if (!window.TischplanungAPI) {
            throw new Error('Tischplanung API nicht verfügbar');
        }

        console.log('Lösche Beziehung mit ID:', relationshipId);
        const result = await window.TischplanungAPI.deleteRelationship(relationshipId);
        console.log('Delete-Ergebnis:', result);
        
        // Robuste Behandlung verschiedener Antwortformate
        let isSuccess = false;
        let errorMessage = '';
        
        if (result === true || result === 'success') {
            // Einfache Success-Antwort
            isSuccess = true;
        } else if (result && typeof result === 'object') {
            // Objekt-Antwort
            if (result.success === true || result.success === 'true') {
                isSuccess = true;
            } else if (result.error || result.message) {
                errorMessage = result.error || result.message;
            }
        } else if (result === false || result === 'error') {
            // Einfache Error-Antwort
            isSuccess = false;
            errorMessage = 'Löschung fehlgeschlagen';
        }
        
        if (isSuccess) {
            // Erfolg melden
            if (typeof showSuccess === 'function') {
                showSuccess('Beziehung erfolgreich gelöscht!');
            } else {
                console.log('Beziehung erfolgreich gelöscht!');
            }
            
            // Liste aktualisieren
            if (typeof refreshRelationshipsList === 'function') {
                await refreshRelationshipsList();
            } else {
                // Fallback: Modal neu laden
                setTimeout(() => {
                    showRelationshipsOverview();
                }, 1000);
            }
            
        } else {
            console.error('Delete-Fehler:', result);
            const errorMsg = 'Fehler beim Löschen der Beziehung: ' + (errorMessage || 'Unbekannter Fehler');
            if (typeof showError === 'function') {
                showError(errorMsg);
            } else {
                alert(errorMsg);
            }
        }
        
    } catch (error) {
        console.error('Fehler beim Löschen der Beziehung:', error);
        const errorMsg = 'Fehler beim Löschen der Beziehung: ' + error.message;
        if (typeof showError === 'function') {
            showError(errorMsg);
        } else {
            alert(errorMsg);
        }
    }
};

// =============================================================================
// Verbesserte Beziehungsliste mit korrigierter Delete-Funktion
// =============================================================================

/**
 * Überschreibt die ursprüngliche generateRelationshipsList Funktion
 */
const originalGenerateRelationshipsList = window.generateRelationshipsList;
window.generateRelationshipsList = function(relationships, guests) {  // Korrekte Parameter-Reihenfolge wie in Core
    if (!relationships || relationships.length === 0) {
        return `
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                Noch keine Beziehungen definiert
            </div>
        `;
    }

    // Gäste-Lookup für schnellen Zugriff
    const guestMap = {};
    guests.forEach(guest => {
        guestMap[guest.id] = guest;
    });

    let html = '<div class="list-group">';
    
    relationships.forEach(rel => {
        // Backend-Format: rel.gast_id_1, rel.gast_id_2, rel.beziehungstyp (wie in tischplanung-core.js)
        const guest1Id = rel.gast_id_1;
        const guest2Id = rel.gast_id_2;
        const relationshipType = rel.beziehungstyp;
        
        const guest1 = guestMap[guest1Id];
        const guest2 = guestMap[guest2Id];
        
        let guest1Name = 'Unbekannt';
        let guest2Name = 'Unbekannt';
        
        if (guest1Id === -1) {
            // Funktion zur Bestimmung des Brautpaar-Namens zur Laufzeit
            function getWeddingCoupleDisplay() {
                let brideName = '';
                let groomName = '';
                
                if (window.BRIDE_NAME && window.BRIDE_NAME.trim() && !window.BRIDE_NAME.includes('{{')) {
                    brideName = window.BRIDE_NAME.trim();
                } else if (window.BRAUT_NAME && window.BRAUT_NAME.trim() && !window.BRAUT_NAME.includes('{{')) {
                    brideName = window.BRAUT_NAME.trim();
                }
                
                if (window.GROOM_NAME && window.GROOM_NAME.trim() && !window.GROOM_NAME.includes('{{')) {
                    groomName = window.GROOM_NAME.trim();
                } else if (window.BRAEUTIGAM_NAME && window.BRAEUTIGAM_NAME.trim() && !window.BRAEUTIGAM_NAME.includes('{{')) {
                    groomName = window.BRAEUTIGAM_NAME.trim();
                }
                
                if (brideName && groomName) {
                    return `${brideName} & ${groomName}`;
                }
                
                if (window.WEDDING_COUPLE_NAME && window.WEDDING_COUPLE_NAME.trim() && !window.WEDDING_COUPLE_NAME.includes('{{')) {
                    return window.WEDDING_COUPLE_NAME.trim();
                }
                
                if (window.weddingCoupleName && window.weddingCoupleName.trim() && !window.weddingCoupleName.includes('{{')) {
                    return window.weddingCoupleName.trim();
                }
                
                return 'Brautpaar';
            }
            guest1Name = `💑 ${getWeddingCoupleDisplay()}`;
        } else if (guest1) {
            guest1Name = `${guest1.vorname || ''} ${guest1.nachname || ''}`.trim();
        }
        
        if (guest2Id === -1) {
            // Gleiche Funktion für guest2
            function getWeddingCoupleDisplay() {
                let brideName = '';
                let groomName = '';
                
                if (window.BRIDE_NAME && window.BRIDE_NAME.trim() && !window.BRIDE_NAME.includes('{{')) {
                    brideName = window.BRIDE_NAME.trim();
                } else if (window.BRAUT_NAME && window.BRAUT_NAME.trim() && !window.BRAUT_NAME.includes('{{')) {
                    brideName = window.BRAUT_NAME.trim();
                }
                
                if (window.GROOM_NAME && window.GROOM_NAME.trim() && !window.GROOM_NAME.includes('{{')) {
                    groomName = window.GROOM_NAME.trim();
                } else if (window.BRAEUTIGAM_NAME && window.BRAEUTIGAM_NAME.trim() && !window.BRAEUTIGAM_NAME.includes('{{')) {
                    groomName = window.BRAEUTIGAM_NAME.trim();
                }
                
                if (brideName && groomName) {
                    return `${brideName} & ${groomName}`;
                }
                
                if (window.WEDDING_COUPLE_NAME && window.WEDDING_COUPLE_NAME.trim() && !window.WEDDING_COUPLE_NAME.includes('{{')) {
                    return window.WEDDING_COUPLE_NAME.trim();
                }
                
                if (window.weddingCoupleName && window.weddingCoupleName.trim() && !window.weddingCoupleName.includes('{{')) {
                    return window.weddingCoupleName.trim();
                }
                
                return 'Brautpaar';
            }
            guest2Name = `💑 ${getWeddingCoupleDisplay()}`;
        } else if (guest2) {
            guest2Name = `${guest2.vorname || ''} ${guest2.nachname || ''}`.trim();
        }

        // Icon für Beziehungstyp
        const relationshipIcon = getRelationshipIcon(relationshipType);
        
        // Beziehungsstärke-Anzeige
        const strengthValue = rel.staerke || 0;
        const strengthColor = strengthValue > 0 ? 'success' : strengthValue < 0 ? 'danger' : 'secondary';
        const strengthIcon = strengthValue > 0 ? 'fas fa-heart' : strengthValue < 0 ? 'fas fa-heart-broken' : 'fas fa-minus';
        
        html += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${guest1Name}</strong>
                    <span class="mx-2">${relationshipIcon} ${relationshipType || 'Unbekannt'}</span>
                    <strong>${guest2Name}</strong>
                    <span class="badge bg-${strengthColor} ms-2">
                        <i class="${strengthIcon} me-1"></i>
                        ${strengthValue > 0 ? '+' : ''}${strengthValue}
                    </span>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" 
                        onclick="deleteRelationshipSafe(${rel.id})"
                        title="Beziehung löschen">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
};

// =============================================================================
// Aktualisiertes refreshRelationshipsList
// =============================================================================

window.refreshRelationshipsList = async function() {
    try {
        const [guests, relationships] = await Promise.all([
            window.TischplanungAPI.loadGuests(),
            window.TischplanungAPI.loadRelationships()
        ]);

        const relationshipsList = document.getElementById('relationshipsList');
        if (relationshipsList) {
            relationshipsList.innerHTML = window.generateRelationshipsList(relationships, guests);
        }
        
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Beziehungen:', error);
        if (typeof showError === 'function') {
            showError('Fehler beim Aktualisieren der Beziehungen: ' + error.message);
        } else {
            alert('Fehler beim Aktualisieren der Beziehungen: ' + error.message);
        }
    }
};

// =============================================================================
// Hilfsfunktionen
// =============================================================================

function getRelationshipIcon(type) {
    const icons = {
        'Trauzeuge/in': '💒',
        'Eltern': '👨‍👩‍👧‍👦',
        'Geschwister': '👫',
        'Großeltern': '👴👵',
        'Tante/Onkel': '👨‍👩‍👧',
        'Cousin/Cousine': '👥',
        'Freunde': '🤝',
        'Kollegen': '💼',
        'Nachbarn': '🏠',
        'Partner': '💕',
        'Kinder': '👶'
    };
    
    return icons[type] || '👥';
}

// =============================================================================
// Überschreibe addRelationship für bessere Benachrichtigungen
// =============================================================================

const originalAddRelationship = window.addRelationship;
window.addRelationship = async function(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const guest1Id = parseInt(formData.get('guest1_id'));
    const guest2Id = parseInt(formData.get('guest2_id'));
    const relationshipType = formData.get('relationship_type');
    const relationshipStrength = parseInt(formData.get('relationship_strength'));
    
    // Validierung
    if (guest1Id === guest2Id) {
        if (typeof showError === 'function') {
            showError('Ein Gast kann keine Beziehung zu sich selbst haben!');
        } else {
            alert('Ein Gast kann keine Beziehung zu sich selbst haben!');
        }
        return;
    }
    
    try {
        // API prüfen
        if (!window.TischplanungAPI) {
            throw new Error('Tischplanung API nicht verfügbar');
        }

        const result = await window.TischplanungAPI.saveRelationship({
            gast_id_1: guest1Id,  // Backend erwartet gast_id_1
            gast_id_2: guest2Id,  // Backend erwartet gast_id_2
            beziehungstyp: relationshipType,  // Backend erwartet beziehungstyp
            staerke: relationshipStrength  // Benutzer-definierte Stärke
        });
        
        if (result.success) {
            // Erfolg melden
            if (typeof showSuccess === 'function') {
                showSuccess('Beziehung erfolgreich hinzugefügt!');
            }
            
            // Formular zurücksetzen
            form.reset();
            
            // Liste aktualisieren
            if (typeof refreshRelationshipsList === 'function') {
                await refreshRelationshipsList();
            }
            
        } else {
            const errorMsg = 'Fehler beim Hinzufügen der Beziehung: ' + (result.error || 'Unbekannter Fehler');
            if (typeof showError === 'function') {
                showError(errorMsg);
            } else {
                alert(errorMsg);
            }
        }
        
    } catch (error) {
        console.error('Fehler beim Hinzufügen der Beziehung:', error);
        const errorMsg = 'Fehler beim Hinzufügen der Beziehung: ' + error.message;
        if (typeof showError === 'function') {
            showError(errorMsg);
        } else {
            alert(errorMsg);
        }
    }
};





