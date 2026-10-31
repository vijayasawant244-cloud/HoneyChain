# HoneyChain chatbot service: POST /api/chatbot  (Python standard library only)
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from agent import ask

HOST = os.getenv("CHATBOT_HOST", "127.0.0.1")   # this computer only, so nobody else can use your API quota
PORT = int(os.getenv("CHATBOT_PORT", "5001"))
ALLOWED_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://127.0.0.1:5174"}  # the React dev server
MAX_MESSAGE = 500
MAX_BODY = 20000
LANGUAGES = {"en", "hi", "mr"}


def clean_history(raw):
    # keep only the last 6 plain user/assistant messages, so nobody can fake a system or tool message
    out = []
    if isinstance(raw, list):
        for item in raw[-6:]:
            if (isinstance(item, dict) and item.get("role") in ("user", "assistant")
                    and isinstance(item.get("content"), str)):
                out.append({"role": item["role"], "content": item["content"][: MAX_MESSAGE * 2]})
    return out


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):          # the browser's pre-check (CORS)
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True})
        self._send(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/api/chatbot":
            return self._send(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return self._send(400, {"error": "Empty request"})
        if length > MAX_BODY:
            return self._send(413, {"error": "Request too large"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._send(400, {"error": "Body must be valid JSON"})
        if not isinstance(data, dict):
            return self._send(400, {"error": "Body must be a JSON object"})

        message = data.get("message")
        if not isinstance(message, str) or not message.strip():
            return self._send(400, {"error": "message is required"})
        message = message.strip()
        if len(message) > MAX_MESSAGE:
            return self._send(400, {"error": f"message must be at most {MAX_MESSAGE} characters"})
        language = data.get("language")
        if language not in LANGUAGES:
            language = None

        try:
            r = ask(message, language, clean_history(data.get("history")))
        except Exception as e:
            print("chatbot error:", repr(e))
            return self._send(500, {"error": "The helper had a problem. Please try again."})

        self._send(200, {
            "answer": r["answer"],
            "toolsUsed": r["tools_used"],
            "searchedPages": r["pages"],
            "degraded": bool(r.get("error")),     # true when the AI was busy and plain search was used
        })


if __name__ == "__main__":
    print(f"Chatbot service on http://{HOST}:{PORT}  (POST /api/chatbot, GET /health)")
    HTTPServer((HOST, PORT), Handler).serve_forever()