import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lock, Power, TriangleAlert } from 'lucide-react'
import './solar.css'

const L = {
  step: { en: 'Step', hi: 'चरण' },
  s1Title: { en: 'Set the panel tilt', hi: 'पैनल का झुकाव सेट करें' },
  s1Hint: {
    en: 'Move the slider so the panel faces the noon sun in {d}. Watch the output.',
    hi: '{d} में दोपहर के सूरज की ओर पैनल करने के लिए स्लाइडर खिसकाएँ। आउटपुट देखें।',
  },
  tilt: { en: 'Tilt', hi: 'झुकाव' },
  output: { en: 'Output', hi: 'आउटपुट' },
  south: { en: 'South', hi: 'दक्षिण' },
  lockAngle: { en: 'Lock angle', hi: 'कोण लॉक करें' },
  s2Title: { en: 'Find the faulty string', hi: 'खराब स्ट्रिंग ढूँढें' },
  do1: { en: 'Turn the DC isolator OFF', hi: 'DC आइसोलेटर OFF करें' },
  do2: { en: 'Drag the red probe onto each test point', hi: 'लाल प्रोब को हर टेस्ट पॉइंट पर खींचकर रखें' },
  do3: { en: 'Tap the faulty string to mark it', hi: 'खराब स्ट्रिंग पर टैप करके चिह्नित करें' },
  isolator: { en: 'DC isolator', hi: 'DC आइसोलेटर' },
  isoOn: { en: 'ON (live)', hi: 'ON (करंट चालू)' },
  isoOff: { en: 'OFF (isolated)', hi: 'OFF (अलग किया)' },
  turnOff: { en: 'Turn isolator OFF', hi: 'आइसोलेटर OFF करें' },
  turnOn: { en: 'Turn isolator ON', hi: 'आइसोलेटर ON करें' },
  inverter: { en: 'Inverter', hi: 'इन्वर्टर' },
  meter: { en: 'Multimeter', hi: 'मल्टीमीटर' },
  probe: { en: 'Probe', hi: 'प्रोब' },
  testPoint: { en: 'Test point, string {n}', hi: 'टेस्ट पॉइंट, स्ट्रिंग {n}' },
  stringN: { en: 'String {n}', hi: 'स्ट्रिंग {n}' },
  liveWarn: {
    en: 'Unsafe: you probed while the DC isolator was ON. Isolate before testing.',
    hi: 'असुरक्षित: DC आइसोलेटर ON रहते हुए आपने जाँच की। जाँच से पहले आइसोलेट करें।',
  },
  marked: { en: 'Marked: String {n}', hi: 'चिह्नित: स्ट्रिंग {n}' },
  next: { en: 'Next', hi: 'आगे' },
  s3Title: { en: 'Choose the repair', hi: 'मरम्मत चुनें' },
  s3Hint: { en: 'You marked String {n}. What will you do?', hi: 'आपने स्ट्रिंग {n} चुनी है। अब क्या करेंगे?' },
  fixConnector: { en: 'Replace the MC4 connector', hi: 'MC4 कनेक्टर बदलें' },
  fixPanel: { en: 'Replace the panel', hi: 'पैनल बदलें' },
  fixScrew: { en: 'Tighten the inverter screw', hi: 'इन्वर्टर का पेंच कसें' },
  finish: { en: 'Finish', hi: 'पूरा करें' },
  indTilt: { en: 'Tilt angle', hi: 'झुकाव कोण' },
  indIso: { en: 'Safety isolation', hi: 'सुरक्षा आइसोलेशन' },
  indFault: { en: 'Fault found', hi: 'खराबी मिली' },
  indFix: { en: 'Repair chosen', hi: 'चुनी गई मरम्मत' },
  valTilt: { en: 'Tilt {t}° vs best {o}°', hi: 'झुकाव {t}°, सबसे अच्छा {o}°' },
  valIsoBefore: { en: '{s} s, before probing', hi: '{s} सेकंड, जाँच से पहले' },
  valIsoAfter: { en: '{s} s, after probing', hi: '{s} सेकंड, जाँच के बाद' },
  valIsoNever: { en: 'Not isolated', hi: 'आइसोलेट नहीं किया' },
  yesString: { en: 'Yes, String {n}', hi: 'हाँ, स्ट्रिंग {n}' },
  no: { en: 'No', hi: 'नहीं' },
  none: { en: 'None', hi: 'कोई नहीं' },
}

