// Gästeliste spezifische Funktionen mit Masseneditierung (kompatibel mit alter Datenstruktur)

let currentGuests = [];
let selectedGuests = new Set();
let seiteMapping = {
    braut_name: 'Katharina',    // wird dynamisch geladen
    braeutigam_name: 'Pascal',  // wird dynamisch geladen
    beide: 'Beide'
};

document.addEventListener('DOMContentLoaded', async function() {

    
    // Seite-Optionen laden (dynamisch basierend auf Einstellungen)
    await loadSeiteOptions();
    
    // Event Listeners
    setupEventListeners();
    
    // Gästeliste laden
    await loadAndDisplayGuests();
});

function setupEventListeners() {
    // Gast hinzufügen
    const saveGuestBtn = document.getElementById('saveGuestBtn');
    if (saveGuestBtn) {
        saveGuestBtn.addEventListener('click', handleAddGuest);
    }
    
    // Gast bearbeiten
    const updateGuestBtn = document.getElementById('updateGuestBtn');
    if (updateGuestBtn) {
        updateGuestBtn.addEventListener('click', handleUpdateGuest);
    }
    
    // Suche
    const searchInput = document.getElementById('guestSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Filter
    const filterWeisserSaal = document.getElementById('filterWeisserSaal');
    const filterEssen = document.getElementById('filterEssen');
    const filterParty = document.getElementById('filterParty');
    
    if (filterWeisserSaal) filterWeisserSaal.addEventListener('change', handleFilter);
    if (filterEssen) filterEssen.addEventListener('change', handleFilter);
    if (filterParty) filterParty.addEventListener('change', handleFilter);
    
    // Form Reset beim Modal öffnen
    const addGuestModal = document.getElementById('addGuestModal');
    if (addGuestModal) {
        addGuestModal.addEventListener('show.bs.modal', function() {
            document.getElementById('addGuestForm').reset();
            // Auto-Update für Ja/Nein Felder aktivieren (unsichtbar)
            setupAutoUpdateFields();
        });
    }
    
    // Masseneditierung
    const selectAllBtn = document.getElementById('selectAllGuests');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', handleSelectAll);
    }
    
    // Header Checkbox für "Alle auswählen"
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAllCheckbox);
    }
    
    const massEditBtn = document.getElementById('massEditBtn');
    if (massEditBtn) {
        massEditBtn.addEventListener('click', handleMassEdit);
    }
    
    const saveMassEditBtn = document.getElementById('saveMassEditBtn');
    if (saveMassEditBtn) {
        saveMassEditBtn.addEventListener('click', handleSaveMassEdit);
    }
    
    // Synchronisation der automatischen Anzahl-Anpassung für neue Gäste
    syncParticipationLogic();
}

