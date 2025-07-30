#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSL Certificate Generator for Hochzeitsplaner
Erstellt ein Self-Signed Certificate für lokale HTTPS-Nutzung
"""

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import datetime
import ipaddress
from pathlib import Path

def create_self_signed_cert(
    hostname="pascalundkäthe-heiraten.de",
    ip_addresses=None,
    key_file="ssl_private_key.key",
    cert_file="ssl_certificate.crt"
):
    """
    Erstellt ein Self-Signed SSL Certificate
    """
    if ip_addresses is None:
        ip_addresses = ["127.0.0.1", "::1"]
    
    # Private Key laden oder erstellen
    key_path = Path(key_file)
    if key_path.exists():
        print(f"🔑 Lade bestehenden Private Key: {key_file}")
        with open(key_path, "rb") as f:
            private_key = serialization.load_pem_private_key(
                f.read(),
                password=None,
            )
    else:
        print("🔑 Erstelle neuen Private Key...")
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Private Key speichern
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        print(f"✅ Private Key gespeichert: {key_file}")
    
    # Subject und Issuer
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "DE"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "NRW"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Aachen"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Hochzeitsplaner"),
        x509.NameAttribute(NameOID.COMMON_NAME, hostname),
    ])
    
    # Certificate erstellen
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(hostname),
            x509.DNSName("localhost"),
            *[x509.IPAddress(ipaddress.ip_address(ip)) for ip in ip_addresses]
        ]),
        critical=False,
    ).sign(private_key, hashes.SHA256())
    
    # Certificate speichern
    cert_path = Path(cert_file)
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    
    print(f"✅ SSL Certificate erstellt: {cert_file}")
    print(f"🔒 Gültig für: {hostname}, localhost, {', '.join(ip_addresses)}")
    print(f"📅 Gültig bis: {cert.not_valid_after}")
    
    return str(key_path), str(cert_path)

if __name__ == "__main__":
    try:
        key_file, cert_file = create_self_signed_cert()
        print("\n🎉 SSL-Setup abgeschlossen!")
        print(f"   Private Key: {key_file}")
        print(f"   Certificate: {cert_file}")
        print("\n💡 Verwendung in working_launcher.py:")
        print("   - ssl_enabled: true setzen")
        print("   - ssl_cert_path: ssl_certificate.crt")
        print("   - ssl_key_path: ssl_private_key.key")
    except ImportError:
        print("❌ cryptography-Bibliothek nicht installiert")
        print("   Installiere mit: pip install cryptography")
    except Exception as e:
        print(f"❌ Fehler beim Erstellen des Certificates: {e}")
