"""Number guard: a reply may only contain figures that exist in the fact pack.

Small counts (up to 12: "3 years", "2 options") are allowed. Every other number, every
percentage and every rupee amount must match a value from the facts the reply was built from.
"""
import re

ALWAYS_ALLOWED = {14416}  # Tele-MANAS helpline
SMALL = 12

_DEV_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_NUM = re.compile(
    r"(?P<num>\d[\d,]*(?:\.\d+)?)\s*"
    r"(?P<mult>k\b|K\b|हज़ार|हजार|hazaar|hazar|thousand|lakh|लाख)?\s*"
    r"(?P<pct>%|प्रतिशत|percent)?",
    re.IGNORECASE,
)
_MULT = {"k": 1000, "हज़ार": 1000, "हजार": 1000, "hazaar": 1000, "hazar": 1000, "thousand": 1000,
         "lakh": 100000, "लाख": 100000}


def _facts_numbers(obj, out: set) -> set:
    if isinstance(obj, bool):
        return out
    if isinstance(obj, (int, float)):
        out.add(round(float(obj), 2))
    elif isinstance(obj, str):
        for m in re.finditer(r"\d[\d,]*(?:\.\d+)?", obj.translate(_DEV_DIGITS)):
            out.add(round(float(m.group().replace(",", "")), 2))
    elif isinstance(obj, dict):
        for v in obj.values():
            _facts_numbers(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _facts_numbers(v, out)
    return out


def extract(text: str) -> list[tuple[float, bool, str]]:
    """Numbers in the text as (value, is_percentage, raw). Handles '11-16 hazaar' style ranges."""
    t = (text or "").translate(_DEV_DIGITS)
    found = []
    matches = list(_NUM.finditer(t))
    for i, m in enumerate(matches):
        raw = m.group("num").replace(",", "")
        try:
            val = float(raw)
        except ValueError:
            continue
        mult = m.group("mult")
        if not mult and i + 1 < len(matches):
            # "11–16 हज़ार": the multiplier written after the range applies to both ends
            nxt = matches[i + 1]
            between = t[m.end():nxt.start()]
            if re.fullmatch(r"\s*(?:-|–|—|to|se|से)\s*", between) and nxt.group("mult"):
                mult = nxt.group("mult")
        if mult:
            val *= _MULT.get(mult.lower(), _MULT.get(mult, 1))
        found.append((round(val, 2), bool(m.group("pct")), m.group(0).strip()))
    return found


def check(reply: str, facts) -> tuple[bool, list[str]]:
    allowed = _facts_numbers(facts, set()) | ALWAYS_ALLOWED
    bad = []
    for val, is_pct, raw in extract(reply):
        if not is_pct and val <= SMALL:
            continue
        if val not in allowed:
            bad.append(raw)
    return (not bad, bad)
