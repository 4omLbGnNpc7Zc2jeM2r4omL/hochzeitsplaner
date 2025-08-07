/**
 * Kontakte Verwaltung - JavaScript
 */

let alleKontakte = [];
let gefilterteKontakte = [];
let aktuellerKontakt = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Kontakte-Seite geladen');
    
    // Event Listeners
    setupEventListeners();
    
    // Kontakte laden
    ladeKontakte();
});

function setupEventListeners() {
    // Filter Event Listeners
    document.getElementById('kategorie-filter').addEventListener('change', filterKontakte);
    document.getElementById('bewertung-filter').addEventListener('change', filterKontakte);
    document.getElementById('suche-input').addEventListener('input', debounce(filterKontakte, 300));
    
    // Modal Event Listeners
    document.getElementById('btn-kontakt-aufnehmen').addEventListener('click', starteKontaktaufnahme);
    document.getElementById('btn-kontakt-senden').addEventListener('click', sendeKontaktanfrage);
    document.getElementById('btn-email-senden').addEventListener('click', sendeEmail);
}

function ladeKontakte() {
    console.log('Lade Kontakte...');
    
    // Loading anzeigen
    document.getElementById('loading-spinner').classList.remove('d-none');
    document.getElementById('error-message').classList.add('d-none');
    document.getElementById('kontakte-container').innerHTML = '';
    
    fetch('/api/kontakte/list')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Kontakte geladen:', data);
            
            if (data.success) {
                alleKontakte = data.kontakte || [];
                gefilterteKontakte = [...alleKontakte];
                
                // Loading verstecken
                document.getElementById('loading-spinner').classList.add('d-none');
                
                // Statistiken anzeigen
                zeigeStatistiken();
                
                // Kontakte anzeigen
                zeigeKontakte();
            } else {
                throw new Error(data.error || 'Unbekannter Fehler beim Laden der Kontakte');
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Kontakte:', error);
            
            // Loading verstecken
            document.getElementById('loading-spinner').classList.add('d-none');
            
            // Fehler anzeigen
            document.getElementById('error-text').textContent = error.message;
            document.getElementById('error-message').classList.remove('d-none');
        });
}

function zeigeStatistiken() {
    const totalKontakte = alleKontakte.length;
    const kategorien = new Set(alleKontakte.map(k => k.kategorie)).size;
    const topRated = alleKontakte.filter(k => parseInt(k.bewertung) === 5).length;
    
    // Statistiken setzen
    document.getElementById('total-kontakte').textContent = totalKontakte;
    document.getElementById('total-kategorien').textContent = kategorien;
    document.getElementById('top-rated').textContent = topRated;
    
    // Statistik Cards anzeigen
    document.getElementById('statistik-cards').classList.remove('d-none');
}

function zeigeKontakte() {
    const container = document.getElementById('kontakte-container');
    const emptyState = document.getElementById('empty-state');
    
    if (gefilterteKontakte.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('d-none');
        return;
    }
    
    emptyState.classList.add('d-none');
    
    const kontakteHtml = gefilterteKontakte.map(kontakt => {
        return createKontaktCard(kontakt);
    }).join('');
    
    container.innerHTML = kontakteHtml;
}

