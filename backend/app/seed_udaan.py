"""Demo data for the UDAAN portals: centres, demo accounts, a synthetic student cohort with Career DNA,
simulation attempts and pathway stages, guardian links, consensus plans and risk-level referrals.

ILLUSTRATIVE ONLY, like seed.py. Cohort sizes are chosen so most districts pass the N ≥ 50 privacy
threshold and two (Muzaffarpur, Rewa) do not, which shows suppression in the admin dashboard.
"""
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from . import auth, catalog, db, mongo, security
from .engine import consensus, dna, match

COHORT = {"lucknow": 64, "varanasi": 58, "gorakhpur": 52, "patna": 66, "gaya": 60, "muzaffarpur": 44,
          "bhopal": 56, "indore": 62, "rewa": 31}
NAMES_F = ["Aarti", "Pooja", "Neha", "Priya", "Sana", "Kajal", "Nisha", "Anjali", "Rubina", "Khushboo", "Simran",
           "Komal", "Shalini", "Muskan", "Divya", "Payal", "Rani", "Sonam", "Jyoti", "Farah"]
NAMES_M = ["Rahul", "Amit", "Ravi", "Imran", "Suraj", "Vikas", "Deepak", "Arjun", "Rohit", "Sachin", "Ankit",
           "Manish", "Aman", "Faizan", "Nitin", "Gaurav", "Pankaj", "Sonu", "Ajay", "Akash"]
INITIALS = "ABDGKMPRSTVY"

# Centre templates: (kind, English name, Hindi name, trades, seats per batch for the sampled blocks)
CENTRES = [
    ("ITI", "Government ITI, {d}", "सरकारी आईटीआई, {h}", ["electrician", "ac_tech", "auto_tech", "tailoring", "data_entry"], (25, 70)),
    ("PMKVY", "PMKVY Kendra, {d}", "पीएमकेवीवाई केंद्र, {h}", ["gda", "beauty", "retail", "data_entry", "tailoring", "solar"], (15, 45)),
    ("Suryamitra", "Suryamitra Training Centre, {d}", "सूर्यमित्र प्रशिक्षण केंद्र, {h}", ["solar", "electrician"], (8, 20)),
    ("Private", "Private Skill Institute, {d}", "निजी कौशल संस्थान, {h}", ["electrician", "ac_tech", "beauty", "auto_tech", "retail"], (10, 30)),
]
NO_SURYAMITRA = {"rewa", "muzaffarpur", "gorakhpur"}


def _uid(rng: random.Random) -> str:
    return uuid.UUID(int=rng.getrandbits(128)).hex[:12]


def _answers(rng: random.Random, gender: str) -> dict:
    """Activity votes from a random leaning: one or two favourite RIASEC letters."""
    fav = rng.sample(catalog.RIASEC, 2)
    lean = {d: 0.15 for d in catalog.RIASEC}
    lean[fav[0]] = 0.85
    lean[fav[1]] = 0.6
    if gender == "f":
        lean["S"] = max(lean["S"], 0.45)
    out = {}
    for item in catalog.RIASEC_ITEMS:
        r = rng.random()
        p = lean[item["dim"]]
        out[item["id"]] = "like" if r < p else "meh" if r < p + 0.25 else "no"
    return out


