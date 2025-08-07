// Verbesserte Tischplanungs-API-Funktionen für das Beziehungsmanagement

// Hinweis: Die API-Funktionen wurden in die tischplanung-api.js verschoben

// Globale Funktion für die Beziehungsübersicht
// Diese Funktion ersetzt die bestehende showRelationshipsOverview-Funktion
function showRelationshipsOverview() {
    console.log("Beziehungsübersicht wird angezeigt...");
    console.log("Debug - window.WEDDING_COUPLE_NAME:", window.WEDDING_COUPLE_NAME);
    console.log("Debug - window.BRIDE_NAME:", window.BRIDE_NAME);
    console.log("Debug - window.GROOM_NAME:", window.GROOM_NAME);
    console.log("Debug - window.BRAUT_NAME:", window.BRAUT_NAME);
    console.log("Debug - window.BRAEUTIGAM_NAME:", window.BRAEUTIGAM_NAME);

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
        console.log("Debug - Fallback Brautpaar-Name verwendet:", weddingCoupleName);
    }

    // Prüfen, ob das tischplanung-Objekt existiert
    if (!window.tischplanung) {
        console.error("Tischplanung-Objekt nicht initialisiert!");
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
        <div class="modal fade" id="relationshipModal" tabindex="-1" aria-labelledby="relationshipModalLabel" aria-hidden="true">
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
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
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
            'family': 'Familie',
            'friends': 'Freunde',
            'colleagues': 'Kollegen',
            'couple': 'Paar',
            'acquaintances': 'Bekannte',
            'rivals': 'Rivalen',
            'wedding_couple': 'Brautpaar'
        };
        return types[type] || type;
    }
    
    // Inhalt erstellen
    const contentHTML = `
        <div class="mb-4">
            <h5><i class="bi bi-heart-fill me-2"></i>Beziehungsübersicht</h5>
            <div class="row text-center">
                <div class="col-md-3">
                    <div class="card border-info">
                        <div class="card-body">
                            <h4 class="text-info">${totalRelations}</h4>
                            <small>Gesamt</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-success">
                        <div class="card-body">
                            <h4 class="text-success">${positiveRelations}</h4>
                            <small>Positiv</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-danger">
                        <div class="card-body">
                            <h4 class="text-danger">${negativeRelations}</h4>
                            <small>Negativ</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-secondary">
                        <div class="card-body">
                            <h4 class="text-secondary">${totalRelations - positiveRelations - negativeRelations}</h4>
                            <small>Neutral</small>
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
                            <option value="family">Familie</option>
                            <option value="friends">Freunde</option>
                            <option value="colleagues">Kollegen</option>
                            <option value="couple">Paar</option>
                            <option value="acquaintances">Bekannte</option>
                            <option value="rivals">Rivalen</option>
                            <option value="wedding_couple">💒 ${weddingCoupleName}</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label for="relationshipStrength" class="form-label">Stärke</label>
                        <input type="range" class="form-range" min="-5" max="5" value="0" id="relationshipStrength">
                        <div class="d-flex justify-content-between">
                            <span class="text-danger">-5</span>
                            <span>0</span>
                            <span class="text-success">+5</span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label for="relationshipNotes" class="form-label">Notizen</label>
                        <input type="text" class="form-control" id="relationshipNotes" placeholder="Optionale Notizen">
                    </div>
                </div>
                <div class="d-flex justify-content-end">
                    <button type="button" class="btn btn-primary" onclick="saveNewRelationship()">
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
                                <span class="badge bg-primary ms-2">${groupedRelations[type].length}</span>
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
                                    
                                    const strengthColor = rel.staerke > 0 ? 'success' : rel.staerke < 0 ? 'danger' : 'secondary';
                                    
                                    return `
                                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                                            <div>
                                                <strong>${guest1Name}</strong> ↔ <strong>${guest2Name}</strong>
                                                ${rel.notizen ? `<br><small class="text-muted">📝 ${rel.notizen}</small>` : ''}
                                            </div>
                                            <div>
                                                <span class="badge bg-${strengthColor}">${rel.staerke}</span>
                                                <button class="btn btn-sm btn-outline-primary ms-2" 
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
    console.log("Modal wird initialisiert und angezeigt...");
    const modal = new bootstrap.Modal(document.getElementById('relationshipModal'));
    modal.show();
    console.log("Modal sollte jetzt sichtbar sein.");
}

