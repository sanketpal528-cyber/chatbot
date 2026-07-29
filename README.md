# Voxify-AI

A voice-enabled AI chatbot with a FastAPI backend and a lightweight
HTML/JS frontend. Chat by typing or speaking — Voxify replies in text
and speaks the answer back to you.

## Features

- 💬 Text chat via a REST API (`/chat`)
- 🎤 Voice input in the browser (Web Speech API) — no extra setup needed
- 🎙️ Server-side voice upload endpoint (`/voice-chat`) for non-browser clients
- 🔊 Spoken replies via the browser's speech synthesis
- 🧠 Per-session conversation memory
- 🛠️ Pluggable "tools" (time, date, and easy to add more)
- 📄 Clean seam for swapping in a real LLM later

## Project Structure

```
Voxify-AI/
├── backend/       FastAPI app, chatbot logic, speech transcription
├── frontend/      HTML/CSS/JS chat UI with mic button
├── database/      SQLite schema (for future durable storage)
├── memory/        Session conversation history
├── uploads/        Uploaded audio files land here
├── prompts/       System prompt / persona definitions
├── tools/         Small callable tools the chatbot can invoke
├── config/        Centralized settings from .env
├── logs/          Application logs
├── tests/         Pytest test suite
├── docs/          Architecture documentation
├── requirements.txt
├── .env
├── main.py
└── README.md
```

See `docs/architecture.md` for a full breakdown of how the pieces fit together.

## Setup

```bash
# 1. Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the backend
python main.py
```

The API will be live at `http://localhost:8000` (docs at `/docs`).

## Using the app

Open `frontend/index.html` directly in your browser (double-click it,
or use a simple static server). Type a message and press Send, or
click the 🎤 button and speak — your browser will transcribe it and
send it to Voxify automatically.

## Running tests

```bash
pytest
```

## Next steps

- Swap the rule-based replies in `backend/chatbot.py` for a real LLM call
- Add more tools in `tools/tool_registry.py`
- Move session memory from JSON to the SQLite database in `database/db.py`
