/**
 * OpenStreetMap Integration für Hochzeitsplaner
 * Verwendet Leaflet.js für Kartendarstellung ohne API-Keys
 */

console.log('🔄 Lade OpenStreetMap Integration...');

// Debug: Teste window Objekt
console.log('🔍 window verfügbar:', typeof window);
console.log('🔍 document verfügbar:', typeof document);

class OpenStreetMapIntegration {
    constructor() {
        console.log('🏗️ OpenStreetMapIntegration Constructor gestartet');
        try {
            this.initialized = false;
            console.log('✅ initialized = false gesetzt');
            
            this.maps = new Map(); // Speichert erstellte Karten
            console.log('✅ maps Map erstellt');
            
            this.loadLeafletCSS();
            console.log('✅ loadLeafletCSS aufgerufen');
            
            // WICHTIG: loadLeafletJS ist async, aber Constructor kann nicht async sein
            // Daher wird initialized erst später auf true gesetzt
            this.loadLeafletJS().catch(error => {
                console.error('❌ Fehler beim Laden von Leaflet.js:', error);
            });
            console.log('✅ loadLeafletJS gestartet (async)');
            
            console.log('✅ OpenStreetMapIntegration Constructor abgeschlossen');
        } catch (error) {
            console.error('❌ Fehler im OpenStreetMapIntegration Constructor:', error);
            throw error;
        }
    }