async function loadSeiteOptions() {
    /**
     * Lädt die verfügbaren Seite-Optionen dynamisch aus den Einstellungen
     */
    try {
        const response = await fetch('/api/gaeste/seite-options');
        const result = await response.json();
        
        if (result.success && result.options) {
            // Update beide Seite-Dropdowns
            updateSeiteDropdowns(result.options);
            
            // Aktualisiere seiteMapping für die Badge-Klassen
            if (result.options.length >= 2) {
                seiteMapping.braut_name = result.options[0].value;
                seiteMapping.braeutigam_name = result.options[1].value;
            }
            
            console.log('✅ Seite-Optionen geladen:', result.options);
            console.log('📋 Seite-Mapping aktualisiert:', seiteMapping);
        } else {
            console.warn('⚠️ Keine Seite-Optionen erhalten, verwende Standard-Werte');
            // Fallback zu Standard-Werten
            const fallbackOptions = [
                {value: 'Käthe', label: 'Käthe'},
                {value: 'Pascal', label: 'Pascal'},
                {value: 'Beide', label: 'Käthe & Pascal'}
            ];
            updateSeiteDropdowns(fallbackOptions);
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Seite-Optionen:', error);
        // Fallback zu Standard-Werten
        const fallbackOptions = [
            {value: 'Käthe', label: 'Käthe'},
            {value: 'Pascal', label: 'Pascal'},
            {value: 'Beide', label: 'Käthe & Pascal'}
        ];
        updateSeiteDropdowns(fallbackOptions);
    }
}

function getSeiteBadgeClass(seite) {
    /**
     * Bestimmt die richtige Badge-Klasse für eine Seite basierend auf den dynamischen Namen
     */
    if (seite === seiteMapping.braut_name) {
        return 'badge-seite-braut';
    } else if (seite === seiteMapping.braeutigam_name) {
        return 'badge-seite-braeutigam';
    } else if (seite === 'Beide') {
        return 'badge-seite-beide';
    }
    
    // Fallback für unbekannte Seiten
    return 'badge-wedding-secondary';
}

function updateSeiteDropdowns(options) {
    /**
     * Aktualisiert alle Seite-Dropdowns mit den neuen Optionen
     */
    const dropdownIds = ['guestSeite', 'editGuestSeite'];
    
    dropdownIds.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        // Aktuellen Wert speichern
        const currentValue = dropdown.value;
        
        // Dropdown leeren (außer erste Option bei Add-Form)
        if (dropdownId === 'guestSeite') {
            // Für "Gast hinzufügen" behalte "Bitte wählen..." Option
            dropdown.innerHTML = '<option value="">Bitte wählen...</option>';
        } else {
            // Für "Gast bearbeiten" keine Leer-Option
            dropdown.innerHTML = '';
        }
        
        // Neue Optionen hinzufügen
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            dropdown.appendChild(optionElement);
        });
        
        // Vorherigen Wert wiederherstellen falls möglich
        if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
            dropdown.value = currentValue;
        }
    });
    
    console.log('✅ Seite-Dropdowns aktualisiert für:', dropdownIds);
}

async function loadAndDisplayGuests() {
    try {
        // Fallback-Funktionen falls HochzeitsplanerApp nicht verfügbar ist
        const showLoading = () => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.showLoading) {
                window.HochzeitsplanerApp.showLoading();
            } else {

            }
        };
        
        const hideLoading = () => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.hideLoading) {
                window.HochzeitsplanerApp.hideLoading();
            }
        };
        
        const showAlert = (message, type = 'danger') => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.showAlert) {
                window.HochzeitsplanerApp.showAlert(message, type);
            } else {
                alert(message);
            }
        };
        
        showLoading();
        
        const data = await apiRequest('/gaeste/list');
        
        if (data.success) {
            currentGuests = data.gaeste || [];
            displayGuests(currentGuests);
            updateGuestStats(currentGuests);
            updateMassEditButton();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        
        const showAlert = (message, type = 'danger') => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.showAlert) {
                window.HochzeitsplanerApp.showAlert(message, type);
            } else {
                alert(message);
            }
        };
        
        showAlert('Fehler beim Laden der Gäste: ' + error.message, 'danger');
    } finally {
        const hideLoading = () => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.hideLoading) {
                window.HochzeitsplanerApp.hideLoading();
            }
        };
        
        hideLoading();
    }
}

