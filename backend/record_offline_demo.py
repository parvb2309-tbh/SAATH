"""Records the offline demo snapshot: frontend/public/demo/offline-{hi,en}.json.

When the website cannot reach this API at all (server asleep, crashed or not deployed), the frontend replays these
saved responses for the five demo accounts, so the demo still works. Run it again after changing demo data or
API responses:

    cd backend
    .venv\\Scripts\\python record_offline_demo.py

Each language is recorded in its own process against a fresh, throwaway database with the offline engine (no Gemini,
no MongoDB), so it is repeatable and touches nothing real.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlencode

os.environ["UDAAN_DB"] = str(Path(tempfile.mkdtemp()) / "offline-demo.db")
os.environ["GEMINI_API_KEY"] = ""
os.environ["MONGO_URI"] = "mongodb://127.0.0.1:1"  # demo accounts never need MongoDB

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "demo"


def key(method: str, path: str, params: dict | None = None) -> str:
    """Same shape the frontend builds in lib/offline.js: method, path and the query sorted by name."""
    params = {k: v for k, v in (params or {}).items() if v not in (None, "")}
    query = urlencode(sorted((k, str(v).lower() if isinstance(v, bool) else str(v)) for k, v in params.items()))
    return f"{method} {path}" + (f"?{query}" if query else "")


class Recorder:
    def __init__(self, client: TestClient, token: str | None = None):
        self.client, self.token, self.data = client, token, {}

    def call(self, method: str, path: str, params: dict | None = None, body=None, save=True):
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        url = path + (f"?{urlencode(params)}" if params else "")
        r = self.client.request(method, url, headers=headers, json=body)
        if r.status_code >= 400 or "application/json" not in r.headers.get("content-type", ""):
            print(f"  skip {method} {url}: {r.status_code}")
            return None
        if save:
            self.data[key(method, path, params)] = r.json()
        return r.json()


def record(client: TestClient, lang: str) -> dict:
    snap = {}
    anon = Recorder(client)
    meta = anon.call("GET", "/api/meta")
    anon.call("GET", "/api/auth/demo")
    trades = [t["id"] for t in meta["trades"]]

    for role in ("student", "parent", "counsellor", "teacher", "admin"):
        login = client.post(f"/api/auth/demo/{role}").json()
        rec = Recorder(client, login["token"])
        rec.call("PATCH", "/api/me", body={"preferred_lang": lang}, save=False)
        rec.call("GET", "/api/auth/me")

        if role == "student":
            for path in ("/api/student/dna", "/api/student/matches", "/api/student/sims", "/api/student/pathway",
                         "/api/student/family", "/api/student/progress", "/api/student/stories", "/api/me/export"):
                rec.call("GET", path)
            for t in trades:
                rec.call("GET", "/api/student/report", {"trade": t})
                rec.call("GET", "/api/student/whatif", {"trade": t})
            share = rec.call("POST", "/api/student/report/share", body={"trade": "solar"})
            if share and share.get("token"):
                anon.call("GET", f"/api/reports/{share['token']}", {"lang": lang})
            for sim in rec.data.get("GET /api/student/sims", []):
                started = rec.call("POST", f"/api/student/sims/{sim['id']}/start")
                if started:
                    rec.call("POST", f"/api/student/sims/{sim['id']}/attempts/{started['attempt_id']}",
                             body={"time_s": 210, "accuracy": 0.85, "safety_score": 0.9, "telemetry": {"offline_demo": True}})
            rec.call("POST", "/api/student/pathway", body={"action": "finance_viewed"})
        elif role == "parent":
            for path in ("/api/parent/overview", "/api/parent/report", "/api/parent/stories", "/api/parent/consensus"):
                rec.call("GET", path)
            for t in trades:
                rec.call("GET", "/api/parent/report", {"trade": t})
                rec.call("GET", "/api/parent/whatif", {"trade": t})
        elif role == "counsellor":
            for status in ("open", "resolved"):
                for e in rec.call("GET", "/api/escalations", {"status": status}) or []:
                    rec.call("GET", f"/api/escalations/{e['id']}")
        elif role == "teacher":
            rec.call("GET", "/api/teacher/class")
            rec.call("GET", "/api/teacher/toolkit")
        elif role == "admin":
            for flag in ("true", "false"):
                rec.call("GET", "/api/admin/summary", {"include_demo": flag})
                rec.call("GET", "/api/admin/families", {"include_demo": flag})
            for t in ["all", *trades]:
                rec.call("GET", "/api/admin/gis", {"trade": t})
            for split in ("all", "gender"):
                rec.call("GET", "/api/admin/barriers", {"split": split})
            for path in ("/api/admin/states", "/api/admin/sidh", "/api/admin/metrics", "/api/admin/attribution",
                         "/api/admin/update-templates", "/api/admin/outcomes", "/api/admin/flagged-turns"):
                rec.call("GET", path)

        if role in ("student", "parent"):
            chat = rec.call("POST", "/api/me/chat")
            if chat:
                rec.call("GET", f"/api/sessions/{chat['session_id']}")
                rec.call("POST", f"/api/sessions/{chat['session_id']}/messages",
                         body={"text": "ITI ke baad kitni kamai hoti hai?", "speaker": "learner" if role == "student" else "mother",
                               "lang": lang})
        snap[role] = rec.data
    snap["anon"] = anon.data
    return snap


def main():
    if len(sys.argv) < 2:  # one fresh process (and database) per language, so chats never mix languages
        for lang in ("hi", "en"):
            subprocess.run([sys.executable, __file__, lang], check=True)
        return
    lang = sys.argv[1]
    OUT.mkdir(parents=True, exist_ok=True)
    with TestClient(app) as client:
        print(f"recording {lang}")
        snap = record(client, lang)
    path = OUT / f"offline-{lang}.json"
    path.write_text(json.dumps(snap, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  wrote {path} ({path.stat().st_size // 1024} KB, {sum(len(v) for v in snap.values())} responses)")


if __name__ == "__main__":
    sys.exit(main())
