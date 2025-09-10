"""
Einfaches Ausführungsscript für die Friendly Captcha Automation
"""

import sys
import os
from automation_config import ConfigManager, get_form_template, create_screenshot_directory

def print_menu():
    """Hauptmenü anzeigen"""
    print("\n" + "="*60)
    print("    FRIENDLY CAPTCHA AUTOMATION TOOL")
    print("="*60)
    print("1. Standard Login ausführen")
    print("2. Login mit benutzerdefinierten Daten")
    print("3. Kontaktformular ausfüllen")
    print("4. Konfiguration anzeigen/bearbeiten")
    print("5. Screenshot-Verzeichnis erstellen")
    print("6. Test-Modus (mit Screenshots)")
    print("0. Beenden")
    print("="*60)

def get_user_input(prompt, default=None):
    """Benutzereingabe mit Standardwert"""
    if default:
        user_input = input(f"{prompt} [{default}]: ").strip()
        return user_input if user_input else default
    return input(f"{prompt}: ").strip()

def run_standard_login():
    """Standard Login ausführen"""
    try:
        from friendly_captcha_automation import FriendlyCaptchaAutomation
        
        print("\nStarte Standard Login...")
        automation = FriendlyCaptchaAutomation(headless=False)
        
        # Zur Seite navigieren
        automation.navigate_to_site()
        
        # Login versuchen
        if automation.login():
            print("✅ Login erfolgreich!")
            automation.take_screenshot("successful_login.png")
        else:
            print("❌ Login fehlgeschlagen!")
            automation.take_screenshot("failed_login.png")
        
        input("\nDrücken Sie Enter um fortzufahren...")
        automation.close()
        
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("\nDrücken Sie Enter um fortzufahren...")

def run_custom_login():
    """Login mit benutzerdefinierten Daten"""
    try:
        from friendly_captcha_automation import FriendlyCaptchaAutomation
        
        print("\nBenutzerdefinierter Login")
        print("-" * 30)
        
        url = get_user_input("URL", "https://friendly-captcha-demo.onrender.com/")
        username = get_user_input("Benutzername", "admin")
        password = get_user_input("Passwort", "admin123")
        
        headless_input = get_user_input("Headless Modus? (j/n)", "n")
        headless = headless_input.lower() in ['j', 'y', 'yes', 'ja']
        
        print(f"\nStarte Login mit:")
        print(f"URL: {url}")
        print(f"Username: {username}")
        print(f"Headless: {headless}")
        
        automation = FriendlyCaptchaAutomation(headless=headless)
        automation.navigate_to_site(url)
        
        if automation.login(username, password):
            print("✅ Login erfolgreich!")
            automation.take_screenshot("custom_login_success.png")
        else:
            print("❌ Login fehlgeschlagen!")
            automation.take_screenshot("custom_login_failed.png")
        
        input("\nDrücken Sie Enter um fortzufahren...")
        automation.close()
        
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("\nDrücken Sie Enter um fortzufahren...")

def run_contact_form():
    """Kontaktformular ausfüllen"""
    try:
        from friendly_captcha_automation import FriendlyCaptchaAutomation
        
        print("\nKontaktformular ausfüllen")
        print("-" * 30)
        
        # Template laden oder benutzerdefinierte Daten
        use_template = get_user_input("Vordefinierte Daten verwenden? (j/n)", "j")
        
        if use_template.lower() in ['j', 'y', 'yes', 'ja']:
            form_data = get_form_template("contact_form")
            print("Verwende vordefinierte Kontaktdaten:")
            for key, value in form_data.items():
                print(f"  {key}: {value}")
        else:
            form_data = {}
            form_data['name'] = get_user_input("Name")
            form_data['email'] = get_user_input("E-Mail")
            form_data['subject'] = get_user_input("Betreff")
            form_data['message'] = get_user_input("Nachricht")
        
        automation = FriendlyCaptchaAutomation(headless=False)
        automation.navigate_to_site()
        
        # Zuerst einloggen
        if automation.login():
            print("✅ Login erfolgreich!")
            
            # Dann Formulardaten ausfüllen
            if automation.fill_form_data(form_data):
                print("✅ Formulardaten erfolgreich ausgefüllt!")
                automation.take_screenshot("form_filled.png")
            else:
                print("⚠️ Einige Formulardaten konnten nicht ausgefüllt werden")
                automation.take_screenshot("form_partial.png")
        else:
            print("❌ Login fehlgeschlagen!")
        
        input("\nDrücken Sie Enter um fortzufahren...")
        automation.close()
        
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("\nDrücken Sie Enter um fortzufahren...")