function createKontaktCard(kontakt) {
    const bewertungSterne = createStarRating(parseInt(kontakt.bewertung || 0));
    const preisRange = kontakt.preis_von && kontakt.preis_bis ? 
        `${kontakt.preis_von}€ - ${kontakt.preis_bis}€` : 'Preis auf Anfrage';
    
    const kategorieIcon = getKategorieIcon(kontakt.kategorie);
    
    // Bild HTML generieren
    const bildHtml = kontakt.bild_url ? `
        <div class="card-img-top-wrapper" style="height: 200px; overflow: hidden; border-radius: 0.375rem 0.375rem 0 0;">
            <img src="${kontakt.bild_url}" 
                 alt="${escapeHtml(kontakt.name)}" 
                 class="card-img-top" 
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.style.display='none'; this.parentElement.style.display='none';">
        </div>
    ` : '';
    
    return `
        <div class="col-lg-4 col-md-6">
            <div class="card wedding-card h-100 border-0 shadow-sm contact-card" data-contact='${JSON.stringify(kontakt)}'>
                ${bildHtml}
                <div class="card-header border-0 py-3" style="background: linear-gradient(135deg, var(--wedding-gold), var(--wedding-light-gold));">
                    <div class="d-flex align-items-center">
                        <i class="${kategorieIcon} fa-lg me-3" style="color: var(--wedding-gold-text);"></i>
                        <div>
                            <h6 class="mb-0 fw-bold" style="color: var(--wedding-gold-text);">${escapeHtml(kontakt.name)}</h6>
                            <small style="color: var(--wedding-gold-text); opacity: 0.8;">${escapeHtml(kontakt.kategorie)}</small>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row g-2 mb-3">
                        <div class="col-12">
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2">${bewertungSterne}</span>
                                <span class="small text-muted">(${kontakt.bewertung}/5)</span>
                            </div>
                        </div>
                        <div class="col-12">
                            <small class="text-muted d-flex align-items-center">
                                <i class="fas fa-phone me-2"></i>
                                <a href="tel:${kontakt.telefon}" class="text-decoration-none">${escapeHtml(kontakt.telefon)}</a>
                            </small>
                        </div>
                        <div class="col-12">
                            <small class="text-muted d-flex align-items-center">
                                <i class="fas fa-envelope me-2"></i>
                                <a href="mailto:${kontakt.email}" class="text-decoration-none text-truncate">${escapeHtml(kontakt.email)}</a>
                            </small>
                        </div>
                        <div class="col-12">
                            <small class="text-muted d-flex align-items-center">
                                <i class="fas fa-map-marker-alt me-2"></i>
                                <span class="text-truncate">${escapeHtml(kontakt.adresse)}</span>
                            </small>
                        </div>
                        <div class="col-12">
                            <small class="text-success fw-semibold d-flex align-items-center">
                                <i class="fas fa-euro-sign me-2"></i>
                                ${preisRange}
                            </small>
                        </div>
                    </div>
                    
                    ${kontakt.notizen ? `
                        <div class="alert alert-info-subtle p-2 mb-3">
                            <small class="text-muted">
                                <i class="fas fa-sticky-note me-1"></i>
                                ${escapeHtml(kontakt.notizen)}
                            </small>
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer bg-transparent border-0 pt-0">
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-wedding-primary btn-sm" onclick="zeigeKontaktDetails(this)">
                            <i class="fas fa-info-circle me-2"></i>Details anzeigen
                        </button>
                        <button class="btn btn-success btn-sm" onclick="direkteKontaktaufnahme(this)">
                            <i class="fas fa-envelope me-2"></i>Kontakt aufnehmen
                        </button>
                        ${kontakt.website ? `
                            <a href="${kontakt.website}" target="_blank" class="btn btn-wedding-primary btn-sm">
                                <i class="fas fa-external-link-alt me-2"></i>Website besuchen
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '⭐';
        } else {
            stars += '☆';
        }
    }
    return stars;
}

function getKategorieIcon(kategorie) {
    const icons = {
        'Fotograf': 'fas fa-camera',
        'DJ': 'fas fa-music',
        'Caterer': 'fas fa-utensils',
        'Location': 'fas fa-building',
        'Florist': 'fas fa-seedling',
        'Band': 'fas fa-guitar',
        'Videograf': 'fas fa-video',
        'Konditor': 'fas fa-birthday-cake'
    };
    return icons[kategorie] || 'fas fa-user';
}

function filterKontakte() {
    const kategorieFilter = document.getElementById('kategorie-filter').value;
    const bewertungFilter = document.getElementById('bewertung-filter').value;
    const sucheText = document.getElementById('suche-input').value.toLowerCase();
    
    gefilterteKontakte = alleKontakte.filter(kontakt => {
        // Kategorie Filter
        if (kategorieFilter && kontakt.kategorie !== kategorieFilter) {
            return false;
        }
        
        // Bewertung Filter
        if (bewertungFilter && parseInt(kontakt.bewertung) < parseInt(bewertungFilter)) {
            return false;
        }
        
        // Suche Filter
        if (sucheText) {
            const suchbereiche = [
                kontakt.name || '',
                kontakt.adresse || '',
                kontakt.notizen || '',
                kontakt.email || ''
            ];
            
            const gefunden = suchbereiche.some(feld => 
                feld.toLowerCase().includes(sucheText)
            );
            
            if (!gefunden) {
                return false;
            }
        }
        
        return true;
    });
    
    zeigeKontakte();
}

function zeigeKontaktDetails(button) {
    const card = button.closest('.contact-card');
    const kontaktData = JSON.parse(card.dataset.contact);
    aktuellerKontakt = kontaktData; // Speichere für Kontaktaufnahme
    
    const detailsContainer = document.getElementById('kontakt-details');
    const websiteBtn = document.getElementById('btn-kontakt-website');
    const kontaktBtn = document.getElementById('btn-kontakt-aufnehmen');
    
    const bewertungSterne = createStarRating(parseInt(kontaktData.bewertung || 0));
    const kategorieIcon = getKategorieIcon(kontaktData.kategorie);
    
    detailsContainer.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="d-flex align-items-center mb-3">
                    <i class="${kategorieIcon} fa-2x me-3" style="color: var(--wedding-gold);"></i>
                    <div>
                        <h4 class="mb-1">${escapeHtml(kontaktData.name)}</h4>
                        <span class="badge" style="background: var(--wedding-gold); color: var(--wedding-gold-text);">${escapeHtml(kontaktData.kategorie)}</span>
                    </div>
                </div>
                
                <div class="mb-3">
                    <h6 class="text-muted mb-2">Bewertung</h6>
                    <div class="d-flex align-items-center">
                        <span class="me-2">${bewertungSterne}</span>
                        <span>${kontaktData.bewertung}/5 Sterne</span>
                    </div>
                </div>
                
                <div class="mb-3">
                    <h6 class="text-muted mb-2">Kontaktdaten</h6>
                    <p class="mb-1">
                        <i class="fas fa-phone me-2 text-muted"></i>
                        <a href="tel:${kontaktData.telefon}" class="text-decoration-none">${escapeHtml(kontaktData.telefon)}</a>
                    </p>
                    <p class="mb-1">
                        <i class="fas fa-envelope me-2 text-muted"></i>
                        <a href="mailto:${kontaktData.email}" class="text-decoration-none">${escapeHtml(kontaktData.email)}</a>
                    </p>
                    <p class="mb-1">
                        <i class="fas fa-map-marker-alt me-2 text-muted"></i>
                        ${escapeHtml(kontaktData.adresse)}
                    </p>
                    ${kontaktData.website ? `
                        <p class="mb-1">
                            <i class="fas fa-globe me-2 text-muted"></i>
                            <a href="${kontaktData.website}" target="_blank" class="text-decoration-none">${escapeHtml(kontaktData.website)}</a>
                        </p>
                    ` : ''}
                </div>
                
                ${kontaktData.notizen ? `
                    <div class="mb-3">
                        <h6 class="text-muted mb-2">Notizen</h6>
                        <div class="alert alert-info-subtle">
                            ${escapeHtml(kontaktData.notizen)}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="col-md-4">
                ${kontaktData.bild_url ? `
                    <div class="card mb-3">
                        <img src="${kontaktData.bild_url}" 
                             alt="${escapeHtml(kontaktData.name)}" 
                             class="card-img-top"
                             style="height: 250px; object-fit: cover;"
                             onerror="this.parentElement.style.display='none';">
                    </div>
                ` : ''}
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h6 class="card-title text-muted mb-3">Preisbereich</h6>
                        ${kontaktData.preis_von && kontaktData.preis_bis ? `
                            <div class="mb-2">
                                <span class="badge bg-success-subtle text-success fs-6 px-3 py-2">
                                    ${kontaktData.preis_von}€ - ${kontaktData.preis_bis}€
                                </span>
                            </div>
                            <small class="text-muted">Preise können variieren</small>
                        ` : `
                            <span class="badge bg-secondary-subtle text-secondary">
                                Preis auf Anfrage
                            </span>
                        `}
                    </div>
                </div>
                
                <div class="mt-3 d-grid">
                    <button class="btn btn-success btn-lg" onclick="starteKontaktaufnahme()">
                        <i class="fas fa-envelope me-2"></i>Kontakt aufnehmen
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Website Button konfigurieren
    if (kontaktData.website) {
        websiteBtn.style.display = 'inline-block';
        websiteBtn.onclick = () => window.open(kontaktData.website, '_blank');
    } else {
        websiteBtn.style.display = 'none';
    }
    
    // Modal anzeigen
    const modal = new bootstrap.Modal(document.getElementById('kontaktDetailModal'));
    modal.show();
}

function direkteKontaktaufnahme(button) {
    const card = button.closest('.contact-card');
    const kontaktData = JSON.parse(card.dataset.contact);
    aktuellerKontakt = kontaktData;
    starteKontaktaufnahme();
}

function starteKontaktaufnahme() {
    if (!aktuellerKontakt) {
        showAlert('Fehler: Kein Kontakt ausgewählt', 'danger');
        return;
    }
    
    // Kontaktaufnahme-Modal befüllen
    document.getElementById('contact-name').value = aktuellerKontakt.name;
    document.getElementById('contact-kategorie').value = aktuellerKontakt.kategorie;
    document.getElementById('contact-email').value = aktuellerKontakt.email;
    
    // Standardwerte für Betreff und Nachricht
    document.getElementById('contact-betreff').value = `Anfrage Hochzeit - ${aktuellerKontakt.kategorie}`;
    document.getElementById('contact-nachricht').value = `Hallo ${aktuellerKontakt.name},\n\nwir planen unsere Hochzeit und interessieren uns für Ihre Dienstleistungen als ${aktuellerKontakt.kategorie}.\n\nKönnten Sie uns weitere Informationen und ein Angebot zukommen lassen?\n\nVielen Dank und freundliche Grüße`;
    
    // Details Modal schließen falls offen
    const detailModal = bootstrap.Modal.getInstance(document.getElementById('kontaktDetailModal'));
    if (detailModal) {
        detailModal.hide();
    }
    
    // Kontaktaufnahme Modal öffnen
    const kontaktModal = new bootstrap.Modal(document.getElementById('kontaktaufnahmeModal'));
    kontaktModal.show();
}

function sendeKontaktanfrage() {
    const betreff = document.getElementById('contact-betreff').value.trim();
    const nachricht = document.getElementById('contact-nachricht').value.trim();
    
    if (!betreff || !nachricht) {
        showAlert('Bitte füllen Sie alle Felder aus', 'warning');
        return;
    }
    
    // Loading-Zustand
    const sendenBtn = document.getElementById('btn-kontakt-senden');
    const originalText = sendenBtn.innerHTML;
    sendenBtn.disabled = true;
    sendenBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Wird verarbeitet...';
    
    // API-Aufruf
    fetch('/api/kontakte/contact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            kontakt_name: aktuellerKontakt.name,
            kontakt_kategorie: aktuellerKontakt.kategorie,
            kontakt_email: aktuellerKontakt.email,
            betreff: betreff,
            nachricht: nachricht
        })
    })
    .then(response => response.json())
    .then(data => {
        sendenBtn.disabled = false;
        sendenBtn.innerHTML = originalText;
        
        if (data.success) {
            // Kontaktaufnahme Modal schließen
            const kontaktModal = bootstrap.Modal.getInstance(document.getElementById('kontaktaufnahmeModal'));
            kontaktModal.hide();
            
            showAlert(data.message, 'success');
            
            // E-Mail Modal öffnen falls E-Mail-Daten vorhanden
            if (data.email_data) {
                setTimeout(() => {
                    oeffneEmailModal(data.email_data);
                }, 500);
            }
        } else {
            showAlert(data.error || 'Fehler bei der Kontaktaufnahme', 'danger');
        }
    })
    .catch(error => {
        console.error('Fehler:', error);
        sendenBtn.disabled = false;
        sendenBtn.innerHTML = originalText;
        showAlert('Netzwerkfehler bei der Kontaktaufnahme', 'danger');
    });
}