// Funktion zum Speichern einer neuen Beziehung
async function saveNewRelationship() {
    const guest1Id = document.getElementById('guest1Select').value;
    const guest2Id = document.getElementById('guest2Select').value;
    const relationshipType = document.getElementById('relationshipType').value;
    const strength = parseInt(document.getElementById('relationshipStrength').value);
    const notes = document.getElementById('relationshipNotes').value;

    console.log("Debug - Gewählte Werte:", { guest1Id, guest2Id, relationshipType, strength });

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

        console.log("Speichere Beziehung:", relationshipData);
        
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
            
            // Erst nachdem die Daten neu geladen wurden, ein neues Modal öffnen
            setTimeout(() => showRelationshipsOverview(), 500);
        } else {
            if (window.showError) {
                window.showError('Fehler beim Speichern der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            } else {
                alert('Fehler beim Speichern der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            }
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Beziehung:', error);
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
            <div class="modal fade" id="editRelationshipModal" tabindex="-1" aria-labelledby="editRelationshipModalLabel" aria-hidden="true">
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
                                            <option value="family" ${relationship.beziehungstyp === 'family' ? 'selected' : ''}>Familie</option>
                                            <option value="friends" ${relationship.beziehungstyp === 'friends' ? 'selected' : ''}>Freunde</option>
                                            <option value="colleagues" ${relationship.beziehungstyp === 'colleagues' ? 'selected' : ''}>Kollegen</option>
                                            <option value="couple" ${relationship.beziehungstyp === 'couple' ? 'selected' : ''}>Paar</option>
                                            <option value="acquaintances" ${relationship.beziehungstyp === 'acquaintances' ? 'selected' : ''}>Bekannte</option>
                                            <option value="rivals" ${relationship.beziehungstyp === 'rivals' ? 'selected' : ''}>Rivalen</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label for="editRelationshipStrength" class="form-label">Stärke</label>
                                        <input type="range" class="form-range" id="editRelationshipStrength" 
                                               min="-5" max="5" value="${relationship.staerke}" 
                                               oninput="document.getElementById('editStrengthValue').textContent = this.value">
                                        <div class="text-center">
                                            <span class="badge bg-secondary" id="editStrengthValue">${relationship.staerke}</span>
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
                            <button type="button" class="btn btn-danger me-auto" onclick="deleteRelationship(${relationshipId})">
                                <i class="bi bi-trash me-1"></i>Löschen
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                            <button type="button" class="btn btn-primary" onclick="saveEditedRelationship(${relationshipId})">
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
        editModal.show();

    } catch (error) {
        console.error('Fehler beim Öffnen des Edit-Modals:', error);
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

        console.log("Debug - Edit Beziehung:", { guest1Id, guest2Id, relationshipType, strength });

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
            
            // Beziehungsübersicht wieder anzeigen
            setTimeout(() => showRelationshipsOverview(), 500);
        } else {
            if (window.showError) {
                window.showError('Fehler beim Aktualisieren der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            } else {
                alert('Fehler beim Aktualisieren der Beziehung: ' + (result.error || 'Unbekannter Fehler'));
            }
        }

    } catch (error) {
        console.error('Fehler beim Speichern der bearbeiteten Beziehung:', error);
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
        console.log('deleteRelationship aufgerufen mit ID:', relationshipId);
        
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

        console.log('Lösche Beziehung mit ID:', relationshipId);
        const result = await window.TischplanungAPI.deleteRelationship(relationshipId);
        console.log('Delete-Ergebnis:', result);

        if (result.success) {
            // Erfolg melden
            if (window.showSuccess) {
                window.showSuccess('Beziehung erfolgreich gelöscht!');
            } else {
                alert('Beziehung erfolgreich gelöscht!');
            }
            
            // Daten neu laden
            await window.tischplanung.loadRelationships();
            
            // Beziehungsübersicht wieder anzeigen
            setTimeout(() => showRelationshipsOverview(), 500);
        } else {
            console.error('Delete-Fehler:', result);
            const errorMessage = result.error || result.message || 'Unbekannter Fehler';
            console.error('Detaillierte Fehlermeldung:', errorMessage);
            
            if (window.showError) {
                window.showError('Fehler beim Löschen der Beziehung: ' + errorMessage);
            } else {
                alert('Fehler beim Löschen der Beziehung: ' + errorMessage);
            }
        }

    } catch (error) {
        console.error('Fehler beim Löschen der Beziehung:', error);
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

console.log('Tischplanung Relationships - geladen und Funktionen exportiert');