def show_config():
    """Konfiguration anzeigen und bearbeiten"""
    try:
        config_manager = ConfigManager()
        
        print("\nAktuelle Konfiguration:")
        print("-" * 30)
        print(f"URL: {config_manager.config.url}")
        print(f"Username: {config_manager.config.username}")
        print(f"Password: {'*' * len(config_manager.config.password)}")
        print(f"Headless: {config_manager.config.headless}")
        print(f"Timeout: {config_manager.config.timeout}")
        print(f"Screenshot Dir: {config_manager.config.screenshot_dir}")
        print(f"Log Level: {config_manager.config.log_level}")
        
        edit = get_user_input("\nKonfiguration bearbeiten? (j/n)", "n")
        
        if edit.lower() in ['j', 'y', 'yes', 'ja']:
            print("\nNeue Werte eingeben (Enter für unverändert):")
            
            new_url = get_user_input("URL", config_manager.config.url)
            new_username = get_user_input("Username", config_manager.config.username)
            new_password = get_user_input("Password", config_manager.config.password)
            
            config_manager.config.url = new_url
            config_manager.config.username = new_username
            config_manager.config.password = new_password
            
            config_manager.save_config()
            print("✅ Konfiguration gespeichert!")
        
        input("\nDrücken Sie Enter um fortzufahren...")
        
    except Exception as e:
        print(f"❌ Fehler: {e}")
        input("\nDrücken Sie Enter um fortzufahren...")

def create_screenshot_dir():
    """Screenshot-Verzeichnis erstellen"""
    config_manager = ConfigManager()
    create_screenshot_directory(config_manager.config.screenshot_dir)
    print(f"✅ Screenshot-Verzeichnis erstellt: {config_manager.config.screenshot_dir}")
    input("\nDrücken Sie Enter um fortzufahren...")

def test_mode():
    """Test-Modus mit detaillierten Screenshots"""
    try:
        from friendly_captcha_automation import FriendlyCaptchaAutomation
        
        print("\nTest-Modus gestartet...")
        print("Erstellt Screenshots bei jedem Schritt")
        
        automation = FriendlyCaptchaAutomation(headless=False)
        
        # Screenshot 1: Initiale Seite
        automation.navigate_to_site()
        automation.take_screenshot("01_initial_page.png")
        print("📸 Screenshot 1: Initiale Seite")
        
        # Screenshot 2: Vor Login
        automation.take_screenshot("02_before_login.png")
        print("📸 Screenshot 2: Vor Login")
        
        # Login versuchen
        if automation.login():
            # Screenshot 3: Nach Login
            automation.take_screenshot("03_after_login.png")
            print("📸 Screenshot 3: Nach Login")
            print("✅ Test erfolgreich abgeschlossen!")
        else:
            automation.take_screenshot("03_login_failed.png")
            print("📸 Screenshot 3: Login fehlgeschlagen")
            print("❌ Test mit Fehlern beendet")
        
        input("\nDrücken Sie Enter um fortzufahren...")
        automation.close()
        
    except Exception as e:
        print(f"❌ Fehler im Test-Modus: {e}")
        input("\nDrücken Sie Enter um fortzufahren...")

def main():
    """Hauptfunktion"""
    
    # Überprüfung der Requirements
    try:
        import selenium
        from webdriver_manager.chrome import ChromeDriverManager
    except ImportError as e:
        print(f"❌ Fehlende Abhängigkeiten: {e}")
        print("Bitte installieren Sie die Requirements:")
        print("pip install -r automation_requirements.txt")
        input("\nDrücken Sie Enter um zu beenden...")
        return
    
    # Screenshot-Verzeichnis erstellen
    config_manager = ConfigManager()
    create_screenshot_directory(config_manager.config.screenshot_dir)
    
    while True:
        try:
            print_menu()
            choice = input("\nWählen Sie eine Option: ").strip()
            
            if choice == "0":
                print("Auf Wiedersehen! 👋")
                break
            elif choice == "1":
                run_standard_login()
            elif choice == "2":
                run_custom_login()
            elif choice == "3":
                run_contact_form()
            elif choice == "4":
                show_config()
            elif choice == "5":
                create_screenshot_dir()
            elif choice == "6":
                test_mode()
            else:
                print("❌ Ungültige Auswahl! Bitte wählen Sie 0-6.")
                input("\nDrücken Sie Enter um fortzufahren...")
                
        except KeyboardInterrupt:
            print("\n\nProgramm durch Benutzer abgebrochen.")
            break
        except Exception as e:
            print(f"❌ Unerwarteter Fehler: {e}")
            input("\nDrücken Sie Enter um fortzufahren...")

if __name__ == "__main__":
    main()