function oeffneEmailModal(emailData) {
    // E-Mail Modal befüllen
    document.getElementById('email-to').value = emailData.to;
    document.getElementById('email-subject').value = emailData.subject;
    document.getElementById('email-body').value = emailData.body;
    
    // E-Mail Modal öffnen
    const emailModal = new bootstrap.Modal(document.getElementById('emailModal'));
    emailModal.show();
}

function sendeEmail() {
    const to = document.getElementById('email-to').value;
    const subject = document.getElementById('email-subject').value;
    const body = document.getElementById('email-body').value;
    
    if (!subject.trim() || !body.trim()) {
        showAlert('Bitte füllen Sie Betreff und Nachricht aus', 'warning');
        return;
    }
    
    // Loading-Zustand
    const sendenBtn = document.getElementById('btn-email-senden');
    const originalText = sendenBtn.innerHTML;
    sendenBtn.disabled = true;
    sendenBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Wird gesendet...';
    
    // E-Mail über bestehende E-Mail API senden
    fetch('/api/email/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to: to,
            subject: subject,
            body: body
        })
    })
    .then(response => response.json())
    .then(data => {
        sendenBtn.disabled = false;
        sendenBtn.innerHTML = originalText;
        
        if (data.success) {
            // E-Mail Modal schließen
            const emailModal = bootstrap.Modal.getInstance(document.getElementById('emailModal'));
            emailModal.hide();
            
            showAlert('E-Mail wurde erfolgreich gesendet!', 'success');
        } else {
            showAlert(data.error || 'Fehler beim Senden der E-Mail', 'danger');
        }
    })
    .catch(error => {
        console.error('Fehler:', error);
        sendenBtn.disabled = false;
        sendenBtn.innerHTML = originalText;
        showAlert('Netzwerkfehler beim Senden der E-Mail', 'danger');
    });
}

function showAlert(message, type) {
    // Nutze das bestehende Notification-System falls verfügbar
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        // Fallback: Einfaches Alert
        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'warning' ? 'alert-warning' : 'alert-danger';
        
        const alertHtml = `
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Füge Alert am Anfang der Seite ein
        const container = document.querySelector('.container-fluid');
        if (container) {
            container.insertAdjacentHTML('afterbegin', alertHtml);
        }
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
