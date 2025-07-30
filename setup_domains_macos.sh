#!/bin/bash
# macOS Domain-Konfiguration für Hochzeitsplaner
# Fügt lokale Domain-Einträge zur hosts-Datei hinzu

echo "🌐 Hochzeitsplaner - macOS Domain-Konfiguration"
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "=" "="

# Lokale IP ermitteln
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "🏠 Lokale IP-Adresse: $LOCAL_IP"

# Prüfe ob bereits konfiguriert
if grep -q "hochzeitsplaner.de" /etc/hosts; then
    echo "✅ Domains bereits in hosts-Datei vorhanden"
    echo "📋 Aktuelle Einträge:"
    grep -E "(hochzeitsplaner|pascalundkäthe|xn--pascalundkthe)" /etc/hosts
    echo ""
    echo "🔄 Möchten Sie die Einträge aktualisieren? (j/n)"
    read -r update_choice
    if [ "$update_choice" != "j" ] && [ "$update_choice" != "J" ]; then
        echo "✋ Konfiguration übersprungen"
        exit 0
    fi
    
    # Alte Einträge entfernen
    echo "🧹 Entferne alte Domain-Einträge..."
    sudo sed -i '' '/hochzeitsplaner.de/d' /etc/hosts
    sudo sed -i '' '/pascalundkäthe-heiraten.de/d' /etc/hosts
    sudo sed -i '' '/xn--pascalundkthe-heiraten-94b.de/d' /etc/hosts
fi

echo "📝 Füge neue Domain-Einträge hinzu..."

# Neue Einträge zur hosts-Datei hinzufügen
{
    echo ""
    echo "# Hochzeitsplaner Dual-Domain-Konfiguration"
    echo "$LOCAL_IP  hochzeitsplaner.de"
    echo "$LOCAL_IP  www.hochzeitsplaner.de"
    echo "$LOCAL_IP  xn--pascalundkthe-heiraten-94b.de"
    echo "$LOCAL_IP  www.xn--pascalundkthe-heiraten-94b.de"
    echo "$LOCAL_IP  pascalundkäthe-heiraten.de"
    echo "$LOCAL_IP  www.pascalundkäthe-heiraten.de"
} | sudo tee -a /etc/hosts > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Domain-Konfiguration erfolgreich!"
    echo "🌐 hochzeitsplaner.de → $LOCAL_IP"
    echo "🌍 xn--pascalundkthe-heiraten-94b.de (pascalundkäthe-heiraten.de) → $LOCAL_IP"
    echo ""
    echo "🔍 Teste Domain-Auflösung..."
    
    # Teste Domain-Auflösung
    if ping -c 1 hochzeitsplaner.de | grep -q "$LOCAL_IP"; then
        echo "✅ hochzeitsplaner.de zeigt auf lokale IP"
    else
        echo "❌ hochzeitsplaner.de zeigt NICHT auf lokale IP"
        echo "🔧 Möglicherweise DNS-Cache leeren erforderlich:"
        echo "   sudo dscacheutil -flushcache"
        echo "   sudo killall -HUP mDNSResponder"
    fi
    
    echo ""
    echo "🎉 Konfiguration abgeschlossen!"
    echo "🚀 Sie können nun den Hochzeitsplaner starten"
else
    echo "❌ Fehler bei der Konfiguration!"
    echo "🔧 Bitte prüfen Sie die Administrator-Rechte"
fi

echo ""
echo "📋 Zur Überprüfung der hosts-Datei:"
echo "   cat /etc/hosts | grep hochzeitsplaner"
echo ""
echo "🔄 Zum Rückgängigmachen:"
echo "   sudo sed -i '' '/hochzeitsplaner.de/d' /etc/hosts"
echo "   sudo sed -i '' '/pascalundkäthe-heiraten.de/d' /etc/hosts"