    loadLeafletCSS() {
        // Leaflet CSS laden (falls nicht bereits geladen)
        if (!document.querySelector('link[href*="leaflet"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);
        }
    }

    async loadLeafletJS() {
        // Leaflet JS laden (falls nicht bereits geladen)
        if (typeof L === 'undefined') {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
                script.crossOrigin = '';
                script.onload = () => {
                    this.initialized = true;
                    console.log('✅ Leaflet.js erfolgreich geladen');
                    resolve();
                };
                script.onerror = () => {
                    console.error('❌ Fehler beim Laden von Leaflet.js');
                    reject();
                };
                document.head.appendChild(script);
            });
        } else {
            this.initialized = true;
            console.log('✅ Leaflet.js bereits verfügbar');
            return Promise.resolve();
        }
    }

    /**
     * Erstellt eine interaktive Karte in einem Container
     */
    async createMap(containerId, options = {}) {
        try {
            await this.loadLeafletJS();
            
            if (!this.initialized || typeof L === 'undefined') {
                console.error('❌ Leaflet.js nicht verfügbar');
                return null;
            }

            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`❌ Container ${containerId} nicht gefunden`);
                return null;
            }

            // Standard-Optionen
            const defaultOptions = {
                center: [50.7753, 6.0839], // Aachen als lokales Zentrum
                zoom: 13,
                scrollWheelZoom: true,
                zoomControl: true,
                attributionControl: true
            };

            const mapOptions = { ...defaultOptions, ...options };

            // Karte erstellen
            const map = L.map(containerId, {
                center: mapOptions.center,
                zoom: mapOptions.zoom,
                scrollWheelZoom: mapOptions.scrollWheelZoom,
                zoomControl: mapOptions.zoomControl,
                attributionControl: mapOptions.attributionControl
            });

            // Verbesserte OpenStreetMap Tiles mit schärferer Darstellung
            L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                subdomains: ['a', 'b', 'c']
            }).addTo(map);

            // Karte speichern für spätere Referenz
            this.maps.set(containerId, map);

            console.log(`✅ Karte ${containerId} erfolgreich erstellt`);
            return map;

        } catch (error) {
            console.error(`❌ Fehler beim Erstellen der Karte ${containerId}:`, error);
            return null;
        }
    }

    /**
     * Fügt einen Marker mit Popup zur Karte hinzu
     */
    addMarker(mapOrContainerId, lat, lng, popupText = '', options = {}) {
        try {
            let map;
            
            if (typeof mapOrContainerId === 'string') {
                map = this.maps.get(mapOrContainerId);
            } else {
                map = mapOrContainerId;
            }

            if (!map) {
                console.error('❌ Karte nicht gefunden');
                return null;
            }

            const marker = L.marker([lat, lng], options).addTo(map);
            
            if (popupText) {
                marker.bindPopup(popupText);
            }

            return marker;

        } catch (error) {
            console.error('❌ Fehler beim Hinzufügen des Markers:', error);
            return null;
        }
    }

    /**
     * Geocoding über Nominatim API (OpenStreetMap) mit erweiterten Suchstrategien
     */
    async geocodeAddress(address) {
        try {
            if (!address || typeof address !== 'string') {
                console.error('❌ Ungültige Adresse für Geocoding:', address);
                return null;
            }

            const originalAddress = address.trim();
            console.log(`🔍 Starte Geocoding für: "${originalAddress}"`);

            // Spezielle Behandlung für bekannte Aachen-Adressen
            const aachenSpecialCases = {
                'Rathaus, Markt 39, 52062 Aachen': { lat: 50.7753, lng: 6.0839 },
                'Markt 39, 52062 Aachen': { lat: 50.7753, lng: 6.0839 },
                'Rathaus Aachen': { lat: 50.7753, lng: 6.0839 },
                'Kruppstraße 28, 52072 Aachen': { lat: 50.7847, lng: 6.0947 },
                'Kruppstraße 28 Aachen': { lat: 50.7847, lng: 6.0947 },
                'Hotel Kastanienhof': { lat: 50.7847, lng: 6.0947 },
                'Weißer Saal': { lat: 50.7753, lng: 6.0839 }
            };

            // Prüfe zuerst bekannte Adressen (case-insensitive)
            const normalizedAddress = originalAddress.toLowerCase();
            for (const [knownAddress, coords] of Object.entries(aachenSpecialCases)) {
                if (normalizedAddress.includes(knownAddress.toLowerCase()) || 
                    knownAddress.toLowerCase().includes(normalizedAddress)) {
                    console.log(`✅ Bekannte Adresse gefunden: ${originalAddress} → ${knownAddress}`);
                    return coords;
                }
            }

            // Verschiedene Suchstrategien ausprobieren
            const searchStrategies = [
                // 1. Originale Adresse
                originalAddress,
                
                // 2. Nur Stadt wenn Postleitzahl vorhanden
                originalAddress.match(/\d{5}\s+([^,]+)/)?.[1]?.trim(),
                
                // 3. Straße und Stadt (ohne Hausnummer für bessere Treffer)
                originalAddress.replace(/,\s*\d{5}/, '').trim(),
                
                // 4. Nur die Postleitzahl + Stadt
                originalAddress.match(/(\d{5}\s+[^,]+)/)?.[1]?.trim(),
                
                // 5. Nur die Stadt
                originalAddress.includes('Aachen') ? 'Aachen, Deutschland' : originalAddress.split(',').pop()?.trim()
            ].filter(Boolean); // Entferne undefined/null Werte

            for (let i = 0; i < searchStrategies.length; i++) {
                const searchTerm = searchStrategies[i];
                if (!searchTerm || searchTerm.length < 3) continue;
                
                console.log(`🔍 Strategie ${i + 1}: "${searchTerm}"`);
                
                try {
                    const result = await this.tryGeocode(searchTerm, i + 1);
                    if (result) {
                        console.log(`✅ Geocoding erfolgreich mit Strategie ${i + 1}: ${result.lat}, ${result.lng}`);
                        return result;
                    }
                } catch (strategyError) {
                    console.warn(`⚠️ Strategie ${i + 1} fehlgeschlagen:`, strategyError.message);
                }
            }

            console.warn(`⚠️ Alle Geocoding-Strategien fehlgeschlagen für: "${originalAddress}"`);
            return null;

        } catch (error) {
            console.error('❌ Geocoding Fehler für "' + address + '":', error);
            return null;
        }
    }

    /**
     * Hilfsfunktion für einzelne Geocoding-Versuche
     */
    async tryGeocode(searchTerm, strategyNumber) {
        const encodedAddress = encodeURIComponent(searchTerm);
        const baseUrl = 'https://nominatim.openstreetmap.org/search';
        const params = [
            'format=json',
            `q=${encodedAddress}`,
            'limit=1',
            'addressdetails=1',
            'countrycodes=de' // Beschränke auf Deutschland
        ];
        const url = `${baseUrl}?${params.join('&')}`;
        
        console.log(`🌐 Nominatim URL (Strategie ${strategyNumber}): ${url}`);
        
        // Timeout für die Anfrage hinzufügen
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 Sekunden Timeout
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Hochzeitsplaner-App/1.0 (https://example.com)',
                'Accept': 'application/json',
                'Accept-Language': 'de,en'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📍 Geocoding Antwort (Strategie ${strategyNumber}):`, data);

        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error('Ungültige Koordinaten erhalten');
            }
            
            return { 
                lat, 
                lng, 
                display_name: result.display_name,
                address: result.address || {},
                importance: result.importance || 0,
                search_term: searchTerm,
                strategy: strategyNumber
            };
        }
        
        return null;
    }

    /**
     * Zentriert die Karte auf eine Adresse (Geocoding über Nominatim)
     */
    async centerOnAddress(mapOrContainerId, address) {
        try {
            let map;
            
            if (typeof mapOrContainerId === 'string') {
                map = this.maps.get(mapOrContainerId);
                if (!map) {
                    console.error(`❌ Karte nicht gefunden: ${mapOrContainerId}`);
                    return false;
                }
            } else {
                map = mapOrContainerId;
            }

            if (!map) {
                console.error('❌ Keine gültige Karte für centerOnAddress');
                return false;
            }

            console.log(`🔍 Suche Adresse: "${address}"`);
            
            // Geocoding durchführen
            const result = await this.geocodeAddress(address);
            
            if (result && result.lat && result.lng) {
                console.log(`� Zentriere Karte auf: ${result.lat}, ${result.lng}`);
                
                // Karte auf neue Position zentrieren mit angemessenem Zoom
                map.setView([result.lat, result.lng], 15);
                
                // Marker hinzufügen
                const marker = L.marker([result.lat, result.lng]).addTo(map);
                
                // Popup mit Adressinformationen
                const popupContent = `
                    <div style="text-align: center;">
                        <strong>${address}</strong><br>
                        <small>${result.display_name}</small>
                    </div>
                `;
                marker.bindPopup(popupContent);
                
                console.log(`✅ Karte erfolgreich zentriert und Marker hinzugefügt`);
                return true;
                
            } else {
                console.warn(`⚠️ Adresse nicht gefunden: "${address}"`);
                
                // Fallback: Zeige Deutschland-Übersicht
                map.setView([51.1657, 10.4515], 6);
                
                // Info-Marker hinzufügen
                const fallbackMarker = L.marker([51.1657, 10.4515]).addTo(map);
                fallbackMarker.bindPopup(`
                    <div style="text-align: center;">
                        <strong>⚠️ Adresse nicht gefunden</strong><br>
                        <small>"${address}"</small><br>
                        <em>Deutschland-Übersicht angezeigt</em>
                    </div>
                `);
                
                return false;
            }

        } catch (error) {
            console.error('❌ Fehler beim Zentrieren der Karte:', error);
            
            // Notfall-Fallback
            if (map) {
                map.setView([51.1657, 10.4515], 6);
            }
            
            return false;
        }
    }

    /**
     * Erstellt eine Karte mit mehreren Locations
     */
    async createMultiLocationMap(containerId, locations = [], options = {}) {
        try {
            const map = await this.createMap(containerId, options);
            
            if (!map || !locations.length) {
                return map;
            }

            const markers = [];
            const bounds = L.latLngBounds();

            for (const location of locations) {
                if (location.address) {
                    const result = await this.geocodeAddress(location.address);
                    if (result) {
                        const popupContent = `
                            <div>
                                <h4>${location.name || 'Location'}</h4>
                                <p><strong>Adresse:</strong> ${location.address}</p>
                                ${location.beschreibung ? `<p>${location.beschreibung}</p>` : ''}
                            </div>
                        `;
                        
                        const marker = this.addMarker(map, result.lat, result.lng, popupContent);
                        if (marker) {
                            markers.push(marker);
                            bounds.extend([result.lat, result.lng]);
                        }
                    }
                } else if (location.lat && location.lng) {
                    const popupContent = `
                        <div>
                            <h4>${location.name || 'Location'}</h4>
                            ${location.beschreibung ? `<p>${location.beschreibung}</p>` : ''}
                        </div>
                    `;
                    
                    const marker = this.addMarker(map, location.lat, location.lng, popupContent);
                    if (marker) {
                        markers.push(marker);
                        bounds.extend([location.lat, location.lng]);
                    }
                }
            }

            // Karte auf alle Marker zoomen, falls mehr als einer vorhanden
            if (markers.length > 1) {
                map.fitBounds(bounds, { padding: [20, 20] });
            }

            return map;

        } catch (error) {
            console.error('❌ Fehler beim Erstellen der Multi-Location Karte:', error);
            return null;
        }
    }

    /**
     * Entfernt eine Karte
     */
    removeMap(containerId) {
        const map = this.maps.get(containerId);
        if (map) {
            map.remove();
            this.maps.delete(containerId);
            console.log(`✅ Karte ${containerId} entfernt`);
        }
    }

    /**
     * Erstellt eine einfache Karte für eine einzelne Adresse
     */
    async createSimpleLocationMap(containerId, address, locationName = '') {
        try {
            console.log(`🗺️ Erstelle einfache Karte für Container: ${containerId}, Adresse: "${address}"`);
            
            // Prüfe ob Container existiert
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`❌ Container nicht gefunden: ${containerId}`);
                return null;
            }

            const map = await this.createMap(containerId, {
                zoom: 15, // Starte mit mittlerem Zoom für bessere Sicht
                scrollWheelZoom: false // Für bessere UX in Cards
            });

            if (!map) {
                console.error(`❌ Karte konnte nicht erstellt werden für Container: ${containerId}`);
                return null;
            }

            if (address && address.trim()) {
                console.log(`📍 Starte Geocoding für Adresse: "${address}"`);
                
                try {
                    const result = await this.geocodeAddress(address);
                    
                    if (result && result.lat && result.lng) {
                        console.log(`🎯 Geocoding erfolgreich! Setze Kartenansicht auf: ${result.lat}, ${result.lng}`);
                        
                        // Karte zentrieren mit optimiertem Zoom für Location-Anzeige
                        map.setView([result.lat, result.lng], 17, {
                            animate: true,
                            duration: 1
                        });
                        
                        // Angepasster Marker mit besserem Icon
                        const marker = L.marker([result.lat, result.lng], {
                            icon: L.icon({
                                iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                                shadowSize: [41, 41]
                            })
                        }).addTo(map);
                        
                        // Verbessertes Popup
                        const popupContent = locationName ? 
                            `<div style="text-align: center; font-family: system-ui;"><strong style="color: #2c5aa0;">${locationName}</strong><br><small style="color: #666;">${address}</small></div>` : 
                            `<div style="text-align: center; font-family: system-ui;"><strong style="color: #2c5aa0;">${address}</strong></div>`;
                        
                        marker.bindPopup(popupContent);
                        
                        console.log(`✅ Karte erfolgreich erstellt mit Adresse: "${address}"`);
                        return map;
                        
                    } else {
                        console.warn(`⚠️ Geocoding fehlgeschlagen für: "${address}" - Zeige Fallback`);
                        
                        // Fallback: Aachen Region anzeigen (lokaler Bezug)
                        map.setView([50.7753, 6.0839], 12);
                        
                        // Info-Marker mit Fehlermeldung
                        const fallbackMarker = L.marker([50.7753, 6.0839], {
                            icon: L.icon({
                                iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                                shadowSize: [41, 41]
                            })
                        }).addTo(map);
                        fallbackMarker.bindPopup(`
                            <div style="text-align: center; font-family: system-ui;">
                                <strong style="color: #d63031;">⚠️ Adresse nicht gefunden</strong><br>
                                <small style="color: #666;">"${address}"</small><br>
                                <em style="color: #999;">Bitte Adresse überprüfen</em>
                            </div>
                        `);
                        
                        return map;
                    }
                    
                } catch (geocodingError) {
                    console.error(`❌ Geocoding Fehler für "${address}":`, geocodingError);
                    
                    // Fallback bei Geocoding-Fehler
                    map.setView([50.7753, 6.0839], 12);
                    
                    const errorMarker = L.marker([50.7753, 6.0839], {
                        icon: L.icon({
                            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                            shadowSize: [41, 41]
                        })
                    }).addTo(map);
                    errorMarker.bindPopup(`
                        <div style="text-align: center; font-family: system-ui;">
                            <strong style="color: #d63031;">❌ Geocoding Fehler</strong><br>
                            <small style="color: #666;">"${address}"</small><br>
                            <em style="color: #999;">Netzwerkproblem oder Server nicht erreichbar</em>
                        </div>
                    `);
                    
                    return map;
                }
                
            } else {
                console.warn(`⚠️ Keine Adresse angegeben für Container: ${containerId}`);
                // Fallback: Zeige Aachen Region
                map.setView([50.7753, 6.0839], 12);
                
                const infoMarker = L.marker([50.7753, 6.0839], {
                    icon: L.icon({
                        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                        shadowSize: [41, 41]
                    })
                }).addTo(map);
                infoMarker.bindPopup(`
                    <div style="text-align: center; font-family: system-ui;">
                        <strong style="color: #0984e3;">ℹ️ Keine Adresse</strong><br>
                        <em style="color: #666;">Bitte geben Sie eine Adresse ein</em>
                    </div>
                `);
                
                return map;
            }

        } catch (error) {
            console.error('❌ Fehler beim Erstellen der einfachen Karte:', error);
            return null;
        }
    }
}

// Debug-Funktion für Geocoding-Tests
window.testGeocoding = async function(address) {
    console.log(`🧪 Teste Geocoding für: "${address}"`);
    
    try {
        // Direkter Test mit verschiedenen Ansätzen
        const testUrls = [
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=de`,
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1&countrycodes=de`
        ];
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            console.log(`🔍 Test ${i + 1}: ${url}`);
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Hochzeitsplaner-App/1.0',
                        'Accept': 'application/json'
                    }
                });
                
                console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
                console.log(`📊 Response Headers:`, [...response.headers.entries()]);
                
                if (response.ok) {
                    const text = await response.text();
                    console.log(`📄 Raw Response:`, text);
                    
                    const data = JSON.parse(text);
                    console.log(`📍 Test ${i + 1} Ergebnis:`, data);
                    
                    if (data && data.length > 0) {
                        const result = data[0];
                        console.log(`✅ Test ${i + 1} erfolgreich: ${result.lat}, ${result.lon}`);
                        return { lat: parseFloat(result.lat), lng: parseFloat(result.lon), display_name: result.display_name };
                    } else {
                        console.warn(`⚠️ Test ${i + 1}: Keine Ergebnisse`);
                    }
                } else {
                    console.error(`❌ Test ${i + 1} HTTP Fehler: ${response.status}`);
                }
            } catch (testError) {
                console.error(`❌ Test ${i + 1} Fehler:`, testError);
            }
        }
        
        console.warn(`⚠️ Alle Geocoding Tests fehlgeschlagen für: "${address}"`);
        return null;
        
    } catch (error) {
        console.error('❌ Geocoding Test Fehler:', error);
        return null;
    }
}

console.log('📚 OpenStreetMapIntegration Klasse definiert');

// Debug: Teste Klassen-Instanziierung
console.log('🏗️ Beginne Instanzerstellung...');
try {
    // Instanz sofort erstellen
    window.openStreetMap = new OpenStreetMapIntegration();
    console.log('🗺️ OpenStreetMap Instanz erstellt');
    console.log('🔍 window.openStreetMap type:', typeof window.openStreetMap);
    console.log('🔍 window.openStreetMap instanceof OpenStreetMapIntegration:', window.openStreetMap instanceof OpenStreetMapIntegration);
} catch (error) {
    console.error('❌ Fehler beim Erstellen der OpenStreetMap Instanz:', error);
    console.error('❌ Error stack:', error.stack);
}

// Helper-Funktionen für einfache Nutzung
console.log('🔧 Erstelle Helper-Funktionen...');
try {
    window.createLocationMap = async function(containerId, address, locationName = '') {
        return await window.openStreetMap.createSimpleLocationMap(containerId, address, locationName);
    };
    console.log('✅ window.createLocationMap erstellt');

    window.createMultiLocationMap = async function(containerId, locations, options = {}) {
        return await window.openStreetMap.createMultiLocationMap(containerId, locations, options);
    };
    console.log('✅ window.createMultiLocationMap erstellt');
} catch (error) {
    console.error('❌ Fehler beim Erstellen der Helper-Funktionen:', error);
}

// Neue Helper-Funktion: Erstellt Karte mit Backend-Koordinaten
console.log('🌐 Erstelle Backend-Helper-Funktion...');
try {
    window.createLocationMapFromBackend = async function(containerId, locationType, options = {}) {
        try {
            console.log(`🗺️ Erstelle Karte für ${locationType} mit Backend-Koordinaten...`);
            
            // Koordinaten vom Backend holen
            const response = await fetch('/api/guest/location-coordinates', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                console.error(`❌ Backend-Request fehlgeschlagen: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            
            if (!data.success || !data.coordinates || !data.coordinates[locationType]) {
                console.error(`❌ Keine Koordinaten für ${locationType} verfügbar:`, data);
                return null;
            }

            const coords = data.coordinates[locationType];
            
            // Standard-Optionen mit höherem Zoom für bessere Detailansicht
            const mapOptions = {
                zoom: 17,
                zoomControl: true,
                scrollWheelZoom: false,
                ...options
            };

            // Karte erstellen
            const map = await window.openStreetMap.createMap(containerId, mapOptions);
            
            if (!map) {
                console.error(`❌ Karte ${containerId} konnte nicht erstellt werden`);
                return null;
            }

            // Karte auf die Koordinaten zentrieren
            map.setView([coords.lat, coords.lng], mapOptions.zoom);

            // Marker hinzufügen
            const marker = L.marker([coords.lat, coords.lng]).addTo(map);
            
            console.log(`✅ Karte ${containerId} erfolgreich mit Backend-Koordinaten erstellt`);
            return map;

        } catch (error) {
            console.error(`❌ Fehler beim Erstellen der Karte ${containerId} mit Backend-Koordinaten:`, error);
            return null;
        }
    };
    console.log('✅ window.createLocationMapFromBackend erstellt');
} catch (error) {
    console.error('❌ Fehler beim Erstellen der Backend-Helper-Funktion:', error);
}

// Instanz erstellen nur falls noch nicht vorhanden (redundante Prüfung für Sicherheit)
console.log('🔍 Redundante Prüfung...');
if (!window.openStreetMap) {
    console.log('⚠️ window.openStreetMap nicht gefunden, erstelle redundante Instanz');
    try {
        window.openStreetMap = new OpenStreetMapIntegration();
        console.log('🔄 Redundante OpenStreetMap Instanz erstellt');
    } catch (error) {
        console.error('❌ Fehler bei redundanter Instanzerstellung:', error);
    }
} else {
    console.log('✅ window.openStreetMap bereits vorhanden');
}

console.log('✅ OpenStreetMap Integration geladen');
console.log('📊 Final Status:');
console.log('  - window.openStreetMap:', typeof window.openStreetMap);
console.log('  - window.createLocationMap:', typeof window.createLocationMap);
console.log('  - window.createLocationMapFromBackend:', typeof window.createLocationMapFromBackend);
