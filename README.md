# UDAAN (उड़ान): vocational career guidance and family decision support

Working prototype for **SIH 2026 PS 26241**, built to the spec in [`241.pdf`](241.pdf) (Project UDAAN, Phase 1 plus all
five portals). Students discover trades through a Career DNA profile and hands-on simulations. Parents get evidence
instead of assumptions, and the family agrees a plan together. The chat companion inside UDAAN is **SAATH (साथ)**.
It answers in Hindi or English, by voice or text, from verified records only.

> **All outcome figures, centres, stories, students and sessions are demo data**, labelled as such in the UI.
> Real outcome figures are loaded through **Admin → Outcome data → Import CSV**.

## Run it

Needs Python 3.11+ and Node 20+.

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

This installs everything on the first run, starts the API on <http://localhost:8000> and the app on
<http://localhost:5173>, and opens the browser.

To reset the demo data, delete `backend/saath.db` (or run `python -m app.seed` from `backend/`).

**Gemini (optional, free).** Put a key from <https://aistudio.google.com/apikey> into `backend/.env`. Without a key,
with an invalid key, or when the free tier is rate-limited, SAATH uses its offline engine. The header badge shows
which engine is live.

## Five-minute demo

The sign-in screen has one-tap demo accounts. No SMS is ever sent: the OTP is shown on screen and marked as a demo.

1. **New student.** Choose *Get started*, then:
   - role → language → mobile + OTP → district and schooling;
   - four separate privacy toggles;
   - **Career DNA**: 18 activity cards, with the RIASEC hexagon redrawing as you answer.

   A 4-step tour then points out the main tools.
2. **Trade finder.** Drag *travel distance*, *fee* or *earning need*. All 9 trades re-score instantly, and each shows a
   bar that splits interest fit, skill fit and limits not met, with a one-line reason.
3. **Exploration Lab.** Six simulations: solar PV, electrician, healthcare (GDA), automotive, retail and data entry.
   Each one sends telemetry, updates the Career DNA competencies and completes pathway stage 2.
4. **Pathway.** Eight stages, each with one action. They include an eligibility check against the trade's minimum
   schooling, a 5-year cost review, and a demo Skill India Digital Hub registration that returns a `SIDH-DEMO-…`
   reference.
5. **Family Space.** Share the 6-letter family code (or send it on WhatsApp) and choose what the parent can see.
   Then rate the 8 family priorities, with private notes that are never shared.