const FIXES = [
  { id: 'connector', key: 'fixConnector' },
  { id: 'panel', key: 'fixPanel' },
  { id: 'screw', key: 'fixScrew' },
]

const STEPS = ['s1Title', 's2Title', 's3Title']
const ROW_Y = [12, 60, 108, 156]
const ROW_H = 34
const TP_X = 182
const PROBE_HOME = { x: 176, y: 262 }
const VB = { w: 360, h: 300 }

const rad = (d) => (d * Math.PI) / 180
const now = () => performance.now()
const fill = (s, vars) => s.replace(/\{(\w)\}/g, (_, k) => vars[k])

export default function SolarSim({ lang, context, onComplete }) {
  const tx = (k, vars) => (vars ? fill(L[k][lang], vars) : L[k][lang])
  const district = context?.districtName || ''
  const optimum = Math.round(context?.districtLat ?? 25)

  const [step, setStep] = useState(0)

  const [tilt, setTilt] = useState(0)
  const [tiltMoves, setTiltMoves] = useState(0)
  const [lockedTilt, setLockedTilt] = useState(null)

  const [strings] = useState(() => {
    const faulty = Math.floor(Math.random() * 4)
    return { faulty, volts: [0, 1, 2, 3].map((i) => (i === faulty ? 0 : +(36 + Math.random() * 2).toFixed(1))) }
  })
  const [isoOpen, setIsoOpen] = useState(false)
  const [probePos, setProbePos] = useState(PROBE_HOME)
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(null)
  const [probeOn, setProbeOn] = useState(null)
  const [readings, setReadings] = useState({})
  const [violations, setViolations] = useState(0)
  const [marked, setMarked] = useState(null)
  const [fix, setFix] = useState(null)
  const [done, setDone] = useState(false)

  const svgRef = useRef(null)
  const t0 = useRef(0)
  const stepStart = useRef(0)
  const stepTimes = useRef({})
  const log = useRef([])
  const probes = useRef([])
  const isoTime = useRef(null)
  const firstProbeIsolated = useRef(null)
  const isoToggles = useRef(0)

  useEffect(() => {
    t0.current = now()
    stepStart.current = t0.current
  }, [])

  const elapsed = () => Math.round(now() - t0.current)
  const record = (event, data = {}) => log.current.push({ t: elapsed(), event, ...data })

  const output = Math.cos(rad(Math.abs(tilt - optimum))) * 100

  const goStep = (next, name) => {
    const t = now()
    stepTimes.current[name] = Math.round(t - stepStart.current)
    stepStart.current = t
    setStep(next)
  }

  const lockAngle = () => {
    setLockedTilt(tilt)
    record('tilt_locked', { tilt, optimum })
    goStep(1, 'tilt')
  }

  const toggleIsolator = () => {
    const next = !isoOpen
    isoToggles.current += 1
    if (next && isoTime.current === null) isoTime.current = Math.round(now() - stepStart.current)
    record(next ? 'isolator_off' : 'isolator_on')
    setIsoOpen(next)
  }

  const probeString = (i) => {
    const volts = strings.volts[i]
    const live = !isoOpen
    if (firstProbeIsolated.current === null) firstProbeIsolated.current = !live
    if (live) setViolations((v) => v + 1)
    probes.current.push({ string: i + 1, volts, isolated: !live, t: Math.round(now() - stepStart.current) })
    record('probe', { string: i + 1, volts, isolated: !live })
    setReadings((r) => ({ ...r, [i]: volts }))
    setProbeOn(i)
    setProbePos({ x: TP_X, y: ROW_Y[i] + ROW_H / 2 })
  }

  const toSvg = (e) => {
    const svg = svgRef.current
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse())
    return { x: Math.min(VB.w - 8, Math.max(8, p.x)), y: Math.min(VB.h - 8, Math.max(8, p.y)) }
  }

  const nearestPoint = (p) => {
    let best = null
    ROW_Y.forEach((y, i) => {
      if (Math.hypot(p.x - TP_X, p.y - (y + ROW_H / 2)) < 22) best = i
    })
    return best
  }

  const onProbeDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setProbeOn(null)
  }
  const onProbeMove = (e) => {
    if (!dragging) return
    const p = toSvg(e)
    setProbePos(p)
    setHover(nearestPoint(p))
  }
  const onProbeUp = () => {
    if (!dragging) return
    setDragging(false)
    if (hover !== null) probeString(hover)
    else setProbePos(PROBE_HOME)
    setHover(null)
  }

  const markString = (i) => {
    setMarked(i)
    record('mark', { string: i + 1 })
  }

  const finish = () => {
    if (done) return
    setDone(true)
    stepTimes.current.fix = Math.round(now() - stepStart.current)
    record('finish', { fix })

    const angleAcc = Math.max(0, 1 - Math.abs(lockedTilt - optimum) / 20)
    const faultOk = marked === strings.faulty
    const fixOk = fix === 'connector'
    const isolatedFirst = firstProbeIsolated.current ?? (isoTime.current !== null)
    const extra = isolatedFirst ? violations : Math.max(0, violations - 1)
    const safety = Math.max(0, (isolatedFirst ? 1 : 0.3) - 0.1 * extra)
    const secs = isoTime.current === null ? null : (isoTime.current / 1000).toFixed(1)

    onComplete?.({
      accuracy: +((angleAcc + (faultOk ? 1 : 0) + (fixOk ? 1 : 0)) / 3).toFixed(3),
      safety_score: +safety.toFixed(2),
      telemetry: {
        district,
        optimum_tilt: optimum,
        tilt_chosen: lockedTilt,
        tilt_output_pct: +(Math.cos(rad(Math.abs(lockedTilt - optimum))) * 100).toFixed(1),
        tilt_adjustments: tiltMoves,
        angle_accuracy: +angleAcc.toFixed(3),
        isolation_time_ms: isoTime.current,
        isolated_before_first_probe: isolatedFirst,
        isolator_toggles: isoToggles.current,
        safety_violations: violations,
        probes: probes.current,
        probe_count: probes.current.length,
        faulty_string: strings.faulty + 1,
        marked_string: marked === null ? null : marked + 1,
        fault_correct: faultOk,
        fix_choice: fix,
        fix_correct: fixOk,
        step_times_ms: stepTimes.current,
        total_ms: elapsed(),
        log: log.current,
      },
      indicators: [
        {
          en: L.indTilt.en, hi: L.indTilt.hi,
          value: tx('valTilt', { t: lockedTilt, o: optimum }),
          good: angleAcc >= 0.75,
        },
        {
          en: L.indIso.en, hi: L.indIso.hi,
          value: secs === null ? tx('valIsoNever') : tx(isolatedFirst ? 'valIsoBefore' : 'valIsoAfter', { s: secs }),
          good: isolatedFirst && violations === 0,
        },
        {
          en: L.indFault.en, hi: L.indFault.hi,
          value: faultOk ? tx('yesString', { n: strings.faulty + 1 }) : tx('no'),
          good: faultOk,
        },
        {
          en: L.indFix.en, hi: L.indFix.hi,
          value: fix ? tx(FIXES.find((f) => f.id === fix).key) : tx('none'),
          good: fixOk,
        },
      ],
    })
  }

  return (
    <div className="sim-solar stack">
      <div className="stack-1">
        <div className="row between">
          <span className="small strong">{tx('step')} {step + 1} / 3 · {tx(STEPS[step])}</span>
        </div>
        <div className="sim-solar-steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={i < step ? 'done' : i === step ? 'current' : ''} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <TiltStep
          tx={tx}
          district={district}
          tilt={tilt}
          optimum={optimum}
          output={output}
          onTilt={(v) => {
            setTilt(v)
            setTiltMoves((m) => m + 1)
          }}
          onLock={lockAngle}
        />
      )}

      {step === 1 && (
        <div className="stack">
          <ol className="sim-solar-todo">
            <Todo done={isoOpen} text={tx('do1')} />
            <Todo done={Object.keys(readings).length === 4} text={tx('do2')} />
            <Todo done={marked !== null} text={tx('do3')} />
          </ol>

          <svg
            ref={svgRef}
            className="sim-solar-svg"
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            role="group"
            aria-label={tx('s2Title')}
          >
            <line className="sim-solar-wire" x1="206" y1={ROW_Y[0] + 17} x2="206" y2={ROW_Y[3] + 17} />
            <line className="sim-solar-wire" x1="206" y1="101" x2="226" y2="101" />
            <line className={`sim-solar-wire${isoOpen ? ' dead' : ' live'}`} x1="266" y1="101" x2="290" y2="101" />

            {ROW_Y.map((y, i) => {
              const cy = y + ROW_H / 2
              return (
                <g key={i}>
                  <g
                    className={`sim-solar-string${marked === i ? ' marked' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={tx('stringN', { n: i + 1 })}
                    aria-pressed={marked === i}
                    onClick={() => markString(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        markString(i)
                      }
                    }}
                  >
                    <rect className="sim-solar-hit" x="4" y={y - 4} width="154" height={ROW_H + 8} />
                    <text className="sim-solar-label" x="12" y={cy + 4}>S{i + 1}</text>
                    {[30, 72, 114].map((x) => (
                      <g key={x}>
                        <rect className="sim-solar-panel" x={x} y={y} width="38" height={ROW_H} />
                        <line className="sim-solar-cell" x1={x + 19} y1={y} x2={x + 19} y2={y + ROW_H} />
                        <line className="sim-solar-cell" x1={x} y1={cy} x2={x + 38} y2={cy} />
                      </g>
                    ))}
                  </g>
                  <line className="sim-solar-wire" x1="152" y1={cy} x2="206" y2={cy} />
                  <rect className="sim-solar-connector" x="156" y={cy - 5} width="12" height="10" />
                  <circle
                    className={`sim-solar-tp${hover === i ? ' hot' : ''}`}
                    cx={TP_X}
                    cy={cy}
                    r="6"
                    tabIndex={0}
                    role="button"
                    aria-label={tx('testPoint', { n: i + 1 })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        probeString(i)
                      }
                    }}
                  />
                  {readings[i] !== undefined && (
                    <text className="sim-solar-read" x={TP_X} y={cy - 10}>{readings[i].toFixed(1)} V</text>
                  )}
                </g>
              )
            })}

            <g
              className="sim-solar-iso"
              role="button"
              tabIndex={0}
              aria-label={`${tx('isolator')}: ${tx(isoOpen ? 'isoOff' : 'isoOn')}`}
              onClick={toggleIsolator}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleIsolator()
                }
              }}
            >
              <rect className={`sim-solar-box${isoOpen ? ' off' : ' on'}`} x="226" y="73" width="40" height="56" />
              <circle className="sim-solar-knob" cx="246" cy="101" r="13" />
              <rect
                className="sim-solar-handle"
                x="243"
                y="88"
                width="6"
                height="26"
                style={{ transform: `rotate(${isoOpen ? 90 : 0}deg)`, transformOrigin: '246px 101px' }}
              />
              <text className="sim-solar-tiny" x="246" y="68" textAnchor="middle">DC</text>
              <text className={`sim-solar-tiny strong${isoOpen ? ' ok' : ' err'}`} x="246" y="142" textAnchor="middle">
                {isoOpen ? 'OFF' : 'ON'}
              </text>
            </g>

            <rect className="sim-solar-box" x="290" y="77" width="62" height="48" />
            <path className="sim-solar-sine" d="M300 101 q6 -10 12 0 t12 0 t12 0" />
            <text className="sim-solar-tiny" x="321" y="140" textAnchor="middle">{tx('inverter')}</text>

            <rect className="sim-solar-meter" x="8" y="226" width="124" height="66" />
            <rect className="sim-solar-display" x="16" y="234" width="108" height="30" />
            <text className="sim-solar-volts" x="116" y="256" textAnchor="end">
              {probeOn === null ? '--.- V' : `${strings.volts[probeOn].toFixed(1)} V`}
            </text>
            <text className="sim-solar-tiny inv" x="16" y="282">{tx('meter')} · DC V</text>

            <path
              className="sim-solar-lead"
              d={`M132 262 C 150 262, ${probePos.x - 20} ${probePos.y + 30}, ${probePos.x} ${probePos.y}`}
            />
            <g
              className={`sim-solar-probe${dragging ? ' dragging' : ''}`}
              transform={`translate(${probePos.x} ${probePos.y})`}
              onPointerDown={onProbeDown}
              onPointerMove={onProbeMove}
              onPointerUp={onProbeUp}
              onPointerCancel={onProbeUp}
              aria-label={tx('probe')}
            >
              <circle className="sim-solar-hit" r="22" />
              <rect className="sim-solar-probe-body" x="-5" y="4" width="10" height="26" />
              <path className="sim-solar-probe-tip" d="M-3 4 L0 -4 L3 4 Z" />
            </g>
          </svg>

          <div className="row wrap">
            <button type="button" className={`btn small${isoOpen ? '' : ' primary'}`} onClick={toggleIsolator}>
              <Power size={16} aria-hidden="true" />
              {tx(isoOpen ? 'turnOn' : 'turnOff')}
            </button>
            <span className={`tag${isoOpen ? ' ok' : ' err'}`}>{tx('isolator')}: {tx(isoOpen ? 'isoOff' : 'isoOn')}</span>
          </div>

          {violations > 0 && (
            <div className="alert" role="alert">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>{tx('liveWarn')}</span>
            </div>
          )}

          <div className="row between wrap">
            <span className="small muted">{marked !== null ? tx('marked', { n: marked + 1 }) : ''}</span>
            <button type="button" className="btn primary" disabled={marked === null} onClick={() => goStep(2, 'fault')}>
              {tx('next')}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <p className="muted small">{tx('s3Hint', { n: marked + 1 })}</p>
          <div className="sim-solar-options" role="radiogroup" aria-label={tx('s3Title')}>
            {FIXES.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={fix === f.id}
                className={`chip${fix === f.id ? ' on' : ''}`}
                disabled={done}
                onClick={() => {
                  setFix(f.id)
                  record('fix_select', { fix: f.id })
                }}
              >
                {tx(f.key)}
              </button>
            ))}
          </div>
          <div className="row end">
            <button type="button" className="btn primary" disabled={!fix || done} onClick={finish}>
              <Check size={18} aria-hidden="true" />
              {tx('finish')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Todo({ done, text }) {
  return (
    <li className={done ? 'done' : ''}>
      <span className="sim-solar-check" aria-hidden="true">{done && <Check size={14} />}</span>
      <span>{text}</span>
    </li>
  )
}

function TiltStep({ tx, district, tilt, optimum, output, onTilt, onLock }) {
  const P = { x: 250, y: 150 }
  const len = 120
  const t = rad(tilt)
  const E = { x: P.x - len * Math.cos(t), y: P.y - len * Math.sin(t) }
  const C = { x: (P.x + E.x) / 2, y: (P.y + E.y) / 2 }
  const N = { x: C.x + 46 * Math.sin(t), y: C.y - 46 * Math.cos(t) }
  const sun = useMemo(() => {
    const o = rad(optimum)
    return { x: 190 + 110 * Math.sin(o), y: 125 - 110 * Math.cos(o) }
  }, [optimum])
  const r = 34
  const arcEnd = { x: P.x - r * Math.cos(t), y: P.y - r * Math.sin(t) }
  const lbl = { x: P.x - 52 * Math.cos(t / 2), y: P.y - 52 * Math.sin(t / 2) + 4 }

  return (
    <div className="stack">
      <p className="muted small">{tx('s1Hint', { d: district })}</p>
      <svg className="sim-solar-svg" viewBox="0 0 360 200" role="img" aria-label={`${tx('tilt')} ${tilt}°`}>
        <rect className="sim-solar-roof" x="30" y="160" width="300" height="40" />
        <line className="sim-solar-ray" x1={sun.x} y1={sun.y} x2={C.x} y2={C.y} />
        <circle className="sim-solar-sun" cx={sun.x} cy={sun.y} r="14" />
        <line className="sim-solar-leg" x1={E.x} y1={E.y} x2={E.x} y2="160" />
        <line className="sim-solar-leg" x1={P.x} y1={P.y} x2={P.x} y2="160" />
        {tilt > 2 && <path className="sim-solar-arc" d={`M${P.x - r} ${P.y} A${r} ${r} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} />}
        <line className="sim-solar-panel-side" x1={P.x} y1={P.y} x2={E.x} y2={E.y} />
        <line className="sim-solar-normal" x1={C.x} y1={C.y} x2={N.x} y2={N.y} />
        <text className="sim-solar-label" x={lbl.x} y={lbl.y} textAnchor="middle">{tilt}°</text>
        <text className="sim-solar-tiny" x="326" y="152" textAnchor="end">{tx('south')} →</text>
      </svg>

      <div className="range-row">
        <label htmlFor="sim-solar-tilt" className="label">{tx('tilt')}</label>
        <span className="val">{tilt}°</span>
        <input
          id="sim-solar-tilt"
          type="range"
          min="0"
          max="60"
          step="1"
          value={tilt}
          onChange={(e) => onTilt(Number(e.target.value))}
        />
      </div>

      <div className="stack-1">
        <div className="row between">
          <span className="label">{tx('output')}</span>
          <span className="strong mono">{output.toFixed(1)}%</span>
        </div>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(output)}>
          <span style={{ width: `${output}%` }} />
        </div>
      </div>

      <div className="row end">
        <button type="button" className="btn primary" onClick={onLock}>
          <Lock size={16} aria-hidden="true" />
          {tx('lockAngle')}
        </button>
      </div>
    </div>
  )
}