def seed(rng: random.Random) -> None:
    now = datetime.now(timezone.utc)
    districts = db.query("SELECT * FROM districts")
    db.insert_many("simulations", [{"id": s["id"], "trade_id": s["trade_id"], "nsqf_level": s["nsqf_level"],
                                    "title_en": s["title_en"], "title_hi": s["title_hi"],
                                    "config": {"competencies": s["competencies"]}} for s in catalog.SIMULATIONS])
    centres = []
    for d in districts:
        for kind, en, hi, trades, (lo, hi_cap) in CENTRES:
            if kind == "Suryamitra" and d["id"] in NO_SURYAMITRA:
                continue
            if kind == "Private" and rng.random() < 0.35:
                continue
            centres.append({"district_id": d["id"], "name_en": en.format(d=d["name_en"]), "name_hi": hi.format(h=d["name_hi"]),
                            "kind": kind, "trades": trades, "capacity": rng.randint(lo, hi_cap),
                            "distance_km": rng.randint(3, 38), "women_hostel": int(rng.random() < 0.4)})
    db.insert_many("centres", centres)
    match.clear_caches()

    # ---- demo accounts (one tap on the sign-in screen)
    demo = {
        "student": ("Riya Kumari", None, "gaya", "9000000001", "student@saath.local", "Student@123"),
        "parent": ("Sunita Devi", "mother", "gaya", "9000000002", "parent@saath.local", "Parent@123"),
        "counsellor": ("Anjali Verma", None, "patna", "9000000003", "counsellor@saath.local", "Counsellor@123"),
        "teacher": ("Rakesh Kumar", None, "gaya", "9000000004", "teacher@saath.local", "Teacher@123"),
        "admin": ("District Skill Officer", None, None, "9000000005", "admin@saath.local", "Admin@123"),
    }
    ids = {}
    mongo_users = mongo.get_sync_users_col()
    mongo_ok = True
    for role, (name, relation, district, mobile, email, pwd) in demo.items():
        ids[role] = f"demo-{role}"
        created_str = (now - timedelta(days=20)).isoformat(timespec="seconds")
        db.insert("users", {"id": ids[role], "role": role, "mobile_hash": auth.hash_mobile(mobile), "name": name,
                            "relation": relation, "preferred_lang": "hi", "district_id": district,
                            "created_at": created_str, "synthetic": 0,
                            "demo_key": role})
        if not mongo_ok:
            continue
        try:
            mongo_users.update_one(
                {"_id": ids[role]},
                {"$set": {
                    "name": name,
                    "email": email,
                    "normalized_email": email.lower(),
                    "password_hash": security.hash_password(pwd),
                    "role": role,
                    "relation": relation,
                    "preferred_lang": "hi",
                    "district_id": district,
                    "is_email_verified": True,
                    "is_active": True,
                    "created_at": created_str,
                    "updated_at": created_str,
                    "last_login_at": None,
                }},
                upsert=True,
            )
        except Exception as e:  # unreachable MongoDB: stop retrying (each try waits for the timeout)
            mongo_ok = False
            logging.getLogger("udaan.seed").warning("Demo accounts not written to MongoDB: %s", str(e)[:160])
    class_id = "class-gaya-10b"
    db.insert("classes", {"id": class_id, "teacher_id": ids["teacher"], "name": "Class 10-B",
                          "school": "Government Inter College, Gaya", "district_id": "gaya"})

    # ---- Riya: a student partway through her pathway, linked to her mother
    riya_pid = "demo-riya"
    db.insert("student_profiles", {
        "id": riya_pid, "user_id": ids["student"], "district_id": "gaya", "education_level": "10", "study_mode": "full_time",
        "budget_limit": 5000, "max_travel_km": 20, "needs_stipend": 1, "min_earning": 9000, "max_months": 12,
        "work_setting": "any", "age": 16, "gender": "f", "chosen_trade": "solar", "private_notes": "", "class_id": class_id,
        "flags": {"prereq_checked": True}, "stage": 4, "created_at": (now - timedelta(days=20)).isoformat(timespec="seconds"),
        "synthetic": 0})
    db.insert("consents", {"user_id": ids["student"], "ai_guidance": 1, "counsellor_share": 1, "parent_link": 1,
                           "research": 0, "guardian_approved": 1, "updated_at": db.now()})
    db.insert("consents", {"user_id": ids["parent"], "ai_guidance": 1, "counsellor_share": 1, "parent_link": 1,
                           "research": 0, "guardian_approved": 0, "updated_at": db.now()})
    riya_answers = {"r1": "like", "i1": "like", "a1": "meh", "s1": "meh", "e1": "no", "c1": "meh", "r2": "like",
                    "i2": "like", "a2": "no", "s2": "like", "e2": "meh", "c2": "meh", "r3": "like", "i3": "meh",
                    "a3": "meh", "s3": "meh", "e3": "like", "c3": "no"}
    comp = dna.update_competencies({}, "solar", 0.82, 1.0)
    db.insert("career_dna", {"profile_id": riya_pid, "riasec": dna.riasec_from_answers(riya_answers), "answers": riya_answers,
                             "competencies": comp, "confidence": {"numerical": 4, "spatial": 3, "digital": 3},
                             "exploration": {"sims": ["solar"], "trades_viewed": ["solar", "electrician"]},
                             "updated_at": db.now()})
    started = now - timedelta(days=6)
    db.insert("simulation_attempts", {"profile_id": riya_pid, "sim_id": "solar", "started_at": started.isoformat(timespec="seconds"),
                                      "completed_at": (started + timedelta(minutes=5)).isoformat(timespec="seconds"),
                                      "time_s": 287, "accuracy": 0.82, "safety_score": 1.0,
                                      "telemetry": {"indicators": [{"en": "Tilt angle", "hi": "झुकाव का कोण", "value": "22° vs 25°", "good": True}]}})
    db.insert("guardian_links", {"id": "demo-link", "student_id": riya_pid, "parent_id": ids["parent"], "code": "RIYA24",
                                 "consent_status": "linked", "shared_permissions": {"dna": True, "simulations": True,
                                                                                    "pathway": True, "chosen_trade": True},
                                 "linked_at": (now - timedelta(days=5)).isoformat(timespec="seconds"),
                                 "created_at": (now - timedelta(days=6)).isoformat(timespec="seconds")})
    db.insert("consensus", {"link_id": "demo-link", "trade_id": "solar",
                            "student_answers": {"earn_soon": 4, "near_home": 3, "safety": 3, "respect": 2, "low_cost": 4,
                                                "degree_path": 3, "interest": 5, "stability": 4},
                            "parent_answers": None, "plan": None, "completed": 0, "updated_at": db.now()})

    _cohort(rng, now, districts, class_id)
    _referrals(rng, now)
    _national(rng, now)
    match.clear_caches()


