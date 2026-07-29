# Voxify-AI Architecture

## Overview

Voxify-AI is a voice-enabled chatbot with a FastAPI backend and a
simple HTML/JS frontend. It supports both typed and spoken input.

## Flow

1. **Frontend** (`frontend/`) captures a message either by typing or
   by voice (using the browser's Web Speech API for instant, no-upload
   transcription), then sends it as text to the backend `/chat` endpoint.
2. **Backend** (`backend/app.py`) receives the message, pulls prior
   conversation turns from `memory/`, and passes it to the chatbot logic.
3. **Chatbot logic** (`backend/chatbot.py`) first checks if any
   registered tool (`tools/tool_registry.py`) matches the message
   (e.g. "what time is it"). If not, it falls back to rule-based
   replies — this is the seam where you'd plug in an LLM later.
4. The reply is saved back to memory and returned to the frontend,
   which displays it and speaks it aloud via the browser's speech
   synthesis.

## Alternate voice path (server-side)

`backend/app.py` also exposes `/voice-chat`, which accepts an
uploaded audio file, transcribes it server-side with
`SpeechRecognition` (see `backend/speech.py`), and returns both the
transcript and the bot's reply. Use this path if you build a mobile
app or CLI client that records audio files instead of using the
browser's built-in speech recognition.

## Folder responsibilities

| Folder      | Responsibility |
|-------------|----------------|
| `backend/`  | FastAPI app, chatbot logic, speech transcription |
| `frontend/` | HTML/CSS/JS chat UI with voice input |
| `database/` | SQLite schema/connection (for durable storage) |
| `memory/`   | Session conversation history (JSON-based by default) |
| `uploads/`  | Uploaded audio files land here temporarily |
| `prompts/`  | System prompt / persona text, reusable across the app |
| `tools/`    | Small callable "tools" the chatbot can invoke (time, date, etc.) |
| `config/`   | Centralized settings loaded from `.env` |
| `logs/`     | Application log output |
| `tests/`    | Automated tests (pytest) |
| `docs/`     | Project documentation (this file) |

## Extending

- **Add an LLM**: replace the body of `get_bot_response()` in
  `backend/chatbot.py` with a call to your model provider, using
  `prompts/persona.py`'s `SYSTEM_PROMPT` as the system message and
  `history` for context.
- **Add a new tool**: write a `matches()`/`run()` pair in
  `tools/tool_registry.py` and add it to the `TOOLS` list.
- **Move to real persistence**: swap `memory/memory_store.py`'s
  JSON file for calls into `database/db.py`'s SQLite table.
