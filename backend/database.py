import sqlite3
import json
import os
from contextlib import contextmanager

DB_FILE = "challans.db"

def init_db():
    """Initializes the database schema if it doesn't exist."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS challans (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                source TEXT,
                preview_image_base64 TEXT,
                saved_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        """)
        
        # Seed the admin user if not exists
        cursor.execute("SELECT id FROM users WHERE email = ?", ("admin@optimo.com",))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", ("admin@optimo.com", "CTPL@2026"))
            
        conn.commit()

@contextmanager
def get_db():
    """Context manager for SQLite database connections."""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Initialize on module import
init_db()
