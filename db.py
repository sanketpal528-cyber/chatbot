"""
SQLite database setup for Voxify-AI.

Currently unused by default (memory/memory_store.py handles session
history via JSON for simplicity) — wire this in once you need
durable, queryable storage (e.g. chat logs across restarts, users table).
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "voxify.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
