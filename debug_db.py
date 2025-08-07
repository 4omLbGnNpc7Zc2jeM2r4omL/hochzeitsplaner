#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from sqlite_datenmanager import SQLiteHochzeitsDatenManager
import json
import sqlite3

print('📊 Checking database for approved uploads...')
dm = SQLiteHochzeitsDatenManager('data')

try:
    # Direct database check
    conn = sqlite3.connect('data/hochzeit.db')
    cursor = conn.cursor()
    
    # Check if gaeste_uploads table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gaeste_uploads'")
    table_exists = cursor.fetchone()
    
    if table_exists:
        print("✅ gaeste_uploads table exists")
        
        # Check all uploads
        cursor.execute('SELECT id, original_filename, admin_approved FROM gaeste_uploads')
        all_uploads = cursor.fetchall()
        
        print(f'📦 Total uploads in database: {len(all_uploads)}')
        
        if all_uploads:
            print('\n📋 All uploads:')
            for upload in all_uploads:
                print(f'  ID: {upload[0]}, Filename: {upload[1]}, Approved: {upload[2]}')
        
        # Check specifically for approved uploads
        cursor.execute('SELECT COUNT(*) FROM gaeste_uploads WHERE admin_approved = 1')
        approved_count = cursor.fetchone()[0]
        print(f'\n✅ Approved uploads count: {approved_count}')
        
    else:
        print("❌ gaeste_uploads table does not exist")
        # List all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"📋 Available tables: {[table[0] for table in tables]}")
    
    conn.close()
    
    # Test the data manager method
    print("\n🔧 Testing SQLiteHochzeitsDatenManager.get_approved_uploads()...")
    approved = dm.get_approved_uploads()
    print(f'📦 Data manager returned {len(approved)} approved uploads')
    
    if approved:
        print('\n📋 Approved uploads from data manager:')
        for upload in approved:
            print(f'  {json.dumps(upload, indent=2)}')
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