def _cohort(rng: random.Random, now: datetime, districts: list[dict], class_id: str) -> None:
    users, profiles, dnas, attempts, consents, links, consensus_rows, events = [], [], [], [], [], [], [], []
    in_class = 0
    for d in districts:
        for _ in range(COHORT[d["id"]]):
            gender = "f" if rng.random() < 0.45 else "m"
            uid, pid = "syn-" + _uid(rng), "synp-" + _uid(rng)
            name = f"{rng.choice(NAMES_F if gender == 'f' else NAMES_M)} {rng.choice(INITIALS)}."
            created = now - timedelta(days=int(56 * rng.random() ** 1.4), hours=rng.randint(0, 23))
            users.append({"id": uid, "role": "student", "mobile_hash": None, "name": name, "relation": None,
                          "preferred_lang": "hi", "district_id": d["id"], "created_at": created.isoformat(timespec="seconds"),
                          "synthetic": 1, "demo_key": None})
            education = rng.choice(["8", "10", "10", "10", "12", "12", "iti"])
            profile = {
                "id": pid, "user_id": uid, "district_id": d["id"], "education_level": education,
                "study_mode": rng.choice(["full_time", "full_time", "part_time", "weekend"]),
                "budget_limit": rng.choice([0, 2000, 5000, 10000, 25000]), "max_travel_km": rng.choice([10, 15, 20, 30, 50]),
                "needs_stipend": int(rng.random() < 0.5), "min_earning": rng.choice([None, 8000, 10000, 12000]),
                "max_months": rng.choice([6, 12, 24, 36]), "work_setting": rng.choice(["any", "any", "indoor", "outdoor"]),
                "age": rng.randint(15, 22), "gender": gender, "chosen_trade": None, "private_notes": "",
                "class_id": None, "flags": {}, "stage": 1, "created_at": created.isoformat(timespec="seconds"), "synthetic": 1,
            }
            if d["id"] == "gaya" and in_class < 38 and education in ("10", "12"):
                profile["class_id"] = class_id
                in_class += 1
            ans = _answers(rng, gender)
            conf = {k: rng.randint(2, 5) for k in dna.CONFIDENCE_DIMS}
            the_dna = {"riasec": dna.riasec_from_answers(ans), "competencies": {}, "confidence": conf}
            ranked = match.rank(profile, the_dna)
            r = rng.random()
            chosen = ranked[0]["trade_id"] if r < 0.6 else ranked[1]["trade_id"] if r < 0.85 else None
            profile["chosen_trade"] = chosen

            # simulations: the chosen trade's own sim most of the time, plus some exploring
            sims = []
            own = catalog.TRADE_PROFILES[chosen]["sim"] if chosen else None
            if own and rng.random() < 0.72:
                sims.append(own)
            sims += rng.sample([s["id"] for s in catalog.SIMULATIONS if s["id"] != own], rng.choice([0, 0, 1, 1, 2]))
            comp, did_own = {}, False
            for sim_id in sims:
                t0 = created + timedelta(days=rng.randint(0, 6), minutes=rng.randint(0, 600))
                done = rng.random() < 0.8
                acc, safe = round(rng.uniform(0.45, 0.98), 3), round(rng.choice([1.0, 1.0, 0.7, 0.4]), 2)
                attempts.append({"profile_id": pid, "sim_id": sim_id, "started_at": t0.isoformat(timespec="seconds"),
                                 "completed_at": (t0 + timedelta(minutes=rng.randint(3, 9))).isoformat(timespec="seconds") if done else None,
                                 "time_s": rng.randint(150, 520) if done else None, "accuracy": acc if done else None,
                                 "safety_score": safe if done else None, "telemetry": {}})
                if done:
                    comp = dna.update_competencies(comp, sim_id, acc, safe)
                    did_own = did_own or sim_id == own
            the_dna["competencies"] = comp
            dnas.append({"profile_id": pid, "riasec": the_dna["riasec"], "answers": ans, "competencies": comp,
                         "confidence": conf, "exploration": {"sims": sims, "trades_viewed": [x["trade_id"] for x in ranked[:2]]},
                         "updated_at": created.isoformat(timespec="seconds")})

            # pathway: each stage only counts once the earlier ones are done
            reached = 1
            steps = [bool(chosen), (did_own or (not own and bool(comp))), rng.random() < 0.85, rng.random() < 0.72,
                     rng.random() < 0.5, rng.random() < 0.5, rng.random() < 0.4]
            for ok in steps:
                if not ok:
                    break
                reached += 1
            profile["stage"] = min(reached, 8)
            if reached >= 6:
                profile["flags"] = {"sidh_ref": f"SIDH-DEMO-{rng.randrange(16**6):06X}", "sidh_trade": chosen, "prereq_checked": True}
            profiles.append(profile)
            consents.append({"user_id": uid, "ai_guidance": 1, "counsellor_share": int(rng.random() < 0.7),
                             "parent_link": 1, "research": int(rng.random() < 0.8), "guardian_approved": 0, "updated_at": db.now()})

            if rng.random() < 0.5:  # a parent linked their account
                parent_id, link_id = "synpar-" + _uid(rng), "synlink-" + _uid(rng)
                users.append({"id": parent_id, "role": "parent", "mobile_hash": None, "name": "", "relation": rng.choice(["mother", "father"]),
                              "preferred_lang": "hi", "district_id": d["id"], "created_at": created.isoformat(timespec="seconds"),
                              "synthetic": 1, "demo_key": None})
                links.append({"id": link_id, "student_id": pid, "parent_id": parent_id, "code": _uid(rng)[:6].upper(),
                              "consent_status": "linked", "shared_permissions": {"dna": True, "simulations": True, "pathway": True,
                                                                                 "chosen_trade": True},
                              "linked_at": (created + timedelta(days=1)).isoformat(timespec="seconds"),
                              "created_at": created.isoformat(timespec="seconds")})
                consents[-1]["guardian_approved"] = 1
                if rng.random() < 0.74:
                    events.append({"user_id": parent_id, "profile_id": pid, "kind": "report_viewed", "data": {"trade": chosen},
                                   "created_at": (created + timedelta(days=2)).isoformat(timespec="seconds")})
                if rng.random() < 0.45 and chosen:
                    s_ans = {p["id"]: rng.randint(1, 5) for p in catalog.PRIORITIES}
                    p_ans = {k: max(1, min(5, v + rng.choice([-2, -1, 0, 0, 1, 2]))) for k, v in s_ans.items()}
                    consensus_rows.append({"link_id": link_id, "trade_id": chosen, "student_answers": s_ans, "parent_answers": p_ans,
                                           "plan": consensus.build_plan(s_ans, p_ans, chosen), "completed": int(rng.random() < 0.58),
                                           "updated_at": (created + timedelta(days=3)).isoformat(timespec="seconds")})
    for table, rows in (("users", users), ("student_profiles", profiles), ("career_dna", dnas),
                        ("simulation_attempts", attempts), ("consents", consents), ("guardian_links", links),
                        ("consensus", consensus_rows), ("events", events)):
        db.insert_many(table, rows)


