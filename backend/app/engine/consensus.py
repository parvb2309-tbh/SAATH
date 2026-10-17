"""Family Consensus Builder (spec §3.6).

Student and parent rate the same priorities independently (1–5). Cross-mapping puts every priority
into one of four action columns. The student's private notes never enter this module's output.
"""
from ..catalog import PRIORITIES, TRADE_PROFILES

AGREED, VERIFY, SIMULATE, COUNSELLOR = "agreed", "verify", "simulate", "counsellor"
SENSITIVE = {"safety", "respect", "interest"}


def classify(item: dict, s: int, p: int, trade_id: str | None) -> dict:
    gap = abs(s - p)
    sim = TRADE_PROFILES.get(trade_id or "", {}).get("sim")
    if gap <= 1:
        col = AGREED
    elif gap >= 3 and item["id"] in SENSITIVE:
        col = COUNSELLOR
    elif item["id"] == "interest" or (item["id"] == "safety" and sim):
        col = SIMULATE
    else:
        col = VERIFY
    out = {"id": item["id"], "icon": item["icon"], "en": item["en"], "hi": item["hi"], "student": s, "parent": p,
           "gap": gap, "column": col, "evidence": item["evidence"] if col == VERIFY else None,
           "sim": sim if col == SIMULATE else None}
    if col == VERIFY and item["evidence"] is None:
        out["column"] = SIMULATE if sim else COUNSELLOR
    return out


def build_plan(student: dict, parent: dict, trade_id: str | None) -> dict:
    items = [classify(it, int(student[it["id"]]), int(parent[it["id"]]), trade_id)
             for it in PRIORITIES if it["id"] in student and it["id"] in parent]
    shared = sorted((i for i in items if i["column"] == AGREED and min(i["student"], i["parent"]) >= 4),
                    key=lambda i: -(i["student"] + i["parent"]))
    return {
        "items": items,
        "columns": {c: [i["id"] for i in items if i["column"] == c] for c in (AGREED, VERIFY, SIMULATE, COUNSELLOR)},
        "shared_priorities": [i["id"] for i in shared[:3]],
        "agreement_pct": round(100 * sum(i["column"] == AGREED for i in items) / len(items)) if items else 0,
    }
