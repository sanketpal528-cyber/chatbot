from fastapi.testclient import TestClient

import app as app_module

client = TestClient(app_module.app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_home_page_served():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_chat_empty_message_returns_400():
    response = client.post("/api/chat", json={"message": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Message cannot be empty."


def test_chat_missing_api_key_returns_500(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 500
    assert response.json()["detail"] == "OPENAI_API_KEY is not configured."


def test_chat_success(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class FakeCompletions:
        @staticmethod
        def create(**kwargs):
            class Message:
                content = "Mocked AI reply"

            class Choice:
                message = Message()

            class Completion:
                choices = [Choice()]

            return Completion()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(app_module, "_get_openai_client", lambda api_key: FakeClient())

    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 200
    assert response.json()["reply"] == "Mocked AI reply"


def test_chat_openai_failure_returns_502(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def failing_client(_api_key):
        raise RuntimeError("OpenAI down")

    monkeypatch.setattr(app_module, "_get_openai_client", failing_client)

    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to get AI response from OpenAI."