def _referrals(rng: random.Random, now: datetime) -> None:
    """Level 2 and 3 demo cases, plus resolved level 2 referrals that feed the counsellor SLA metric."""
    db.update("escalations", "engine", "demo", {"risk_level": 1})
    patna = db.one("SELECT p.* FROM student_profiles p JOIN consents c ON c.user_id = p.user_id "
                   "WHERE p.district_id = 'patna' AND p.synthetic = 1 AND c.counsellor_share = 1 AND p.chosen_trade IS NOT NULL "
                   "LIMIT 1")
    muz = db.one("SELECT * FROM student_profiles WHERE district_id = 'muzaffarpur' AND synthetic = 1 AND gender = 'f' LIMIT 1")
    cases = [
        {"sid": "demo-esc-l2", "profile": patna, "district": "patna", "trade": patna["chosen_trade"], "gender": patna["gender"],
         "level": 2, "priority": 1, "hours": 5, "halted": 0,
         "reason": "Severe distress about family pressure or dropping out",
         "turns": [("learner", "papa zabardasti engineering coaching bhej rahe hain, bahut pressure hai", ["distress"], -0.7),
                   ("learner", "lagta hai padhai chhod dunga, neend nahi aati", ["distress"], -0.8)],
         "summary": "The learner feels heavy pressure from his father to join engineering coaching and talks about dropping out. "
                    "He agreed to a counsellor call. Suggest a gentle call first with the learner alone, then a joint call "
                    "with the father using the What-If comparison."},
        {"sid": "demo-esc-l3", "profile": muz, "district": "muzaffarpur", "trade": muz.get("chosen_trade"), "gender": "f",
         "level": 3, "priority": 1, "hours": 1, "halted": 1,
         "reason": "Immediate safety concern: self-harm or abuse mentioned",
         "turns": [("learner", "ghar par maarte hain jab main training ki baat karti hoon", ["crisis"], -0.9)],
         "summary": "The learner reported being beaten at home when she talks about training. Helplines were shown and the "
                    "career chat is paused. Safeguarding desk: follow the institutional protocol today."},
    ]
    for c in cases:
        created = (now - timedelta(hours=c["hours"])).isoformat(timespec="seconds")
        p = c["profile"]
        db.insert("sessions", {"id": c["sid"], "created_at": created, "district_id": c["district"], "trade_id": c["trade"],
                               "income_bracket": None, "schooling": p.get("education_level") or "10", "language": "hi",
                               "members": ["learner"], "learner_gender": c["gender"], "consent": 1, "status": "thinking",
                               "first_sentiment": c["turns"][0][3], "last_sentiment": c["turns"][-1][3], "synthetic": 1,
                               "phone": "", "user_id": p["user_id"], "profile_id": p["id"], "trade_changes": 0,
                               "halted": c["halted"]})
        for speaker, text, concerns, s in c["turns"]:
            db.insert("messages", {"session_id": c["sid"], "created_at": created, "role": "user", "speaker": speaker, "text": text,
                                   "lang": "hi", "concerns": concerns, "sentiment": s, "engine": "synthetic", "cards": []})
        db.insert("escalations", {"session_id": c["sid"], "created_at": created, "reason": c["reason"], "priority": c["priority"],
                                  "summary": c["summary"], "status": "open", "phone": "", "callback_time": "", "notes": "",
                                  "engine": "demo", "risk_level": c["level"], "first_contact_at": None,
                                  "consented": int(c["level"] < 3)})
    # resolved level-2 referrals over the past weeks, contacted within 2–30 hours
    sample = db.query("SELECT * FROM student_profiles WHERE synthetic = 1 ORDER BY id LIMIT 9 OFFSET 40")
    for i, p in enumerate(sample):
        created = now - timedelta(days=3 + 4 * i, hours=rng.randint(0, 12))
        sid = f"demo-l2-{i}"
        db.insert("sessions", {"id": sid, "created_at": created.isoformat(timespec="seconds"), "district_id": p["district_id"],
                               "trade_id": p["chosen_trade"], "income_bracket": None, "schooling": p["education_level"],
                               "language": "hi", "members": ["learner"], "learner_gender": p["gender"], "consent": 1,
                               "status": "thinking", "first_sentiment": -0.6, "last_sentiment": 0.1, "synthetic": 1,
                               "phone": "", "user_id": p["user_id"], "profile_id": p["id"], "trade_changes": 0, "halted": 0})
        db.insert("messages", {"session_id": sid, "created_at": created.isoformat(timespec="seconds"), "role": "user",
                               "speaker": "learner", "text": "", "lang": "hi", "concerns": ["distress"], "sentiment": -0.6,
                               "engine": "synthetic", "cards": []})
        contact = created + timedelta(hours=rng.choice([2, 4, 6, 9, 14, 18, 22, 30]))
        db.insert("escalations", {"session_id": sid, "created_at": created.isoformat(timespec="seconds"),
                                  "reason": "Severe distress about family pressure or dropping out", "priority": 1,
                                  "summary": "Resolved referral (demo).", "status": "resolved", "phone": "", "callback_time": "",
                                  "notes": "Called the learner and family; agreed next steps.", "engine": "demo", "risk_level": 2,
                                  "first_contact_at": contact.isoformat(timespec="seconds"), "consented": 1})


