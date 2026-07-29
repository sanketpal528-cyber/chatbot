"""
Voxify-AI Backend
------------------
FastAPI app exposing:
  - POST /chat        : send text, get a chatbot reply
  - POST /voice-chat   : upload an audio file, get transcribed text + bot reply
  - GET  /health       : simple health check

Run with:
    uvicorn backend.app:app --reload
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
import uuid
import os

from backend.chatbot import get_bot_response
from backend.speech import transcribe_audio
from memory.memory_store import get_history, save_turn
from config.settings import settings

app = FastAPI(title="Voxify-AI", version="0.1.0")

# Allow the frontend (served from a different port/file) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str = "default"
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "Voxify-AI"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    history = get_history(req.session_id)
    reply = get_bot_response(req.message, history)
    save_turn(req.session_id, req.message, reply)
    return ChatResponse(reply=reply)


@app.post("/voice-chat")
async def voice_chat(session_id: str = "default", file: UploadFile = File(...)):
    # Save uploaded audio to /uploads with a unique name
    ext = os.path.splitext(file.filename)[1] or ".wav"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Speech -> text
    transcript = transcribe_audio(filepath)

    if not transcript:
        return {"transcript": "", "reply": "Sorry, I couldn't understand the audio."}

    # Text -> chatbot reply
    history = get_history(session_id)
    reply = get_bot_response(transcript, history)
    save_turn(session_id, transcript, reply)

    return {"transcript": transcript, "reply": reply}
