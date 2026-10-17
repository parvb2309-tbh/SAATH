import { useRef, useState } from 'react'
import { Activity, Gauge, Hammer, Play, TriangleAlert, Zap } from 'lucide-react'
import './auto.css'

const L = {
  where: { en: (d) => `Two-wheeler workshop${d ? `, ${d}` : ''} · 125cc fuel-injected motorcycle`, hi: (d) => `टू-व्हीलर वर्कशॉप${d ? `, ${d}` : ''} · 125cc फ्यूल-इंजेक्टेड मोटरसाइकिल` },
  stepSymptom: { en: 'Symptom', hi: 'लक्षण' },
  stepTest: { en: 'Test parts', hi: 'पुर्ज़े जाँचें' },
  stepDiagnose: { en: 'Diagnose & fix', hi: 'खराबी व मरम्मत' },
  complaint: { en: 'Customer complaint', hi: 'ग्राहक की शिकायत' },
  pickPart: { en: '1. Tap a part', hi: '1. पुर्ज़ा चुनें' },
  pickTool: { en: '2. Pick a tool', hi: '2. औज़ार चुनें' },
  runTest: { en: 'Run test', hi: 'जाँच करें' },
  needBoth: { en: 'Select a part and a tool', hi: 'पुर्ज़ा और औज़ार चुनें' },
  electrical: { en: 'Electrical', hi: 'बिजली' },
  fuel: { en: 'Fuel', hi: 'ईंधन' },
  engine: { en: 'Engine', hi: 'इंजन' },
  testsRun: { en: (n) => `Tests run: ${n}`, hi: (n) => `जाँच हुईं: ${n}` },
  cantTest: { en: "This tool can't test that part.", hi: 'यह औज़ार इस पुर्ज़े की जाँच नहीं कर सकता।' },
  hammerWarn: { en: 'Hitting parts can damage them and injure you. Use a test instrument.', hi: 'पुर्ज़ों पर हथौड़ा मारने से नुकसान और चोट हो सकती है। जाँच वाला औज़ार इस्तेमाल करें।' },
  sparkFuelWarn: { en: 'Never make sparks near fuel parts. Fire risk.', hi: 'ईंधन वाले पुर्ज़ों के पास कभी चिंगारी न करें। आग का खतरा।' },
  log: { en: 'Test log', hi: 'जाँच रिकॉर्ड' },
  diagnosis: { en: 'Your diagnosis', hi: 'आपका निदान' },
  faultyPart: { en: 'Faulty part', hi: 'खराब पुर्ज़ा' },
  fix: { en: 'Repair', hi: 'मरम्मत' },
  choose: { en: 'Choose…', hi: 'चुनें…' },
  submit: { en: 'Submit diagnosis', hi: 'निदान जमा करें' },
  right: { en: 'Correct diagnosis.', hi: 'सही निदान।' },
  wrong: { en: (p) => `Not quite. The fault was: ${p}.`, hi: (p) => `सही नहीं। असली खराबी: ${p}।` },
  fixRight: { en: 'Repair choice is correct.', hi: 'मरम्मत का तरीका सही है।' },
  fixWrong: { en: (f) => `Better repair: ${f}.`, hi: (f) => `सही मरम्मत: ${f}।` },
  finish: { en: 'Finish', hi: 'पूरा करें' },
  indEff: { en: 'Diagnostic logic efficiency', hi: 'जाँच की कुशलता' },
  indTool: { en: 'Correct tool selection', hi: 'सही औज़ार का चुनाव' },
  indDiag: { en: 'Diagnosis correct', hi: 'निदान सही' },
  indFix: { en: 'Repair action', hi: 'मरम्मत का तरीका' },
  effVal: { en: (n, b) => `${n} tests (best: ${b})`, hi: (n, b) => `${n} जाँच (सबसे कम: ${b})` },
  yes: { en: 'Yes', hi: 'हाँ' },
  no: { en: 'No', hi: 'नहीं' },
  correct: { en: 'Correct', hi: 'सही' },
  incorrect: { en: 'Incorrect', hi: 'गलत' },
}

