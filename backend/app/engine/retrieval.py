"""Retrieval for grounded answers: a small BM25 index over curated passages and the trade catalogue.

Runs fully offline in pure Python. The retrieved passages are added to the fact pack, so the model
(and the number guard) only see figures from verified text, and the reply can cite its sources.
"""
import math
import re
from collections import Counter
from functools import lru_cache

from .. import db
from ..catalog import TRADE_DETAILS
from ..kb import CONCERN_EXPANSION, PASSAGES

K1, B = 1.4, 0.75
_TOKEN = re.compile(r"[a-z0-9]+|[ऀ-ॿ]+")
STOP = {"the", "a", "an", "of", "to", "and", "or", "is", "are", "for", "in", "on", "with", "what", "how", "will",
        "it", "be", "can", "do", "does", "my", "kya", "hai", "ka", "ki", "ke", "se", "me", "mein", "ko",
        "है", "का", "की", "के", "में", "से", "को", "और", "क्या"}


def tokens(text: str) -> list[str]:
    return [t for t in _TOKEN.findall((text or "").lower()) if t not in STOP and len(t) > 1]


def _docs() -> list[dict]:
    docs = [{**p, "kind": "kb"} for p in PASSAGES]
    for t in db.query("SELECT * FROM trades"):
        det = TRADE_DETAILS.get(t["id"], {})
        docs.append({
            "id": f"trade:{t['id']}", "kind": "trade", "source": "UDAAN trade catalogue", "url": None,
            "tags": f"{t['id']} {t['name_en']} {t['sector_en']} course duration nsqf",
            "title_en": t["name_en"], "title_hi": t["name_hi"],
            "en": f"{t['name_en']}: {t['about_en']} NSQF level {t['nsqf_level']}, {t['duration_months']} months. "
                  f"Roles: {t['roles_en']}. {det.get('day', {}).get('en', '')}",
            "hi": f"{t['name_hi']}: {t['about_hi']} NSQF स्तर {t['nsqf_level']}, {t['duration_months']} महीने। "
                  f"काम: {t['roles_hi']}। {det.get('day', {}).get('hi', '')}",
        })
    return docs


@lru_cache(maxsize=1)
def _index():
    docs = _docs()
    bags = [Counter(tokens(" ".join([d["tags"], d["title_en"], d["title_hi"], d["en"], d["hi"]]))) for d in docs]
    df = Counter(t for b in bags for t in b)
    avg = sum(sum(b.values()) for b in bags) / max(len(bags), 1)
    return docs, bags, df, avg


def search(query: str, concerns: list[str] | None = None, trade_id: str | None = None, k: int = 3) -> list[dict]:
    docs, bags, df, avg = _index()
    n = len(docs)
    q = tokens(query) + tokens(" ".join(CONCERN_EXPANSION.get(c, "") for c in concerns or []))
    if not q:
        return []
    scored = []
    for d, bag in zip(docs, bags):
        length = sum(bag.values())
        s = 0.0
        for term in q:
            f = bag.get(term)
            if not f:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            s += idf * f * (K1 + 1) / (f + K1 * (1 - B + B * length / avg))
        if d["kind"] == "trade" and trade_id and d["id"] != f"trade:{trade_id}":
            s *= 0.3  # other trades' catalogue entries are rarely what the family is asking about
        if s > 0:
            scored.append((s, d))
    scored.sort(key=lambda x: -x[0])
    return [{**d, "score": round(s, 3)} for s, d in scored[:k]]


def as_facts(hits: list[dict], lang: str) -> list[dict]:
    return [{"id": h["id"], "title": h[f"title_{lang}"], "text": h[lang], "source": h["source"]} for h in hits]


def as_sources(hits: list[dict], lang: str) -> list[dict]:
    return [{"id": h["id"], "title": h[f"title_{lang}"], "source": h["source"], "url": h.get("url")}
            for h in hits if h["kind"] == "kb"]


def clear_cache() -> None:
    _index.cache_clear()
