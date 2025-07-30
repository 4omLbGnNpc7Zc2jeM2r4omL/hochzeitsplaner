@echo off
chcp 65001 > nul
REM Git Repository Cleanup für GitHub Build
REM Entfernt alle lokalen Dateien und behält nur Build-relevante Dateien

echo 🧹 Git Repository Cleanup für GitHub Build
echo ================================================

REM Prüfe ob wir in einem Git-Repository sind
if not exist ".git" (
    echo ❌ Kein Git-Repository gefunden!
    pause
    exit /b 1
)

echo 🔍 Analysiere aktuelle Git-Dateien...
git status --porcelain

echo.
echo ⚠️  WARNUNG: Dies wird alle nicht-committed Änderungen entfernen!
echo 📋 Folgende Dateien werden für GitHub Build beibehalten:
echo    ✅ working_launcher_ssl.py
echo    ✅ app.py
echo    ✅ datenmanager.py
echo    ✅ requirements.txt
echo    ✅ data/
echo    ✅ static/
echo    ✅ templates/
echo    ✅ auth_config.json
echo    ✅ .github/
echo    ✅ README_GITHUB.md
echo.
echo ❌ Alle anderen Dateien werden entfernt (siehe .gitignore)

set /p continue="🤔 Möchtest du fortfahren? (y/N): "
if /i not "%continue%"=="y" (
    echo ❌ Abgebrochen
    pause
    exit /b 1
)

echo.
echo 🧹 Führe Git Cleanup durch...

REM Lösche alle nicht-getrackte Dateien (respektiert .gitignore)
git clean -fdx

REM Setze alle Änderungen zurück
git reset --hard HEAD

echo.
echo 📝 Aktualisiere README für GitHub...

REM Ersetze README.md mit der GitHub-Version
if exist "README_GITHUB.md" (
    copy "README_GITHUB.md" "README.md" > nul
    del "README_GITHUB.md"
)

echo.
echo 📋 Überprüfe verbleibende Dateien:
dir /b

echo.
echo ✅ Git Repository bereit für GitHub Build!
echo.
echo 🚀 Nächste Schritte:
echo    1. git add .
echo    2. git commit -m "Cleanup für GitHub Build"
echo    3. git push
echo.
echo 📦 GitHub Actions wird automatisch eine Windows .exe erstellen!

echo.
set /p autopush="🤖 Soll ich Git Add + Commit + Push automatisch ausführen? (y/N): "
if /i "%autopush%"=="y" (
    echo 🚀 Führe Git-Operationen aus...
    
    git add .
    git commit -m "Cleanup für GitHub Build - SSL-Integration mit Domain-Support"
    git push
    
    echo.
    echo ✅ Erfolgreich zu GitHub gepusht!
    echo 🔗 Überwache den Build: https://github.com/USERNAME/REPO/actions
) else (
    echo 📝 Manuelle Git-Befehle erforderlich
)

echo.
echo ================================================
echo 🎯 Repository erfolgreich für GitHub Build vorbereitet!
pause
