// Guest Geschenkliste JavaScript
class GuestGeschenkliste {
    constructor() {
        this.geschenke = [];
        this.meineGeschenke = [];
        this.init();
    }

    init() {
        this.loadGeschenklisteTextConfig();
        this.loadGeschenke();
        this.loadMeineGeschenke();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Toggle-Button für Geschenkliste-Info
        const toggleBtn = document.getElementById('toggle-geschenkliste-info');
        const toggleIcon = document.getElementById('toggle-icon');
        const geschenklisteInfo = document.getElementById('geschenkliste-info');
        
        if (toggleBtn && toggleIcon && geschenklisteInfo) {
            geschenklisteInfo.addEventListener('shown.bs.collapse', function() {
                toggleIcon.className = 'bi bi-chevron-up';
            });
            
            geschenklisteInfo.addEventListener('hidden.bs.collapse', function() {
                toggleIcon.className = 'bi bi-chevron-down';
            });
        }

        // Filter
        document.getElementById('kategorie-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('preis-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('search-input').addEventListener('input', () => this.applyFilters());

        // Auswahl bestätigen
        document.getElementById('bestaetigen-btn').addEventListener('click', () => this.confirmSelection());
        document.getElementById('geld-bestaetigen-btn').addEventListener('click', () => this.confirmGeldgeschenk());
    }

    async loadGeschenklisteTextConfig() {
        try {
            const response = await fetch('/api/geschenkliste/guest-text-config');
            const data = await response.json();
            
            if (data.success && data.config) {
                const titelElement = document.getElementById('geschenkliste-titel');
                const beschreibungElement = document.getElementById('geschenkliste-beschreibung');
                
                if (titelElement) {
                    titelElement.textContent = `🎁 ${data.config.titel}`;
                }
                
                if (beschreibungElement) {
                    beschreibungElement.textContent = data.config.beschreibung;
                }
            }
        } catch (error) {
            console.error('Fehler beim Laden der Geschenkliste Text-Konfiguration:', error);
        }
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

    async loadMeineGeschenke() {
        try {
            const response = await fetch('/api/geschenkliste/meine');
            const data = await response.json();
            
            if (data.success) {
                this.meineGeschenke = data.geschenke;
                this.renderMeineGeschenke();
            }
        } catch (error) {
            console.error('Fehler beim Laden der eigenen Geschenke:', error);
        }
    }

    renderMeineGeschenke() {
        const section = document.getElementById('meine-geschenke-section');
        const liste = document.getElementById('meine-geschenke-liste');
        
        if (this.meineGeschenke.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        liste.innerHTML = '';

        this.meineGeschenke.forEach(geschenk => {
            const div = document.createElement('div');
            div.className = 'border rounded p-3 mb-2 bg-light';
            
            const geldIcon = geschenk.ist_geldgeschenk ? '💰 ' : '🎁 ';
            const preis = geschenk.ist_geldgeschenk || geschenk.kategorie === 'Geld' ? 
                ' - Wunschbetrag' : 
                (geschenk.preis ? ` - ${geschenk.preis} ${geschenk.waehrung}` : '');
            
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${geldIcon}${geschenk.name}</strong>${preis}
                        <br><small class="text-muted">${geschenk.beschreibung || ''}</small>
                        <br><small class="text-success">Ausgewählt am: ${new Date(geschenk.ausgewaehlt_am).toLocaleDateString('de-DE')}</small>
                    </div>
                    <button class="btn btn-outline-warning btn-sm" onclick="guestGeschenkliste.freigebenGeschenk(${geschenk.id})">
                        <i class="fas fa-undo"></i> Freigeben
                    </button>
                </div>
            `;
            
            liste.appendChild(div);
        });
    }

    renderGeschenke() {
        const grid = document.getElementById('geschenke-grid');
        grid.innerHTML = '';

        // Nur verfügbare Geschenke anzeigen
        const verfuegbareGeschenke = this.geschenke.filter(g => g.ausgewaehlt_menge < g.menge);

        if (verfuegbareGeschenke.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <h4>🎁 Alle Geschenke wurden bereits ausgewählt</h4>
                        <p>Vielen Dank für Ihr Interesse! Alle Geschenke aus unserer Liste wurden bereits von anderen Gästen ausgewählt.</p>
                    </div>
                </div>
            `;
            return;
        }

        verfuegbareGeschenke.forEach(geschenk => {
            const card = this.createGeschenkCard(geschenk);
            grid.appendChild(card);
        });
    }

    createGeschenkCard(geschenk) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';
        
        const geldIcon = geschenk.ist_geldgeschenk ? '💰' : '🎁';
        const preis = geschenk.ist_geldgeschenk || geschenk.kategorie === 'Geld' ? 
            'Wunschbetrag' : 
            (geschenk.preis ? `${geschenk.preis} ${geschenk.waehrung}` : 'Preis auf Anfrage');
        const verfuegbar = geschenk.menge - (geschenk.ausgewaehlt_menge || 0);
        
        // Priorität Badge
        let priorityBadge = '';
        if (geschenk.prioritaet === 'Hoch') {
            priorityBadge = '<span class="badge bg-danger">Hoch</span>';
        } else if (geschenk.prioritaet === 'Niedrig') {
            priorityBadge = '<span class="badge bg-secondary">Niedrig</span>';
        }

        col.innerHTML = `
            <div class="card h-100 shadow-sm">
                ${geschenk.bild_url ? `
                    <img src="${geschenk.bild_url}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${geschenk.name}">
                ` : `
                    <div class="card-img-top d-flex align-items-center justify-content-center bg-light" style="height: 200px; font-size: 4rem;">
                        ${geldIcon}
                    </div>
                `}
                <div class="card-body d-flex flex-column">
                    <div class="mb-2">
                        <span class="badge bg-primary">${geschenk.kategorie}</span>
                        ${priorityBadge}
                    </div>
                    <h5 class="card-title">${geschenk.name}</h5>
                    <p class="card-text flex-grow-1">${geschenk.beschreibung || 'Keine Beschreibung verfügbar'}</p>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <strong class="text-primary">${preis}</strong>
                            <small class="text-muted">${verfuegbar} verfügbar</small>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-success" onclick="guestGeschenkliste.selectGeschenk(${geschenk.id})">
                                <i class="fas fa-heart"></i> Auswählen
                            </button>
                            ${geschenk.link ? `
                                <a href="${geschenk.link}" target="_blank" class="btn btn-outline-info btn-sm">
                                    <i class="fas fa-external-link-alt"></i> Details ansehen
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        return col;
    }

    selectGeschenk(geschenkId) {
        const geschenk = this.geschenke.find(g => g.id === geschenkId);
        if (!geschenk) return;

        this.currentSelection = geschenk;

        // Spezialbehandlung für Geldgeschenke
        if (geschenk.ist_geldgeschenk) {
            this.showGeldgeschenkModal(geschenk);
            return;
        }

        // Normales Geschenk Modal
        document.getElementById('auswahl-title').textContent = `${geschenk.name} auswählen`;
        
        const content = document.getElementById('auswahl-content');
        const verfuegbar = geschenk.menge - (geschenk.ausgewaehlt_menge || 0);
        const preis = geschenk.ist_geldgeschenk || geschenk.kategorie === 'Geld' ? 
            'Wunschbetrag' : 
            (geschenk.preis ? `${geschenk.preis} ${geschenk.waehrung}` : 'Preis auf Anfrage');
        
        content.innerHTML = `
            <div class="text-center">
                <h5>🎁 ${geschenk.name}</h5>
                <p class="text-muted">${geschenk.beschreibung || ''}</p>
                <p><strong>Preis:</strong> ${preis}</p>
                <p><strong>Kategorie:</strong> ${geschenk.kategorie}</p>
                
                ${verfuegbar > 1 ? `
                    <div class="mb-3">
                        <label for="menge-auswahl" class="form-label">Menge auswählen:</label>
                        <select class="form-select" id="menge-auswahl">
                            ${Array.from({length: verfuegbar}, (_, i) => 
                                `<option value="${i + 1}">${i + 1}</option>`
                            ).join('')}
                        </select>
                    </div>
                ` : ''}
                
                <p class="text-info">
                    <i class="fas fa-info-circle"></i> 
                    Nach der Auswahl wird dieses Geschenk für andere Gäste nicht mehr sichtbar sein.
                </p>
            </div>
        `;

        new bootstrap.Modal(document.getElementById('auswahlModal')).show();
    }

    showGeldgeschenkModal(geschenk) {
        const preis = geschenk.ist_geldgeschenk || geschenk.kategorie === 'Geld' ? 
            'Ihren Wunschbetrag' : 
            (geschenk.preis ? `${geschenk.preis} ${geschenk.waehrung}` : 'einen Betrag');
        
        document.querySelector('#paypalModal .modal-body p').innerHTML = `
            Sie können ${preis} als Geldgeschenk bequem über PayPal senden:
        `;

        if (geschenk.paypal_link) {
            document.getElementById('paypal-link').href = geschenk.paypal_link;
            document.getElementById('paypal-link').style.display = 'inline-block';
        } else {
            document.getElementById('paypal-link').style.display = 'none';
        }

        this.currentSelection = geschenk;
        new bootstrap.Modal(document.getElementById('paypalModal')).show();
    }

    async confirmSelection() {
        if (!this.currentSelection) return;

        const menge = document.getElementById('menge-auswahl')?.value || 1;

        try {
            const response = await fetch(`/api/geschenkliste/waehlen/${this.currentSelection.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ menge: parseInt(menge) })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Geschenk erfolgreich ausgewählt! Vielen Dank!');
                bootstrap.Modal.getInstance(document.getElementById('auswahlModal')).hide();
                this.loadGeschenke();
                this.loadMeineGeschenke();
            } else {
                this.showError(data.error || 'Fehler beim Auswählen des Geschenks');
            }
        } catch (error) {
            console.error('Fehler beim Auswählen:', error);
            this.showError('Netzwerkfehler beim Auswählen');
        }
    }

    async confirmGeldgeschenk() {
        if (!this.currentSelection) return;

        try {
            const response = await fetch(`/api/geschenkliste/waehlen/${this.currentSelection.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ menge: 1 })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Geldgeschenk erfolgreich ausgewählt! Vielen Dank!');
                bootstrap.Modal.getInstance(document.getElementById('paypalModal')).hide();
                this.loadGeschenke();
                this.loadMeineGeschenke();
            } else {
                this.showError(data.error || 'Fehler beim Auswählen des Geldgeschenks');
            }
        } catch (error) {
            console.error('Fehler beim Auswählen:', error);
            this.showError('Netzwerkfehler beim Auswählen');
        }
    }

    async freigebenGeschenk(geschenkId) {
        if (!confirm('Sind Sie sicher, dass Sie dieses Geschenk wieder freigeben möchten?')) return;

        try {
            const response = await fetch(`/api/geschenkliste/freigeben/${geschenkId}`, {
                method: 'POST'
            });

            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Geschenk erfolgreich freigegeben');
                this.loadGeschenke();
                this.loadMeineGeschenke();
            } else {
                this.showError(data.error || 'Fehler beim Freigeben');
            }
        } catch (error) {
            console.error('Fehler beim Freigeben:', error);
            this.showError('Netzwerkfehler beim Freigeben');
        }
    }

    applyFilters() {
        const kategorie = document.getElementById('kategorie-filter').value;
        const preisRange = document.getElementById('preis-filter').value;
        const search = document.getElementById('search-input').value.toLowerCase();

        let filteredGeschenke = this.geschenke.filter(geschenk => {
            // Nur verfügbare Geschenke
            if (geschenk.ausgewaehlt_menge >= geschenk.menge) return false;
            
            // Kategorie Filter
            if (kategorie && geschenk.kategorie !== kategorie) return false;
            
            // Preis Filter
            if (preisRange && geschenk.preis) {
                const preis = geschenk.preis;
                if (preisRange === '0-25' && preis > 25) return false;
                if (preisRange === '25-50' && (preis <= 25 || preis > 50)) return false;
                if (preisRange === '50-100' && (preis <= 50 || preis > 100)) return false;
                if (preisRange === '100-200' && (preis <= 100 || preis > 200)) return false;
                if (preisRange === '200+' && preis <= 200) return false;
            }
            
            // Such Filter
            if (search && !geschenk.name.toLowerCase().includes(search) && 
                !geschenk.beschreibung?.toLowerCase().includes(search)) return false;
            
            return true;
        });

        this.renderFilteredGeschenke(filteredGeschenke);
    }

    renderFilteredGeschenke(geschenke) {
        const grid = document.getElementById('geschenke-grid');
        grid.innerHTML = '';

        if (geschenke.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        <h5>🔍 Keine Geschenke gefunden</h5>
                        <p>Mit den aktuellen Filtereinstellungen wurden keine Geschenke gefunden.</p>
                    </div>
                </div>
            `;
            return;
        }

        geschenke.forEach(geschenk => {
            const card = this.createGeschenkCard(geschenk);
            grid.appendChild(card);
        });
    }

    showSuccess(message) {
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
let guestGeschenkliste;
document.addEventListener('DOMContentLoaded', () => {
    guestGeschenkliste = new GuestGeschenkliste();
});
