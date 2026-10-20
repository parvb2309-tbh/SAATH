"""SQLite storage and small repository helpers (UDAAN prototype).

Plain stdlib sqlite3 keeps the prototype dependency-free; every helper opens its own
connection so FastAPI's threadpool can call them safely. Swapping to PostgreSQL later
means re-implementing this module only.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.getenv("SAATH_DB", Path(__file__).resolve().parent.parent / "saath.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY, name_en TEXT, name_hi TEXT, state TEXT, state_hi TEXT, lat REAL, lng REAL
);
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY, name_en TEXT, name_hi TEXT, icon TEXT, sector_en TEXT, sector_hi TEXT,
    nsqf_level INTEGER, duration_months INTEGER, min_schooling TEXT,
    roles_en TEXT, roles_hi TEXT, about_en TEXT, about_hi TEXT, ladder TEXT
);
CREATE TABLE IF NOT EXISTS outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id TEXT, district_id TEXT, provider TEXT,
    earn_low INTEGER, earn_high INTEGER, earn3_low INTEGER, earn3_high INTEGER,
    earn5_low INTEGER, earn5_high INTEGER,
    placement_pct INTEGER, local_pct INTEGER, women_pct INTEGER, cohort INTEGER,
    source TEXT, year INTEGER, status TEXT
);
CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, trade_id TEXT, district_id TEXT, kind TEXT,
    name TEXT, gender TEXT, text_en TEXT, text_hi TEXT
);
CREATE TABLE IF NOT EXISTS schemes (
    id TEXT PRIMARY KEY, name_en TEXT, name_hi TEXT, text_en TEXT, text_hi TEXT, trades TEXT, link TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, created_at TEXT, district_id TEXT, trade_id TEXT,
    income_bracket TEXT, schooling TEXT, language TEXT, members TEXT, learner_gender TEXT,
    consent INTEGER, status TEXT, first_sentiment REAL, last_sentiment REAL,
    synthetic INTEGER DEFAULT 0, phone TEXT, learner_age INTEGER, quiz TEXT
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, created_at TEXT, role TEXT,
    speaker TEXT, text TEXT, lang TEXT, concerns TEXT, sentiment REAL, engine TEXT, cards TEXT
);
CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, created_at TEXT, reason TEXT,
    priority INTEGER, summary TEXT, status TEXT, phone TEXT, callback_time TEXT, notes TEXT,
    engine TEXT
);
CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, created_at TEXT, kind TEXT,
    text_en TEXT, text_hi TEXT
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, role TEXT, mobile_hash TEXT, name TEXT, relation TEXT, preferred_lang TEXT,
    district_id TEXT, created_at TEXT, synthetic INTEGER DEFAULT 0, demo_key TEXT
);
CREATE TABLE IF NOT EXISTS auth_tokens (token TEXT PRIMARY KEY, user_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS otp_requests (mobile_hash TEXT PRIMARY KEY, code_hash TEXT, created_at TEXT, tries INTEGER);
CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY, user_id TEXT, district_id TEXT, education_level TEXT, study_mode TEXT,
    budget_limit INTEGER, max_travel_km INTEGER, needs_stipend INTEGER, min_earning INTEGER, max_months INTEGER,
    work_setting TEXT, age INTEGER, gender TEXT, chosen_trade TEXT, private_notes TEXT, class_id TEXT,
    flags TEXT, stage INTEGER, created_at TEXT, synthetic INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS consents (
    user_id TEXT PRIMARY KEY, ai_guidance INTEGER, counsellor_share INTEGER, parent_link INTEGER,
    research INTEGER, guardian_approved INTEGER, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS career_dna (
    profile_id TEXT PRIMARY KEY, riasec TEXT, answers TEXT, competencies TEXT, confidence TEXT,
    exploration TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY, trade_id TEXT, nsqf_level INTEGER, title_en TEXT, title_hi TEXT, config TEXT
);
CREATE TABLE IF NOT EXISTS simulation_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id TEXT, sim_id TEXT, started_at TEXT, completed_at TEXT,
    time_s REAL, accuracy REAL, safety_score REAL, telemetry TEXT
);
CREATE TABLE IF NOT EXISTS guardian_links (
    id TEXT PRIMARY KEY, student_id TEXT, parent_id TEXT, code TEXT, consent_status TEXT,
    shared_permissions TEXT, linked_at TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS consensus (
    link_id TEXT PRIMARY KEY, trade_id TEXT, student_answers TEXT, parent_answers TEXT, plan TEXT,
    completed INTEGER DEFAULT 0, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS centres (
    id INTEGER PRIMARY KEY AUTOINCREMENT, district_id TEXT, name_en TEXT, name_hi TEXT, kind TEXT,
    trades TEXT, capacity INTEGER, distance_km INTEGER, women_hostel INTEGER
);
CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, teacher_id TEXT, name TEXT, school TEXT, district_id TEXT);
CREATE TABLE IF NOT EXISTS report_shares (
    token TEXT PRIMARY KEY, profile_id TEXT, trade_id TEXT, created_at TEXT, views INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, profile_id TEXT, kind TEXT, data TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS ix_attempts_profile ON simulation_attempts(profile_id);
CREATE INDEX IF NOT EXISTS ix_events_profile ON events(profile_id, kind);
CREATE INDEX IF NOT EXISTS ix_outcomes_td ON outcomes(trade_id, district_id);
"""

