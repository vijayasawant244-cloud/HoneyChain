# Tiny client for any OpenAI-compatible chat API (Groq, Gemini, OpenRouter...).
# It uses only Python's standard library, so Windows has nothing to block.
import json
import os
import time
import urllib.error
import urllib.request

from dotenv import load_dotenv

ROOT = r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain"
load_dotenv(ROOT + r"\.env")

BASE_URL = (os.getenv("LLM_BASE_URL") or "").rstrip("/")
API_KEY = os.getenv("LLM_API_KEY")
MODEL = os.getenv("LLM_MODEL")


def chat(messages, tools=None, temperature=0.2, timeout=60, tool_choice="auto"):
    """Send messages to the model and return its reply message (a dict)."""
    if not (BASE_URL and API_KEY and MODEL):
        raise RuntimeError("Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in the .env file")

    body = {"model": MODEL, "messages": messages, "temperature": temperature}
    if tools:
        body["tools"] = tools
        body["tool_choice"] = tool_choice

    request = urllib.request.Request(
        BASE_URL + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + API_KEY,
            "User-Agent": "HoneyChain/1.0",   # some providers block the default Python user agent
        },
    )

    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))["choices"][0]["message"]

        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:300]

            if e.code == 429 and attempt < 3:
                time.sleep(8 * (attempt + 1))
                continue

            raise RuntimeError(f"LLM API error {e.code}: {detail}")

        except urllib.error.URLError as e:
            raise RuntimeError(f"Could not reach the LLM API: {e.reason}")