# PowerShell Script für Windows .exe Build
# Hochzeitsplaner Builder

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "    HOCHZEITSPLANER .EXE BUILDER (Windows)" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Wechsle ins Skript-Verzeichnis
Set-Location $PSScriptRoot

# Prüfe Python Installation
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python gefunden: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python nicht gefunden"
    }
} catch {
    Write-Host "❌ FEHLER: Python ist nicht installiert oder nicht im PATH!" -ForegroundColor Red
    Write-Host "Bitte installieren Sie Python 3.8+ von https://python.org" -ForegroundColor Yellow
    Write-Host "Achten Sie darauf, 'Add to PATH' zu aktivieren!" -ForegroundColor Yellow
    Read-Host "Drücken Sie Enter zum Beenden"
    exit 1
}

# Prüfe ob app.py existiert
if (-not (Test-Path "app.py")) {
    Write-Host "❌ app.py nicht gefunden!" -ForegroundColor Red
    Write-Host "Bitte führen Sie dieses Script im Hochzeitsplaner-Ordner aus." -ForegroundColor Yellow
    Read-Host "Drücken Sie Enter zum Beenden"
    exit 1
}

Write-Host ""
Write-Host "🔨 Starte Build-Prozess..." -ForegroundColor Cyan

# Führe Build-Script aus
try {
    python build_exe.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Build erfolgreich abgeschlossen!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📁 Ihre .exe finden Sie hier:" -ForegroundColor Cyan
        Write-Host "   Distribution\Hochzeitsplaner.exe" -ForegroundColor White
        Write-Host ""
        Write-Host "🚀 Zum Testen: Doppelklick auf die .exe" -ForegroundColor Yellow
        Write-Host ""
        
        # Frage ob Distribution-Ordner geöffnet werden soll
        $openFolder = Read-Host "Möchten Sie den Distribution-Ordner öffnen? [J/N]"
        if ($openFolder -match "^[JjYy]") {
            if (Test-Path "Distribution") {
                Invoke-Item "Distribution"
            }
        }
    } else {
        Write-Host "❌ Build fehlgeschlagen!" -ForegroundColor Red
        Write-Host "Bitte prüfen Sie die Fehlermeldungen oben." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Unerwarteter Fehler: $_" -ForegroundColor Red
}

Write-Host ""
Read-Host "Drücken Sie Enter zum Beenden"
