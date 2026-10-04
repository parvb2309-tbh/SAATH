# SAATH (साथ): family-first AI counselling for vocational careers

Working prototype for **SIH 2026 PS 26241**. SAATH talks to a learner **and their parents together**, in Hindi or
English, by voice or text. It answers family worries about a trade with figures from a verified outcome database,
explains the career path as a picture ladder (*Seedhi*), hands hard cases to a human counsellor, and shows scheme
administrators **where and why families resist** vocational training.

> **All outcome figures, stories and sessions in this prototype are demo data**, labelled as such in the UI.
> Real figures are loaded through **Admin → Outcome data → Import CSV**.

## Run it

Needs Python 3.11+ and Node 20+.

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

This installs everything on first run, starts the API on <http://localhost:8000> and the app on
<http://localhost:5173>, and opens the browser. To run the pieces by hand:

```powershell
cd backend;  py -3 -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
cd frontend; npm install; npm run dev
```

### Gemini (optional, free)
Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY` (free key from
<https://aistudio.google.com/apikey>). Restart the backend. The header badge changes from **Offline engine** to
**Gemini**.

Without a key, or when the free-tier rate limit is hit, SAATH switches to its offline rule-based engine, so a demo
never breaks. Every reply shows which engine wrote it.

## What to try (5-minute demo)

1. **Family**: the opening flow is an interactive quiz:
   - a story hook;
   - *How SAATH works*, which is also the consent screen;
   - the family profile: who is here, son or daughter, an age slider, district, schooling and income range;
   - a *Your journey begins* screen;
   - 9 one-per-screen questions, each marked for the learner, the parents or the whole family (keys 1–4 work;
     🔊 reads them aloud).

   A side panel shows matching courses and detected worries as you answer. The result screen picks the course, and
   the chat opens by answering the family's biggest worry. Try *Mother + Father + Learner*, *Daughter*, *Gaya*, and
   answer the caring and safety options.
2. Tap the worry buttons: earnings, *Is it safe for girls?*, *What will people say?* Each answer has fact cards
   with source, year and status (verified / centre-reported / estimate), plus stories from families in the same area.
3. Speak with the 🎤 button (Chrome/Edge). Replies are read aloud in a Hindi neural voice.
4. Repeat the safety worry with some upset words (`raat ki duty se dar lagta hai, bharosa nahi`). SAATH escalates and
   asks for a callback number.
5. **Counsellor**: the family appears in the call queue with an auto-written handover note and the tagged transcript.
6. **Admin**: the resistance map, districts ranked by resistance, the *why* heatmap, and the conversation-to-classroom
   funnel. Under *Families & updates*, send a parent update. The family sees it (and can listen to it) in their
   screen.
7. Switch **हिंदी / English** at any time. Try a district with no local record (e.g. *Rewa + Beauty*): SAATH says it
   is using a state-level figure.

## How it works

```
Family (web, voice/text)
  └─ POST /api/sessions/{id}/messages
       1. offline classifier + sentiment       (Hindi, Hinglish, English keywords)
       2. fact pack from the DB                 trade × district outcome, stories, schemes, ladder
       3. Gemini structured reply (if key)      concerns, sentiment, reply, needs_human
       4. number guard                          any figure not in the fact pack → template reply instead
       5. escalation rules                      distress · asked for a person · same worry 3× ·
                                                upset twice · repeated safety worry · no local data
       6. persist turn → feeds the counsellor queue and the admin dashboard
```

| Part | Where |
|---|---|
| Concern taxonomy | `backend/app/engine/concerns.py` |
| Classifier / sentiment | `backend/app/engine/classifier.py`, `sentiment.py` |
| Number guard | `backend/app/engine/guard.py` |
| Hindi/English templates, fact pack, cards | `backend/app/engine/templates.py` |
| Escalation rules | `backend/app/engine/escalation.py` |
| Turn orchestration | `backend/app/engine/responder.py` |
| Gemini client (JSON schema output, rate-limit back-off) | `backend/app/llm/gemini.py` |
| Voice: edge-tts (speaking), Gemini (server-side listening fallback) | `backend/app/speech/` |
| Demo data | `backend/app/seed.py` (reset: `python -m app.seed`) |
| Family / Counsellor / Admin screens | `frontend/src/pages/` |

**Voice is free.** Listening uses the browser's Web Speech API (`hi-IN`, `en-IN`). If the browser has none, the audio
is sent to `/api/speech/stt` and transcribed by Gemini. Speaking uses `edge-tts` neural voices (no key); if that
fails, the browser's built-in voice is used. Bhashini or AI4Bharat models can be added behind
`backend/app/speech/base.py`.

**Safety rules built into the code:**
- Distress always gets the reviewed reply with the Tele-MANAS helpline (14416) and an urgent escalation, whatever
  the model says.
- The model can never introduce a number that isn't in the database.
- Income is stored only as a bracket, and nothing is kept before consent.

## Tests

```powershell
cd backend; .\.venv\Scripts\python -m pytest -q
```

43 tests cover:
- the number guard: invented amounts, percentages, Hindi "हज़ार" ranges, Devanagari digits;
- the classifier and sentiment on Hindi, Hinglish and English;
- every escalation rule;
- the offline chat API end-to-end;
- the Gemini path with a mocked model: an honest reply is used, an invented figure is blocked, and distress is
  handled even when the model misses it;
- the opening quiz: scoring, the course chosen from it, the chat opening on the top worry, and quiz answers not
  triggering escalation on their own;
- the CSV importer.

## Not in this prototype (next steps)
- Real WhatsApp (Cloud API) and IVR missed-call channels. The web app stands in for them.
- Real outcome data from Skill India Digital Hub / tracer studies (the importer is ready).
- Login and roles for counsellors and admins, and PostgreSQL instead of SQLite.
- More languages through Bhashini.
