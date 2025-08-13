// Geschenkliste Admin JavaScript
class GeschenklisteAdmin {
    constructor() {
        this.geschenke = [];
        this.currentGeschenk = null;
        this.geldgeschenkConfig = null;
        this.init();
    }

    init() {
        this.loadGeschenke();
        this.loadStatistiken();
        this.loadGeschenklisteText();
        this.loadGeldgeschenkConfig();
        this.loadGeldgeschenkAuswahlen();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Neue Geschenk Button
        document.getElementById('save-geschenk').addEventListener('click', () => this.saveGeschenk());
        
        // Geschenkliste Text Konfiguration
        document.getElementById('save-geschenkliste-text').addEventListener('click', () => this.saveGeschenklisteText());
        
        // Geldgeschenk Konfiguration
        document.getElementById('save-geldgeschenk').addEventListener('click', () => this.saveGeldgeschenkConfig());
        document.getElementById('deactivate-geldgeschenk').addEventListener('click', () => this.deactivateGeldgeschenkConfig());

        // Filter
        document.getElementById('kategorie-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('status-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('search-input').addEventListener('input', () => this.applyFilters());

        // Modal Reset
        document.getElementById('addGeschenkModal').addEventListener('hidden.bs.modal', () => {
            this.resetForm();
        });
    }

    async loadGeldgeschenkConfig() {
        try {
            const response = await fetch('/api/geldgeschenk/config');
            const data = await response.json();
            
            if (data.success && data.config) {
                this.geldgeschenkConfig = data.config;
                this.updateGeldgeschenkUI();
            } else {
                this.updateGeldgeschenkUI(null);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Geldgeschenk-Konfiguration:', error);
        }
    }

    updateGeldgeschenkUI(config = this.geldgeschenkConfig) {
        const nameInput = document.getElementById('geldgeschenk-name');
        const paypalInput = document.getElementById('geldgeschenk-paypal');
        const beschreibungInput = document.getElementById('geldgeschenk-beschreibung');
        const statusBadge = document.getElementById('geldgeschenk-status-badge');
        const deactivateBtn = document.getElementById('deactivate-geldgeschenk');

        if (config) {
            nameInput.value = config.name || '';
            paypalInput.value = config.paypal_link || '';
            beschreibungInput.value = config.beschreibung || '';
            
            if (config.aktiv) {
                statusBadge.className = 'badge bg-success';
                statusBadge.textContent = 'Aktiv';
                deactivateBtn.style.display = 'inline-block';
            } else {
                statusBadge.className = 'badge bg-warning';
                statusBadge.textContent = 'Inaktiv';
                deactivateBtn.style.display = 'none';
            }
        } else {
            nameInput.value = '';
            paypalInput.value = '';
            beschreibungInput.value = '';
            statusBadge.className = 'badge bg-secondary';
            statusBadge.textContent = 'Nicht konfiguriert';
            deactivateBtn.style.display = 'none';
        }
    }

    async saveGeldgeschenkConfig() {
        try {
            const name = document.getElementById('geldgeschenk-name').value.trim();
            const paypalLink = document.getElementById('geldgeschenk-paypal').value.trim();
            const beschreibung = document.getElementById('geldgeschenk-beschreibung').value.trim();

            if (!name) {
                this.showError('Name ist erforderlich');
                return;
            }

            if (!paypalLink) {
                this.showError('PayPal-Link ist erforderlich');
                return;
            }

            const response = await fetch('/api/geldgeschenk/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    beschreibung: beschreibung,
                    paypal_link: paypalLink,
                    aktiv: 1
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Geldgeschenk-Konfiguration gespeichert');
                this.loadGeldgeschenkConfig();
            } else {
                this.showError(data.error || 'Fehler beim Speichern');
            }
        } catch (error) {
            console.error('Fehler beim Speichern der Geldgeschenk-Konfiguration:', error);
            this.showError('Netzwerkfehler beim Speichern');
        }
    }

    async deactivateGeldgeschenkConfig() {
        this.showConfirm(
            'Geldgeschenk deaktivieren',
            'Möchten Sie das Geldgeschenk wirklich deaktivieren? Es wird dann für Gäste nicht mehr verfügbar sein.',
            async () => {
                try {
                    const response = await fetch('/api/geldgeschenk/deactivate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        this.showSuccess('Geldgeschenk wurde deaktiviert');
                        this.loadGeldgeschenkConfig();
                    } else {
                        this.showError(data.error || 'Fehler beim Deaktivieren');
                    }
                } catch (error) {
                    console.error('Fehler beim Deaktivieren der Geldgeschenk-Konfiguration:', error);
                    this.showError('Netzwerkfehler beim Deaktivieren');
                }
            },
            'Deaktivieren'
        );
    }

    async loadGeschenke() {
        try {
            const response = await fetch('/api/geschenkliste/list');
            const data = await response.json();
            
            if (data.success) {
                this.geschenke = data.geschenke;
                this.renderGeschenke();
            } else {
                this.showError('Fehler beim Laden der Geschenke');
            }
        } catch (error) {
            console.error('Fehler beim Laden der Geschenke:', error);
            this.showError('Netzwerkfehler beim Laden der Geschenke');
        }
    }

    async loadStatistiken() {
        try {
            const response = await fetch('/api/geschenkliste/statistiken');
            const data = await response.json();
            
            if (data.success) {
                const stats = data.statistiken;
                document.getElementById('stat-total').textContent = stats.total_geschenke || 0;
                document.getElementById('stat-ausgewaehlt').textContent = stats.ausgewaehlt_geschenke || 0;
                document.getElementById('stat-verfuegbar').textContent = stats.verfuegbar_geschenke || 0;
                document.getElementById('stat-gesamtwert').textContent = `${(stats.gesamtwert || 0).toFixed(2)} €`;
            }
        } catch (error) {
            console.error('Fehler beim Laden der Statistiken:', error);
        }
    }

    async loadGeschenklisteText() {
        try {
            const response = await fetch('/api/geschenkliste/text-config');
            const data = await response.json();
            
            if (data.success && data.config) {
                this.updateGeschenklisteTextUI(data.config);
            } else {
                this.updateGeschenklisteTextUI(null);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Geschenkliste-Text-Konfiguration:', error);
            this.updateGeschenklisteTextUI(null);
        }
    }

    updateGeschenklisteTextUI(config) {
        const titelInput = document.getElementById('geschenkliste-titel');
        const beschreibungInput = document.getElementById('geschenkliste-beschreibung');
        const statusBadge = document.getElementById('geschenkliste-text-status-badge');

        if (config) {
            titelInput.value = config.titel || 'Unsere Geschenkliste';
            beschreibungInput.value = config.beschreibung || 'Wir haben eine kleine Geschenkliste für euch zusammengestellt.';
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'Konfiguriert';
        } else {
            titelInput.value = 'Unsere Geschenkliste';
            beschreibungInput.value = 'Wir haben eine kleine Geschenkliste für euch zusammengestellt.';
            statusBadge.className = 'badge bg-secondary';
            statusBadge.textContent = 'Standard';
        }
    }

    async saveGeschenklisteText() {
        try {
            const titel = document.getElementById('geschenkliste-titel').value.trim();
            const beschreibung = document.getElementById('geschenkliste-beschreibung').value.trim();

            if (!titel) {
                this.showError('Titel ist erforderlich');
                return;
            }

            const response = await fetch('/api/geschenkliste/text-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    titel: titel,
                    beschreibung: beschreibung
                })
            });

            const data = await response.json();
            if (data.success) {
                this.showSuccess('Geschenkliste-Text erfolgreich gespeichert');
                this.updateGeschenklisteTextUI({
                    titel: titel,
                    beschreibung: beschreibung
                });
            } else {
                this.showError(data.error || 'Fehler beim Speichern');
            }
        } catch (error) {
            console.error('Fehler beim Speichern der Geschenkliste-Text-Konfiguration:', error);
            this.showError('Netzwerkfehler beim Speichern');
        }
    }

