#!/bin/bash
# -*- coding: utf-8 -*-
"""
Git Repository Cleanup für GitHub Build
Entfernt alle lokalen Dateien und behält nur Build-relevante Dateien
"""

echo "🧹 Git Repository Cleanup für GitHub Build"
echo "================================================"

# Prüfe ob wir in einem Git-Repository sind
if [ ! -d ".git" ]; then
    echo "❌ Kein Git-Repository gefunden!"
    exit 1
fi

echo "🔍 Analysiere aktuelle Git-Dateien..."
git status --porcelain

echo ""
echo "⚠️  WARNUNG: Dies wird alle nicht-committed Änderungen entfernen!"
echo "📋 Folgende Dateien werden für GitHub Build beibehalten:"
echo "   ✅ working_launcher_ssl.py"
echo "   ✅ app.py"
echo "   ✅ datenmanager.py"
echo "   ✅ requirements.txt"
echo "   ✅ data/"
echo "   ✅ static/"
echo "   ✅ templates/"
echo "   ✅ auth_config.json"
echo "   ✅ .github/"
echo "   ✅ README_GITHUB.md"
echo ""
echo "❌ Alle anderen Dateien werden entfernt (siehe .gitignore)"

read -p "🤔 Möchtest du fortfahren? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Abgebrochen"
    exit 1
fi

echo ""
echo "🧹 Führe Git Cleanup durch..."

# Lösche alle nicht-getrackte Dateien (respektiert .gitignore)
git clean -fdx

# Setze alle Änderungen zurück
git reset --hard HEAD

echo ""
echo "📝 Aktualisiere README für GitHub..."

# Ersetze README.md mit der GitHub-Version
if [ -f "README_GITHUB.md" ]; then
    cp README_GITHUB.md README.md
    rm README_GITHUB.md
fi

echo ""
echo "📋 Überprüfe verbleibende Dateien:"
ls -la

echo ""
echo "✅ Git Repository bereit für GitHub Build!"
echo ""
echo "🚀 Nächste Schritte:"
echo "   1. git add ."
echo "   2. git commit -m 'Cleanup für GitHub Build'"
echo "   3. git push"
echo ""
echo "📦 GitHub Actions wird automatisch eine Windows .exe erstellen!"

echo ""
read -p "🤖 Soll ich Git Add + Commit + Push automatisch ausführen? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Führe Git-Operationen aus..."
    
    git add .
    git commit -m "Cleanup für GitHub Build - SSL-Integration mit Domain-Support"
    git push
    
    echo ""
    echo "✅ Erfolgreich zu GitHub gepusht!"
    echo "🔗 Überwache den Build: https://github.com/USERNAME/REPO/actions"
else
    echo "📝 Manuelle Git-Befehle erforderlich"
fi

echo ""
echo "================================================"
echo "🎯 Repository erfolgreich für GitHub Build vorbereitet!"
