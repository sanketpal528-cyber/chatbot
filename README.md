# AI Chatbot (FastAPI + OpenAI)

Deploy-ready chatbot web app with a FastAPI backend and a simple HTML/CSS/JS frontend.

## Features

- FastAPI backend with `POST /api/chat`
- OpenAI integration using `OPENAI_API_KEY`
- Configurable model via `OPENAI_MODEL` (default: `gpt-4o-mini`)
- Graceful error handling for empty input, missing key, and API failures
- Browser chat UI served by the backend at `/`
- Render deployment config included (`render.yaml`)

## Project Files

- `/app.py` - FastAPI app, routes, OpenAI call
- `/main.py` - app runner (`0.0.0.0:$PORT`)
- `/index.html`, `/style.css`, `/main.js` - chat frontend
- `/requirements.txt` - Python dependencies
- `/.env.example` - required environment variables
- `/render.yaml` - Render deployment configuration

## Local Setup

### 1) Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
# Windows (PowerShell): .venv\Scripts\Activate.ps1
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`)
- `PORT` (optional, defaults to `8000`)

### 4) Run locally

```bash
python main.py
```

App URL: `http://localhost:8000`

## API

### `POST /api/chat`

Request body:

```json
{ "message": "Hello" }
```

Response body:

```json
{ "reply": "Hi! How can I help you?" }
```

## Deploy on Render

1. Push the repository to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Render reads `render.yaml` automatically.
4. Set environment variable `OPENAI_API_KEY` in Render dashboard.
5. Deploy.

Render will run:

- Build: `pip install -r requirements.txt`
- Start: `python main.py`

## Troubleshooting

- **`OPENAI_API_KEY is not configured.`**
  - Ensure `.env` exists locally and `OPENAI_API_KEY` is set.
  - Ensure Render environment variable is configured.
- **`Failed to get AI response from OpenAI.`**
  - Check key validity, model name, internet access, and OpenAI service status.
- **Port/bind issues on hosting**
  - App already binds to `0.0.0.0` and uses `PORT` env var.
