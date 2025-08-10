/**
 * First Login Modal Funktionen
 * Wird in guest_dashboard.html eingebunden
 */

// ===============================================
// First Login Modal Funktionen
// ===============================================

async function checkFirstLogin() {
    console.log('🚀 First Login Modal Check gestartet');
    
    try {
        // Prüfe ob der Gast zum ersten Mal eingeloggt ist (aus URL Parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const isFirstLogin = urlParams.get('first_login') === '1';
        
        if (!isFirstLogin) {
            console.log('⏭️ Kein First Login Parameter - Modal wird übersprungen');
            return;
        }

        console.log('✅ First Login Parameter erkannt - lade Daten...');

        // Alle benötigten Daten in einem Promise.all laden für bessere Performance
        const [settingsResponse, personalizedResponse] = await Promise.all([
            fetch('/api/settings/get?t=' + Date.now()), // Cache-buster
            fetch('/api/guest/first-login-message?t=' + Date.now()) // Cache-buster
        ]);

        console.log('📡 API Responses erhalten:');
        console.log('  - Settings Response:', settingsResponse.status, settingsResponse.ok);
        console.log('  - Personalized Response:', personalizedResponse.status, personalizedResponse.ok);

        if (!settingsResponse.ok) {
            console.error('❌ Settings API Fehler:', settingsResponse.status, settingsResponse.statusText);
            return;
        }

        const settingsResult = await settingsResponse.json();
        console.log('📋 Settings API Result:', settingsResult);
        
        if (!settingsResult.success) {
            console.error('❌ Settings API Erfolg = false:', settingsResult);
            return;
        }

        // First Login Modal Daten extrahieren - Verbessertes Mapping für verschiedene Datenstrukturen
        const settings = settingsResult.settings || {};
        
        // Debugging für bessere Fehlererkennung
        console.log('🔍 First Login Modal - Geladene Settings:', settings);
        
        // Flexible Extraktion der First Login Daten mit Fallback-Strategien
        const firstLoginImage = settings.first_login_image || settings['first_login_image'] || '';
        let firstLoginImageData = settings.first_login_image_data || settings['first_login_image_data'] || '';
        const firstLoginText = settings.first_login_text || settings['first_login_text'] || '';
        const isLargeImage = settings.first_login_image_large || false;
        
        // Wenn das Bild zu groß ist, lade es separat
        if (isLargeImage && !firstLoginImageData) {
            console.log('🖼️ Großes Bild erkannt - lade separat...');
            try {
                const imageResponse = await fetch('/api/settings/first-login-image?t=' + Date.now());
                if (imageResponse.ok) {
                    const imageResult = await imageResponse.json();
                    if (imageResult.success && imageResult.image_data) {
                        firstLoginImageData = imageResult.image_data;
                        console.log('✅ Großes Bild erfolgreich geladen (Länge:', imageResult.image_data.length, ')');
                    } else {
                        console.warn('⚠️ Großes Bild konnte nicht geladen werden:', imageResult);
                    }
                } else {
                    console.error('❌ Fehler beim Laden des großen Bildes:', imageResponse.status);
                }
            } catch (error) {
                console.error('❌ Exception beim Laden des großen Bildes:', error);
            }
        }
        
        // Hochzeitsdatum mit verschiedenen Strukturen unterstützen
        let weddingDate = null;
        
        // Versuche verschiedene Pfade für das Hochzeitsdatum
        const dateSources = [
            settings.hochzeitsdatum,
            settings['hochzeitsdatum'],
            settings.hochzeit?.datum,
            settings['hochzeit']?.datum
        ];
        
        for (const dateSource of dateSources) {
            if (dateSource) {
                weddingDate = dateSource;
                console.log('📅 Hochzeitsdatum gefunden:', weddingDate, 'aus Quelle:', dateSource);
                break;
            }
        }
        
        // Falls 'hochzeit' als JSON-String gespeichert ist
        if (!weddingDate && settings.hochzeit && typeof settings.hochzeit === 'string') {
            try {
                const hochzeitObj = JSON.parse(settings.hochzeit);
                weddingDate = hochzeitObj.datum;
                console.log('📅 Hochzeitsdatum aus JSON-String extrahiert:', weddingDate);
            } catch (e) {
                console.warn('🟡 Hochzeit-Daten konnten nicht geparst werden:', settings.hochzeit);
            }
        }
        
        // Fallback: Suche nach anderen Datums-Feldern
        if (!weddingDate) {
            const fallbackSources = [
                settings.wedding_date,
                settings['wedding_date'],
                settings.date,
                settings['date']
            ];
            
            for (const fallbackSource of fallbackSources) {
                if (fallbackSource) {
                    weddingDate = fallbackSource;
                    console.log('📅 Hochzeitsdatum aus Fallback gefunden:', weddingDate);
                    break;
                }
            }
        }
        
        console.log('📋 First Login Modal Daten:');
        console.log('  - Image URL:', firstLoginImage);
        console.log('  - Image Data (Base64):', firstLoginImageData ? 'Vorhanden' : 'Nicht vorhanden');
        console.log('  - Text:', firstLoginText);
        console.log('  - Wedding Date:', weddingDate);

        if (!firstLoginImage && !firstLoginImageData && !firstLoginText) {
            console.log('⚠️ Keine First Login Modal Daten verfügbar - Modal wird übersprungen');
            return;
        }

        // Personalisierte Nachricht verarbeiten
        let personalizedMessage = null;
        let personalizedDate = null;
        
        if (personalizedResponse.ok) {
            try {
                const personalizedResult = await personalizedResponse.json();
                console.log('💬 Personalized Message API Result:', personalizedResult);
                
                if (personalizedResult.success) {
                    personalizedMessage = personalizedResult.message;
                    personalizedDate = personalizedResult.wedding_date;
                    console.log('✅ Personalisierte Nachricht geladen:', personalizedMessage ? 'Vorhanden' : 'Leer');
                } else {
                    console.warn('⚠️ Personalisierte Nachricht API Erfolg = false:', personalizedResult);
                }
            } catch (error) {
                console.error('❌ Fehler beim Parsen der personalisierten Nachricht:', error);
            }
        } else {
            console.warn('⚠️ Personalisierte Nachricht API Fehler:', personalizedResponse.status, personalizedResponse.statusText);
        }

        console.log('🎯 Modal wird angezeigt mit Daten:');
        console.log('  - Image URL:', firstLoginImage || 'Nicht vorhanden');
        console.log('  - Image Data:', firstLoginImageData ? 'Base64 vorhanden' : 'Nicht vorhanden');
        console.log('  - Fallback Text:', firstLoginText || 'Nicht vorhanden');
        console.log('  - Personalized Message:', personalizedMessage || 'Nicht vorhanden');
        console.log('  - Wedding Date:', personalizedDate || weddingDate || 'Nicht vorhanden');

        // Modal mit allen geladenen Daten anzeigen
        showFirstLoginModal({
            imageUrl: firstLoginImage,
            imageData: firstLoginImageData,
            fallbackText: firstLoginText,
            personalizedMessage: personalizedMessage,
            weddingDate: personalizedDate || weddingDate
        });
        
        // URL bereinigen (first_login Parameter entfernen)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
    } catch (error) {
        console.error('❌ Kritischer Fehler in checkFirstLogin:', error);
        console.error('Stack Trace:', error.stack);
        
        // Fallback: Zeige wenigstens ein einfaches Modal falls möglich
        try {
            const modal = document.getElementById('firstLoginModal');
            if (modal) {
                const welcomeText = document.getElementById('welcomeText');
                if (welcomeText) {
                    welcomeText.innerHTML = 'Willkommen! Schön, dass Sie da sind.';
                }
                
                const bootstrapModal = new bootstrap.Modal(modal, {
                    backdrop: 'static',
                    keyboard: false
                });
                bootstrapModal.show();
                console.log('🆘 Fallback-Modal angezeigt');
            }
        } catch (fallbackError) {
            console.error('❌ Selbst Fallback-Modal fehlgeschlagen:', fallbackError);
        }
    }
}

