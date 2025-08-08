/**
 * Google Maps Integration für Hochzeitsplaner
 * Unterstützt Kartenvorschauen mit echtem Google Maps API
 */

class GoogleMapsIntegration {
    constructor() {
        this.apiKey = null;
        this.initialized = false;
        this.config = null;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch('/static/google_maps_config.json');
            this.config = await response.json();
            this.apiKey = this.config.google_maps?.api_key;
            
            if (this.apiKey && this.apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY') {
                this.initialized = true;

            } else {

            }
        } catch (error) {

        }
    }

    /**
     * Erstellt eine Google Maps Embed URL
     */
    createEmbedUrl(address, options = {}) {
        if (!this.initialized || !this.apiKey) {
            return this.createFallbackUrl(address, options);
        }

        const zoom = options.zoom || this.config.google_maps?.default_zoom || 15;
        const mapType = options.mapType || this.config.google_maps?.map_type || 'roadmap';
        
        const encodedAddress = encodeURIComponent(address);
        return `https://www.google.com/maps/embed/v1/place?key=${this.apiKey}&q=${encodedAddress}&zoom=${zoom}&maptype=${mapType}`;
    }

    /**
     * Fallback URL ohne API-Key
     */
    createFallbackUrl(address, options = {}) {
        const encodedAddress = encodeURIComponent(address);
        const zoom = options.zoom || 15;
        return `https://maps.google.com/maps?q=${encodedAddress}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
    }

    /**
     * Erstellt eine Google Maps Such-URL
     */
    createSearchUrl(address) {
        const encodedAddress = encodeURIComponent(address);
        return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }

    /**
     * Aktualisiert eine Kartenvorschau
     */
    updateMapPreview(containerId, address, options = {}) {
        const container = document.getElementById(containerId);
        if (!container || !address) {

            return false;
        }

        const embedUrl = this.createEmbedUrl(address, options);
        const searchUrl = this.createSearchUrl(address);
        
        // Erstelle Map Container
        const mapHtml = this.initialized ? 
            this.createEmbedMapHtml(embedUrl, searchUrl, address) :
            this.createFallbackMapHtml(searchUrl, address);

        container.innerHTML = mapHtml;
        container.style.display = 'block';
        

        return true;
    }

    /**
     * HTML für echte Google Maps Embed
     */
    createEmbedMapHtml(embedUrl, searchUrl, address) {
        return `
            <div class="ratio ratio-16x9 border rounded overflow-hidden">
                <iframe 
                    src="${embedUrl}"
                    frameborder="0" 
                    style="border:0;" 
                    allowfullscreen="" 
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    title="Google Maps - ${address}">
                </iframe>
            </div>
            <div class="mt-2 text-center">
                <a href="${searchUrl}" 
                   target="_blank" 
                   class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-map me-1"></i>
                    In Google Maps öffnen
                    <i class="bi bi-box-arrow-up-right ms-1"></i>
                </a>
            </div>
        `;
    }

    /**
     * HTML für Fallback ohne API-Key
     */
    createFallbackMapHtml(searchUrl, address) {
        return `
            <div class="d-flex align-items-center justify-content-center bg-light border rounded p-4" style="min-height: 250px;">
                <div class="text-center">
                    <i class="bi bi-geo-alt text-primary mb-3" style="font-size: 2.5rem;"></i>
                    <h6 class="mb-3">${address}</h6>
                    <a href="${searchUrl}" 
                       target="_blank" 
                       class="btn btn-primary">
                        <i class="bi bi-map me-1"></i>
                        In Google Maps öffnen
                        <i class="bi bi-box-arrow-up-right ms-1"></i>
                    </a>
                    <p class="text-muted small mt-2 mb-0">
                        Kartenvorschau erfordert Google Maps API
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Aktualisiert mehrere Karten für Location-Daten
     */
    updateLocationMaps(locationsData) {
        if (!locationsData) {

            return;
        }

        let hasAnyMaps = false;

        // Standesamt
        if (locationsData.standesamt?.adresse) {
            this.updateMapPreview('standesamtMapPreview', locationsData.standesamt.adresse);
            hasAnyMaps = true;
        }

        // Hochzeitslocation
        if (locationsData.hochzeitslocation?.adresse) {
            this.updateMapPreview('hochzeitslocationMapPreview', locationsData.hochzeitslocation.adresse);
            hasAnyMaps = true;
        }

        // Gäste-Dashboard Karten
        if (locationsData.standesamt?.adresse) {
            this.updateMapPreview('guestStandesamtMapPreview', locationsData.standesamt.adresse);
        }

        if (locationsData.hochzeitslocation?.adresse) {
            this.updateMapPreview('guestHochzeitslocationMapPreview', locationsData.hochzeitslocation.adresse);
        }

        // Map Section anzeigen
        if (hasAnyMaps) {
            const mapSections = [
                'mapPreviewsSection',
                'guestMapPreviewsSection'
            ];
            
            mapSections.forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.style.display = 'block';
                }
            });
        }

        return hasAnyMaps;
    }

    /**
     * Prüft ob Google Maps verfügbar ist
     */
    isAvailable() {
        return this.initialized;
    }

    /**
     * Status-Info für Debugging
     */
    getStatus() {
        return {
            initialized: this.initialized,
            hasApiKey: !!this.apiKey,
            config: this.config
        };
    }
}

// Globale Instanz erstellen
window.googleMaps = new GoogleMapsIntegration();

// Event Listener für Seitenladung
document.addEventListener('DOMContentLoaded', function() {
    // Kurz warten bis Config geladen ist
    setTimeout(() => {

    }, 1000);
});

