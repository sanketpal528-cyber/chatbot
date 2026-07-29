"""
Speech-to-text transcription for Voxify-AI.

Uses the `SpeechRecognition` library with Google's free web API
by default. Swap `recognize_google` for `recognize_whisper` or
another engine if you want offline/higher-accuracy transcription.
"""

import speech_recognition as sr


def transcribe_audio(filepath: str) -> str:
    """Transcribe an audio file (wav/aiff/flac) to text. Returns '' on failure."""
    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(filepath) as source:
            audio = recognizer.record(source)
    except Exception:
        return ""

    try:
        return recognizer.recognize_google(audio)
    except sr.UnknownValueError:
        return ""
    except sr.RequestError:
        return ""