JSON_COLUMNS = {"members", "concerns", "cards", "ladder", "trades", "quiz", "sources", "riasec", "answers",
                "competencies", "confidence", "exploration", "config", "telemetry", "shared_permissions",
                "student_answers", "parent_answers", "plan", "data", "flags"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _decode(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    for k in JSON_COLUMNS & d.keys():
        if isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except json.JSONDecodeError:
                pass
    return d


def _encode(values: dict) -> dict:
    return {k: json.dumps(v, ensure_ascii=False) if k in JSON_COLUMNS and not isinstance(v, str) else v
            for k, v in values.items()}


# Columns added after the first release; existing databases get them on start-up.
MIGRATIONS = {
    "sessions": {"learner_age": "INTEGER", "quiz": "TEXT", "user_id": "TEXT", "profile_id": "TEXT",
                 "trade_changes": "INTEGER DEFAULT 0", "halted": "INTEGER DEFAULT 0"},
    "messages": {"sources": "TEXT"},
    "escalations": {"risk_level": "INTEGER DEFAULT 1", "first_contact_at": "TEXT", "consented": "INTEGER DEFAULT 1"},
    # national demo cohort (users outside the pilot districts) and the India map
    "users": {"state": "TEXT", "gender": "TEXT", "interest_trade": "TEXT", "last_active_at": "TEXT"},
}


def init_db() -> None:
    with connect() as c:
        c.executescript(SCHEMA)
        for table, cols in MIGRATIONS.items():
            have = {r[1] for r in c.execute(f"PRAGMA table_info({table})")}
            for col, kind in cols.items():
                if col not in have:
                    c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {kind}")


def query(sql: str, params: tuple | list = ()) -> list[dict]:
    with connect() as c:
        return [_decode(r) for r in c.execute(sql, params).fetchall()]


def one(sql: str, params: tuple | list = ()) -> dict | None:
    with connect() as c:
        return _decode(c.execute(sql, params).fetchone())


def insert(table: str, values: dict) -> int:
    values = _encode(values)
    cols = ", ".join(values)
    marks = ", ".join("?" for _ in values)
    with connect() as c:
        cur = c.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(values.values()))
        return cur.lastrowid


def insert_many(table: str, rows: list[dict]) -> None:
    if not rows:
        return
    rows = [_encode(r) for r in rows]
    cols = list(rows[0])
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})"
    with connect() as c:
        c.executemany(sql, [[r[k] for k in cols] for r in rows])


def update(table: str, key: str, key_value, values: dict) -> None:
    values = _encode(values)
    sets = ", ".join(f"{k} = ?" for k in values)
    with connect() as c:
        c.execute(f"UPDATE {table} SET {sets} WHERE {key} = ?", [*values.values(), key_value])


def count(table: str) -> int:
    with connect() as c:
        return c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


# ------------------------------------------------------------------ domain lookups
def get_district(district_id: str) -> dict | None:
    return one("SELECT * FROM districts WHERE id = ?", (district_id,))


def get_trade(trade_id: str) -> dict | None:
    return one("SELECT * FROM trades WHERE id = ?", (trade_id,))


def get_outcome(trade_id: str, district_id: str) -> dict | None:
    """District record first; otherwise the best record from the same state, marked as a fallback."""
    rec = one("SELECT * FROM outcomes WHERE trade_id = ? AND district_id = ? "
              "ORDER BY CASE status WHEN 'verified' THEN 0 WHEN 'self-reported' THEN 1 ELSE 2 END LIMIT 1",
              (trade_id, district_id))
    if rec:
        rec["scope"] = "district"
        return rec
    rec = one("SELECT o.* FROM outcomes o JOIN districts d ON d.id = o.district_id "
              "WHERE o.trade_id = ? AND d.state = (SELECT state FROM districts WHERE id = ?) "
              "ORDER BY CASE o.status WHEN 'verified' THEN 0 ELSE 1 END LIMIT 1",
              (trade_id, district_id))
    if rec:
        rec["scope"] = "state"
    return rec


def get_story(trade_id: str, district_id: str, kind: str | None = None, gender: str | None = None) -> dict | None:
    clauses, params = ["trade_id = ?"], [trade_id]
    if kind:
        clauses.append("kind = ?")
        params.append(kind)
    if gender:
        clauses.append("gender = ?")
        params.append(gender)
    order = "CASE WHEN district_id = ? THEN 0 WHEN district_id IN (SELECT id FROM districts WHERE state = " \
            "(SELECT state FROM districts WHERE id = ?)) THEN 1 ELSE 2 END"
    return one(f"SELECT * FROM stories WHERE {' AND '.join(clauses)} ORDER BY {order} LIMIT 1",
               [*params, district_id, district_id])


def get_schemes(trade_id: str) -> list[dict]:
    return [s for s in query("SELECT * FROM schemes") if "all" in s["trades"] or trade_id in s["trades"]]


def get_session(session_id: str) -> dict | None:
    return one("SELECT * FROM sessions WHERE id = ?", (session_id,))


def get_messages(session_id: str) -> list[dict]:
    return query("SELECT * FROM messages WHERE session_id = ? ORDER BY id", (session_id,))


def event(kind: str, user_id: str | None = None, profile_id: str | None = None, data: dict | None = None) -> None:
    insert("events", {"user_id": user_id, "profile_id": profile_id, "kind": kind, "data": data or {}, "created_at": now()})


def open_escalation(session_id: str) -> dict | None:
    return one("SELECT * FROM escalations WHERE session_id = ? AND status != 'resolved' ORDER BY id DESC LIMIT 1",
               (session_id,))
