"""
Entry point for Voxify-AI.

Run with:
    python main.py

This starts the FastAPI backend on http://localhost:8000
Then open frontend/index.html in your browser to chat.
"""

import uvicorn
from config.settings import settings

if __name__ == "__main__":
    uvicorn.run("backend.app:app", host=settings.HOST, port=settings.PORT, reload=True)
