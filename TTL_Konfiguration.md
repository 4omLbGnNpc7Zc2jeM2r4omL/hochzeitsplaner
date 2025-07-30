# TTL-Konfiguration für Ionos DynDNS

## 🕐 **TTL (Time To Live) Einstellungen**

### **Ihre Konfiguration: 6 Stunden**
- **TTL-Wert**: `21600` Sekunden (6 Stunden)
- **Parameter**: `&ttl=21600`
- **Bedeutung**: DNS-Record ist 6 Stunden lang gültig

## 📋 **TTL-Werte Übersicht**

| Dauer | Sekunden | Parameter | Verwendung |
|-------|----------|-----------|------------|
| 5 Minuten | 300 | `&ttl=300` | Häufige Änderungen |
| 30 Minuten | 1800 | `&ttl=1800` | Testing/Development |
| 1 Stunde | 3600 | `&ttl=3600` | Standard kurz |
| **6 Stunden** | **21600** | **`&ttl=21600`** | **Ihre Einstellung** |
| 12 Stunden | 43200 | `&ttl=43200` | Täglich |
| 24 Stunden | 86400 | `&ttl=86400` | Standard lang |

## 🎯 **Warum 6 Stunden ideal für DS-Lite sind:**

### **Vorteile:**
- ✅ **Ausreichend kurz**: Bei IPv6-Änderungen schnelle Aktualisierung
- ✅ **Nicht zu kurz**: Reduziert DNS-Server-Last
- ✅ **Praktisch**: Passt zu typischen IPv6-Präfix-Erneuerungen
- ✅ **Zuverlässig**: Guter Kompromiss zwischen Aktualität und Stabilität

### **Vodafone DS-Lite Besonderheiten:**
- IPv6-Präfixe ändern sich **selten** (meist nur bei Router-Neustart)
- 6 Stunden sind ausreichend für IPv6-Präfix-Erneuerungen
- Kurze TTL hilft bei IPv6-Adress-Rotationen

## 🔧 **Script-Konfiguration:**

### **Python-Script:**
```python
update_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}&ttl=21600"
```

### **Bash-Script:**
```bash
response=$(curl -s --max-time 15 "${UPDATE_URL}&hostname=${DOMAIN}&myip=&myipv6=${ipv6}&ttl=21600")
```

## 📊 **DNS-Propagation mit 6h TTL:**

### **Zeitplan:**
- **0 Minuten**: DynDNS-Update gesendet
- **0-5 Minuten**: Ionos DNS-Server aktualisiert
- **5-15 Minuten**: Primäre DNS-Server weltweit
- **15-60 Minuten**: Sekundäre DNS-Server
- **1-6 Stunden**: Vollständige globale Propagation

### **Empfohlene Update-Frequenz:**
```bash
# Cronjob: Alle 3 Stunden prüfen (halb so oft wie TTL)
0 */3 * * * /pfad/zu/ionos_dyndns_update.py

# Oder: Alle 6 Stunden (entspricht TTL)
0 */6 * * * /pfad/zu/ionos_dyndns_update.py
```

## 🧪 **TTL-Überprüfung:**

### **Aktuellen TTL-Wert prüfen:**
```bash
dig xn--pascalundkthe-heiraten-94b.de AAAA

# Ausgabe zeigt TTL:
# xn--pascalundkthe-heiraten-94b.de. 21600 IN AAAA 2a02:908:1022:...
#                                     ^^^^^ TTL in Sekunden
```

### **TTL-Countdown beobachten:**
```bash
# Mehrmals ausführen - TTL-Wert sinkt
watch -n 300 'dig +noall +answer xn--pascalundkthe-heiraten-94b.de AAAA'
```

## ⚙️ **Alternative TTL-Werte je nach Bedarf:**

### **Für Testing (kurze TTL):**
```python
# 5 Minuten TTL für schnelle Tests
update_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}&ttl=300"
```

### **Für Produktion (längere TTL):**
```python
# 24 Stunden TTL für stabile Umgebungen
update_url = f"{IONOS_UPDATE_URL}&hostname={DOMAIN}&myip=&myipv6={ipv6}&ttl=86400"
```

## 📈 **Monitoring:**

### **TTL-basiertes Monitoring:**
- DNS-Updates alle 6 Stunden überwachen
- Bei IPv6-Änderungen: Update auslösen
- TTL-Ablauf vor kritischen Zeiten vermeiden

**Ihre 6-Stunden-TTL ist optimal für DS-Lite-Umgebungen!** 🎯
