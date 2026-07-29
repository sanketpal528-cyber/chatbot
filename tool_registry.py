"""
Lightweight tool system for Voxify-AI.

Add new tools by writing a `matches(text) -> bool` check and a
`run(text) -> str` function, then registering them in TOOLS below.
This keeps chatbot.py free of tool-specific logic.
"""

import datetime


def _time_matches(text: str) -> bool:
    return "time" in text and "what" in text or "current time" in text


def _time_run(text: str) -> str:
    now = datetime.datetime.now().strftime("%I:%M %p")
    return f"The current time is {now}."


def _date_matches(text: str) -> bool:
    return "date" in text or "today's date" in text


def _date_run(text: str) -> str:
    today = datetime.date.today().strftime("%B %d, %Y")
    return f"Today's date is {today}."


TOOLS = [
    {"matches": _time_matches, "run": _time_run},
    {"matches": _date_matches, "run": _date_run},
]


def run_tool_if_matched(text: str):
    """Return a tool's response if the text matches, else None."""
    for tool in TOOLS:
        if tool["matches"](text):
            return tool["run"](text)
    return None
