#!/bin/bash
# Git Setup Helper für GitHub Actions

echo "🚀 GitHub Repository Setup für Windows .exe Build"
echo "=================================================="
echo

# Prüfe ob Git installiert ist
if ! command -v git &> /dev/null; then
    echo "❌ Git ist nicht installiert!"
    echo "Installieren Sie Git von: https://git-scm.com"
    exit 1
fi

echo "✅ Git gefunden"
echo

# Prüfe ob bereits ein Git Repo existiert
if [ -d ".git" ]; then
    echo "📁 Git Repository bereits vorhanden"
    
    # Prüfe ob Remote bereits existiert
    if git remote -v | grep -q origin; then
        echo "🔗 Remote 'origin' bereits konfiguriert:"
        git remote -v
        echo
        
        read -p "Möchten Sie die Änderungen pushen? [j/N]: " push_changes
        if [[ $push_changes =~ ^[JjYy] ]]; then
            echo "📤 Pushe Änderungen..."
            git add .
            git commit -m "Windows .exe Build-System hinzugefügt"
            git push
            echo "✅ Änderungen gepusht!"
            echo "🌐 Gehen Sie zu GitHub Actions für den Build"
        fi
    else
        echo "⚠️  Kein Remote 'origin' gefunden"
        read -p "GitHub Repository URL eingeben (https://github.com/username/repo.git): " repo_url
        if [ ! -z "$repo_url" ]; then
            git remote add origin "$repo_url"
            git branch -M main
            git add .
            git commit -m "Initial commit mit Windows .exe Build"
            git push -u origin main
            echo "✅ Repository erstellt und gepusht!"
        fi
    fi
else
    echo "📝 Neues Git Repository wird erstellt..."
    
    # Git Repository initialisieren
    git init
    
    # .gitignore erstellen
    cat > .gitignore << EOF
# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.env

# PyInstaller
build/
dist/
*.spec
launcher.py
simple_launcher.py
windows_launcher.py

# IDE
.vscode/
.idea/
*.swp
*.swo

# macOS
.DS_Store

# Windows
Thumbs.db
EOF
    
    echo "✅ .gitignore erstellt"
    
    # Alle Dateien hinzufügen
    git add .
    git commit -m "Initial commit: Hochzeitsplaner mit Windows .exe Build-System"
    
    echo "📋 Git Repository erstellt!"
    echo
    echo "Nächste Schritte:"
    echo "1. Gehen Sie zu github.com"
    echo "2. Erstellen Sie ein neues Repository 'hochzeitsplaner'"
    echo "3. Führen Sie diese Befehle aus:"
    echo
    echo "   git remote add origin https://github.com/IHR_USERNAME/hochzeitsplaner.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo
fi

echo
echo "🎉 Setup abgeschlossen!"
echo
echo "📋 Nach dem Push zu GitHub:"
echo "1. Gehen Sie zu Ihrem Repository"
echo "2. Klicken Sie auf 'Actions'"
echo "3. Windows .exe wird automatisch erstellt"
echo "4. Download aus 'Artifacts'"
echo
