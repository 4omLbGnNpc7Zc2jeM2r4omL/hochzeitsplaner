# Google Maps API Integration Anleitung

## Google Maps API Key einrichten

1. **API Key in Konfigurationsdatei einfügen:**
   - Öffne die Datei `google_maps_config.json` im Hauptverzeichnis
   - Ersetze `"YOUR_GOOGLE_MAPS_API_KEY_HERE"` mit deinem echten API Key
   
   ```json
   {
     "google_maps_api_key": "AIzaSyDEINE_ECHTER_API_KEY_HIER",
     "default_zoom": 15,
     "default_map_type": "roadmap"
   }
   ```

2. **API Key Berechtigungen prüfen:**
   - Stelle sicher, dass dein API Key für folgende APIs aktiviert ist:
     - Maps Embed API
     - Maps JavaScript API
     - Geocoding API (optional, für bessere Adresssuche)

3. **Sicherheitseinstellungen:**
   - Konfiguriere Referrer-Beschränkungen in der Google Cloud Console
   - Beschränke den Key auf deine Domain(s):
     - `hochzeitsplaner.de/*`
     - `pascalundkäthe-heiraten.de/*`
     - `xn--pascalundkthe-heiraten-94b.de/*`

## Funktionsweise

### Neue Google Maps Integration
- **Primär:** Verwendet deine neue Google Maps API mit dem konfigurierten Key
- **Fallback:** Bei API-Fehlern wird automatisch auf OpenStreetMap umgeschaltet
- **Letzter Fallback:** Einfacher Link zu Google Maps

### Kartenanzeige in Dashboards
- **Gäste-Dashboard:** Zeigt Karten für Standesamt und Hochzeitslocation
- **Admin-Dashboard:** Zeigt Kartenvorschauen in den Einstellungen
- **Automatische Anpassung:** Karten werden automatisch basierend auf Adressen erstellt

### API Key Verwaltung
- **Zentrale Konfiguration:** Ein Key für alle Karten
- **Sichere Einbindung:** Key wird nur clientseitig verwendet
- **Flexible Anpassung:** Zoom-Level und Kartentyp konfigurierbar

## Upgrade von der alten Version

### Was wurde verbessert:
1. **Neuer API Key:** Dein aktueller API Key ersetzt den alten
2. **Bessere Fallbacks:** Robustere Fehlerbehandlung
3. **Einheitliche Integration:** Konsistente Kartenanzeige überall
4. **Zentrale Konfiguration:** Einfache Verwaltung des API Keys

### Kompatibilität:
- Die alte Google Maps Funktionalität bleibt als Fallback erhalten
- Bestehende Karten werden automatisch auf die neue Integration umgestellt
- Keine Änderungen an bestehenden Daten erforderlich

## Testen der Integration

1. **Starte die Anwendung:**
   ```bash
   python app.py
   ```

2. **Teste Gäste-Dashboard:**
   - Öffne ein Gäste-Dashboard mit konfigurierten Locations
   - Prüfe ob Karten korrekt angezeigt werden

3. **Console-Logs prüfen:**
   - Öffne Browser-Entwicklertools
   - Suche nach "Google Maps" Meldungen
   - Bei Erfolg: "Google Maps integration result: true"
   - Bei Fallback: "Google Maps integration not available, using fallback"

## Fehlerbehebung

### Keine Karten sichtbar:
1. **API Key prüfen:** Ist der Key korrekt in `google_maps_config.json`?
2. **Browser Console:** Gibt es JavaScript-Fehler?
3. **API Limits:** Ist das Tageslimit erreicht?

### Fallback auf OpenStreetMap:
- Das ist normal wenn der Google Maps API Key nicht funktioniert
- Prüfe API Key Berechtigungen und Limits
- Teste mit einem einfachen Google Maps URL

### API Key Fehler:
```
Google Maps API error: 
- API key not valid
- API key restricted
- Quota exceeded
```
→ Prüfe Google Cloud Console Einstellungen

## Kosten-Optimierung

### Effiziente Nutzung:
- **Maps Embed API:** Kostenlos bis 50.000 Aufrufe/Monat
- **Caching:** Browser cached Karten automatisch
- **Lazy Loading:** Karten werden nur bei Bedarf geladen

### Überwachung:
- Prüfe regelmäßig die Google Cloud Console
- Setze Budgetbenachrichtigungen
- Nutze Quota-Limits zur Kostenkontrolle

## Support

Bei Problemen:
1. Prüfe Browser-Console auf Fehlermeldungen
2. Teste API Key in Google Cloud Console
3. Vergleiche Funktionalität mit/ohne API Key
4. OpenStreetMap Fallback sollte immer funktionieren
