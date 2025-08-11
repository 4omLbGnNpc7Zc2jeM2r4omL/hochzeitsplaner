/**
 * OpenStreetMap Integration für Hochzeitsplaner
 * Verwendet Leaflet.js für Kartendarstellung ohne API-Keys
 * v1.1 - Debug Control
 */

// Debug-Modus - auf false setzen um alle Debug-Ausgaben zu deaktivieren
const DEBUG_OPENSTREETMAP = false;

// Debug-Helper-Funktion
function debugLog(...args) {
    if (DEBUG_OPENSTREETMAP) {

    }
}

debugLog('🔄 Lade OpenStreetMap Integration...');

// Debug: Teste window Objekt
debugLog('🔍 window verfügbar:', typeof window);
debugLog('🔍 document verfügbar:', typeof document);

class OpenStreetMapIntegration {
    constructor() {
        debugLog('🏗️ OpenStreetMapIntegration Constructor gestartet');
        try {
            this.initialized = false;
            debugLog('✅ initialized = false gesetzt');
            
            this.maps = new Map(); // Speichert erstellte Karten
            debugLog('✅ maps Map erstellt');
            
            this.loadLeafletCSS();
            debugLog('✅ loadLeafletCSS aufgerufen');
            
            // WICHTIG: loadLeafletJS ist async, aber Constructor kann nicht async sein
            // Daher wird initialized erst später auf true gesetzt
            this.loadLeafletJS().catch(error => {

            });
            debugLog('✅ loadLeafletJS gestartet (async)');
            
            debugLog('✅ OpenStreetMapIntegration Constructor abgeschlossen');
        } catch (error) {

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
                    debugLog('✅ Leaflet.js erfolgreich geladen');
                    resolve();
                };
                script.onerror = () => {

                    reject();
                };
                document.head.appendChild(script);
            });
        } else {
            this.initialized = true;
            debugLog('✅ Leaflet.js bereits verfügbar');
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

                return null;
            }

            const container = document.getElementById(containerId);
            if (!container) {

                return null;
            }

            // Prüfe ob Container bereits initialisiert ist und bereinige ihn
            if (this.maps.has(containerId)) {
                debugLog(`🔄 Bereinige bereits existierende Karte für Container ${containerId}`);
                const existingMap = this.maps.get(containerId);
                try {
                    existingMap.remove();
                } catch (e) {
                    // Ignoriere Fehler beim Entfernen
                }
                this.maps.delete(containerId);
                
                // Container-HTML bereinigen
                container.innerHTML = '';
                container._leaflet_id = null;
                delete container._leaflet_id;
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

            debugLog(`✅ Karte ${containerId} erfolgreich erstellt`);
            return map;

        } catch (error) {

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

                return null;
            }

            const marker = L.marker([lat, lng], options).addTo(map);
            
            if (popupText) {
                marker.bindPopup(popupText);
            }

            return marker;

        } catch (error) {

            return null;
        }
    }

    /**
     * Geocoding über Nominatim API (OpenStreetMap) mit erweiterten Suchstrategien
     */
    async geocodeAddress(address) {
        try {
            if (!address || typeof address !== 'string') {

                return null;
            }

            const originalAddress = address.trim();
            debugLog(`🔍 Starte Geocoding für: "${originalAddress}"`);

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
                    debugLog(`✅ Bekannte Adresse gefunden: ${originalAddress} → ${knownAddress}`);
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
                
                debugLog(`🔍 Strategie ${i + 1}: "${searchTerm}"`);
                
                try {
                    const result = await this.tryGeocode(searchTerm, i + 1);
                    if (result) {
                        debugLog(`✅ Geocoding erfolgreich mit Strategie ${i + 1}: ${result.lat}, ${result.lng}`);
                        return result;
                    }
                } catch (strategyError) {

                }
            }


            return null;

        } catch (error) {

            return null;
        }
    }

    /**
     * Hilfsfunktion für einzelne Geocoding-Versuche
     */
    async tryGeocode(searchTerm, strategyNumber) {
        // Verwende die neue lokale API anstatt direkt Nominatim
        const encodedAddress = encodeURIComponent(searchTerm);
        const url = `/api/geocode?q=${encodedAddress}`;
        
        debugLog(`🌐 Lokale Geocoding API (Strategie ${strategyNumber}): ${url}`);
        
        // Timeout für die Anfrage hinzufügen
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 Sekunden Timeout
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        debugLog(`📍 Geocoding Antwort (Strategie ${strategyNumber}):`, data);

        if (data && data.success) {
            const lat = parseFloat(data.lat);
            const lng = parseFloat(data.lng);
            
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error('Ungültige Koordinaten erhalten');
            }
            
            return { 
                lat, 
                lng,
                lon: lng, // Alias für Kompatibilität  
                display_name: data.display_name || searchTerm,
                address: {},
                importance: 1,
                search_term: searchTerm,
                strategy: strategyNumber,
                source: data.source || 'api'
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

                    return false;
                }
            } else {
                map = mapOrContainerId;
            }

            if (!map) {

                return false;
            }

            debugLog(`🔍 Suche Adresse: "${address}"`);
            
            // Geocoding durchführen
            const result = await this.geocodeAddress(address);
            
            if (result && result.lat && result.lng) {
                debugLog(`� Zentriere Karte auf: ${result.lat}, ${result.lng}`);
                
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
                
                debugLog(`✅ Karte erfolgreich zentriert und Marker hinzugefügt`);
                return true;
                
            } else {

                
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
            debugLog(`✅ Karte ${containerId} entfernt`);
        }
    }

    /**
     * Erstellt eine erweiterte Karte für Location mit optionalen Parkplätzen
     */
    async createLocationMapWithParking(containerId, locationData, options = {}) {
        try {
            debugLog(`🗺️ Erstelle Location-Karte mit Parkplätzen für Container: ${containerId}`);
            
            // Standard-Optionen
            const defaultOptions = {
                showRoutes: true,  // Standardmäßig Routen anzeigen
                routeType: 'walking'  // 'walking' für echte Routen, 'straight' für Luftlinie
            };
            
            const mapOptions = { ...defaultOptions, ...options };
            
            // Prüfe ob Container existiert
            const container = document.getElementById(containerId);
            if (!container) {
                debugLog(`❌ Container ${containerId} nicht gefunden`);
                return null;
            }

            const map = await this.createMap(containerId, {
                zoom: 15,
                scrollWheelZoom: false
            });

            if (!map) {
                debugLog(`❌ Karte konnte nicht erstellt werden`);
                return null;
            }

            const markers = [];
            const bounds = L.latLngBounds();

            // Haupt-Location hinzufügen (unterstützt sowohl 'address' als auch 'adresse')
            const mainAddress = locationData.address || locationData.adresse;
            if (mainAddress) {
                const result = await this.geocodeAddress(mainAddress);
                if (result && result.lat && result.lng) {
                    const mainMarker = L.marker([result.lat, result.lng], {
                        icon: L.icon({
                            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                            shadowSize: [41, 41]
                        })
                    }).addTo(map);
                    
                    const popupContent = `
                        <div style="text-align: center; font-family: system-ui;">
                            <strong style="color: #2c5aa0;">${locationData.name || 'Hochzeitslocation'}</strong><br>
                            <small style="color: #666;">${mainAddress}</small>
                            ${locationData.beschreibung ? `<br><em style="color: #999;">${locationData.beschreibung}</em>` : ''}
                        </div>
                    `;
                    mainMarker.bindPopup(popupContent);
                    
                    markers.push(mainMarker);
                    bounds.extend([result.lat, result.lng]);
                    debugLog(`✅ Hauptlocation-Marker erstellt für: ${mainAddress}`);
                } else {
                    debugLog(`❌ Geocoding fehlgeschlagen für Hauptlocation: ${mainAddress}`);
                }
            } else {
                debugLog(`⚠️ Keine Hauptadresse gefunden in locationData:`, locationData);
            }

            // Parkplätze hinzufügen (falls konfiguriert)
            if (locationData.parkplaetze && Array.isArray(locationData.parkplaetze)) {
                debugLog(`🅿️ Verarbeite ${locationData.parkplaetze.length} Parkplätze`);
                
                for (const parkplatz of locationData.parkplaetze) {
                    let parkingLat, parkingLng;
                    
                    // Unterstütze sowohl 'address' als auch 'adresse'
                    const parkingAddress = parkplatz.address || parkplatz.adresse;
                    
                    if (parkingAddress) {
                        debugLog(`🔍 Geocode Parkplatz-Adresse: ${parkingAddress}`);
                        const parkingResult = await this.geocodeAddress(parkingAddress);
                        if (parkingResult) {
                            parkingLat = parkingResult.lat;
                            parkingLng = parkingResult.lng;
                            debugLog(`✅ Parkplatz geocodiert: ${parkingLat}, ${parkingLng}`);
                        } else {
                            debugLog(`❌ Geocoding fehlgeschlagen für Parkplatz: ${parkingAddress}`);
                        }
                    } else if (parkplatz.lat && parkplatz.lng) {
                        parkingLat = parkplatz.lat;
                        parkingLng = parkplatz.lng;
                        debugLog(`📍 Verwende direkte Koordinaten für Parkplatz: ${parkingLat}, ${parkingLng}`);
                    } else {
                        debugLog(`⚠️ Keine Adresse oder Koordinaten für Parkplatz gefunden:`, parkplatz);
                    }
                    
                    if (parkingLat && parkingLng) {
                        const parkingMarker = L.marker([parkingLat, parkingLng], {
                            icon: L.icon({
                                iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwN0JGRiIvPgo8cGF0aCBkPSJNOCA2SDEyQzE0LjIwOTEgNiAxNiA3Ljc5MDg2IDE2IDEwQzE2IDEyLjIwOTEgMTQuMjA5MSAxNCAxMiAxNEg5VjE4SDhWNloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
                                iconSize: [24, 24],
                                iconAnchor: [12, 24],
                                popupAnchor: [0, -24]
                            })
                        }).addTo(map);
                        
                        const parkingPopup = `
                            <div style="text-align: center; font-family: system-ui;">
                                <strong style="color: #007BFF;">🅿️ ${parkplatz.name || 'Parkplatz'}</strong><br>
                                ${parkingAddress ? `<small style="color: #666;">${parkingAddress}</small><br>` : ''}
                                ${parkplatz.beschreibung ? `<em style="color: #999;">${parkplatz.beschreibung}</em><br>` : ''}
                                ${parkplatz.kostenlos ? '<span style="color: #28a745;">💚 Kostenlos</span>' : ''}
                                ${parkplatz.kostenpflichtig ? '<span style="color: #ffc107;">💰 Kostenpflichtig</span>' : ''}
                            </div>
                        `;
                        parkingMarker.bindPopup(parkingPopup);
                        
                        markers.push(parkingMarker);
                        bounds.extend([parkingLat, parkingLng]);
                        debugLog(`✅ Parkplatz-Marker erstellt: ${parkplatz.name || 'Parkplatz'}`);
                    }
                }
            } else {
                debugLog(`ℹ️ Keine Parkplätze konfiguriert`);
            }

            // Karte auf alle Marker zoomen
            if (markers.length > 1) {
                // Bei mehreren Markern: Passe den Zoom an um alle zu zeigen
                map.fitBounds(bounds, { 
                    padding: [30, 30], 
                    maxZoom: 16  // Nicht zu weit hineinzoomen
                });
                debugLog(`✅ Karte auf ${markers.length} Marker angepasst`);
                
                // Zeichne Wege zwischen Parkplätzen und Hauptlocation (falls aktiviert)
                if (mapOptions.showRoutes && markers.length > 1) {
                    console.log('🛣️ Starte Routen-Zeichnung...');
                    await this.drawSimpleRoutes(map, markers);
                }
                
            } else if (markers.length === 1) {
                // Bei nur einem Marker: Setze einen festen Zoom
                map.setView(bounds.getCenter(), 17);
                debugLog(`✅ Karte auf einzelnen Marker zentriert`);
            } else {
                debugLog(`⚠️ Keine Marker erstellt - Standardansicht verwenden`);
                // Fallback auf eine Standardansicht wenn möglich
                const mainAddress = locationData.address || locationData.adresse;
                if (mainAddress) {
                    const result = await this.geocodeAddress(mainAddress);
                    if (result) {
                        map.setView([result.lat, result.lng], 15);
                    }
                }
            }

            debugLog(`✅ Location-Karte mit ${markers.length} Markern erstellt`);
            return map;

        } catch (error) {
            debugLog(`❌ Fehler beim Erstellen der Location-Karte:`, error);
            return null;
        }
    }

    /**
     * Zeichnet Routen zwischen Parkplätzen und der Hauptlocation
     */
    async drawRoutesToLocation(map, markers, locationData, routeType = 'straight') {
        try {
            console.log('🛣️ drawRoutesToLocation aufgerufen');
            console.log('Markers:', markers);
            console.log('RouteType:', routeType);
            debugLog(`🛣️ Zeichne Routen zwischen Parkplätzen und Hauptlocation (Typ: ${routeType})`);
            
            if (!markers || markers.length === 0) {
                console.log('❌ Keine Marker übergeben');
                return;
            }
            
            // Finde den Hauptlocation-Marker und Parkplätze
            let mainLocationMarker = null;
            const parkingMarkers = [];
            
            console.log('🔍 Analysiere Marker:');
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                console.log(`Marker ${i}:`, marker);
                console.log(`Icon URL:`, marker.options?.icon?.options?.iconUrl);
                
                const icon = marker.options.icon;
                if (icon && icon.options && icon.options.iconUrl) {
                    if (icon.options.iconUrl.includes('marker-icon.png')) {
                        mainLocationMarker = marker;
                        console.log(`✅ Hauptlocation-Marker gefunden (Index ${i})`);
                    } else if (icon.options.iconUrl.includes('data:image/svg+xml') || 
                              icon.options.iconUrl.includes('svg')) {
                        parkingMarkers.push(marker);
                        console.log(`🅿️ Parkplatz-Marker gefunden (Index ${i})`);
                    }
                } else {
                    console.log(`⚠️ Marker ${i} hat kein erkennbares Icon`);
                }
            }
            
            console.log(`Gefunden: ${mainLocationMarker ? 1 : 0} Hauptlocation, ${parkingMarkers.length} Parkplätze`);
            
            if (!mainLocationMarker) {
                console.log('❌ Keine Hauptlocation gefunden');
                debugLog('❌ Keine Hauptlocation gefunden - prüfe Marker-Icons');
                return;
            }
            
            if (parkingMarkers.length === 0) {
                console.log('❌ Keine Parkplätze gefunden');
                debugLog('❌ Keine Parkplätze gefunden - prüfe Parkplatz-Icons');
                return;
            }
            
            const mainLatLng = mainLocationMarker.getLatLng();
            console.log(`🎯 Hauptlocation Koordinaten: ${mainLatLng.lat}, ${mainLatLng.lng}`);
            debugLog(`🎯 Hauptlocation gefunden: ${mainLatLng.lat}, ${mainLatLng.lng}`);
            
            // Zeichne Routen zu allen Parkplätzen
            for (let i = 0; i < parkingMarkers.length; i++) {
                const parkingMarker = parkingMarkers[i];
                const parkingLatLng = parkingMarker.getLatLng();
                
                console.log(`🅿️ Zeichne Route ${i + 1}: Parkplatz (${parkingLatLng.lat}, ${parkingLatLng.lng}) -> Hauptlocation`);
                debugLog(`🅿️ Zeichne Route zu Parkplatz ${i + 1}: ${parkingLatLng.lat}, ${parkingLatLng.lng}`);
                
                // Zeichne Route basierend auf gewähltem Typ
                if (routeType === 'walking') {
                    await this.drawRoute(map, parkingLatLng, mainLatLng, i);
                } else {
                    console.log(`📏 Zeichne Luftlinie ${i + 1}`);
                    this.drawStraightLine(map, parkingLatLng, mainLatLng, i);
                }
            }
            
            console.log('✅ Alle Routen gezeichnet');
            
        } catch (error) {
            console.error('❌ Fehler beim Zeichnen der Routen:', error);
            debugLog('❌ Fehler beim Zeichnen der Routen:', error);
        }
    }

    /**
     * Zeichnet eine Route zwischen zwei Punkten
     */
    async drawRoute(map, startLatLng, endLatLng, routeIndex = 0) {
        try {
            console.log(`🛣️ Zeichne Route ${routeIndex}: Lade echte Fußgängerroute...`);
            
            // Versuche echte Fußgängerroute zu bekommen
            const route = await this.getWalkingRoute(startLatLng, endLatLng);
            
            if (route && route.coordinates && route.coordinates.length > 0) {
                console.log('✅ Echte Fußgängerroute erhalten, zeichne detaillierte Route');
                this.drawRealRoute(map, route, routeIndex);
            } else {
                console.log('⚠️ Keine echte Route verfügbar, verwende verbesserte Luftlinie');
                // Fallback auf Luftlinie mit Fußgänger-Styling
                this.drawWalkingStyleStraightLine(map, startLatLng, endLatLng, routeIndex);
            }
            
        } catch (error) {
            console.error('❌ Routing-Fehler, verwende Luftlinie:', error);
            this.drawWalkingStyleStraightLine(map, startLatLng, endLatLng, routeIndex);
        }
    }

    /**
     * Holt eine echte Walking-Route von OpenRouteService
     */
    async getWalkingRoute(startLatLng, endLatLng) {
        try {
            // Verwende OSRM (Open Source Routing Machine) - kostenlos und ohne API-Key
            const url = `https://router.project-osrm.org/route/v1/foot/${startLatLng.lng},${startLatLng.lat};${endLatLng.lng},${endLatLng.lat}?geometries=geojson&overview=full`;
            
            console.log(`🌐 Lade Fußgängerroute von OSRM: ${url}`);
            
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ OSRM Response:', data);
                
                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    console.log(`🚶‍♀️ Route gefunden: ${Math.round(route.distance)}m, ${Math.round(route.duration/60)}min`);
                    
                    return {
                        coordinates: route.geometry.coordinates,
                        distance: Math.round(route.distance),
                        duration: Math.round(route.duration / 60) // in Minuten
                    };
                }
            } else {
                console.log('⚠️ OSRM API Fehler:', response.status);
            }
            
            return null;
            
        } catch (error) {
            console.log('❌ OSRM API Fehler:', error);
            return null;
        }
    }

    /**
     * Zeichnet eine echte Route auf die Karte
     */
    drawRealRoute(map, route, routeIndex) {
        const colors = ['#007BFF', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
        const color = colors[routeIndex % colors.length];
        
        // Konvertiere Koordinaten von [lng, lat] zu [lat, lng] für Leaflet
        const coordinates = route.coordinates.map(coord => [coord[1], coord[0]]);
        
        console.log(`🗺️ Zeichne echte Route mit ${coordinates.length} Punkten`);
        
        // Hauptroute als durchgehende Linie
        const polyline = L.polyline(coordinates, {
            color: color,
            weight: 5,
            opacity: 0.8
        }).addTo(map);
        
        // Zusätzliche gestrichelte Linie für bessere Sichtbarkeit
        const shadowLine = L.polyline(coordinates, {
            color: '#FFFFFF',
            weight: 7,
            opacity: 0.5,
            dashArray: '0'
        }).addTo(map);
        
        // Bringe die Hauptlinie nach vorne
        polyline.bringToFront();
        
        // Richtungspfeile alle 100m simulieren
        if (coordinates.length > 10) {
            const arrowInterval = Math.max(1, Math.floor(coordinates.length / 5));
            for (let i = arrowInterval; i < coordinates.length; i += arrowInterval) {
                const point = coordinates[i];
                const prevPoint = coordinates[i - 1];
                
                // Berechne Richtung
                const angle = Math.atan2(point[1] - prevPoint[1], point[0] - prevPoint[0]) * 180 / Math.PI;
                
                // Pfeil-Marker
                const arrowMarker = L.marker(point, {
                    icon: L.divIcon({
                        html: `<div style="
                            width: 0; 
                            height: 0; 
                            border-left: 6px solid transparent; 
                            border-right: 6px solid transparent; 
                            border-bottom: 12px solid ${color};
                            transform: rotate(${angle + 90}deg);
                            filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));
                        "></div>`,
                        className: 'route-arrow',
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                    })
                }).addTo(map);
            }
        }
        
        // Detailliertes Popup mit Routeninformationen
        polyline.bindPopup(`
            <div style="text-align: center; font-family: system-ui;">
                <strong style="color: ${color};">🚶‍♀️ Fußweg-Route</strong><br>
                <div style="margin: 8px 0;">
                    <span style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; margin: 2px;">
                        📏 ${route.distance}m
                    </span>
                    <span style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; margin: 2px;">
                        ⏱️ ca. ${route.duration}min
                    </span>
                </div>
                <small style="color: #666;">Optimaler Fußweg zum Parkplatz</small>
            </div>
        `);
        
        // Startpunkt markieren
        const startMarker = L.circleMarker(coordinates[0], {
            radius: 6,
            fillColor: '#28a745',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(map);
        
        startMarker.bindTooltip('🚶‍♀️ Start', {
            permanent: false,
            direction: 'top'
        });
        
        // Endpunkt markieren
        const endMarker = L.circleMarker(coordinates[coordinates.length - 1], {
            radius: 6,
            fillColor: '#dc3545',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(map);
        
        endMarker.bindTooltip('🎯 Ziel', {
            permanent: false,
            direction: 'top'
        });
        
        console.log(`✅ Echte Route gezeichnet: ${route.distance}m, ${route.duration}min`);
    }

    /**
     * Zeichnet eine gestrichelte Luftlinie zwischen zwei Punkten
     */
    drawStraightLine(map, startLatLng, endLatLng, routeIndex) {
        try {
            console.log(`📏 drawStraightLine aufgerufen für Route ${routeIndex}`);
            console.log(`Start: ${startLatLng.lat}, ${startLatLng.lng}`);
            console.log(`Ende: ${endLatLng.lat}, ${endLatLng.lng}`);
            
            const colors = ['#007BFF', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
            const color = colors[routeIndex % colors.length];
            
            // Berechne Entfernung
            const distance = Math.round(startLatLng.distanceTo(endLatLng));
            console.log(`Entfernung: ${distance}m, Farbe: ${color}`);
            
            // Einfache gestrichelte Linie
            const polyline = L.polyline([startLatLng, endLatLng], {
                color: color,
                weight: 4,
                opacity: 0.8,
                dashArray: '12, 8'
            });
            
            console.log('Polyline erstellt, füge zur Karte hinzu...');
            polyline.addTo(map);
            console.log('✅ Polyline zur Karte hinzugefügt');
            
            // Popup für die Linie
            polyline.bindPopup(`
                <div style="text-align: center; font-family: system-ui;">
                    <strong style="color: ${color};">🚶‍♀️ Fußweg</strong><br>
                    <small>Ca. ${distance}m Luftlinie</small><br>
                    <em style="color: #999; font-size: 12px;">Tatsächlicher Weg kann länger sein</em>
                </div>
            `);
            
            console.log(`✅ Route ${routeIndex} gezeichnet: ${distance}m mit Farbe ${color}`);
            debugLog(`✅ Luftlinie gezeichnet: ${distance}m mit Farbe ${color}`);
            
        } catch (error) {
            console.error(`❌ Fehler beim Zeichnen der Luftlinie ${routeIndex}:`, error);
            debugLog(`❌ Fehler beim Zeichnen der Luftlinie ${routeIndex}:`, error);
        }
    }

    /**
     * Zeichnet eine verbesserte Luftlinie mit Fußgänger-Styling
     */
    drawWalkingStyleStraightLine(map, startLatLng, endLatLng, routeIndex) {
        try {
            const colors = ['#007BFF', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
            const color = colors[routeIndex % colors.length];
            
            // Berechne Entfernung und geschätzte Gehzeit
            const distance = Math.round(startLatLng.distanceTo(endLatLng));
            const walkingTime = Math.round(distance / 80); // ca. 80m/min Gehgeschwindigkeit
            
            console.log(`🚶‍♀️ Zeichne Fußgänger-Luftlinie: ${distance}m, ca. ${walkingTime}min`);
            
            // Hauptlinie mit Fußgänger-Styling
            const polyline = L.polyline([startLatLng, endLatLng], {
                color: color,
                weight: 5,
                opacity: 0.8,
                dashArray: '15, 10'
            }).addTo(map);
            
            // Schatten-Linie für bessere Sichtbarkeit
            const shadowLine = L.polyline([startLatLng, endLatLng], {
                color: '#FFFFFF',
                weight: 7,
                opacity: 0.4
            }).addTo(map);
            
            // Hauptlinie nach vorne bringen
            polyline.bringToFront();
            
            // Richtungspfeil in der Mitte
            const midPoint = L.latLng(
                (startLatLng.lat + endLatLng.lat) / 2,
                (startLatLng.lng + endLatLng.lng) / 2
            );
            
            // Berechne Winkel für Richtungspfeil
            const angle = Math.atan2(endLatLng.lat - startLatLng.lat, endLatLng.lng - startLatLng.lng) * 180 / Math.PI;
            
            const directionMarker = L.marker(midPoint, {
                icon: L.divIcon({
                    html: `<div style="
                        width: 0; 
                        height: 0; 
                        border-left: 8px solid transparent; 
                        border-right: 8px solid transparent; 
                        border-bottom: 16px solid ${color};
                        transform: rotate(${angle + 90}deg);
                        filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));
                    "></div>`,
                    className: 'walking-arrow',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(map);
            
            // Detailliertes Popup
            polyline.bindPopup(`
                <div style="text-align: center; font-family: system-ui;">
                    <strong style="color: ${color};">🚶‍♀️ Geschätzter Fußweg</strong><br>
                    <div style="margin: 8px 0;">
                        <span style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; margin: 2px;">
                            📏 ${distance}m Luftlinie
                        </span>
                        <span style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; margin: 2px;">
                            ⏱️ ca. ${walkingTime}min
                        </span>
                    </div>
                    <small style="color: #666;">Tatsächlicher Weg kann abweichen</small>
                </div>
            `);
            
            console.log(`✅ Fußgänger-Luftlinie gezeichnet: ${distance}m, ${walkingTime}min`);
            
        } catch (error) {
            console.error(`❌ Fehler beim Zeichnen der Fußgänger-Luftlinie ${routeIndex}:`, error);
        }
    }

    /**
     * Einfache Routen-Funktion die garantiert funktioniert
     */
    async drawSimpleRoutes(map, markers) {
        try {
            console.log('🛣️ drawSimpleRoutes aufgerufen mit', markers.length, 'Markern');
            
            // Finde Hauptlocation und Parkplätze
            let mainMarker = null;
            const parkingMarkers = [];
            
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                const iconUrl = marker.options?.icon?.options?.iconUrl || '';
                
                if (iconUrl.includes('marker-icon.png')) {
                    mainMarker = marker;
                    console.log('✅ Hauptlocation gefunden');
                } else if (iconUrl.includes('svg') || iconUrl.includes('data:image')) {
                    parkingMarkers.push(marker);
                    console.log('🅿️ Parkplatz gefunden');
                }
            }
            
            if (!mainMarker || parkingMarkers.length === 0) {
                console.log('❌ Keine passenden Marker für Routen gefunden');
                return;
            }
            
            const mainLatLng = mainMarker.getLatLng();
            console.log(`Hauptlocation: ${mainLatLng.lat}, ${mainLatLng.lng}`);
            
            // Zeichne Routen zu allen Parkplätzen
            for (let index = 0; index < parkingMarkers.length; index++) {
                const parkingMarker = parkingMarkers[index];
                const parkingLatLng = parkingMarker.getLatLng();
                console.log(`Zeichne echte Route ${index + 1} zu: ${parkingLatLng.lat}, ${parkingLatLng.lng}`);
                
                // Verwende echte Routen-Funktion statt einfache Linie
                await this.drawRoute(map, parkingLatLng, mainLatLng, index);
            }
            
            console.log('✅ Alle Routen gezeichnet');
            
        } catch (error) {
            console.error('❌ Fehler in drawSimpleRoutes:', error);
        }
    }

    /**
        const arrowSymbol = L.Symbol.arrowHead({
            pixelSize: 15,
            polygon: false,
            pathOptions: { 
                stroke: true,
                color: color,
                weight: 3
            }
        });
        
        const decorator = L.polylineDecorator(polyline, {
            patterns: [
                {
                    offset: '70%',
                    repeat: 0,
                    symbol: arrowSymbol
                }
            ]
        });
        
        // Nur hinzufügen wenn Decorator verfügbar ist
        if (typeof L.polylineDecorator !== 'undefined') {
            decorator.addTo(map);
        }
        
        polyline.bindPopup(`
            <div style="text-align: center; font-family: system-ui;">
                <strong style="color: ${color};">�‍♀️ Fußweg</strong><br>
                <small>Ca. ${distance}m Luftlinie</small><br>
                <em style="color: #999; font-size: 12px;">Tatsächlicher Weg kann länger sein</em>
            </div>
        `);
        
        // Zusätzlich: Mittelpunkt-Marker mit Entfernung
        const midPoint = L.latLng(
            (startLatLng.lat + endLatLng.lat) / 2,
            (startLatLng.lng + endLatLng.lng) / 2
        );
        
        const distanceMarker = L.circleMarker(midPoint, {
            radius: 8,
            fillColor: color,
            color: 'white',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.8
        }).addTo(map);
        
        distanceMarker.bindTooltip(`${distance}m`, {
            permanent: false,
            direction: 'top',
            className: 'distance-tooltip'
        });
        
        debugLog(`✅ Luftlinie gezeichnet: ${distance}m mit Farbe ${color}`);
    }

    /**
     * Erstellt eine einfache Karte für eine einzelne Adresse
     */
    async createSimpleLocationMap(containerId, address, locationName = '') {
        try {
            debugLog(`🗺️ Erstelle einfache Karte für Container: ${containerId}, Adresse: "${address}"`);
            
            // Prüfe ob Container existiert
            const container = document.getElementById(containerId);
            if (!container) {

                return null;
            }

            const map = await this.createMap(containerId, {
                zoom: 15, // Starte mit mittlerem Zoom für bessere Sicht
                scrollWheelZoom: false // Für bessere UX in Cards
            });

            if (!map) {

                return null;
            }

            if (address && address.trim()) {
                debugLog(`📍 Starte Geocoding für Adresse: "${address}"`);
                
                try {
                    const result = await this.geocodeAddress(address);
                    
                    if (result && result.lat && result.lng) {
                        debugLog(`🎯 Geocoding erfolgreich! Setze Kartenansicht auf: ${result.lat}, ${result.lng}`);
                        
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
                        
                        debugLog(`✅ Karte erfolgreich erstellt mit Adresse: "${address}"`);
                        return map;
                        
                    } else {

                        
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

            return null;
        }
    }
}

// Debug-Funktion für Geocoding-Tests
window.testGeocoding = async function(address) {
    debugLog(`🧪 Teste Geocoding für: "${address}"`);
    
    try {
        // Direkter Test mit verschiedenen Ansätzen
        const testUrls = [
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=de`,
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1&countrycodes=de`
        ];
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            debugLog(`🔍 Test ${i + 1}: ${url}`);
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Hochzeitsplaner-App/1.0',
                        'Accept': 'application/json'
                    }
                });
                
                debugLog(`📊 Response Status: ${response.status} ${response.statusText}`);
                debugLog(`📊 Response Headers:`, [...response.headers.entries()]);
                
                if (response.ok) {
                    const text = await response.text();
                    debugLog(`📄 Raw Response:`, text);
                    
                    const data = JSON.parse(text);
                    debugLog(`📍 Test ${i + 1} Ergebnis:`, data);
                    
                    if (data && data.length > 0) {
                        const result = data[0];
                        debugLog(`✅ Test ${i + 1} erfolgreich: ${result.lat}, ${result.lon}`);
                        return { lat: parseFloat(result.lat), lng: parseFloat(result.lon), display_name: result.display_name };
                    } else {

                    }
                } else {

                }
            } catch (testError) {

            }
        }
        

        return null;
        
    } catch (error) {

        return null;
    }
}

debugLog('📚 OpenStreetMapIntegration Klasse definiert');

// Debug: Teste Klassen-Instanziierung
debugLog('🏗️ Beginne Instanzerstellung...');
try {
    // Instanz sofort erstellen
    window.openStreetMap = new OpenStreetMapIntegration();
    debugLog('🗺️ OpenStreetMap Instanz erstellt');
    debugLog('🔍 window.openStreetMap type:', typeof window.openStreetMap);
    debugLog('🔍 window.openStreetMap instanceof OpenStreetMapIntegration:', window.openStreetMap instanceof OpenStreetMapIntegration);
} catch (error) {


}

// Helper-Funktionen für einfache Nutzung
debugLog('🔧 Erstelle Helper-Funktionen...');
try {
    window.createLocationMap = async function(containerId, address, locationName = '') {
        return await window.openStreetMap.createSimpleLocationMap(containerId, address, locationName);
    };
    debugLog('✅ window.createLocationMap erstellt');

    window.createMultiLocationMap = async function(containerId, locations, options = {}) {
        return await window.openStreetMap.createMultiLocationMap(containerId, locations, options);
    };
    debugLog('✅ window.createMultiLocationMap erstellt');
} catch (error) {

}

// Neue Helper-Funktion: Erstellt Karte mit Backend-Koordinaten
debugLog('🌐 Erstelle Backend-Helper-Funktion...');
try {
    window.createLocationMapFromBackend = async function(containerId, locationType, options = {}) {
        try {
            debugLog(`🗺️ Erstelle Karte für ${locationType} mit Backend-Koordinaten...`);
            
            // Koordinaten vom Backend holen
            const response = await fetch('/api/guest/location-coordinates', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {

                return null;
            }

            const data = await response.json();
            
            if (!data.success || !data.coordinates || !data.coordinates[locationType]) {

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

                return null;
            }

            // Karte auf die Koordinaten zentrieren
            map.setView([coords.lat, coords.lng], mapOptions.zoom);

            // Marker hinzufügen
            const marker = L.marker([coords.lat, coords.lng]).addTo(map);
            
            debugLog(`✅ Karte ${containerId} erfolgreich mit Backend-Koordinaten erstellt`);
            return map;

        } catch (error) {

            return null;
        }
    };
    debugLog('✅ window.createLocationMapFromBackend erstellt');
} catch (error) {

}



debugLog('✅ OpenStreetMap Integration geladen');
debugLog('📊 Final Status:');
debugLog('  - window.openStreetMap:', typeof window.openStreetMap);
debugLog('  - window.createLocationMap:', typeof window.createLocationMap);
debugLog('  - window.createLocationMapFromBackend:', typeof window.createLocationMapFromBackend);

