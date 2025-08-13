// Verbesserte Tischplanungs-API-Funktionen für das Beziehungsmanagement

// Hinweis: Die API-Funktionen wurden in die tischplanung-api.js verschoben

// Globale Funktion für die Beziehungsübersicht
// Diese Funktion ersetzt die bestehende showRelationshipsOverview-Funktion
function showRelationshipsOverview() {







    // Fallback für Brautpaar-Namen falls window.WEDDING_COUPLE_NAME nicht gesetzt ist
    let weddingCoupleName = window.WEDDING_COUPLE_NAME;
    if (!weddingCoupleName || weddingCoupleName === " & " || weddingCoupleName.trim() === "&" || weddingCoupleName === "Braut & Bräutigam") {
        // Versuche zuerst englische Namen (aber nicht die Standardwerte)
        if (window.BRIDE_NAME && window.GROOM_NAME && 
            window.BRIDE_NAME !== 'Braut' && window.GROOM_NAME !== 'Bräutigam') {
            weddingCoupleName = `${window.BRIDE_NAME} & ${window.GROOM_NAME}`;
        }
        // Dann deutsche Namen als Fallback (aber nicht die Standardwerte)
        else if (window.BRAUT_NAME && window.BRAEUTIGAM_NAME && 
                 window.BRAUT_NAME !== 'Braut' && window.BRAEUTIGAM_NAME !== 'Bräutigam') {
            weddingCoupleName = `${window.BRAUT_NAME} & ${window.BRAEUTIGAM_NAME}`;
        }
        // Letzter Fallback
        else {
            weddingCoupleName = 'Brautpaar';
        }

    }

    // Prüfen, ob das tischplanung-Objekt existiert
    if (!window.tischplanung) {

        return;
    }

    // Prüfen, ob Beziehungen geladen wurden
    if (!window.tischplanung.relationships) {
        window.tischplanung.relationships = [];
    }

    // Entfernen eines bestehenden Modals (falls vorhanden)
    const existingModal = document.getElementById('relationshipModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Modal-HTML erstellen
    const modalHTML = `
        <div class="modal fade modal-wedding" id="relationshipModal" tabindex="-1" aria-labelledby="relationshipModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="relationshipModalLabel"><i class="bi bi-heart me-2"></i>Beziehungen verwalten</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                    </div>
                    <div class="modal-body" id="relationshipModalContent">
                        <!-- Wird dynamisch gefüllt -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Schließen</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Modal zum DOM hinzufügen
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modalContent = document.getElementById('relationshipModalContent');
    
    // Beziehungen nach Typ gruppieren
    const groupedRelations = {};
    const relationships = window.tischplanung.relationships || [];
    
    relationships.forEach(rel => {
        if (!groupedRelations[rel.beziehungstyp]) {
            groupedRelations[rel.beziehungstyp] = [];
        }
        groupedRelations[rel.beziehungstyp].push(rel);
    });
    
    const totalRelations = relationships.length;
    const positiveRelations = relationships.filter(r => r.staerke > 0).length;
    const negativeRelations = relationships.filter(r => r.staerke < 0).length;

    // Funktion zum Formatieren des Beziehungstyps
    function formatRelationshipType(type) {
        const types = {
            'familie': '👨‍👩‍👧‍👦 Familie',
            'beste_freunde': '💯 Beste Freunde',
            'freunde': '😊 Freunde',
            'partner': '💑 Partner',
            'ex_partner': '💔 Ex-Partner',
            'studienfreunde': '🎓 Studienfreunde',
            'kollegen': '💼 Kollegen',
            'ehemalige_kollegen': '📋 Ehemalige Kollegen',
            'nachbarn': '🏠 Nachbarn',
            'verwandte': '👥 Verwandte',
            'sportverein': '⚽ Sportverein',
            'hobby': '🎨 Hobby-Partner',
            'geschaeftlich': '🤝 Geschäftlich',
            'bekannte': '👋 Bekannte',
            'konflikt': '⚡ Konflikt',
            'trauzeugen': '👰‍♀️ Trauzeugen',
            // Fallback für alte Kategorien
            'family': '👨‍👩‍👧‍👦 Familie',
            'friends': '😊 Freunde',
            'colleagues': '💼 Kollegen',
            'couple': '💑 Partner',
            'acquaintances': '👋 Bekannte',
            'rivals': '⚡ Konflikt',
            'wedding_couple': '💒 Brautpaar'
        };
        return types[type] || type;
    }
    
    // Inhalt erstellen
    const contentHTML = `
        <div class="mb-4">
            <h5 class="text-wedding"><i class="bi bi-heart-fill me-2"></i>Beziehungsübersicht</h5>
            <div class="row text-center">
                <div class="col-md-3">
                    <div class="card card-wedding">
                        <div class="card-body">
                            <h4 class="text-wedding">${totalRelations}</h4>
                            <small class="text-wedding">Gesamt</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-wedding-success">
                        <div class="card-body">
                            <h4 style="color: #d4af37;">${positiveRelations}</h4>
                            <small>Positiv</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-wedding-danger">
                        <div class="card-body">
                            <h4 style="color: #8b7355;">${negativeRelations}</h4>
                            <small>Negativ</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-wedding">
                        <div class="card-body">
                            <h4 class="text-wedding">${totalRelations - positiveRelations - negativeRelations}</h4>
                            <small class="text-wedding">Neutral</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Formular zum Hinzufügen neuer Beziehungen erstellen
    const formHTML = `
        <div class="mb-4 p-3 border rounded">
            <h5><i class="bi bi-plus-circle me-2"></i>Neue Beziehung hinzufügen</h5>
            <form id="newRelationshipForm">
                <div class="row mb-3">
                    <div class="col-md-5">
                        <label for="guest1Select" class="form-label">Person 1</label>
                        <select class="form-select" id="guest1Select" required>
                            <option value="">Person auswählen...</option>
                            <option value="brautpaar" style="font-weight: bold; color: #d63384;">💒 ${weddingCoupleName}</option>
                            <optgroup label="Alle Gäste">
                                ${window.tischplanung.guests.map(guest => 
                                    `<option value="${guest.id}">${guest.vorname} ${guest.nachname || ''}</option>`
                                ).join('')}
                            </optgroup>
                        </select>
                    </div>
                    <div class="col-md-5">
                        <label for="guest2Select" class="form-label">Person 2</label>
                        <select class="form-select" id="guest2Select" required>
                            <option value="">Person auswählen...</option>
                            <option value="brautpaar" style="font-weight: bold; color: #d63384;">💒 ${weddingCoupleName}</option>
                            <optgroup label="Alle Gäste">
                                ${window.tischplanung.guests.map(guest => 
                                    `<option value="${guest.id}">${guest.vorname} ${guest.nachname || ''}</option>`
                                ).join('')}
                            </optgroup>
                        </select>
                    </div>
                </div>
                <div class="row mb-3">
                    <div class="col-md-4">
                        <label for="relationshipType" class="form-label">Beziehungstyp</label>
                        <select class="form-select" id="relationshipType" required>
                            <option value="">Typ auswählen...</option>
                            <optgroup label="👨‍👩‍👧‍👦 Familie & Partner">
                                <option value="familie">👨‍👩‍👧‍👦 Familie</option>
                                <option value="verwandte">👥 Verwandte</option>
                                <option value="partner">💑 Partner</option>
                                <option value="ex_partner">💔 Ex-Partner</option>
                            </optgroup>
                            <optgroup label="😊 Freunde">
                                <option value="beste_freunde">💯 Beste Freunde</option>
                                <option value="freunde">😊 Freunde</option>
                                <option value="studienfreunde">🎓 Studienfreunde</option>
                            </optgroup>
                            <optgroup label="💼 Beruf & Hobby">
                                <option value="kollegen">💼 Kollegen</option>
                                <option value="ehemalige_kollegen">📋 Ehemalige Kollegen</option>
                                <option value="geschaeftlich">🤝 Geschäftlich</option>
                                <option value="sportverein">⚽ Sportverein</option>
                                <option value="hobby">🎨 Hobby-Partner</option>
                            </optgroup>
                            <optgroup label="🏠 Nachbarschaft & Bekannte">
                                <option value="nachbarn">🏠 Nachbarn</option>
                                <option value="bekannte">👋 Bekannte</option>
                                <option value="neutral">😐 Neutral</option>
                            </optgroup>
                            <optgroup label="😤 Problematisch">
                                <option value="spinnen_sich_nicht">😤 Spinnen sich nicht</option>
                                <option value="konflikt">⚡ Konflikt</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label for="relationshipStrength" class="form-label">Stärke</label>
                        <input type="range" class="form-range" min="-5" max="5" value="0" id="relationshipStrength">
                        <div class="d-flex justify-content-between">
                            <span style="color: #8b7355;">-5</span>
                            <span>0</span>
                            <span style="color: #d4af37;">+5</span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label for="relationshipNotes" class="form-label">Notizen</label>
                        <input type="text" class="form-control" id="relationshipNotes" placeholder="Optionale Notizen">
                    </div>
                </div>
                <div class="d-flex justify-content-end">
                    <button type="button" class="btn btn-wedding-primary" onclick="saveNewRelationship()">
                        <i class="bi bi-plus-circle me-1"></i>Beziehung hinzufügen
                    </button>
                </div>
            </form>
        </div>`;

    // Bestehende Beziehungen anzeigen (wenn vorhanden)
    let relationshipsHTML = '';
    
    if (totalRelations > 0) {
        relationshipsHTML = `
            <div class="accordion" id="relationshipsAccordion">
                ${Object.keys(groupedRelations).map((type, index) => `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading${index}">
                            <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" 
                                    data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                                ${formatRelationshipType(type)} 
                                <span class="badge badge-wedding-primary ms-2">${groupedRelations[type].length}</span>
                            </button>
                        </h2>
                        <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                             data-bs-parent="#relationshipsAccordion">
                            <div class="accordion-body">
                                ${groupedRelations[type].map(rel => {
                                    const guest1 = window.tischplanung.guests.find(g => g.id === rel.gast_id_1);
                                    const guest2 = window.tischplanung.guests.find(g => g.id === rel.gast_id_2);
                                    
                                    // Spezielle Behandlung für Brautpaar-ID (-1)
                                    let guest1Name, guest2Name;
                                    
                                    if (rel.gast_id_1 === -1) {
                                        guest1Name = weddingCoupleName;
                                    } else if (guest1) {
                                        guest1Name = `${guest1.vorname} ${guest1.nachname || ''}`;
                                    } else {
                                        guest1Name = rel.gast1_name || 'Unbekannt';
                                    }
                                    
                                    if (rel.gast_id_2 === -1) {
                                        guest2Name = weddingCoupleName;
                                    } else if (guest2) {
                                        guest2Name = `${guest2.vorname} ${guest2.nachname || ''}`;
                                    } else {
                                        guest2Name = rel.gast2_name || 'Unbekannt';
                                    }
                                    
                                    const strengthColor = rel.staerke > 0 ? 'wedding-success' : rel.staerke < 0 ? 'wedding-danger' : 'wedding-secondary';
                                    
                                    return `
                                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                                            <div>
                                                <strong>${guest1Name}</strong> ↔ <strong>${guest2Name}</strong>
                                                ${rel.notizen ? `<br><small style="color: #8b7355;">📝 ${rel.notizen}</small>` : ''}
                                            </div>
                                            <div>
                                                <span class="badge badge-${strengthColor}">${rel.staerke}</span>
                                                <button class="btn btn-sm btn-wedding-secondary ms-2" 
                                                        onclick="editRelationship(${rel.id})" 
                                                        title="Bearbeiten">
                                                    <i class="bi bi-pencil"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        relationshipsHTML = `
            <div class="alert alert-info">
                Noch keine Beziehungen definiert. Fügen Sie mit dem Formular oben eine neue Beziehung hinzu.
            </div>
        `;
    }

    // Alles zusammenführen
    modalContent.innerHTML = contentHTML + formHTML + relationshipsHTML;

    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('relationshipModal'));
    
    // Event-Handler zum Aufräumen beim Schließen
    document.getElementById('relationshipModal').addEventListener('hidden.bs.modal', function () {
        // Modal DOM-Element entfernen
        this.remove();
    });
    
    modal.show();

}

// Funktion zum Speichern einer neuen Beziehung
async function saveNewRelationship() {
    const guest1Id = document.getElementById('guest1Select').value;
    const guest2Id = document.getElementById('guest2Select').value;
    const relationshipType = document.getElementById('relationshipType').value;
    const strength = parseInt(document.getElementById('relationshipStrength').value);
    const notes = document.getElementById('relationshipNotes').value;



    // Validierung
    if (!guest1Id || !guest2Id) {
        if (window.showWarning) {
            window.showWarning('Bitte wählen Sie beide Beziehungspartner aus.');
        } else {
            alert('Bitte wählen Sie beide Beziehungspartner aus.');
        }
        return;
    }
    
    if (guest1Id === guest2Id && guest1Id !== 'brautpaar') {
        if (window.showWarning) {
            window.showWarning('Bitte wählen Sie zwei unterschiedliche Gäste aus.');
        } else {
            alert('Bitte wählen Sie zwei unterschiedliche Gäste aus.');
        }
        return;
    }
    
    if (guest1Id === 'brautpaar' && guest2Id === 'brautpaar') {
        if (window.showWarning) {
            window.showWarning('Bitte wählen Sie einen Gast zusätzlich zum Brautpaar.');
        } else {
            alert('Bitte wählen Sie einen Gast zusätzlich zum Brautpaar.');
        }
        return;
    }

    if (!relationshipType) {
        if (window.showWarning) {
            window.showWarning('Bitte wählen Sie einen Beziehungstyp.');
        } else {
            alert('Bitte wählen Sie einen Beziehungstyp.');
        }
        return;
    }

    try {
        // API prüfen
        if (!window.TischplanungAPI) {
            throw new Error('Tischplanung API nicht verfügbar');
        }
        
        // Spezialbehandlung für Brautpaar
        // Im Backend kann "brautpaar" nicht direkt als ID verwendet werden, daher verwenden wir spezielle IDs
        const brautpaarId = -1; // Spezielle ID für das Brautpaar

        let finalGuest1Id = guest1Id === 'brautpaar' ? brautpaarId : parseInt(guest1Id);
        let finalGuest2Id = guest2Id === 'brautpaar' ? brautpaarId : parseInt(guest2Id);

        const relationshipData = {
            gast_id_1: finalGuest1Id,
            gast_id_2: finalGuest2Id,
            beziehungstyp: relationshipType,
            staerke: strength,
            notizen: notes
        };


        
        // Modal schließen, bevor wir die Beziehung speichern
        const modalElement = document.getElementById('relationshipModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }
        
        // Beziehung speichern
        const result = await window.TischplanungAPI.saveRelationship(relationshipData);
        
        if (result && !result.error) {
            // Daten neu laden
            await window.tischplanung.loadRelationships();
            
            // Erfolgsmeldung anzeigen
            if (window.showSuccess) {
                window.showSuccess('Beziehung erfolgreich gespeichert!');
            } else {
                alert('Beziehung erfolgreich gespeichert!');
            }
            
            // Modal nicht automatisch wieder öffnen
            // setTimeout(() => showRelationshipsOverview(), 500);
        } else {
            if (window.showError) {
                window.showError('Fehler beim Speichern der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            } else {
                alert('Fehler beim Speichern der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            }
        }
    } catch (error) {

        if (window.showError) {
            window.showError('Ein Fehler ist aufgetreten: ' + error.message);
        } else {
            alert('Ein Fehler ist aufgetreten: ' + error.message);
        }
    }
}

// Funktion zum Bearbeiten einer bestehenden Beziehung
async function editRelationship(relationshipId) {
    try {
        // Finde die Beziehung in den geladenen Daten
        const relationship = window.tischplanung.relationships.find(rel => rel.id === relationshipId);
        if (!relationship) {
            if (window.showError) {
                window.showError('Beziehung nicht gefunden.');
            } else {
                alert('Beziehung nicht gefunden.');
            }
            return;
        }

        // Beziehungsübersicht-Modal schließen
        const existingModal = document.getElementById('relationshipModal');
        if (existingModal) {
            const modalInstance = bootstrap.Modal.getInstance(existingModal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }

        // Edit-Modal erstellen
        const editModalHTML = `
            <div class="modal fade modal-wedding" id="editRelationshipModal" tabindex="-1" aria-labelledby="editRelationshipModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editRelationshipModalLabel">
                                <i class="bi bi-pencil me-2"></i>Beziehung bearbeiten
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editRelationshipForm">
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label for="editGuest1Select" class="form-label">Person 1</label>
                                        <select class="form-select" id="editGuest1Select" required>
                                            <option value="">Person auswählen...</option>
                                            <option value="brautpaar" ${relationship.gast_id_1 === -1 ? 'selected' : ''} style="font-weight: bold; color: #d63384;">💒 ${weddingCoupleName}</option>
                                            <optgroup label="Alle Gäste">
                                                ${window.tischplanung.guests.map(guest => 
                                                    `<option value="${guest.id}" ${guest.id === relationship.gast_id_1 ? 'selected' : ''}>${guest.vorname} ${guest.nachname || ''}</option>`
                                                ).join('')}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="editGuest2Select" class="form-label">Person 2</label>
                                        <select class="form-select" id="editGuest2Select" required>
                                            <option value="">Person auswählen...</option>
                                            <option value="brautpaar" ${relationship.gast_id_2 === -1 ? 'selected' : ''} style="font-weight: bold; color: #d63384;">💒 ${weddingCoupleName}</option>
                                            <optgroup label="Alle Gäste">
                                                ${window.tischplanung.guests.map(guest => 
                                                    `<option value="${guest.id}" ${guest.id === relationship.gast_id_2 ? 'selected' : ''}>${guest.vorname} ${guest.nachname || ''}</option>`
                                                ).join('')}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <label for="editRelationshipType" class="form-label">Beziehungstyp</label>
                                        <select class="form-select" id="editRelationshipType" required>
                                            <option value="">Typ auswählen...</option>
                                            <optgroup label="👨‍👩‍👧‍👦 Familie & Partner">
                                                <option value="familie" ${relationship.beziehungstyp === 'familie' ? 'selected' : ''}>👨‍👩‍👧‍👦 Familie</option>
                                                <option value="verwandte" ${relationship.beziehungstyp === 'verwandte' ? 'selected' : ''}>👥 Verwandte</option>
                                                <option value="partner" ${relationship.beziehungstyp === 'partner' ? 'selected' : ''}>💑 Partner</option>
                                                <option value="ex_partner" ${relationship.beziehungstyp === 'ex_partner' ? 'selected' : ''}>💔 Ex-Partner</option>
                                            </optgroup>
                                            <optgroup label="😊 Freunde">
                                                <option value="beste_freunde" ${relationship.beziehungstyp === 'beste_freunde' ? 'selected' : ''}>💯 Beste Freunde</option>
                                                <option value="freunde" ${relationship.beziehungstyp === 'freunde' ? 'selected' : ''}>😊 Freunde</option>
                                                <option value="studienfreunde" ${relationship.beziehungstyp === 'studienfreunde' ? 'selected' : ''}>🎓 Studienfreunde</option>
                                            </optgroup>
                                            <optgroup label="💼 Beruf & Hobby">
                                                <option value="kollegen" ${relationship.beziehungstyp === 'kollegen' ? 'selected' : ''}>💼 Kollegen</option>
                                                <option value="ehemalige_kollegen" ${relationship.beziehungstyp === 'ehemalige_kollegen' ? 'selected' : ''}>📋 Ehemalige Kollegen</option>
                                                <option value="geschaeftlich" ${relationship.beziehungstyp === 'geschaeftlich' ? 'selected' : ''}>🤝 Geschäftlich</option>
                                                <option value="sportverein" ${relationship.beziehungstyp === 'sportverein' ? 'selected' : ''}>⚽ Sportverein</option>
                                                <option value="hobby" ${relationship.beziehungstyp === 'hobby' ? 'selected' : ''}>🎨 Hobby-Partner</option>
                                            </optgroup>
                                            <optgroup label="🏠 Nachbarschaft & Bekannte">
                                                <option value="nachbarn" ${relationship.beziehungstyp === 'nachbarn' ? 'selected' : ''}>🏠 Nachbarn</option>
                                                <option value="bekannte" ${relationship.beziehungstyp === 'bekannte' ? 'selected' : ''}>👋 Bekannte</option>
                                                <option value="neutral" ${relationship.beziehungstyp === 'neutral' ? 'selected' : ''}>😐 Neutral</option>
                                            </optgroup>
                                            <optgroup label="😤 Problematisch">
                                                <option value="spinnen_sich_nicht" ${relationship.beziehungstyp === 'spinnen_sich_nicht' ? 'selected' : ''}>😤 Spinnen sich nicht</option>
                                                <option value="konflikt" ${relationship.beziehungstyp === 'konflikt' ? 'selected' : ''}>⚡ Konflikt</option>
                                            </optgroup>
                                            <!-- Fallback für alte Kategorien -->
                                            <option value="family" ${relationship.beziehungstyp === 'family' ? 'selected' : ''}>Familie (alt)</option>
                                            <option value="friends" ${relationship.beziehungstyp === 'friends' ? 'selected' : ''}>Freunde (alt)</option>
                                            <option value="colleagues" ${relationship.beziehungstyp === 'colleagues' ? 'selected' : ''}>Kollegen (alt)</option>
                                            <option value="couple" ${relationship.beziehungstyp === 'couple' ? 'selected' : ''}>Paar (alt)</option>
                                            <option value="acquaintances" ${relationship.beziehungstyp === 'acquaintances' ? 'selected' : ''}>Bekannte (alt)</option>
                                            <option value="rivals" ${relationship.beziehungstyp === 'rivals' ? 'selected' : ''}>Rivalen (alt)</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label for="editRelationshipStrength" class="form-label">Stärke</label>
                                        <input type="range" class="form-range" id="editRelationshipStrength" 
                                               min="-5" max="5" value="${relationship.staerke}" 
                                               oninput="document.getElementById('editStrengthValue').textContent = this.value">
                                        <div class="text-center">
                                            <span class="badge badge-wedding" id="editStrengthValue">${relationship.staerke}</span>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <label for="editRelationshipNotes" class="form-label">Notizen</label>
                                        <input type="text" class="form-control" id="editRelationshipNotes" 
                                               placeholder="Optionale Notizen" value="${relationship.notizen || ''}">
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-wedding-danger me-auto" onclick="deleteRelationship(${relationshipId})">
                                <i class="bi bi-trash me-1"></i>Löschen
                            </button>
                            <button type="button" class="btn btn-wedding-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-wedding-primary" onclick="saveEditedRelationship(${relationshipId})">
                                <i class="bi bi-check-circle me-1"></i>Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bestehendes Edit-Modal entfernen
        const existingEditModal = document.getElementById('editRelationshipModal');
        if (existingEditModal) {
            existingEditModal.remove();
        }

        // Edit-Modal zum DOM hinzufügen
        document.body.insertAdjacentHTML('beforeend', editModalHTML);

        // Modal anzeigen
        const editModal = new bootstrap.Modal(document.getElementById('editRelationshipModal'));
        
        // Event-Handler zum Aufräumen beim Schließen
        document.getElementById('editRelationshipModal').addEventListener('hidden.bs.modal', function () {
            // Modal DOM-Element entfernen
            this.remove();
        });
        
        editModal.show();

    } catch (error) {

        if (window.showError) {
            window.showError('Fehler beim Öffnen des Bearbeitungsformulars: ' + error.message);
        } else {
            alert('Fehler beim Öffnen des Bearbeitungsformulars: ' + error.message);
        }
    }
}

// Funktion zum Speichern der bearbeiteten Beziehung
async function saveEditedRelationship(relationshipId) {
    try {
        const guest1Id = document.getElementById('editGuest1Select').value;
        const guest2Id = document.getElementById('editGuest2Select').value;
        const relationshipType = document.getElementById('editRelationshipType').value;
        const strength = parseInt(document.getElementById('editRelationshipStrength').value);
        const notes = document.getElementById('editRelationshipNotes').value;



        // Validierung
        if (!guest1Id || !guest2Id) {
            if (window.showWarning) {
                window.showWarning('Bitte wählen Sie beide Beziehungspartner aus.');
            } else {
                alert('Bitte wählen Sie beide Beziehungspartner aus.');
            }
            return;
        }

        if (!relationshipType) {
            if (window.showWarning) {
                window.showWarning('Bitte wählen Sie einen Beziehungstyp.');
            } else {
                alert('Bitte wählen Sie einen Beziehungstyp.');
            }
            return;
        }

        // Spezialbehandlung für Brautpaar
        const brautpaarId = -1;
        let finalGuest1Id = guest1Id === 'brautpaar' ? brautpaarId : parseInt(guest1Id);
        let finalGuest2Id = guest2Id === 'brautpaar' ? brautpaarId : parseInt(guest2Id);

        const relationshipData = {
            gast_id_1: finalGuest1Id,
            gast_id_2: finalGuest2Id,
            beziehungstyp: relationshipType,
            staerke: strength,
            notizen: notes
        };

        // Modal schließen
        const editModalElement = document.getElementById('editRelationshipModal');
        const editModalInstance = bootstrap.Modal.getInstance(editModalElement);
        if (editModalInstance) {
            editModalInstance.hide();
        }

        // Beziehung aktualisieren
        const result = await window.TischplanungAPI.updateRelationship(relationshipId, relationshipData);

        if (result && !result.error) {
            // Daten neu laden
            await window.tischplanung.loadRelationships();
            
            if (window.showSuccess) {
                window.showSuccess('Beziehung erfolgreich aktualisiert!');
            } else {
                alert('Beziehung erfolgreich aktualisiert!');
            }
            
            // Modal nicht automatisch wieder öffnen
            // setTimeout(() => showRelationshipsOverview(), 500);
        } else {
            if (window.showError) {
                window.showError('Fehler beim Aktualisieren der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            } else {
                alert('Fehler beim Aktualisieren der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            }
        }

    } catch (error) {

        if (window.showError) {
            window.showError('Ein Fehler ist aufgetreten: ' + error.message);
        } else {
            alert('Ein Fehler ist aufgetreten: ' + error.message);
        }
    }
}

// Funktion zum Löschen einer Beziehung
async function deleteRelationship(relationshipId) {
    try {

        
        // API prüfen
        if (!window.TischplanungAPI) {
            throw new Error('Tischplanung API nicht verfügbar');
        }

        // Modal schließen
        const editModalElement = document.getElementById('editRelationshipModal');
        const editModalInstance = bootstrap.Modal.getInstance(editModalElement);
        if (editModalInstance) {
            editModalInstance.hide();
        }


        const result = await window.TischplanungAPI.deleteRelationship(relationshipId);


        if (result.success) {
            // Erfolg melden
            if (window.showSuccess) {
                window.showSuccess('Beziehung erfolgreich gelöscht!');
            } else {
                alert('Beziehung erfolgreich gelöscht!');
            }
            
            // Daten neu laden
            await window.tischplanung.loadRelationships();
            
            // Modal nicht automatisch wieder öffnen
            // setTimeout(() => showRelationshipsOverview(), 500);
        } else {

            const errorMessage = result.error || result.message || 'Unbekannter Fehler';

            
            if (window.showError) {
                window.showError('Fehler beim Löschen der Beziehung: ' + errorMessage);
            } else {
                alert('Fehler beim Löschen der Beziehung: ' + errorMessage);
            }
        }

    } catch (error) {

        if (window.showError) {
            window.showError('Ein Fehler ist aufgetreten: ' + error.message);
        } else {
            alert('Ein Fehler ist aufgetreten: ' + error.message);
        }
    }
}

// Sichere Delete-Funktion für direkte Verwendung (Kompatibilität mit Fixed-Version)
async function deleteRelationshipSafe(relationshipId) {
    return await deleteRelationship(relationshipId);
}

// =============================================================================
// Globale Funktionen für Abwärtskompatibilität
// =============================================================================

// Die ursprüngliche showRelationshipsOverview Funktion überschreiben
window.showRelationshipsOverview = showRelationshipsOverview;

// Delete-Funktionen global verfügbar machen
window.deleteRelationship = deleteRelationship;
window.deleteRelationshipSafe = deleteRelationshipSafe;

// Weitere Funktionen exportieren
window.saveNewRelationship = saveNewRelationship;
window.editRelationship = editRelationship;
window.saveEditedRelationship = saveEditedRelationship;