function displayGuests(guests) {
    const tbody = document.getElementById('guestsTableBody');
    if (!tbody) return;
    
    if (!guests || guests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center text-muted">
                    Keine Gäste gefunden
                    <br><small>Fügen Sie Ihren ersten Gast hinzu</small>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = guests.map((guest, index) => {
        const isSelected = selectedGuests.has(guest.id); // Verwende echte ID statt Index
        
        // Korrekte Mapping für die JSON-Struktur
        const vorname = guest.Vorname || '';
        const nachname = guest.Nachname || '';
        const kategorie = guest.Kategorie || '';
        const seite = guest.Seite || '';
        const anzahlPersonen = guest.Anzahl_Personen || 0;
        const weisserSaal = guest.Weisser_Saal || 0;
        const anzahlEssen = guest.Anzahl_Essen || 0;
        const anzahlParty = guest.Anzahl_Party || 0;
        const kinder = guest.Kind || 0;
        const status = guest.Status || 'Offen';
        const guestId = guest.id || index; // Fallback auf Index falls ID fehlt
        
        // Status-Badge-Klasse
        const statusClass = status === 'Zugesagt' ? 'badge-wedding-success' : 
                           status === 'Abgesagt' ? 'badge-wedding-danger' : 'badge-wedding-warning';
        
        // Kategorie-Badge-Klasse (auch für Namen verwendet)
        const kategorieClass = kategorie === 'Familie' ? 'badge-wedding-primary' : 'badge-wedding-info';
        
        return `
            <tr class="${isSelected ? 'table-active' : ''}">
                <td>
                    <input type="checkbox" class="form-check-input guest-checkbox" 
                           data-id="${guestId}" ${isSelected ? 'checked' : ''}
                           onchange="handleGuestSelection(${guestId}, this.checked)">
                </td>
                <td>
                    <span class="badge ${kategorieClass}">
                        ${escapeHtml(vorname)}
                    </span>
                </td>
                <td>
                    <span class="badge ${kategorieClass}">
                        ${escapeHtml(nachname)}
                    </span>
                </td>
                <td>
                    <span class="badge ${kategorieClass}">
                        ${escapeHtml(kategorie)}
                    </span>
                </td>
                <td>
                    <span class="badge ${getSeiteBadgeClass(seite)}">
                        ${escapeHtml(seite)}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge ${anzahlPersonen > 0 ? 'badge-wedding-success' : 'badge-wedding-light'}">
                        ${anzahlPersonen}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge ${weisserSaal > 0 ? 'badge-wedding-success' : 'badge-wedding-light'}">
                        ${weisserSaal}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge ${anzahlEssen > 0 ? 'badge-wedding-success' : 'badge-wedding-light'}">
                        ${anzahlEssen}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge ${anzahlParty > 0 ? 'badge-wedding-success' : 'badge-wedding-light'}">
                        ${anzahlParty}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge ${kinder > 0 ? 'badge-wedding-warning' : 'badge-wedding-light'}">
                        ${kinder}
                    </span>
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        ${escapeHtml(status)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-wedding-secondary me-1" 
                            onclick="editGuest(${guestId})" 
                            title="Bearbeiten">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-wedding-danger" 
                            onclick="deleteGuest(${guestId})" 
                            title="Löschen">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateGuestStats(guests) {
    // Berechne die Gesamtsummen basierend auf den Anzahl-Feldern
    const totalGuests = guests.reduce((sum, guest) => sum + (guest.Anzahl_Personen || 0), 0);
    const weisserSaalGuests = guests.reduce((sum, guest) => sum + (guest.Weisser_Saal || 0), 0);
    const essenGuests = guests.reduce((sum, guest) => sum + (guest.Anzahl_Essen || 0), 0);
    const partyGuests = guests.reduce((sum, guest) => sum + (guest.Anzahl_Party || 0), 0);

    // Update der Statistik-Cards
    const totalElement = document.getElementById('totalGuests');
    const weisserSaalElement = document.getElementById('weisserSaalGuests');
    const essenElement = document.getElementById('essenGuests');
    const partyElement = document.getElementById('partyGuests');

    if (totalElement) totalElement.textContent = totalGuests;
    if (weisserSaalElement) weisserSaalElement.textContent = weisserSaalGuests;
    if (essenElement) essenElement.textContent = essenGuests;
    if (partyElement) partyElement.textContent = partyGuests;
}

function handleGuestSelection(guestId, selected) {
    if (selected) {
        selectedGuests.add(guestId);
    } else {
        selectedGuests.delete(guestId);
    }
    updateMassEditButton();
    
    // Zeile hervorheben
    const row = document.querySelector(`input[data-guest-id="${guestId}"]`).closest('tr');
    if (selected) {
        row.classList.add('table-active');
    } else {
        row.classList.remove('table-active');
    }
}

function handleSelectAll() {
    const checkboxes = document.querySelectorAll('.guest-checkbox');
    const selectAllBtn = document.getElementById('selectAllGuests');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const allSelected = selectedGuests.size === currentGuests.length;
    
    if (allSelected) {
        // Alle abwählen
        selectedGuests.clear();
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.closest('tr').classList.remove('table-active');
        });
        if (selectAllBtn) selectAllBtn.textContent = 'Alle auswählen';
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    } else {
        // Alle auswählen
        selectedGuests.clear();
        checkboxes.forEach(cb => {
            const guestId = parseInt(cb.getAttribute('data-guest-id'));
            selectedGuests.add(guestId);
            cb.checked = true;
            cb.closest('tr').classList.add('table-active');
        });
        if (selectAllBtn) selectAllBtn.textContent = 'Alle abwählen';
        if (selectAllCheckbox) selectAllCheckbox.checked = true;
    }
    
    updateMassEditButton();
}

function handleSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.guest-checkbox');
    const selectAllBtn = document.getElementById('selectAllGuests');
    
    if (selectAllCheckbox.checked) {
        // Alle auswählen
        selectedGuests.clear();
        checkboxes.forEach(cb => {
            const guestId = parseInt(cb.getAttribute('data-guest-id'));
            selectedGuests.add(guestId);
            cb.checked = true;
            cb.closest('tr').classList.add('table-active');
        });
        if (selectAllBtn) selectAllBtn.textContent = 'Alle abwählen';
    } else {
        // Alle abwählen
        selectedGuests.clear();
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.closest('tr').classList.remove('table-active');
        });
        if (selectAllBtn) selectAllBtn.textContent = 'Alle auswählen';
    }
    
    updateMassEditButton();
}

function updateMassEditButton() {
    const massEditBtn = document.getElementById('massEditBtn');
    const selectAllBtn = document.getElementById('selectAllGuests');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (massEditBtn) {
        massEditBtn.disabled = selectedGuests.size === 0;
        massEditBtn.innerHTML = `<i class="bi bi-pencil-square"></i> Ausgewählte bearbeiten (${selectedGuests.size})`;
    }
    
    if (selectAllBtn) {
        selectAllBtn.textContent = selectedGuests.size === currentGuests.length ? 'Alle abwählen' : 'Alle auswählen';
    }
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = selectedGuests.size === currentGuests.length;
    }
}

function handleMassEdit() {
    if (selectedGuests.size === 0) return;
    
    // Modal öffnen
    const modal = new bootstrap.Modal(document.getElementById('massEditModal'));
    modal.show();
}

async function handleSaveMassEdit() {
    const weisserSaal = document.getElementById('massWeisserSaal').value;
    const essen = document.getElementById('massEssen').value;
    const party = document.getElementById('massParty').value;
    
    if (!weisserSaal && !essen && !party) {
        HochzeitsplanerApp.showAlert('Bitte wählen Sie mindestens eine Option zum Bearbeiten aus.', 'warning');
        return;
    }
    
    try {
        HochzeitsplanerApp.showLoading();
        
        const updates = {};
        if (weisserSaal) updates.Zum_Weisser_Saal = weisserSaal;
        if (essen) updates.Zum_Essen = essen;
        if (party) updates.Zur_Party = party;
        
        const guestIds = Array.from(selectedGuests);
        
        const data = await apiRequest('/gaeste/mass-update', {
            method: 'PUT',
            body: JSON.stringify({
                guest_ids: guestIds,
                updates: updates
            })
        });
        
        if (data.success) {
            HochzeitsplanerApp.showAlert(`${guestIds.length} Gäste erfolgreich aktualisiert!`);
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('massEditModal'));
            modal.hide();
            
            // Auswahl zurücksetzen
            selectedGuests.clear();
            
            // Gästeliste neu laden
            await loadAndDisplayGuests();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler bei der Masseneditierung: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

// Synchronisation der Teilnahme-Logik
function syncParticipationLogic() {
    const weisserSaalInput = document.getElementById('guestWeisserSaal');
    const anzahlEssenInput = document.getElementById('guestAnzahlEssen');
    const anzahlPartyInput = document.getElementById('guestAnzahlParty');
    
    function updateCascadingCounts() {
        const weisserSaalCount = parseInt(weisserSaalInput.value) || 0;
        const essenCount = parseInt(anzahlEssenInput.value) || 0;
        const partyCount = parseInt(anzahlPartyInput.value) || 0;
        
        // Logik: Weißer Saal → automatisch Essen, Essen → automatisch Party
        let finalEssenCount = Math.max(essenCount, weisserSaalCount);
        let finalPartyCount = Math.max(partyCount, finalEssenCount);
        
        // Aktualisiere die Eingabefelder automatisch
        if (weisserSaalCount > 0 && finalEssenCount !== essenCount) {
            anzahlEssenInput.value = finalEssenCount;
        }
        if (finalEssenCount > 0 && finalPartyCount !== partyCount) {
            anzahlPartyInput.value = finalPartyCount;
        }
    }
    
    // Event Listeners für die automatische Aktualisierung
    if (weisserSaalInput) weisserSaalInput.addEventListener('input', updateCascadingCounts);
    if (anzahlEssenInput) anzahlEssenInput.addEventListener('input', updateCascadingCounts);
    if (anzahlPartyInput) anzahlPartyInput.addEventListener('input', updateCascadingCounts);
    
    // Initial einmal ausführen
    updateCascadingCounts();
}

function handleSearch() {
    const searchTerm = document.getElementById('guestSearch').value.toLowerCase();
    const filteredGuests = currentGuests.filter(guest => 
        (guest.Vorname || '').toLowerCase().includes(searchTerm) ||
        (guest.Nachname || '').toLowerCase().includes(searchTerm) ||
        (guest.Adresse || '').toLowerCase().includes(searchTerm)
    );
    displayGuests(filteredGuests);
}

function handleFilter() {
    const weisserSaalFilter = document.getElementById('filterWeisserSaal').value;
    const essenFilter = document.getElementById('filterEssen').value;
    const partyFilter = document.getElementById('filterParty').value;
    
    let filteredGuests = currentGuests;
    
    if (weisserSaalFilter) {
        filteredGuests = filteredGuests.filter(guest => 
            guest.Zum_Weisser_Saal === weisserSaalFilter
        );
    }
    
    if (essenFilter) {
        filteredGuests = filteredGuests.filter(guest => 
            guest.Zum_Essen === essenFilter
        );
    }
    
    if (partyFilter) {
        filteredGuests = filteredGuests.filter(guest => 
            guest.Zur_Party === partyFilter
        );
    }
    
    displayGuests(filteredGuests);
}

async function handleAddGuest() {
    const form = document.getElementById('addGuestForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Sammle alle Felder aus dem erweiterten Formular
    const guestData = {
        Vorname: document.getElementById('guestVorname').value.trim(),
        Nachname: document.getElementById('guestNachname').value.trim(),
        Kategorie: document.getElementById('guestKategorie').value,
        Status: document.getElementById('guestStatus').value,
        Seite: document.getElementById('guestSeite').value,
        Begleitung: document.getElementById('guestBegleitung').value.trim(),
        Email: document.getElementById('guestEmail').value.trim(),
        Kontakt: document.getElementById('guestKontakt').value.trim(),
        Adresse: document.getElementById('guestAdresse').value.trim(),
        Anzahl_Personen: parseInt(document.getElementById('guestAnzahlPersonen').value) || 0,
        Kind: parseInt(document.getElementById('guestKind').value) || 0,
        Optional: parseInt(document.getElementById('guestOptional').value) || 0,
        Weisser_Saal: parseInt(document.getElementById('guestWeisserSaal').value) || 0,
        Anzahl_Essen: parseInt(document.getElementById('guestAnzahlEssen').value) || 0,
        Anzahl_Party: parseInt(document.getElementById('guestAnzahlParty').value) || 0,
        Bemerkungen: document.getElementById('guestBemerkungen').value.trim()
    };
    
    try {
        HochzeitsplanerApp.showLoading();
        
        const data = await apiRequest('/gaeste/add', {
            method: 'POST',
            body: JSON.stringify(guestData)
        });
        
        if (data.success) {
            HochzeitsplanerApp.showAlert('Gast erfolgreich hinzugefügt!');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('addGuestModal'));
            modal.hide();
            
            // Gästeliste neu laden
            await loadAndDisplayGuests();
            
            // Dashboard aktualisieren falls verfügbar
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.refreshDashboard) {
                window.HochzeitsplanerApp.refreshDashboard();
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler beim Hinzufügen: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

// Funktion zum automatischen Aktualisieren der Ja/Nein-Felder basierend auf Anzahl-Feldern
function setupAutoUpdateFields() {
    // Keine sichtbaren Auto-Updates mehr - Logik wird nur auf Server-Seite angewendet
    // Funktion bleibt für Kompatibilität, aber macht nichts sichtbares
}

function editGuest(guestId) {
    const guest = currentGuests.find(g => g.id === guestId);
    if (!guest) return;
    
    // Modal Felder befüllen - vollständige JSON-Struktur
    document.getElementById('editGuestIndex').value = guestId;
    
    // Grunddaten
    document.getElementById('editGuestVorname').value = guest.Vorname || '';
    document.getElementById('editGuestNachname').value = guest.Nachname || '';
    document.getElementById('editGuestKategorie').value = guest.Kategorie || 'Familie';
    document.getElementById('editGuestSeite').value = guest.Seite || 'Käthe';
    document.getElementById('editGuestStatus').value = guest.Status || 'Offen';
    
    // Anzahl Personen
    document.getElementById('editAnzahlPersonen').value = guest.Anzahl_Personen || 1;
    document.getElementById('editAnzahlKinder').value = guest.Kind || 0;
    document.getElementById('editBegleitung').value = guest.Begleitung || 0;
    document.getElementById('editOptional').value = guest.Optional || 0;
    
    // Teilnahme Anzahlen (vereinheitlicht)
    document.getElementById('editWeisserSaal').value = guest.Weisser_Saal || 0;
    document.getElementById('editAnzahlEssen').value = guest.Anzahl_Essen || 0;
    document.getElementById('editAnzahlParty').value = guest.Anzahl_Party || 0;
    
    // Zusätzliche Informationen
    document.getElementById('editGuestEmail').value = guest.Email || '';
    document.getElementById('editGuestKontakt').value = guest.Kontakt || '';
    document.getElementById('editGuestAdresse').value = guest.Adresse || '';
    document.getElementById('editGuestBemerkungen').value = guest.Bemerkungen || '';
    
    // Modal öffnen
    const modal = new bootstrap.Modal(document.getElementById('editGuestModal'));
    modal.show();
}

async function handleUpdateGuest() {
    const form = document.getElementById('editGuestForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const guestId = parseInt(document.getElementById('editGuestIndex').value);
    
    // Vollständige Gästedaten sammeln
    const guestData = {
        // Grunddaten
        Vorname: document.getElementById('editGuestVorname').value.trim(),
        Nachname: document.getElementById('editGuestNachname').value.trim(),
        Kategorie: document.getElementById('editGuestKategorie').value,
        Seite: document.getElementById('editGuestSeite').value,
        Status: document.getElementById('editGuestStatus').value,
        
        // Anzahl Personen
        Anzahl_Personen: parseInt(document.getElementById('editAnzahlPersonen').value) || 1,
        Kind: parseInt(document.getElementById('editAnzahlKinder').value) || 0,
        Begleitung: parseInt(document.getElementById('editBegleitung').value) || 0,
        Optional: parseInt(document.getElementById('editOptional').value) || 0,
        
        // Teilnahme Anzahlen (vereinheitlicht)
        Weisser_Saal: parseInt(document.getElementById('editWeisserSaal').value) || 0,
        Anzahl_Essen: parseInt(document.getElementById('editAnzahlEssen').value) || 0,
        Anzahl_Party: parseInt(document.getElementById('editAnzahlParty').value) || 0,
        
        // Zusätzliche Informationen
        Email: document.getElementById('editGuestEmail').value.trim(),
        Kontakt: document.getElementById('editGuestKontakt').value.trim(),
        Adresse: document.getElementById('editGuestAdresse').value.trim(),
        Bemerkungen: document.getElementById('editGuestBemerkungen').value.trim(),
        
        // Pflichtfelder die nicht im Form sind
        Optional: currentGuests.find(g => g.id === guestId)?.Optional || 0
    };
    
    try {
        const showLoading = () => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.showLoading) {
                window.HochzeitsplanerApp.showLoading();
            } else {

            }
        };
        
        const hideLoading = () => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.hideLoading) {
                window.HochzeitsplanerApp.hideLoading();
            }
        };
        
        const showAlert = (message, type = 'success') => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.showAlert) {
                window.HochzeitsplanerApp.showAlert(message, type);
            } else {
                alert(message);
            }
        };
        
        showLoading();
        
        console.log('Updating guest with ID:', guestId);
        console.log('Request URL:', `/gaeste/update/${guestId}`);
        
        const data = await apiRequest(`/gaeste/update/${guestId}`, {
            method: 'PUT',
            body: JSON.stringify(guestData)
        });
        
        if (data.success) {
            showAlert('Gast erfolgreich aktualisiert!');
            
            // Modal schließen
            const modal = bootstrap.Modal.getInstance(document.getElementById('editGuestModal'));
            modal.hide();
            
            // Gästeliste neu laden
            await loadAndDisplayGuests();
            
            // Dashboard aktualisieren falls verfügbar
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.refreshDashboard) {
                window.HochzeitsplanerApp.refreshDashboard();
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        
        const showAlert = (message, type = 'danger') => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.showAlert) {
                window.HochzeitsplanerApp.showAlert(message, type);
            } else {
                alert(message);
            }
        };
        
        showAlert('Fehler beim Aktualisieren: ' + error.message, 'danger');
    } finally {
        const hideLoading = () => {
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.hideLoading) {
                window.HochzeitsplanerApp.hideLoading();
            }
        };
        
        hideLoading();
    }
}

async function deleteGuest(guestId) {
    const guest = currentGuests.find(g => g.id === guestId);
    if (!guest) return;
    
    if (!confirm(`Möchten Sie ${guest.Vorname} ${guest.Nachname} wirklich löschen?`)) {
        return;
    }
    
    try {
        HochzeitsplanerApp.showLoading();
        
        const data = await apiRequest(`/gaeste/delete/${guestId}`, {
            method: 'DELETE'
        });
        
        if (data.success) {
            HochzeitsplanerApp.showAlert(`${guest.Vorname} ${guest.Nachname} wurde gelöscht!`);
            await loadAndDisplayGuests();
            
            // Dashboard aktualisieren falls verfügbar
            if (window.HochzeitsplanerApp && window.HochzeitsplanerApp.refreshDashboard) {
                window.HochzeitsplanerApp.refreshDashboard();
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {

        HochzeitsplanerApp.showAlert('Fehler beim Löschen: ' + error.message, 'danger');
    } finally {
        HochzeitsplanerApp.hideLoading();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

