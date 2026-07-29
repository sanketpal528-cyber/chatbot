"""
Central configuration for Voxify-AI, loaded from environment
variables (see .env). Import `settings` anywhere you need a
config value instead of hardcoding paths or keys.
"""

import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings:
    APP_NAME: str = "Voxify-AI"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))

    UPLOADS_DIR: str = os.path.join(BASE_DIR, "uploads")
    LOGS_DIR: str = os.path.join(BASE_DIR, "logs")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/database/voxify.db")

    # Add API keys for external services (e.g. an LLM provider) here,
    # always reading from the environment — never hardcode secrets.
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")


settings = Settings()

os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.LOGS_DIR, exist_ok=True)