6. **Parent** (demo: *Sunita*, Riya's mother, works best in हिंदी):
   - the consented overview;
   - the **16-point Parent Proof report** (print, listen, share link);
   - the **What-If** comparator: degree vs ITI + NAPS vs PMKVY + diploma over 5 years, with editable assumptions;
   - the **Consensus board**, with columns *agreed / verify (links to the report section) / try in a simulation /
     counsellor*.
7. **Ask SAATH.** Each answer cites the passages it was grounded in. Try these to see the risk levels:
   - `samajh nahi aa raha kaun sa chunu` → level 1: a banner to book a counsellor;
   - `bahut pressure hai, padhai chhod dunga` → level 2: recommendations pause and a referral is created only with
     consent;
   - a self-harm phrase → level 3: Tele-MANAS 14416, KIRAN 1800-599-0019 and 112 appear, the career chat halts, and the
     safeguarding desk is alerted.
8. **Counsellor.** The priority queue is ordered L3 → L2 → L1, with a 24-hour first-contact SLA timer. Each case shows
   the student's consented Career DNA and *why* the trade scores what it does, as a per-factor attribution chart.
9. **Teacher.** Class RIASEC mix, chosen trades and pathway stages; a sortable engagement table; printable
   group-guidance sheets per interest cluster; and referral status (never the conversation).
10. **Admin.**
    - **Skill gap map**: IGI = interested students ÷ (accredited seats + ε), per trade.
    - **Barrier taxonomy**, by district or by girls/boys.
    - **SIDH tracker** and the **policy metrics matrix** (the six §8.2 metrics, pass/fail against target).
    - **Interest drivers** heatmap.
    - The earlier family-resistance dashboard, parent updates and outcome CSV import.

    Cohorts under **N = 50** are hidden, and published counts carry Laplace noise (ε = 1).

## How it maps to the spec

| Spec | Where |
|---|---|
| §3.1 Career DNA P = [R, C, L, S, E] | `backend/app/engine/dna.py` |
| §3.2 Compatibility index S(u, j) = w₁·f_interest + w₂·f_skill − Σλ·g | `backend/app/engine/match.py` |
| §3.3 Six micro-simulations | `frontend/src/components/sims/*` (+ `formula.js`, a safe spreadsheet parser) |
| §3.4 16-point Parent Proof report | `backend/app/engine/evidence.py`, `frontend/src/components/Report.jsx` |
| §3.5 What-If (options A/B/C, 5 years) | `backend/app/engine/whatif.py`, `frontend/src/components/WhatIf.jsx` |
| §3.6 Family Consensus Builder | `backend/app/engine/consensus.py`, `frontend/src/components/Consensus.jsx` |
| §3.7 8-stage pathway | `backend/app/engine/pathway.py`, `frontend/src/pages/student/Pathways.jsx` |
| §4.1 Design tokens (navy, teal, saffron; Inter + Noto Sans Devanagari; 8px grid) | `frontend/src/styles.css` |
| §4.2 Five role portals | `frontend/src/pages/{student,parent}/`, `Counsellor.jsx`, `Teacher.jsx`, `Admin.jsx` |
| §4.3 Onboarding (welcome, role, language, OTP, demographics, consent, tour) | `frontend/src/pages/Onboarding.jsx`, `components/Tour.jsx` |
| §5.1 Retrieval-grounded answers | `backend/app/engine/retrieval.py` (BM25) over `backend/app/kb.py` |
| §5.2 Explainability | `match.attribution()`: exact additive attribution vs the cohort mean (equals SHAP for this linear score) |
| §5.3 4-level risk escalation | `backend/app/engine/escalation.py`, `responder.py`, `components/Chat.jsx` |
| §6 Schema, DPDP (hashed mobiles, guardian consent, export/delete) | `backend/app/db.py`, `auth.py`, `routers/account.py` |
| §7 GIS gap index, barrier taxonomy, N ≥ 50 | `backend/app/routers/admin.py` |
| §8.2 Metrics matrix | `GET /api/admin/metrics` |

**SAATH's turn pipeline:**
1. Classify the message offline, in Hindi, Hinglish or English.
2. Retrieve the top passages with BM25.
3. Build the fact pack from the database.
4. Ask Gemini for a structured reply, if a key is set.
5. Run the **number guard**: any figure that is not in the facts or the passages sends the reply back to a template.
6. Assess the risk level.
7. Save the turn.

Crisis and distress always get the reviewed reply, whatever the model says.

## Prototype choices (Phase 1)

- **SQLite instead of PostgreSQL + pgvector.** The tables follow §6.1. The swap is confined to `db.py`.
- **BM25 instead of a vector database** for retrieval. It is free and runs offline.
- **OTP in demo mode.** The code is shown on screen. Mobile numbers are stored only as salted SHA-256 hashes.
- **Stubbed government APIs.** SIDH registration and the NAPS routing are clearly marked demo stubs; the live APIs
  are Phase 2.
- **Voice is free.** The browser's Web Speech API listens, with Gemini as the fallback, and `edge-tts` speaks.
- **Staff portals are in English.** Counsellor, teacher and admin screens are English-only; the teacher toolkit
  sheets are in both languages. The student and parent portals are fully Hindi and English.

## Tests

```powershell
cd backend; .\.venv\Scripts\python -m pytest -q
```

65 tests, all offline. They cover:
- **Language and guard:** the number guard (including the helpline numbers), the classifier (crisis, distress and
  confusion) and every escalation rule.
- **Career DNA and matching:** ΣR = 1, ranking, constraint penalties, and that the attribution terms sum exactly to S.
- **Family tools:** What-If arithmetic, the consensus columns, private notes never reaching the parent, the
  16-section report and its signed-out share link, and guardian consent through the family code.
- **Accounts:** OTP with a hashed mobile, role enforcement, and export and delete.
- **Lab and risk:** a simulation updating competencies and the pathway; L2 consent and the L3 halt in chat;
  retrieval in Hindi and English.
- **Analytics:** the IGI formula, N < 50 suppression, the metrics matrix, the counsellor's consented case view, and
  the teacher view hiding conversations.
