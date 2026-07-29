"""
Simple JSON-file-based conversation memory.

Each session_id gets its own list of {role, text} turns.
Good enough for a small project — swap for a real database
(see database/db.py) once you need persistence across restarts
at scale, or multi-user concurrency.
"""

import json
import os

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "history.json")


def _load() -> dict:
    if not os.path.exists(MEMORY_FILE):
        return {}
    with open(MEMORY_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def _save(data: dict):
    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_history(session_id: str) -> list:
    data = _load()
    return data.get(session_id, [])


def save_turn(session_id: str, user_text: str, bot_text: str):
    data = _load()
    data.setdefault(session_id, [])
    data[session_id].append({"role": "user", "text": user_text})
    data[session_id].append({"role": "bot", "text": bot_text})
    # keep only the last 20 turns per session to avoid unbounded growth
    data[session_id] = data[session_id][-40:]
    _save(data)
