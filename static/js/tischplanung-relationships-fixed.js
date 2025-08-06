/* =============================================================================
   Hochzeitsplaner - Beziehungsmanagement (Korrigierte Version)
   Integriert Website-Benachrichtigungssystem und behebt Delete-Funktionalität
   ============================================================================= */

// =============================================================================
// Beziehungsübersicht Modal
// =============================================================================

/**
 * Zeigt die Beziehungsübersicht in einem Modal an
 */
async function showRelationshipsOverview() {
    console.log('showRelationshipsOverview wird aufgerufen');
    
    // Modal erstellen falls nicht vorhanden
    let modal = document.getElementById('relationshipsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'relationshipsModal';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-heart"></i> Beziehungsübersicht
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="relationshipsModalBody">
                        <div class="text-center">
                            <i class="fas fa-spinner fa-spin fa-2x"></i>
                            <p class="mt-2">Lade Beziehungen...</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Modal anzeigen
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();

    // Daten laden
    const modalBody = document.getElementById('relationshipsModalBody');
    
    try {
        // API prüfen
        if (!window.TischplanungAPI) {
            throw new Error('Tischplanung API nicht verfügbar');
        }

        // Gäste und Beziehungen laden
        const [guests, relationships] = await Promise.all([
            window.TischplanungAPI.getGuests(),
            window.TischplanungAPI.getRelationships()
        ]);

        console.log('Geladene Gäste:', guests);
        console.log('Geladene Beziehungen:', relationships);

        // Inhalt generieren
        modalBody.innerHTML = generateRelationshipsContent(guests, relationships);
        
    } catch (error) {
        console.error('Fehler beim Laden der Beziehungen:', error);
        
        // Website-Benachrichtigung verwenden wenn verfügbar
        if (typeof showError === 'function') {
            showError('Fehler beim Laden der Beziehungen: ' + error.message);
        } else {
            alert('Fehler beim Laden der Beziehungen: ' + error.message);
        }
        
        // Fallback für Fehlerzustand
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Fehler beim Laden der Beziehungen: ${error.message}
            </div>
            <button type="button" class="btn btn-primary" onclick="showRelationshipsOverview()">
                <i class="fas fa-redo"></i> Erneut versuchen
            </button>
        `;
    }
}

/**
 * Generiert den HTML-Inhalt für die Beziehungsübersicht
 */
function generateRelationshipsContent(guests, relationships) {
    const content = `
        <div class="row">
            <div class="col-md-8">
                <h6><i class="fas fa-list"></i> Bestehende Beziehungen</h6>
                <div id="relationshipsList">
                    ${generateRelationshipsList(guests, relationships)}
                </div>
            </div>
            <div class="col-md-4">
                <h6><i class="fas fa-plus"></i> Neue Beziehung hinzufügen</h6>
                <div id="addRelationshipForm">
                    ${generateAddRelationshipForm(guests)}
                </div>
            </div>
        </div>
    `;
    
    return content;
}

/**
 * Generiert die Liste der Beziehungen
 */
function generateRelationshipsList(guests, relationships) {
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
        const guest1 = guestMap[rel.guest1_id];
        const guest2 = guestMap[rel.guest2_id];
        
        let guest1Name = 'Unbekannt';
        let guest2Name = 'Unbekannt';
        
        if (rel.guest1_id === -1) {
            guest1Name = window.WEDDING_COUPLE_NAME || 'Brautpaar';
        } else if (guest1) {
            guest1Name = `${guest1.vorname} ${guest1.nachname}`;
        }
        
        if (rel.guest2_id === -1) {
            guest2Name = window.WEDDING_COUPLE_NAME || 'Brautpaar';
        } else if (guest2) {
            guest2Name = `${guest2.vorname} ${guest2.nachname}`;
        }

        const relationshipIcon = getRelationshipIcon(rel.relationship_type);
        
        html += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${guest1Name}</strong>
                    <span class="mx-2">${relationshipIcon} ${rel.relationship_type}</span>
                    <strong>${guest2Name}</strong>
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
}

/**
 * Generiert das Formular zum Hinzufügen einer neuen Beziehung
 */
function generateAddRelationshipForm(guests) {
    // Dropdown-Optionen für Gäste generieren
    let guestOptions = '<option value="">Gast wählen...</option>';
    
    // Brautpaar-Option hinzufügen
    if (window.WEDDING_COUPLE_NAME) {
        guestOptions += `<option value="-1">${window.WEDDING_COUPLE_NAME}</option>`;
    }
    
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
                    <option value="Trauzeuge/in">Trauzeuge/in</option>
                    <option value="Eltern">Eltern</option>
                    <option value="Geschwister">Geschwister</option>
                    <option value="Großeltern">Großeltern</option>
                    <option value="Tante/Onkel">Tante/Onkel</option>
                    <option value="Cousin/Cousine">Cousin/Cousine</option>
                    <option value="Freunde">Freunde</option>
                    <option value="Kollegen">Kollegen</option>
                    <option value="Nachbarn">Nachbarn</option>
                    <option value="Partner">Partner</option>
                    <option value="Kinder">Kinder</option>
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
}

/**
 * Icon für Beziehungstyp ermitteln
 */
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
// Beziehungsmanagement Funktionen
// =============================================================================

/**
 * Fügt eine neue Beziehung hinzu
 */
async function addRelationship(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const guest1Id = parseInt(formData.get('guest1_id'));
    const guest2Id = parseInt(formData.get('guest2_id'));
    const relationshipType = formData.get('relationship_type');
    
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
            guest1_id: guest1Id,
            guest2_id: guest2Id,
            relationship_type: relationshipType
        });
        
        if (result.success) {
            // Erfolg melden
            if (typeof showSuccess === 'function') {
                showSuccess('Beziehung erfolgreich hinzugefügt!');
            }
            
            // Formular zurücksetzen
            form.reset();
            
            // Liste aktualisieren
            await refreshRelationshipsList();
            
        } else {
            if (typeof showError === 'function') {
                showError('Fehler beim Hinzufügen der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            } else {
                alert('Fehler beim Hinzufügen der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            }
        }
        
    } catch (error) {
        console.error('Fehler beim Hinzufügen der Beziehung:', error);
        if (typeof showError === 'function') {
            showError('Fehler beim Hinzufügen der Beziehung: ' + error.message);
        } else {
            alert('Fehler beim Hinzufügen der Beziehung: ' + error.message);
        }
    }
}

/**
 * Sichere Delete-Funktion mit Bestätigung und korrekter Fehlerbehandlung
 */
async function deleteRelationshipSafe(relationshipId) {
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
        
        if (result.success) {
            // Erfolg melden
            if (typeof showSuccess === 'function') {
                showSuccess('Beziehung erfolgreich gelöscht!');
            }
            
            // Liste aktualisieren
            await refreshRelationshipsList();
            
        } else {
            console.error('Delete-Fehler:', result);
            if (typeof showError === 'function') {
                showError('Fehler beim Löschen der Beziehung: ' + (result.error || result.message || 'Unbekannter Fehler'));
            } else {
                alert('Fehler beim Löschen der Beziehung: ' + (result.error || result.message || 'Unbekannter Fehler'));
            }
        }
        
    } catch (error) {
        console.error('Fehler beim Löschen der Beziehung:', error);
        if (typeof showError === 'function') {
            showError('Fehler beim Löschen der Beziehung: ' + error.message);
        } else {
            alert('Fehler beim Löschen der Beziehung: ' + error.message);
        }
    }
}

/**
 * Aktualisiert die Beziehungsliste ohne das ganze Modal neu zu laden
 */
async function refreshRelationshipsList() {
    try {
        const [guests, relationships] = await Promise.all([
            window.TischplanungAPI.getGuests(),
            window.TischplanungAPI.getRelationships()
        ]);

        const relationshipsList = document.getElementById('relationshipsList');
        if (relationshipsList) {
            relationshipsList.innerHTML = generateRelationshipsList(guests, relationships);
        }
        
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Beziehungen:', error);
        if (typeof showError === 'function') {
            showError('Fehler beim Aktualisieren der Beziehungen: ' + error.message);
        } else {
            alert('Fehler beim Aktualisieren der Beziehungen: ' + error.message);
        }
    }
}

// =============================================================================
// Globale Funktionen für Abwärtskompatibilität
// =============================================================================

// Die ursprüngliche showRelationshipsOverview Funktion überschreiben
window.showRelationshipsOverview = showRelationshipsOverview;

// Delete-Funktion global verfügbar machen
window.deleteRelationshipSafe = deleteRelationshipSafe;

console.log('Tischplanung Relationships (Fixed) - geladen');
