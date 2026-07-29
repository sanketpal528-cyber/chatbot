"""
Core chatbot logic for Voxify-AI.

This is intentionally simple (rule-based) as a starting point.
Swap `get_bot_response` internals for an LLM API call, an
intent classifier, or whatever model you plug in later —
the rest of the app (routes, memory, voice) doesn't need to change.
"""

import datetime
from prompts.persona import SYSTEM_PROMPT
from tools.tool_registry import run_tool_if_matched


def get_bot_response(message: str, history: list) -> str:
    text = message.lower().strip()

    # 1. Try tools first (time, calculator, etc. — see tools/tool_registry.py)
    tool_result = run_tool_if_matched(text)
    if tool_result is not None:
        return tool_result

    # 2. Simple rule-based fallback replies
    if any(greet in text for greet in ["hello", "hi", "hey"]):
        return "Hello! I'm Voxify — how can I help you today?"

    if "your name" in text:
        return "I'm Voxify, your voice-enabled AI assistant."

    if "how are you" in text:
        return "Running smoothly! What can I do for you?"

    if any(bye in text for bye in ["bye", "exit", "stop", "goodbye"]):
        return "Goodbye! Talk to you soon."

    # 3. Default fallback
    return "I'm still learning — I don't have a good answer for that yet."
