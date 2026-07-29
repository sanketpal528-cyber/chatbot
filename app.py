from pathlib import Path
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL = "gpt-4o-mini"

app = FastAPI(title="AI Chatbot", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


def _get_openai_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def home() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/main.js")
def script() -> FileResponse:
    return FileResponse(BASE_DIR / "main.js")


@app.get("/style.css")
def stylesheet() -> FileResponse:
    return FileResponse(BASE_DIR / "style.css")


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.")

    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)

    try:
        client = _get_openai_client(api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant for a web chatbot.",
                },
                {"role": "user", "content": message},
            ],
        )
        reply = (completion.choices[0].message.content or "").strip()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to get AI response from OpenAI.",
        ) from exc

    if not reply:
        raise HTTPException(status_code=502, detail="AI response was empty.")

    return ChatResponse(reply=reply)
