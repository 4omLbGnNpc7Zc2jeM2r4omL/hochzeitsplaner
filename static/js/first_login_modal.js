/**
 * First Login Modal Funktionen
 * Wird in guest_dashboard.html eingebunden
 */

// ===============================================
// First Login Modal Funktionen
// ===============================================

async function checkFirstLogin() {

    
    try {
        // Prüfe ob der Gast zum ersten Mal eingeloggt ist (aus URL Parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const isFirstLogin = urlParams.get('first_login') === '1';
        
        if (!isFirstLogin) {

            return;
        }



        // Alle benötigten Daten in einem Promise.all laden für bessere Performance
        const [settingsResponse, personalizedResponse] = await Promise.all([
            fetch('/api/settings/get?t=' + Date.now()), // Cache-buster
            fetch('/api/guest/first-login-message?t=' + Date.now()) // Cache-buster
        ]);

        if (!settingsResponse.ok) {

            return;
        }

        const settingsResult = await settingsResponse.json();
        

        
        if (!settingsResult.success) {

            return;
        }

        // First Login Modal Daten extrahieren
        const firstLoginImage = settingsResult.settings?.first_login_image;
        const firstLoginImageData = settingsResult.settings?.first_login_image_data;
        const firstLoginText = settingsResult.settings?.first_login_text;
        const weddingDate = settingsResult.settings?.hochzeitsdatum || settingsResult.settings?.hochzeit?.datum;

        if (!firstLoginImage && !firstLoginImageData && !firstLoginText) {

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

                }
            } catch (error) {

            }
        } else {

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

    }
}

function showFirstLoginModal(data) {

    
    const modal = document.getElementById('firstLoginModal');
    const welcomeImage = document.getElementById('welcomeImage');
    const welcomeImageContainer = document.getElementById('welcomeImageContainer');
    const welcomeImagePlaceholder = document.getElementById('welcomeImagePlaceholder');
    const welcomeText = document.getElementById('welcomeText');
    const weddingDateDisplay = document.getElementById('weddingDateDisplay');
    
    if (!modal) {

        return;
    }
    
    // Hochzeitsdatum setzen (falls verfügbar)
    if (data.weddingDate && weddingDateDisplay) {
        try {
            const formattedDate = formatWeddingDate(data.weddingDate);
            weddingDateDisplay.textContent = formattedDate;

        } catch (error) {

        }
    }

    // Text setzen - personalisierte Nachricht hat Priorität
    if (data.personalizedMessage && welcomeText) {
        welcomeText.innerHTML = data.personalizedMessage;
        welcomeText.dataset.personalized = 'true';

    } else if (data.fallbackText && data.fallbackText.trim() && welcomeText) {
        welcomeText.innerHTML = data.fallbackText.trim().replace(/\n/g, '<br>');

    }
    
    // Bild konfigurieren - Priorisiere Base64-Daten über URL
    if (data.imageData && data.imageData.trim()) {
        // Base64-Bild direkt verwenden
        welcomeImage.src = data.imageData.trim();
        welcomeImage.onload = function() {

            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
        welcomeImage.onerror = function() {

            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
    } else if (data.imageUrl && data.imageUrl.trim()) {
        // URL-Bild laden
        welcomeImage.src = data.imageUrl.trim();
        welcomeImage.onerror = function() {

            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
        welcomeImage.onload = function() {

            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
    } else {
        // Kein Bild - zeige Placeholder
        welcomeImageContainer.classList.add('d-none');
        welcomeImagePlaceholder.classList.remove('d-none');

    }
    
    // Modal anzeigen
    const bootstrapModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: false
    });
    
    bootstrapModal.show();
    

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

        return dateString; // Fallback auf ursprünglichen String
    }
}