const PARTS = {
  battery: { en: 'Battery', hi: 'बैटरी', x: 8, y: 112, w: 96, h: 44 },
  ignition: { en: 'Ignition switch', hi: 'इग्निशन स्विच', x: 8, y: 184, w: 96, h: 44 },
  starter: { en: 'Starter motor', hi: 'स्टार्टर मोटर', x: 268, y: 150, w: 86, h: 44 },
  tank: { en: 'Fuel tank', hi: 'फ्यूल टैंक', x: 8, y: 14, w: 96, h: 44 },
  pump: { en: 'Fuel pump', hi: 'फ्यूल पंप', x: 132, y: 14, w: 96, h: 44 },
  filter: { en: 'Fuel filter', hi: 'फ्यूल फ़िल्टर', x: 256, y: 14, w: 98, h: 44 },
  plug: { en: 'Spark plug', hi: 'स्पार्क प्लग', x: 146, y: 78, w: 76, h: 32 },
}
const PART_IDS = Object.keys(PARTS)
const FUEL_PARTS = ['tank', 'pump', 'filter']

const TOOLS = {
  multimeter: { en: 'Multimeter', hi: 'मल्टीमीटर', Icon: Activity },
  pressure: { en: 'Fuel pressure gauge', hi: 'फ्यूल प्रेशर गेज', Icon: Gauge },
  spark: { en: 'Spark tester', hi: 'स्पार्क टेस्टर', Icon: Zap },
  hammer: { en: 'Hammer', hi: 'हथौड़ा', Icon: Hammer },
}

const FIXES = {
  charge_battery: { en: 'Charge or replace battery', hi: 'बैटरी चार्ज करें या बदलें' },
  replace_starter: { en: 'Replace starter motor', hi: 'स्टार्टर मोटर बदलें' },
  replace_filter: { en: 'Replace fuel filter', hi: 'फ्यूल फ़िल्टर बदलें' },
  replace_plug: { en: 'Clean, re-gap or replace spark plug', hi: 'स्पार्क प्लग साफ़ करें, गैप सेट करें या बदलें' },
  replace_switch: { en: 'Replace ignition switch', hi: 'इग्निशन स्विच बदलें' },
  replace_pump: { en: 'Replace fuel pump', hi: 'फ्यूल पंप बदलें' },
  refill_tank: { en: 'Refill fuel tank', hi: 'टंकी में ईंधन भरें' },
}

const FAULTS = {
  battery: {
    fix: 'charge_battery', minimal: 1,
    symptom: { en: 'Press start: only a click, and the dashboard lights go dim.', hi: 'स्टार्ट दबाने पर सिर्फ़ "क्लिक" की आवाज़ आती है और डैशबोर्ड की लाइट धीमी हो जाती है।' },
  },
  starter: {
    fix: 'replace_starter', minimal: 2,
    symptom: { en: 'Press start: dashboard lights stay bright, but the engine does not turn at all.', hi: 'स्टार्ट दबाने पर डैशबोर्ड की लाइट तेज़ रहती है, पर इंजन बिल्कुल नहीं घूमता।' },
  },
  filter: {
    fix: 'replace_filter', minimal: 2,
    symptom: { en: 'Engine cranks normally but does not start. Yesterday it lost power on the highway.', hi: 'इंजन ठीक से घूमता है पर स्टार्ट नहीं होता। कल हाईवे पर पिकअप कम हो गया था।' },
  },
  plug: {
    fix: 'replace_plug', minimal: 2,
    symptom: { en: 'Engine cranks normally but does not start. Smell of petrol near the exhaust.', hi: 'इंजन ठीक से घूमता है पर स्टार्ट नहीं होता। साइलेंसर के पास पेट्रोल की गंध।' },
  },
}

const r = (en, hi) => ({ en, hi })