# Rough population weights (crore) for states and UTs outside the three pilot states. Small UTs end up
# under the N >= 50 threshold, which shows suppression on the India map.
NATIONAL = {
    "Maharashtra": 12.5, "West Bengal": 10.0, "Rajasthan": 8.0, "Tamil Nadu": 7.7, "Gujarat": 7.0, "Karnataka": 6.8,
    "Andhra Pradesh": 5.3, "Odisha": 4.6, "Jharkhand": 4.0, "Telangana": 3.8, "Kerala": 3.5, "Assam": 3.5,
    "Punjab": 3.0, "Chhattisgarh": 3.0, "Haryana": 2.9, "Delhi": 2.0, "Jammu & Kashmir": 1.4, "Uttarakhand": 1.1,
    "Himachal Pradesh": 0.7, "Tripura": 0.4, "Meghalaya": 0.33, "Manipur": 0.3, "Nagaland": 0.2, "Goa": 0.16,
    "Arunachal Pradesh": 0.15, "Puducherry": 0.15, "Mizoram": 0.12, "Chandigarh": 0.12, "Sikkim": 0.07,
    "Dadra and Nagar Haveli and Daman and Diu": 0.06, "Andaman & Nicobar": 0.04, "Ladakh": 0.03, "Lakshadweep": 0.007,
}
NATIONAL_USERS = 5200
TRADE_MIX = ["electrician", "solar", "gda", "ac_tech", "tailoring", "beauty", "auto_tech", "retail", "data_entry"]


