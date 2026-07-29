"""
Basic tests for Voxify-AI's API endpoints.

Run with:
    pytest
"""

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chat_greeting():
    response = client.post("/chat", json={"session_id": "test", "message": "hello"})
    assert response.status_code == 200
    assert "Voxify" in response.json()["reply"]


def test_chat_time_tool():
    response = client.post("/chat", json={"session_id": "test", "message": "what is the time"})
    assert response.status_code == 200
    assert "time" in response.json()["reply"].lower()
