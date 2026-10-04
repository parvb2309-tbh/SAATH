from app.engine import guard

FACTS = {"outcome": {"first_year_monthly": [11000, 15500], "placed_within_6_months_pct": 68,
                     "batch_size": 40, "year": 2025, "source": "SIDH placement tracker (demo)"}}


def test_allows_fact_numbers():
    ok, bad = guard.check("Pehle saal ₹11,000–15,500 mahina. 68% ko naukri mili, 40 mein se. (2025)", FACTS)
    assert ok, bad


def test_blocks_invented_amount():
    ok, bad = guard.check("They earn about ₹25,000 a month.", FACTS)
    assert not ok and bad


def test_blocks_invented_percentage_even_if_small():
    ok, _ = guard.check("Almost 9% drop out.", FACTS)
    assert not ok


def test_small_counts_are_fine():
    ok, _ = guard.check("After 3 years and 2 more courses.", FACTS)
    assert ok


def test_hindi_thousands_and_ranges():
    ok, _ = guard.check("लगभग 11–15.5 हज़ार महीना", {"x": [11000, 15500]})
    assert ok
    ok, _ = guard.check("लगभग 30 हज़ार महीना", FACTS)
    assert not ok


def test_devanagari_digits():
    ok, _ = guard.check("६८% को नौकरी मिली", FACTS)
    assert ok


def test_helpline_allowed():
    ok, _ = guard.check("Call Tele-MANAS on 14416.", FACTS)
    assert ok