function reading(fault, tool, part) {
  const cranks = fault === 'filter' || fault === 'plug'
  if (tool === 'multimeter') {
    if (part === 'battery') {
      const v = fault === 'battery' ? '10.8' : fault === 'starter' ? '12.6' : '12.5'
      return r(`${v} V across terminals (healthy: 12.4–12.7 V)`, `टर्मिनल पर ${v} V (सही: 12.4–12.7 V)`)
    }
    if (part === 'starter') {
      if (fault === 'battery') return r('Pressing start: 8.1 V at starter terminal, voltage collapses, relay clicks', 'स्टार्ट दबाने पर स्टार्टर पर 8.1 V, वोल्टेज गिर जाता है, रिले क्लिक करता है')
      if (fault === 'starter') return r('Pressing start: 12.3 V reaches the starter, current draw 0 A, motor does not turn', 'स्टार्ट दबाने पर स्टार्टर तक 12.3 V पहुँचता है, करंट 0 A, मोटर नहीं घूमती')
      return r('Pressing start: 10.9 V at starter, draws 70 A, engine turns over normally', 'स्टार्ट दबाने पर स्टार्टर पर 10.9 V, 70 A करंट, इंजन ठीक से घूमता है')
    }
    if (part === 'ignition') return r('Key ON: continuity OK, 0.2 Ω across the switch', 'चाबी ON: कंटिन्युटी ठीक, स्विच पर 0.2 Ω')
    if (part === 'pump') {
      return fault === 'battery'
        ? r('Key ON: 10.5 V at pump connector, pump hums weakly', 'चाबी ON: पंप कनेक्टर पर 10.5 V, पंप धीमी आवाज़ करता है')
        : r('Key ON: 12.2 V at pump connector, pump hums for 2 s', 'चाबी ON: पंप कनेक्टर पर 12.2 V, पंप 2 सेकंड चलता है')
    }
    if (part === 'tank') return r('Fuel level sender: tank 3/4 full', 'फ्यूल लेवल सेंडर: टंकी 3/4 भरी')
  }
  if (tool === 'pressure') {
    if (part === 'pump') {
      const k = fault === 'filter' ? 360 : fault === 'battery' ? 270 : 300
      return r(`Pump outlet, before filter: ${k} kPa (normal: 250–350 kPa)`, `पंप आउटलेट, फ़िल्टर से पहले: ${k} kPa (सामान्य: 250–350 kPa)`)
    }
    if (part === 'filter') {
      const k = fault === 'filter' ? 90 : fault === 'battery' ? 265 : 295
      return r(`After filter, at injector: ${k} kPa (normal: 250–350 kPa)`, `फ़िल्टर के बाद, इंजेक्टर पर: ${k} kPa (सामान्य: 250–350 kPa)`)
    }
  }
  if (tool === 'spark' && part === 'plug') {
    if (!cranks) return r('No spark: the engine does not turn, so the coil cannot fire. Fix cranking first.', 'चिंगारी नहीं: इंजन घूम ही नहीं रहा, इसलिए कॉइल फ़ायर नहीं करती। पहले क्रैंकिंग ठीक करें।')
    if (fault === 'plug') return r('No spark at the gap. Plug tip is black, wet and carbon-fouled.', 'गैप पर चिंगारी नहीं। प्लग की नोक काली, गीली और कार्बन से भरी है।')
    return r('Strong blue spark at the plug gap.', 'प्लग गैप पर तेज़ नीली चिंगारी।')
  }
  return null
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function Steps({ items, current }) {
  return (
    <ol className="sim-auto-steps">
      {items.map((s, i) => (
        <li key={s} className={i === current ? 'on' : i < current ? 'done' : ''}>
          <span className="sim-auto-stepnum">{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  )
}

function Schematic({ lang, selected, tested, onSelect, engineLabel }) {
  const keyDown = (id) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }
  return (
    <svg viewBox="0 0 362 246" className="sim-auto-svg" role="group" aria-label="Engine schematic">
      <path d="M104 36 H132 M228 36 H256 M305 58 V94 H240 V110" className="sim-auto-fuel" />
      <path d="M56 156 V184 M104 206 H120 V236 H311 V194 M104 124 H122 V94 H146" className="sim-auto-wire" />
      <path d="M268 172 H256" className="sim-auto-mesh" />

      <rect x={136} y={110} width={120} height={96} className="sim-auto-engine" />
      <rect x={168} y={118} width={56} height={58} className="sim-auto-cyl" />
      <rect x={174} y={148} width={44} height={14} className="sim-auto-piston" />
      <line x1={196} y1={162} x2={196} y2={186} className="sim-auto-rod" />
      <circle cx={196} cy={190} r={8} className="sim-auto-crank" />
      <text x={142} y={200} className="sim-auto-enginelabel">{engineLabel}</text>

      {PART_IDS.map((id) => {
        const p = PARTS[id]
        const sel = selected === id
        return (
          <g
            key={id}
            className={`sim-auto-part${sel ? ' sel' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={sel}
            aria-label={p[lang]}
            onClick={() => onSelect(id)}
            onKeyDown={keyDown(id)}
          >
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={2} />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2} className="sim-auto-label">{p[lang]}</text>
            {tested.has(id) && <circle cx={p.x + p.w - 7} cy={p.y + 7} r={3.5} className="sim-auto-dot" />}
          </g>
        )
      })}
    </svg>
  )
}

export default function AutoSim({ lang, context, onComplete }) {
  const tx = (k, ...a) => {
    const v = L[k][lang]
    return typeof v === 'function' ? v(...a) : v
  }
  const district = context?.districtName || ''

  const [fault] = useState(() => {
    const ids = Object.keys(FAULTS)
    return ids[Math.floor(Math.random() * ids.length)]
  })
  const [part, setPart] = useState(null)
  const [tool, setTool] = useState(null)
  const [tests, setTests] = useState([])
  const [last, setLast] = useState(null)
  const [diagPart, setDiagPart] = useState('')
  const [diagFix, setDiagFix] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const t0 = useRef(performance.now())
  const steps = useRef([])
  const counts = useRef({ part_selects: 0, tool_selects: 0 })
  const done = useRef(false)

  const now = () => Math.round(performance.now() - t0.current)
  const logStep = (event, extra = {}) => steps.current.push({ t_ms: now(), event, ...extra })

  const selectPart = (id) => {
    setPart(id)
    counts.current.part_selects += 1
    logStep('select_part', { part: id })
  }
  const selectTool = (id) => {
    setTool(id)
    counts.current.tool_selects += 1
    logStep('select_tool', { tool: id })
  }

  const runTest = () => {
    if (!part || !tool) return
    const res = reading(fault, tool, part)
    const unsafe = tool === 'hammer' || (tool === 'spark' && FUEL_PARTS.includes(part))
    const entry = { n: tests.length + 1, t_ms: now(), tool, part, valid: !!res, unsafe, reading: res ? res.en : null }
    setTests((ts) => [...ts, entry])
    setLast({ ...entry, res })
    logStep('run_test', { tool, part, valid: !!res, unsafe })
  }

  const validTests = tests.filter((t) => t.valid)
  const wrongUses = tests.length - validTests.length
  const tested = new Set(validTests.map((t) => t.part))
  const minimal = FAULTS[fault].minimal
  const diagCorrect = diagPart === fault
  const fixCorrect = diagFix === FAULTS[fault].fix

  const submit = () => {
    setSubmitted(true)
    logStep('submit_diagnosis', { part: diagPart, fix: diagFix, correct: diagCorrect, fix_correct: fixCorrect })
  }

  const finish = () => {
    if (done.current) return
    done.current = true
    const nValid = validTests.length
    const efficiency = nValid === 0 ? 0 : clamp(1 - (nValid - minimal) / 6, 0, 1)
    const toolRate = tests.length === 0 ? 0 : nValid / tests.length
    const accuracy = ((diagCorrect ? 1 : 0) + efficiency + toolRate) / 3
    const safety = Math.max(0, 1 - 0.2 * wrongUses)
    const firstTest = tests[0]

    onComplete?.({
      accuracy: Math.round(accuracy * 1000) / 1000,
      safety_score: Math.round(safety * 1000) / 1000,
      telemetry: {
        sim: 'auto_no_start',
        district: district || null,
        fault,
        symptom: FAULTS[fault].symptom.en,
        tests: tests.map(({ n, t_ms, tool: tl, part: pt, valid, unsafe, reading: rd }) => ({ n, t_ms, tool: tl, part: pt, valid, unsafe, reading: rd })),
        tests_run: nValid,
        test_attempts: tests.length,
        wrong_tool_uses: wrongUses,
        hammer_uses: tests.filter((t) => t.tool === 'hammer').length,
        unsafe_uses: tests.filter((t) => t.unsafe).length,
        parts_tested: [...tested],
        minimal_tests: minimal,
        efficiency: Math.round(efficiency * 1000) / 1000,
        tool_selection_rate: Math.round(toolRate * 1000) / 1000,
        diagnosis_part: diagPart || null,
        diagnosis_fix: diagFix || null,
        diagnosis_correct: diagCorrect,
        fix_correct: fixCorrect,
        part_selects: counts.current.part_selects,
        tool_selects: counts.current.tool_selects,
        time_to_first_test_ms: firstTest ? firstTest.t_ms : null,
        total_ms: now(),
        steps: steps.current,
      },
      indicators: [
        { en: L.indEff.en, hi: L.indEff.hi, value: tx('effVal', nValid, minimal), good: nValid > 0 && efficiency >= 0.67 },
        { en: L.indTool.en, hi: L.indTool.hi, value: `${Math.round(toolRate * 100)}%`, good: toolRate >= 0.8 },
        { en: L.indDiag.en, hi: L.indDiag.hi, value: diagCorrect ? tx('yes') : `${tx('no')} (${PARTS[fault][lang]})`, good: diagCorrect },
        { en: L.indFix.en, hi: L.indFix.hi, value: fixCorrect ? tx('correct') : tx('incorrect'), good: fixCorrect },
      ],
    })
  }

  const stepIdx = submitted || diagPart ? 2 : tests.length > 0 ? 1 : 0
  const lastWarn = last && !last.res
    ? last.tool === 'hammer' ? tx('hammerWarn') : last.unsafe ? tx('sparkFuelWarn') : null
    : null

  return (
    <div className="sim-auto">
      <p className="small muted sim-auto-where">{tx('where', district)}</p>
      <Steps items={[tx('stepSymptom'), tx('stepTest'), tx('stepDiagnose')]} current={stepIdx} />

      <div className="note warn">
        <TriangleAlert size={18} aria-hidden="true" />
        <div>
          <div className="small strong">{tx('complaint')}</div>
          {FAULTS[fault].symptom[lang]}
        </div>
      </div>

      <div className="panel tight stack">
        <div className="stack-1">
          <div className="row between">
            <span className="section-title">{tx('pickPart')}</span>
            <span className="sim-auto-legend small muted">
              <span className="sim-auto-key wire" aria-hidden="true" /> {tx('electrical')}
              <span className="sim-auto-key fuel" aria-hidden="true" /> {tx('fuel')}
            </span>
          </div>
          <Schematic lang={lang} selected={part} tested={tested} onSelect={selectPart} engineLabel={tx('engine')} />
        </div>

        <div className="stack-1">
          <span className="section-title">{tx('pickTool')}</span>
          <div className="sim-auto-tools" role="group" aria-label={tx('pickTool')}>
            {Object.entries(TOOLS).map(([id, tl]) => (
              <button
                key={id}
                type="button"
                className={`sim-auto-tool${tool === id ? ' on' : ''}`}
                aria-pressed={tool === id}
                onClick={() => selectTool(id)}
              >
                <tl.Icon size={20} aria-hidden="true" />
                <span>{tl[lang]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row between wrap">
          <span className="small muted">
            {part && tool ? `${TOOLS[tool][lang]} → ${PARTS[part][lang]}` : tx('needBoth')}
          </span>
          <button type="button" className="btn primary" disabled={!part || !tool || submitted} onClick={runTest}>
            <Play size={16} aria-hidden="true" /> {tx('runTest')}
          </button>
        </div>

        {last && (
          last.res ? (
            <div className="sim-auto-readout" role="status">
              <div className="small muted">#{last.n} · {TOOLS[last.tool][lang]} → {PARTS[last.part][lang]}</div>
              <div className="sim-auto-value">{last.res[lang]}</div>
            </div>
          ) : (
            <div className={last.unsafe ? 'alert' : 'note warn'} role="status">
              <div>
                <div className="strong">{tx('cantTest')}</div>
                {lastWarn && <div className="small">{lastWarn}</div>}
              </div>
            </div>
          )
        )}

        {tests.length > 0 && (
          <div className="stack-1">
            <div className="row between">
              <span className="section-title">{tx('log')}</span>
              <span className="small muted mono">{tx('testsRun', validTests.length)}</span>
            </div>
            <ol className="sim-auto-log">
              {tests.map((t) => (
                <li key={t.n} className={t.valid ? '' : 'bad'}>
                  <span className="mono">#{t.n}</span>
                  <span>
                    <span className="strong">{TOOLS[t.tool][lang]} → {PARTS[t.part][lang]}</span>
                    <span className="sim-auto-logval">{t.valid ? reading(fault, t.tool, t.part)[lang] : tx('cantTest')}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="panel tight stack">
        <span className="section-title">{tx('diagnosis')}</span>
        <div className="sim-auto-diag">
          <label className="field">
            <span>{tx('faultyPart')}</span>
            <select className="select" value={diagPart} disabled={submitted} onChange={(e) => setDiagPart(e.target.value)}>
              <option value="">{tx('choose')}</option>
              {PART_IDS.map((id) => <option key={id} value={id}>{PARTS[id][lang]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{tx('fix')}</span>
            <select className="select" value={diagFix} disabled={submitted} onChange={(e) => setDiagFix(e.target.value)}>
              <option value="">{tx('choose')}</option>
              {Object.entries(FIXES).map(([id, f]) => <option key={id} value={id}>{f[lang]}</option>)}
            </select>
          </label>
        </div>

        {!submitted ? (
          <div className="row end">
            <button type="button" className="btn primary" disabled={!diagPart || !diagFix} onClick={submit}>
              {tx('submit')}
            </button>
          </div>
        ) : (
          <>
            <div className={diagCorrect && fixCorrect ? 'note ok' : diagCorrect ? 'note warn' : 'alert'} role="status">
              <div>
                <div className="strong">{diagCorrect ? tx('right') : tx('wrong', PARTS[fault][lang])}</div>
                <div className="small">{fixCorrect ? tx('fixRight') : tx('fixWrong', FIXES[FAULTS[fault].fix][lang])}</div>
              </div>
            </div>
            <div className="row end">
              <button type="button" className="btn primary big" onClick={finish}>{tx('finish')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
