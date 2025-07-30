#!/bin/bash
echo "================================================"
echo "    HOCHZEITSPLANER .EXE BUILDER (macOS/Linux)"
echo "================================================"
echo

# Wechsle ins richtige Verzeichnis
cd "$(dirname "$0")"

# Prüfe ob Python verfügbar ist
if ! command -v python3 &> /dev/null; then
    echo "❌ FEHLER: Python3 ist nicht installiert!"
    echo "Bitte installieren Sie Python 3.8+ von https://python.org"
    exit 1
fi

echo "✅ Python3 gefunden"
echo

# Führe Build-Script aus
echo "🔨 Starte Build-Prozess..."
python3 build_exe.py

echo
echo "✅ Build abgeschlossen!"
echo
echo "📁 Ihre .exe finden Sie im Distribution-Ordner"
echo "🚀 Zum Testen auf Windows übertragen und Doppelklick auf Distribution/Hochzeitsplaner.exe"
echo
