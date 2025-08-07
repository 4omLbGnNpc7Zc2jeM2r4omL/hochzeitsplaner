/**
 * First Login Modal Funktionen
 * Wird in guest_dashboard.html eingebunden
 */

// ===============================================
// First Login Modal Funktionen
// ===============================================

async function checkFirstLogin() {
    console.log('🔍 Checking first login status...');
    
    try {
        // Prüfe ob der Gast zum ersten Mal eingeloggt ist (aus URL Parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const isFirstLogin = urlParams.get('first_login') === '1';
        
        if (!isFirstLogin) {
            console.log('✅ Not a first login, skipping modal');
            return;
        }

        console.log('🎉 First login detected! Loading modal data...');

        // Alle benötigten Daten in einem Promise.all laden für bessere Performance
        const [settingsResponse, personalizedResponse] = await Promise.all([
            fetch('/api/settings/get?t=' + Date.now()), // Cache-buster
            fetch('/api/guest/first-login-message?t=' + Date.now()) // Cache-buster
        ]);

        if (!settingsResponse.ok) {
            console.log('❌ Fehler beim Laden der Settings für First Login Modal');
            return;
        }

        const settingsResult = await settingsResponse.json();
        
        console.log('🔍 Settings response:', settingsResult);
        
        if (!settingsResult.success) {
            console.log('❌ Settings-API Response nicht erfolgreich');
            return;
        }

        // First Login Modal Daten extrahieren
        const firstLoginImage = settingsResult.settings?.first_login_image;
        const firstLoginImageData = settingsResult.settings?.first_login_image_data;
        const firstLoginText = settingsResult.settings?.first_login_text;
        const weddingDate = settingsResult.settings?.hochzeitsdatum || settingsResult.settings?.hochzeit?.datum;
        
        console.log('🔍 First Login settings:', {
            firstLoginImage,
            firstLoginImageData: firstLoginImageData ? 'present' : 'not present',
            firstLoginText,
            weddingDate,
            allSettings: Object.keys(settingsResult.settings || {}),
            settingsResult: settingsResult
        });

        if (!firstLoginImage && !firstLoginImageData && !firstLoginText) {
            console.log('ℹ️ Kein First Login Modal konfiguriert');
            return;
        }

        // Personalisierte Nachricht verarbeiten
        let personalizedMessage = null;
        let personalizedDate = null;
        
        if (personalizedResponse.ok) {
            try {
                const personalizedResult = await personalizedResponse.json();
                if (personalizedResult.success) {
                    personalizedMessage = personalizedResult.message;
                    personalizedDate = personalizedResult.wedding_date;
                    console.log('✅ Personalisierte Nachricht geladen');
                }
            } catch (error) {
                console.log('⚠️ Fehler beim Verarbeiten der personalisierten Nachricht:', error);
            }
        } else {
            console.log('⚠️ Personalisierte Nachricht konnte nicht geladen werden, verwende Fallback');
        }

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
        console.log('❌ Fehler beim First Login Check:', error);
    }
}

function showFirstLoginModal(data) {
    console.log('📱 Showing first login modal with data:', data);
    
    const modal = document.getElementById('firstLoginModal');
    const welcomeImage = document.getElementById('welcomeImage');
    const welcomeImageContainer = document.getElementById('welcomeImageContainer');
    const welcomeImagePlaceholder = document.getElementById('welcomeImagePlaceholder');
    const welcomeText = document.getElementById('welcomeText');
    const weddingDateDisplay = document.getElementById('weddingDateDisplay');
    
    if (!modal) {
        console.log('❌ First Login Modal nicht gefunden!');
        return;
    }
    
    // Hochzeitsdatum setzen (falls verfügbar)
    if (data.weddingDate && weddingDateDisplay) {
        try {
            const formattedDate = formatWeddingDate(data.weddingDate);
            weddingDateDisplay.textContent = formattedDate;
            console.log('✅ Hochzeitsdatum gesetzt:', formattedDate);
        } catch (error) {
            console.log('⚠️ Fehler beim Formatieren des Hochzeitsdatums:', error);
        }
    }

    // Text setzen - personalisierte Nachricht hat Priorität
    if (data.personalizedMessage && welcomeText) {
        welcomeText.innerHTML = data.personalizedMessage;
        welcomeText.dataset.personalized = 'true';
        console.log('✅ Personalisierte Nachricht gesetzt');
    } else if (data.fallbackText && data.fallbackText.trim() && welcomeText) {
        welcomeText.innerHTML = data.fallbackText.trim().replace(/\n/g, '<br>');
        console.log('✅ Fallback-Text gesetzt');
    }
    
    // Bild konfigurieren - Priorisiere Base64-Daten über URL
    if (data.imageData && data.imageData.trim()) {
        // Base64-Bild direkt verwenden
        welcomeImage.src = data.imageData.trim();
        welcomeImage.onload = function() {
            console.log('✅ Hochgeladenes Willkommensbild geladen');
            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
        welcomeImage.onerror = function() {
            console.log('⚠️ Hochgeladenes Willkommensbild konnte nicht geladen werden');
            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
    } else if (data.imageUrl && data.imageUrl.trim()) {
        // URL-Bild laden
        welcomeImage.src = data.imageUrl.trim();
        welcomeImage.onerror = function() {
            console.log('⚠️ Willkommensbild konnte nicht geladen werden:', data.imageUrl);
            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
        welcomeImage.onload = function() {
            console.log('✅ Willkommensbild geladen:', data.imageUrl);
            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
    } else {
        // Kein Bild - zeige Placeholder
        welcomeImageContainer.classList.add('d-none');
        welcomeImagePlaceholder.classList.remove('d-none');
        console.log('ℹ️ Kein Bild verfügbar, zeige Placeholder');
    }
    
    // Modal anzeigen
    const bootstrapModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: false
    });
    
    bootstrapModal.show();
    
    console.log('✅ First Login Modal angezeigt');
}

function formatWeddingDate(dateString) {
    try {
        const date = new Date(dateString);
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}. ${month} ${year}`;
    } catch (error) {
        console.log('⚠️ Fehler beim Formatieren des Datums:', error);
        return dateString; // Fallback auf ursprünglichen String
    }
}
