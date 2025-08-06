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
        // Settings laden um First-Login-Modal Daten zu bekommen
        const settingsResponse = await fetch('/api/settings/get');
        
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

        // First Login Modal nur anzeigen wenn es konfiguriert ist
        const firstLoginImage = settingsResult.settings?.first_login_image;
        const firstLoginImageData = settingsResult.settings?.first_login_image_data;
        const firstLoginText = settingsResult.settings?.first_login_text;
        
        console.log('🔍 First Login settings:', {
            firstLoginImage,
            firstLoginImageData: firstLoginImageData ? 'present' : 'not present',
            firstLoginText,
            allSettings: Object.keys(settingsResult.settings || {}),
            settingsResult: settingsResult
        });        if (!firstLoginImage && !firstLoginImageData && !firstLoginText) {
            console.log('ℹ️ Kein First Login Modal konfiguriert');
            return;
        }
        
        // Prüfe ob der Gast zum ersten Mal eingeloggt ist (aus URL Parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const isFirstLogin = urlParams.get('first_login') === '1';
        
        if (isFirstLogin) {
            console.log('🎉 First login detected! Showing welcome modal...');
            showFirstLoginModal(firstLoginImage, firstLoginImageData, firstLoginText);
            
            // URL bereinigen (first_login Parameter entfernen)
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } else {
            console.log('✅ Not a first login, skipping modal');
        }
        
    } catch (error) {
        console.log('❌ Fehler beim First Login Check:', error);
    }
}

function showFirstLoginModal(imageUrl, imageData, text) {
    console.log('📱 Showing first login modal...');
    
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
    
    // Personalisierte Nachricht laden (überschreibt den konfigurierten Text)
    loadPersonalizedMessage();
    
    // Hochzeitsdatum aus den Settings laden und anzeigen
    loadWeddingDateForModal();
    
    // Bild konfigurieren - Priorisiere Base64-Daten über URL
    if (imageData && imageData.trim()) {
        // Base64-Bild direkt verwenden
        welcomeImage.src = imageData.trim();
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
    } else if (imageUrl && imageUrl.trim()) {
        // URL-Bild laden
        welcomeImage.src = imageUrl.trim();
        welcomeImage.onerror = function() {
            console.log('⚠️ Willkommensbild konnte nicht geladen werden:', imageUrl);
            welcomeImageContainer.classList.add('d-none');
            welcomeImagePlaceholder.classList.remove('d-none');
        };
        welcomeImage.onload = function() {
            console.log('✅ Willkommensbild geladen:', imageUrl);
            welcomeImageContainer.classList.remove('d-none');
            welcomeImagePlaceholder.classList.add('d-none');
        };
    } else {
        // Kein Bild - zeige Placeholder
        welcomeImageContainer.classList.add('d-none');
        welcomeImagePlaceholder.classList.remove('d-none');
    }
    
    // Fallback-Text falls personalisierte Nachricht fehlschlägt
    if (text && text.trim() && !welcomeText.dataset.personalized) {
        welcomeText.innerHTML = text.trim().replace(/\n/g, '<br>');
    }
    
    // Modal anzeigen
    const bootstrapModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: false
    });
    
    bootstrapModal.show();
    
    console.log('✅ First Login Modal angezeigt');
}

async function loadPersonalizedMessage() {
    try {
        const response = await fetch('/api/guest/first-login-message');
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.message) {
                const welcomeText = document.getElementById('welcomeText');
                if (welcomeText) {
                    welcomeText.innerHTML = result.message;
                    welcomeText.dataset.personalized = 'true';
                    console.log('✅ Personalisierte Nachricht geladen');
                }
                
                // Aktualisiere auch das Datum im Header falls verfügbar
                if (result.wedding_date) {
                    const weddingDateDisplay = document.getElementById('weddingDateDisplay');
                    if (weddingDateDisplay) {
                        const formattedDate = formatWeddingDate(result.wedding_date.replace(/\./g, '-').split('-').reverse().join('-'));
                        weddingDateDisplay.textContent = formattedDate;
                    }
                }
            }
        } else {
            console.log('⚠️ Personalisierte Nachricht konnte nicht geladen werden, verwende Fallback');
        }
    } catch (error) {
        console.log('⚠️ Fehler beim Laden der personalisierten Nachricht:', error);
    }
}

async function loadWeddingDateForModal() {
    try {
        const settingsResponse = await fetch('/api/settings/get');
        
        if (settingsResponse.ok) {
            const settingsResult = await settingsResponse.json();
            
            if (settingsResult.success && settingsResult.settings) {
                const weddingDate = settingsResult.settings.hochzeitsdatum || settingsResult.settings.hochzeit?.datum;
                const weddingDateDisplay = document.getElementById('weddingDateDisplay');
                
                if (weddingDate && weddingDateDisplay) {
                    // Datum formatieren (von YYYY-MM-DD zu DD. MMMM YYYY)
                    const formattedDate = formatWeddingDate(weddingDate);
                    weddingDateDisplay.textContent = formattedDate;
                    console.log('✅ Hochzeitsdatum geladen:', formattedDate);
                }
            }
        }
    } catch (error) {
        console.log('⚠️ Fehler beim Laden des Hochzeitsdatums:', error);
    }
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
