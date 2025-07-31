#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gunicorn Produktivserver-Konfiguration
Hochzeitsplaner Web-Anwendung
"""

import multiprocessing
import os

# Server-Einstellungen - Dual-Stack 
# Note: Echtes Dual-Stack wird durch launcher.py mit mehreren --bind Parametern erreicht
bind = "0.0.0.0:8080"  # Default IPv4 Binding
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
worker_connections = 1000

# Performance-Optimierung
max_requests = 1000
max_requests_jitter = 100
preload_app = True
keepalive = 5
timeout = 120
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# SSL/TLS (aktivieren wenn SSL-Zertifikate vorhanden)
# keyfile = "ssl_private_key.key"
# certfile = "ssl_certificate.crt"

def post_fork(server, worker):
    """Nach dem Worker-Fork ausgeführt"""
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def worker_int(worker):
    """Bei Worker-Interrupt ausgeführt"""
    worker.log.info("Worker received INT or QUIT signal")

def on_starting(server):
    """Beim Server-Start ausgeführt"""
    server.log.info("🎉 Hochzeitsplaner Gunicorn Server startet...")

def on_reload(server):
    """Bei Server-Reload ausgeführt"""
    server.log.info("🔄 Server wird neu geladen...")

def when_ready(server):
    """Wenn Server bereit ist"""
    server.log.info("✅ Server ist bereit für Verbindungen auf: %s", bind)
    server.log.info("👥 Aktive Worker: %d", workers)