function showFirstLoginModal(data) {
    console.log('🎭 First Login Modal wird angezeigt mit Daten:', data);
    
    const modal = document.getElementById('firstLoginModal');
    const welcomeImage = document.getElementById('welcomeImage');
    const welcomeImageContainer = document.getElementById('welcomeImageContainer');
    const welcomeImagePlaceholder = document.getElementById('welcomeImagePlaceholder');
    const welcomeText = document.getElementById('welcomeText');
    const weddingDateDisplay = document.getElementById('weddingDateDisplay');
    
    if (!modal) {
        console.error('❌ First Login Modal Element nicht gefunden!');
        return;
    }
    
    console.log('📱 Modal-Elemente gefunden:');
    console.log('  - Modal:', modal ? '✅' : '❌');
    console.log('  - Welcome Image:', welcomeImage ? '✅' : '❌');
    console.log('  - Image Container:', welcomeImageContainer ? '✅' : '❌');
    console.log('  - Image Placeholder:', welcomeImagePlaceholder ? '✅' : '❌');
    console.log('  - Welcome Text:', welcomeText ? '✅' : '❌');
    console.log('  - Wedding Date Display:', weddingDateDisplay ? '✅' : '❌');
    
    // Hochzeitsdatum setzen (falls verfügbar)
    if (data.weddingDate && weddingDateDisplay) {
        try {
            console.log('📅 Verarbeite Hochzeitsdatum:', data.weddingDate);
            const formattedDate = formatWeddingDate(data.weddingDate);
            
            if (formattedDate && formattedDate !== 'NaN. undefined NaN') {
                weddingDateDisplay.textContent = formattedDate;
                console.log('📅 Hochzeitsdatum gesetzt:', formattedDate);
            } else {
                // Fallback: Verstecke das Datum-Element falls Formatierung fehlschlägt
                weddingDateDisplay.style.display = 'none';
                console.warn('⚠️ Datum-Formatierung fehlgeschlagen, Element versteckt');
            }
        } catch (error) {
            console.error('❌ Fehler beim Formatieren des Hochzeitsdatums:', error);
            weddingDateDisplay.style.display = 'none';
        }
    } else {
        console.log('ℹ️ Kein Hochzeitsdatum verfügbar oder Element nicht gefunden');
        if (weddingDateDisplay) {
            weddingDateDisplay.style.display = 'none';
        }
    }

    // Text setzen - personalisierte Nachricht hat Priorität
    if (data.personalizedMessage && welcomeText) {
        welcomeText.innerHTML = data.personalizedMessage;
        welcomeText.dataset.personalized = 'true';
        console.log('💬 Personalisierte Nachricht angezeigt');
    } else if (data.fallbackText && data.fallbackText.trim() && welcomeText) {
        welcomeText.innerHTML = data.fallbackText.trim().replace(/\n/g, '<br>');
        console.log('📝 Fallback-Text angezeigt:', data.fallbackText.substring(0, 50) + '...');
    } else {
        console.warn('⚠️ Kein Text für das Modal verfügbar');
    }
    
    // Bild konfigurieren - Priorisiere Base64-Daten über URL
    if (data.imageData && data.imageData.trim()) {
        // Base64-Bild direkt verwenden
        console.log('🖼️ Verwende Base64-Bild (Länge:', data.imageData.length, ')');
        welcomeImage.src = data.imageData.trim();
        welcomeImage.onload = function() {
            console.log('✅ Base64-Bild erfolgreich geladen');
            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
        welcomeImage.onerror = function() {
            console.error('❌ Base64-Bild konnte nicht geladen werden');
            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
    } else if (data.imageUrl && data.imageUrl.trim()) {
        // URL-Bild laden
        console.log('🌐 Verwende Bild-URL:', data.imageUrl);
        welcomeImage.src = data.imageUrl.trim();
        welcomeImage.onerror = function() {
            console.error('❌ URL-Bild konnte nicht geladen werden:', data.imageUrl);
            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
        welcomeImage.onload = function() {
            console.log('✅ URL-Bild erfolgreich geladen');
            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
    } else {
        // Kein Bild - zeige Placeholder
        console.log('🖼️ Kein Bild verfügbar - zeige Placeholder');
        welcomeImageContainer.classList.add('d-none');
        welcomeImagePlaceholder.classList.remove('d-none');
    }
    
    // Modal anzeigen
    const bootstrapModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: false
    });
    
    console.log('🎭 Bootstrap Modal wird geöffnet...');
    bootstrapModal.show();
    console.log('✅ First Login Modal erfolgreich angezeigt!');

}

function formatWeddingDate(dateString) {
    try {
        console.log('📅 Formatiere Datum:', dateString);
        
        // Verschiedene Datumsformate unterstützen
        let date;
        
        if (dateString.includes('-')) {
            // Format: 2026-07-25 oder YYYY-MM-DD
            date = new Date(dateString);
        } else if (dateString.includes('.')) {
            // Format: 25.07.2026 oder DD.MM.YYYY
            const parts = dateString.split('.');
            if (parts.length === 3) {
                // DD.MM.YYYY -> YYYY-MM-DD für Date Constructor
                date = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            } else {
                date = new Date(dateString);
            }
        } else {
            // Fallback: Versuche direkten Parse
            date = new Date(dateString);
        }
        
        // Prüfe ob Datum gültig ist
        if (isNaN(date.getTime())) {
            console.warn('⚠️ Ungültiges Datum, verwende Original-String:', dateString);
            return dateString;
        }
        
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        const formattedDate = `${day}. ${month} ${year}`;
        console.log('✅ Datum formatiert:', formattedDate);
        return formattedDate;
        
    } catch (error) {
        console.error('❌ Fehler beim Formatieren des Datums:', error);
        return dateString; // Fallback auf ursprünglichen String
    }
}

