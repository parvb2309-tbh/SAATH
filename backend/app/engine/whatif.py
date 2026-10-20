"""What-If Scenario Simulator (spec §3.5): three routes compared over five years.

A  Conventional      2 years Class 11–12 + 3 years BA
B  Direct vocational 2 years ITI (CTS) + 1 year NAPS apprenticeship, then work
C  Short-term skill  6 months PMKVY (NSQF 4) + work + 3-year part-time diploma

Earnings come from the trade × district outcome record (the same verified table the chat answers from).
Everything else is an editable assumption and is returned with the result so the UI can show it.
"""
from .. import db

DEFAULTS = {
    "school_fee": 6000,       # per year, government senior secondary incl. books (demo estimate)
    "ba_fee": 12000,          # per year, government college BA (demo estimate)
    "iti_fee": 2000,          # per year, government ITI (demo estimate)
    "diploma_fee": 15000,     # per year, part-time diploma (demo estimate)
    "naps_stipend": 8000,     # per month during apprenticeship (demo estimate; varies by state and trade)
    "band": "mid",            # which part of the outcome band to use: low | mid | high
}
YEARS = 5


def _wage(o: dict, experience_years: float, band: str) -> float:
    """Monthly wage after `experience_years` of work, interpolated between the year-1, -3 and -5 bands."""
    pick = {"low": lambda lo, hi: lo, "high": lambda lo, hi: hi}.get(band, lambda lo, hi: (lo + hi) / 2)
    pts = [(0, pick(o["earn_low"], o["earn_high"])), (2, pick(o["earn3_low"], o["earn3_high"])),
           (4, pick(o["earn5_low"], o["earn5_high"]))]
    x = max(0.0, min(4.0, experience_years))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def simulate(trade_id: str, district_id: str, overrides: dict | None = None) -> dict:
    a = {**DEFAULTS, **{k: v for k, v in (overrides or {}).items() if v is not None}}
    o = db.get_outcome(trade_id, district_id)
    if not o:
        return {"available": False}
    band = a["band"]
    entry = _wage(o, 0, band)

    def year_rows(plan):
        rows, cum = [], 0.0
        for y, (cost, study_months, stipend_months, work_months, exp) in enumerate(plan, start=1):
            earnings = work_months * _wage(o, exp, band)
            stipend = stipend_months * a["naps_stipend"]
            opportunity = study_months * entry  # what the same months of work would have paid
            net = earnings + stipend - cost
            cum += net
            rows.append({"year": y, "direct_cost": round(cost), "opportunity_cost": round(opportunity),
                         "stipend": round(stipend), "earnings": round(earnings), "net": round(net),
                         "cumulative": round(cum)})
        return rows

    # (direct cost, study months, stipend months, working months, years of experience at mid-year)
    plan_a = [(a["school_fee"], 12, 0, 0, 0), (a["school_fee"], 12, 0, 0, 0),
              (a["ba_fee"], 12, 0, 0, 0), (a["ba_fee"], 12, 0, 0, 0), (a["ba_fee"], 12, 0, 0, 0)]
    plan_b = [(a["iti_fee"], 12, 0, 0, 0), (a["iti_fee"], 12, 0, 0, 0), (0, 0, 12, 0, 0),
              (0, 0, 0, 12, 0.5), (0, 0, 0, 12, 1.5)]
    plan_c = [(0, 6, 0, 6, 0.25), (a["diploma_fee"], 0, 0, 12, 1), (a["diploma_fee"], 0, 0, 12, 2),
              (a["diploma_fee"], 0, 0, 12, 3), (0, 0, 0, 12, 4.2)]
    options = [
        {"id": "A", "rows": year_rows(plan_a)},
        {"id": "B", "rows": year_rows(plan_b)},
        {"id": "C", "rows": year_rows(plan_c)},
    ]
    for op in options:
        r = op["rows"]
        op["total_cost"] = sum(x["direct_cost"] for x in r)
        op["total_opportunity"] = sum(x["opportunity_cost"] for x in r)
        op["total_income"] = sum(x["earnings"] + x["stipend"] for x in r)
        op["net_5y"] = r[-1]["cumulative"]
        op["first_income_year"] = next((x["year"] for x in r if x["earnings"] or x["stipend"]), None)
    d = db.get_district(o["district_id"]) or {}
    return {
        "available": True, "assumptions": a, "options": options,
        "wage_entry": round(entry), "wage_year5": round(_wage(o, 4, band)),
        "source": {"source": o["source"], "year": o["year"], "status": o["status"], "scope": o["scope"],
                   "district": d.get("name_en"), "district_hi": d.get("name_hi")},
    }