    async loadGeldgeschenkAuswahlen() {
        try {
            const response = await fetch('/api/geldgeschenk/auswahlen');
            const data = await response.json();
            
            if (data.success) {
                this.renderGeldgeschenkAuswahlen(data.auswahlen || []);
            } else {
                console.error('Fehler beim Laden der Geldgeschenk-Auswahlen:', data.error);
                this.renderGeldgeschenkAuswahlen([]);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Geldgeschenk-Auswahlen:', error);
            this.renderGeldgeschenkAuswahlen([]);
        }
    }

    renderGeldgeschenkAuswahlen(auswahlen) {
        const container = document.getElementById('geldgeschenk-auswahlen-container');
        const tbody = document.getElementById('geldgeschenk-auswahlen-tbody');
        const keineAuswahlen = document.getElementById('keine-geldgeschenk-auswahlen');
        
        if (auswahlen.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        tbody.innerHTML = '';
        keineAuswahlen.style.display = 'none';
        
        auswahlen.forEach(auswahl => {
            const row = document.createElement('tr');
            const gastName = auswahl.gast_name || `Gast ${auswahl.gast_id}`;
            const betrag = auswahl.betrag ? `${auswahl.betrag} ${auswahl.waehrung || 'EUR'}` : '-';
            const notiz = auswahl.notiz || '-';
            const datum = new Date(auswahl.ausgewaehlt_am).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            row.innerHTML = `
                <td><strong>${gastName}</strong></td>
                <td><span class="badge bg-success">${betrag}</span></td>
                <td><em class="text-muted">${notiz}</em></td>
                <td><small class="text-muted">${datum}</small></td>
                <td>
                    <button class="btn btn-outline-warning btn-sm" onclick="geschenklisteAdmin.freigebenGeldgeschenk(${auswahl.gast_id})" title="Auswahl freigeben">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    renderGeschenke() {
        const tbody = document.getElementById('geschenke-tbody');
        tbody.innerHTML = '';

        this.geschenke.forEach(geschenk => {
            const row = this.createGeschenkRow(geschenk);
            tbody.appendChild(row);
        });
    }

    createGeschenkRow(geschenk) {
        const row = document.createElement('tr');
        
        // Status ermitteln
        const istAusgewaehlt = geschenk.ausgewaehlt_menge > 0;
        const statusBadge = istAusgewaehlt ? 
            `<span class="badge bg-success">Ausgewählt (${geschenk.ausgewaehlt_menge}/${geschenk.menge})</span>` :
            `<span class="badge bg-primary">Verfügbar (${geschenk.menge})</span>`;

        const geldIcon = geschenk.ist_geldgeschenk ? '💰 ' : '🎁 ';
        const preis = geschenk.preis ? `${geschenk.preis} ${geschenk.waehrung}` : '-';

        row.innerHTML = `
            <td>
                ${geldIcon}${geschenk.name}
                ${geschenk.beschreibung ? `<br><small class="text-muted">${geschenk.beschreibung.substring(0, 50)}...</small>` : ''}
            </td>
            <td><span class="badge bg-secondary">${geschenk.kategorie}</span></td>
            <td>${preis}</td>
            <td>${statusBadge}</td>
            <td>${geschenk.ausgewaehlt_von_name || '-'}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" onclick="geschenklisteAdmin.showDetails(${geschenk.id})" title="Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-primary" onclick="geschenklisteAdmin.editGeschenk(${geschenk.id})" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${istAusgewaehlt ? `
                        <button class="btn btn-outline-warning" onclick="geschenklisteAdmin.freigebenGeschenk(${geschenk.id})" title="Freigeben">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-outline-danger" onclick="geschenklisteAdmin.deleteGeschenk(${geschenk.id})" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        return row;
    }

    showDetails(geschenkId) {
        const geschenk = this.geschenke.find(g => g.id === geschenkId);
        if (!geschenk) return;

        const istAusgewaehlt = geschenk.ausgewaehlt_menge > 0;
        
        document.getElementById('detail-title').textContent = geschenk.name;
        document.getElementById('detail-content').innerHTML = `
            <div class="row">
                <div class="col-12">
                    <p><strong>Kategorie:</strong> ${geschenk.kategorie}</p>
                    <p><strong>Beschreibung:</strong> ${geschenk.beschreibung || 'Keine'}</p>
                    <p><strong>Preis:</strong> ${geschenk.preis ? `${geschenk.preis} ${geschenk.waehrung}` : 'Nicht angegeben'}</p>
                    <p><strong>Artikel URL:</strong> ${geschenk.link ? `<a href="${geschenk.link}" target="_blank" class="text-primary">Produktseite öffnen <i class="fas fa-external-link-alt"></i></a>` : 'Keine'}</p>
                    
                    ${istAusgewaehlt ? `
                        <hr>
                        <h6>Auswahl-Details</h6>
                        <p><strong>Ausgewählt von:</strong> ${geschenk.ausgewaehlt_von_name}</p>
                        <p><strong>Ausgewählt am:</strong> ${new Date(geschenk.ausgewaehlt_am).toLocaleDateString('de-DE')}</p>
                        <p><strong>Ausgewählte Menge:</strong> ${geschenk.ausgewaehlt_menge} von ${geschenk.menge}</p>
                    ` : ''}
                </div>
            </div>
        `;

        // Freigeben Button anzeigen falls ausgewählt
        const freigebenBtn = document.getElementById('freigeben-btn');
        if (istAusgewaehlt) {
            freigebenBtn.style.display = 'inline-block';
            freigebenBtn.onclick = () => {
                bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
                this.freigebenGeschenk(geschenkId);
            };
        } else {
            freigebenBtn.style.display = 'none';
        }

        new bootstrap.Modal(document.getElementById('detailModal')).show();
    }

    editGeschenk(geschenkId) {
        const geschenk = this.geschenke.find(g => g.id === geschenkId);
        if (!geschenk) return;

        this.currentGeschenk = geschenk;
        
        // Form füllen
        document.getElementById('geschenk-id').value = geschenk.id;
        document.getElementById('geschenk-name').value = geschenk.name;
        document.getElementById('geschenk-kategorie').value = geschenk.kategorie;
        document.getElementById('geschenk-beschreibung').value = geschenk.beschreibung || '';
        document.getElementById('geschenk-preis').value = geschenk.preis || '';
        document.getElementById('geschenk-waehrung').value = geschenk.waehrung || 'EUR';
        document.getElementById('geschenk-menge').value = geschenk.menge;
        document.getElementById('geschenk-prioritaet').value = geschenk.prioritaet;
        document.getElementById('geschenk-link').value = geschenk.link || '';
        document.getElementById('geschenk-bild-url').value = geschenk.bild_url || '';

        // Modal Titel ändern
        document.getElementById('modal-title').textContent = 'Geschenk bearbeiten';

        new bootstrap.Modal(document.getElementById('addGeschenkModal')).show();
    }

    async saveGeschenk() {
        const form = document.getElementById('geschenk-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const geschenkData = {
            name: document.getElementById('geschenk-name').value,
            kategorie: document.getElementById('geschenk-kategorie').value,
            beschreibung: document.getElementById('geschenk-beschreibung').value,
            preis: parseFloat(document.getElementById('geschenk-preis').value) || null,
            waehrung: document.getElementById('geschenk-waehrung').value,
            menge: parseInt(document.getElementById('geschenk-menge').value),
            prioritaet: document.getElementById('geschenk-prioritaet').value,
            link: document.getElementById('geschenk-link').value,
            bild_url: document.getElementById('geschenk-bild-url').value
        };

        try {
            const geschenkId = document.getElementById('geschenk-id').value;
            const isEdit = geschenkId !== '';
            
            const url = isEdit ? `/api/geschenkliste/edit/${geschenkId}` : '/api/geschenkliste/add';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(geschenkData)
            });

            const data = await response.json();
            
            if (data.success) {
                this.showSuccess(data.message);
                bootstrap.Modal.getInstance(document.getElementById('addGeschenkModal')).hide();
                this.loadGeschenke();
                this.loadStatistiken();
            } else {
                this.showError(data.error || 'Fehler beim Speichern');
            }
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            this.showError('Netzwerkfehler beim Speichern');
        }
    }

    async deleteGeschenk(geschenkId) {
        this.showConfirm(
            'Geschenk löschen',
            'Sind Sie sicher, dass Sie dieses Geschenk löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.',
            async () => {
                try {
                    const response = await fetch(`/api/geschenkliste/delete/${geschenkId}`, {
                        method: 'DELETE'
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        this.showSuccess(data.message);
                        this.loadGeschenke();
                        this.loadStatistiken();
                    } else {
                        this.showError(data.error || 'Fehler beim Löschen');
                    }
                } catch (error) {
                    console.error('Fehler beim Löschen:', error);
                    this.showError('Netzwerkfehler beim Löschen');
                }
            },
            'Löschen'
        );
    }

    async freigebenGeschenk(geschenkId) {
        this.showConfirm(
            'Geschenk freigeben',
            'Sind Sie sicher, dass Sie dieses Geschenk wieder freigeben möchten? Es wird dann wieder für andere Gäste verfügbar sein.',
            async () => {
                try {
                    const response = await fetch(`/api/geschenkliste/admin/freigeben/${geschenkId}`, {
                        method: 'POST'
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        this.showSuccess(data.message);
                        this.loadGeschenke();
                        this.loadStatistiken();
                    } else {
                        this.showError(data.error || 'Fehler beim Freigeben');
                    }
                } catch (error) {
                    console.error('Fehler beim Freigeben:', error);
                    this.showError('Netzwerkfehler beim Freigeben');
                }
            },
            'Freigeben',
            'btn-warning'
        );
    }

    applyFilters() {
        const kategorie = document.getElementById('kategorie-filter').value;
        const status = document.getElementById('status-filter').value;
        const search = document.getElementById('search-input').value.toLowerCase();

        const filteredGeschenke = this.geschenke.filter(geschenk => {
            // Kategorie Filter
            if (kategorie && geschenk.kategorie !== kategorie) return false;
            
            // Status Filter
            if (status === 'verfuegbar' && geschenk.ausgewaehlt_menge > 0) return false;
            if (status === 'ausgewaehlt' && geschenk.ausgewaehlt_menge === 0) return false;
            
            // Such Filter
            if (search && !geschenk.name.toLowerCase().includes(search) && 
                !geschenk.beschreibung?.toLowerCase().includes(search)) return false;
            
            return true;
        });

        this.renderFilteredGeschenke(filteredGeschenke);
    }

    renderFilteredGeschenke(geschenke) {
        const tbody = document.getElementById('geschenke-tbody');
        tbody.innerHTML = '';

        geschenke.forEach(geschenk => {
            const row = this.createGeschenkRow(geschenk);
            tbody.appendChild(row);
        });
    }

    resetForm() {
        document.getElementById('geschenk-form').reset();
        document.getElementById('geschenk-id').value = '';
        document.getElementById('modal-title').textContent = 'Neues Geschenk hinzufügen';
        this.currentGeschenk = null;
    }

    async freigebenGeldgeschenk(gastId) {
        if (!confirm('Möchten Sie die Geldgeschenk-Auswahl dieses Gastes wirklich freigeben?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/geldgeschenk/admin/freigeben/${gastId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Geldgeschenk-Auswahl erfolgreich freigegeben');
                this.loadGeldgeschenkAuswahlen(); // Tabelle neu laden
                this.loadStatistiken(); // Statistiken aktualisieren
            } else {
                this.showError(data.error || 'Fehler beim Freigeben');
            }
        } catch (error) {
            console.error('Fehler beim Freigeben der Geldgeschenk-Auswahl:', error);
            this.showError('Netzwerkfehler beim Freigeben');
        }
    }

    showConfirm(title, message, onConfirm, confirmButtonText = 'Bestätigen', confirmButtonClass = 'btn-danger') {
        // Modal-Elemente setzen
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const confirmBtn = document.getElementById('confirm-action-btn');
        confirmBtn.textContent = confirmButtonText;
        confirmBtn.className = `btn ${confirmButtonClass}`;
        
        // Event Listener für Bestätigung
        const handleConfirm = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
            modal.hide();
            onConfirm();
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        
        // Modal anzeigen
        const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
        modal.show();
    }

    showSuccess(message) {
        // Einfache Toast-Implementierung
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed';
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999;';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        new bootstrap.Toast(toast).show();
        setTimeout(() => toast.remove(), 5000);
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed';
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999;';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        new bootstrap.Toast(toast).show();
        setTimeout(() => toast.remove(), 5000);
    }
}

// Initialisierung
let geschenklisteAdmin;
document.addEventListener('DOMContentLoaded', () => {
    geschenklisteAdmin = new GeschenklisteAdmin();
});