def _national(rng: random.Random, now: datetime) -> None:
    """Demo students and parents across India (no district record), plus state and activity for pilot users."""
    with db.connect() as c:
        c.execute("UPDATE users SET state = (SELECT d.state FROM districts d WHERE d.id = users.district_id) "
                  "WHERE district_id IS NOT NULL")
    pilot = db.query("SELECT id, created_at FROM users WHERE synthetic = 1")
    seen_at = []
    for u in pilot:
        created = datetime.fromisoformat(u["created_at"])
        seen_at.append(((created + (now - created) * rng.random()).isoformat(timespec="seconds"), u["id"]))
    with db.connect() as c:  # one transaction: hundreds of separate commits would slow every cold start
        c.executemany("UPDATE users SET last_active_at = ? WHERE id = ?", seen_at)

    total = sum(NATIONAL.values())
    rows = []
    for state, weight in NATIONAL.items():
        n = max(3, round(NATIONAL_USERS * weight / total))
        # each state leans towards a few trades, so "top trade" differs across the map
        lean = rng.sample(TRADE_MIX, 3)
        for _ in range(n):
            role = "student" if rng.random() < 0.63 else "parent"
            created = now - timedelta(days=int(120 * rng.random() ** 1.3), hours=rng.randint(0, 23))
            seen = created + (now - created) * rng.random() ** 0.6
            rows.append({
                "id": "nat-" + _uid(rng), "role": role, "mobile_hash": None, "name": "",
                "relation": None if role == "student" else rng.choice(["mother", "father"]),
                "preferred_lang": "hi", "district_id": None, "created_at": created.isoformat(timespec="seconds"),
                "synthetic": 1, "demo_key": None, "state": state,
                "gender": ("f" if rng.random() < 0.44 else "m") if role == "student" else None,
                "interest_trade": (rng.choice(lean) if rng.random() < 0.7 else rng.choice(TRADE_MIX)) if role == "student" else None,
                "last_active_at": seen.isoformat(timespec="seconds"),
            })
    db.insert_many("users", rows)
