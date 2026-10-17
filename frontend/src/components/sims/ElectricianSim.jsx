import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check, ChevronDown, ChevronUp, GripVertical, Lightbulb, Power, TriangleAlert, X } from 'lucide-react'
import './electrician.css'

const L = {
  step: { en: 'Step', hi: 'चरण' },
  s1Title: { en: 'Lock-out tag-out', hi: 'लॉक-आउट टैग-आउट' },
  s1Hint: {
    en: 'Put the safety steps in the right order. Drag the handle or use the arrows.',
    hi: 'सुरक्षा के कदम सही क्रम में लगाएँ। हैंडल खींचें या तीर बटन दबाएँ।',
  },
  moveUp: { en: 'Move up', hi: 'ऊपर करें' },
  moveDown: { en: 'Move down', hi: 'नीचे करें' },
  dragHandle: { en: 'Drag to reorder', hi: 'क्रम बदलने के लिए खींचें' },
  submitOrder: { en: 'Submit order', hi: 'क्रम जमा करें' },
  orderScore: { en: '{c} of 5 in the right place', hi: '5 में से {c} सही जगह पर' },
  shouldBe: { en: 'Should be step {n}', hi: 'सही क्रम: {n}' },
  next: { en: 'Next', hi: 'आगे' },
  s2Title: { en: 'Wire a two-way switch', hi: 'टू-वे स्विच की वायरिंग' },
  s2Hint1: {
    en: 'Tap a terminal, then another, to run a wire. Tap a wire to remove it.',
    hi: 'तार जोड़ने के लिए एक टर्मिनल, फिर दूसरा टर्मिनल टैप करें। तार हटाने के लिए उस पर टैप करें।',
  },
  s2Hint2: {
    en: 'Then switch on the MCB and test all 4 switch positions.',
    hi: 'फिर MCB चालू करें और स्विच की चारों स्थितियाँ जाँचें।',
  },
  supply: { en: 'Supply 230 V', hi: 'सप्लाई 230 V' },
  lamp: { en: 'Lamp', hi: 'बल्ब' },
  switchA: { en: 'Switch A', hi: 'स्विच A' },
  switchB: { en: 'Switch B', hi: 'स्विच B' },
  flipA: { en: 'Flip A', hi: 'A बदलें' },
  flipB: { en: 'Flip B', hi: 'B बदलें' },
  mcbOn: { en: 'Switch on MCB', hi: 'MCB चालू करें' },
  mcbOff: { en: 'Switch off MCB', hi: 'MCB बंद करें' },
  powered: { en: 'Power ON', hi: 'बिजली चालू' },
  unpowered: { en: 'Power OFF', hi: 'बिजली बंद' },
  liveEdit: { en: 'Switch off the MCB before changing wires.', hi: 'तार बदलने से पहले MCB बंद करें।' },
  short: {
    en: 'Short circuit: Line touched Neutral and the MCB tripped. Check your wires.',
    hi: 'शॉर्ट सर्किट: फेज़ और न्यूट्रल मिल गए, MCB ट्रिप हो गया। अपने तार जाँचें।',
  },
  tested: { en: 'Positions tested: {n} / 4', hi: 'जाँची गई स्थितियाँ: {n} / 4' },
  lampOn: { en: 'Lamp on', hi: 'बल्ब जला' },
  lampOff: { en: 'Lamp off', hi: 'बल्ब बंद' },
  untested: { en: 'Not tested', hi: 'जाँच बाकी' },
  terminal: { en: 'Terminal {n}', hi: 'टर्मिनल {n}' },
  wire: { en: 'Wire {n}. Tap to remove', hi: 'तार {n}. हटाने के लिए टैप करें' },
  finish: { en: 'Finish', hi: 'पूरा करें' },
  indLoto: { en: 'LOTO sequence', hi: 'LOTO क्रम' },
  indWiring: { en: 'Two-way wiring', hi: 'टू-वे वायरिंग' },
  indCont: { en: 'Continuity verified', hi: 'निरंतरता की जाँच' },
  indShort: { en: 'Short circuits', hi: 'शॉर्ट सर्किट' },
  valLoto: { en: '{c}/5 in correct order', hi: '{c}/5 सही क्रम में' },
  valCont: { en: '{n}/4 positions tested', hi: '{n}/4 स्थितियाँ जाँचीं' },
  correct: { en: 'Correct', hi: 'सही' },
  incorrect: { en: 'Incorrect', hi: 'गलत' },
}

const LOTO = [
  { id: 'mcb_off', en: 'Switch off the MCB', hi: 'MCB बंद करें' },
  { id: 'lock', en: 'Lock the MCB', hi: 'MCB पर ताला लगाएँ' },
  { id: 'tag', en: 'Attach a tag with your name', hi: 'अपने नाम का टैग लगाएँ' },
  { id: 'test_dead', en: 'Test that the circuit is dead with a tester', hi: 'टेस्टर से जाँचें कि सर्किट में करंट नहीं है' },
  { id: 'start_work', en: 'Start work', hi: 'काम शुरू करें' },
]
const LOTO_IDS = LOTO.map((c) => c.id)

const TERMS = {
  'S.L': { x: 44, y: 92, label: 'L', lx: 44, ly: 78 },
  'S.N': { x: 92, y: 92, label: 'N', lx: 92, ly: 78 },
  'LP.N': { x: 268, y: 92, label: 'N', lx: 268, ly: 78 },
  'LP.L': { x: 316, y: 92, label: 'L', lx: 316, ly: 78 },
  'A.COM': { x: 36, y: 256, label: 'COM', lx: 36, ly: 282 },
  'A.L1': { x: 116, y: 228, label: 'L1', lx: 100, ly: 232, anchor: 'end' },
  'A.L2': { x: 116, y: 284, label: 'L2', lx: 100, ly: 288, anchor: 'end' },
  'B.L1': { x: 244, y: 228, label: 'L1', lx: 260, ly: 232, anchor: 'start' },
  'B.L2': { x: 244, y: 284, label: 'L2', lx: 260, ly: 288, anchor: 'start' },
  'B.COM': { x: 324, y: 256, label: 'COM', lx: 324, ly: 282 },
}
const TERM_IDS = Object.keys(TERMS)

const edgeKey = (a, b) => [a, b].sort().join('|')
const STANDARD = ['S.L|A.COM', 'A.L1|B.L1', 'A.L2|B.L2', 'B.COM|LP.L', 'S.N|LP.N'].map((k) => edgeKey(...k.split('|')))
const CROSSED = ['S.L|A.COM', 'A.L1|B.L2', 'A.L2|B.L1', 'B.COM|LP.L', 'S.N|LP.N'].map((k) => edgeKey(...k.split('|')))
const sameSet = (keys, ref) => keys.length === ref.length && ref.every((k) => keys.includes(k))

const COMBOS = ['L1/L1', 'L1/L2', 'L2/L1', 'L2/L2']
const BLADE = (Math.atan2(28, 80) * 180) / Math.PI

const now = () => performance.now()
const fill = (s, vars) => s.replace(/\{(\w)\}/g, (_, k) => vars[k])

function shuffled(ids) {
  let out = ids
  while (out.every((id, i) => id === ids[i])) {
    out = [...ids]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
  }
  return out
}

function circuit(wires, posA, posB) {
  const parent = Object.fromEntries(TERM_IDS.map((t) => [t, t]))
  const find = (t) => (parent[t] === t ? t : (parent[t] = find(parent[t])))
  const join = (a, b) => { parent[find(a)] = find(b) }
  wires.forEach((w) => join(w.a, w.b))
  join('A.COM', `A.${posA}`)
  join('B.COM', `B.${posB}`)
  const short = find('S.L') === find('S.N')
  const lit = !short && find('S.L') === find('LP.L') && find('S.N') === find('LP.N')
  return { short, lit }
}

export default function ElectricianSim({ lang, onComplete }) {
  const tx = (k, vars) => (vars ? fill(L[k][lang], vars) : L[k][lang])

  const [step, setStep] = useState(0)

  const [initialOrder] = useState(() => shuffled(LOTO_IDS))
  const [order, setOrder] = useState(initialOrder)
  const [lotoDone, setLotoDone] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragDy, setDragDy] = useState(0)

  const [wires, setWires] = useState([])
  const [pick, setPick] = useState(null)
  const [posA, setPosA] = useState('L1')
  const [posB, setPosB] = useState('L2')
  const [power, setPower] = useState(false)
  const [tripped, setTripped] = useState(false)
  const [liveEdit, setLiveEdit] = useState(false)
  const [tested, setTested] = useState({})
  const [shorts, setShorts] = useState(0)
  const [done, setDone] = useState(false)

  const t0 = useRef(0)
  const stepStart = useRef(0)
  const lotoTime = useRef(null)
  const log = useRef([])
  const counts = useRef({ lotoMoves: 0, wireAdds: 0, wireRemoves: 0, powerOns: 0, liveEdits: 0 })
  const orderRef = useRef(order)
  const drag = useRef(null)
  const cardRefs = useRef({})
  const wireSeq = useRef(0)

  useEffect(() => {
    t0.current = now()
    stepStart.current = t0.current
  }, [])

  const elapsed = () => Math.round(now() - t0.current)
  const record = (event, data = {}) => log.current.push({ t: elapsed(), event, ...data })

  const commitOrder = (next) => {
    orderRef.current = next
    setOrder(next)
  }

  const move = (id, delta) => {
    const cur = [...orderRef.current]
    const i = cur.indexOf(id)
    const j = i + delta
    if (j < 0 || j >= cur.length) return
    ;[cur[i], cur[j]] = [cur[j], cur[i]]
    counts.current.lotoMoves += 1
    commitOrder(cur)
  }

  const onHandleDown = (e, id) => {
    if (lotoDone) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, startY: e.clientY, moved: false }
    setDragId(id)
    setDragDy(0)
  }

  const onHandleMove = (e) => {
    const d = drag.current
    if (!d) return
    const cur = [...orderRef.current]
    let i = cur.indexOf(d.id)
    let dy = e.clientY - d.startY
    let changed = false
    // Swap with a neighbour once the card passes half of it; shift the origin by the neighbour's height.
    for (;;) {
      const nbr = dy > 0 ? cur[i + 1] : cur[i - 1]
      const el = nbr && cardRefs.current[nbr]
      if (!el) break
      const h = el.offsetHeight + 8
      if (Math.abs(dy) <= h / 2) break
      const j = dy > 0 ? i + 1 : i - 1
      ;[cur[i], cur[j]] = [cur[j], cur[i]]
      d.startY += dy > 0 ? h : -h
      dy += dy > 0 ? -h : h
      i = j
      changed = true
    }
    if (changed) {
      d.moved = true
      counts.current.lotoMoves += 1
      commitOrder(cur)
    }
    setDragDy(dy)
  }

  const onHandleUp = () => {
    if (!drag.current) return
    drag.current = null
    setDragId(null)
    setDragDy(0)
  }

  const submitOrder = () => {
    lotoTime.current = Math.round(now() - stepStart.current)
    record('loto_submit', { order })
    setLotoDone(true)
  }

  const goWiring = () => {
    stepStart.current = now()
    setStep(1)
  }

  // Evaluate the powered circuit after any state change; an L-N path trips the MCB.
  const evaluate = (nextWires, a, b, on) => {
    if (!on) return
    const { short, lit } = circuit(nextWires, a, b)
    if (short) {
      setShorts((s) => s + 1)
      setTripped(true)
      setPower(false)
      record('short_circuit', { posA: a, posB: b })
      return
    }
    const combo = `${a}/${b}`
    setTested((t) => ({ ...t, [combo]: lit }))
    record('test', { combo, lit })
  }

  const tapTerminal = (id) => {
    if (power) {
      counts.current.liveEdits += 1
      setLiveEdit(true)
      record('live_edit_attempt', { terminal: id })
      return
    }
    setLiveEdit(false)
    setTripped(false)
    if (pick === null) return setPick(id)
    if (pick === id) return setPick(null)
    const key = edgeKey(pick, id)
    setPick(null)
    if (wires.some((w) => edgeKey(w.a, w.b) === key)) return
    wireSeq.current += 1
    counts.current.wireAdds += 1
    record('wire_add', { a: pick, b: id })
    setWires([...wires, { id: wireSeq.current, a: pick, b: id }])
    setTested({})
  }

  const removeWire = (w) => {
    if (power) {
      counts.current.liveEdits += 1
      setLiveEdit(true)
      record('live_edit_attempt', { wire: `${w.a}-${w.b}` })
      return
    }
    setTripped(false)
    counts.current.wireRemoves += 1
    record('wire_remove', { a: w.a, b: w.b })
    setWires(wires.filter((x) => x.id !== w.id))
    setTested({})
  }

  const flip = (which) => {
    const a = which === 'A' ? (posA === 'L1' ? 'L2' : 'L1') : posA
    const b = which === 'B' ? (posB === 'L1' ? 'L2' : 'L1') : posB
    setPosA(a)
    setPosB(b)
    record('flip', { which, posA: a, posB: b })
    evaluate(wires, a, b, power)
  }

  const togglePower = () => {
    const on = !power
    setPower(on)
    setLiveEdit(false)
    setPick(null)
    if (on) {
      setTripped(false)
      counts.current.powerOns += 1
    }
    record(on ? 'mcb_on' : 'mcb_off')
    evaluate(wires, posA, posB, on)
  }

  const finish = () => {
    if (done) return
    setDone(true)
    record('finish')
    const correctPos = order.filter((id, i) => id === LOTO_IDS[i]).length
    const lotoScore = correctPos / 5
    const keys = wires.map((w) => edgeKey(w.a, w.b))
    const variant = sameSet(keys, STANDARD) ? 'standard' : sameSet(keys, CROSSED) ? 'crossed' : null
    const wiringOk = variant !== null
    const nTested = Object.keys(tested).length
    const allTested = nTested === 4
    const mcbFirst = order[0] === 'mcb_off'
    const testBeforeWork = order.indexOf('test_dead') < order.indexOf('start_work')
    const safety = Math.max(0, (mcbFirst && testBeforeWork ? 1 : 0.4) - 0.2 * shorts)

    onComplete?.({
      accuracy: +((lotoScore + (wiringOk ? 1 : 0) + (allTested ? 1 : 0)) / 3).toFixed(3),
      safety_score: +safety.toFixed(2),
      telemetry: {
        loto_initial_order: initialOrder,
        loto_submitted_order: order,
        loto_correct_positions: correctPos,
        loto_score: lotoScore,
        loto_moves: counts.current.lotoMoves,
        loto_time_ms: lotoTime.current,
        mcb_off_first: mcbFirst,
        test_before_work: testBeforeWork,
        wires: keys,
        wire_adds: counts.current.wireAdds,
        wire_removes: counts.current.wireRemoves,
        wiring_correct: wiringOk,
        wiring_variant: variant,
        combos_tested: Object.keys(tested),
        combo_results: tested,
        all_combos_verified: allTested,
        short_circuits: shorts,
        power_ons: counts.current.powerOns,
        live_edit_attempts: counts.current.liveEdits,
        wiring_time_ms: Math.round(now() - stepStart.current),
        total_ms: elapsed(),
        log: log.current,
      },
      indicators: [
        { en: L.indLoto.en, hi: L.indLoto.hi, value: tx('valLoto', { c: correctPos }), good: correctPos === 5 },
        { en: L.indWiring.en, hi: L.indWiring.hi, value: tx(wiringOk ? 'correct' : 'incorrect'), good: wiringOk },
        { en: L.indCont.en, hi: L.indCont.hi, value: tx('valCont', { n: nTested }), good: allTested && wiringOk },
        { en: L.indShort.en, hi: L.indShort.hi, value: String(shorts), good: shorts === 0 },
      ],
    })
  }

  const { lit } = circuit(wires, posA, posB)
  const lampLit = power && lit
  const nTested = Object.keys(tested).length

  return (
    <div className="sim-elec stack">
      <div className="stack-1">
        <span className="small strong">
          {tx('step')} {step + 1} / 2 · {tx(step === 0 ? 's1Title' : 's2Title')}
        </span>
        <div className="sim-elec-steps" aria-hidden="true">
          <span className={step > 0 ? 'done' : 'current'} />
          <span className={step === 1 ? 'current' : ''} />
        </div>
      </div>

      {step === 0 && (
        <div className="stack">
          <p className="muted small">{tx('s1Hint')}</p>
          <ol className="sim-elec-cards">
            {order.map((id, i) => {
              const card = LOTO.find((c) => c.id === id)
              const right = LOTO_IDS[i] === id
              const cls = ['sim-elec-card']
              if (dragId === id) cls.push('dragging')
              if (lotoDone) cls.push(right ? 'ok' : 'err')
              return (
                <li
                  key={id}
                  ref={(el) => { cardRefs.current[id] = el }}
                  className={cls.join(' ')}
                  style={dragId === id ? { transform: `translateY(${dragDy}px)` } : undefined}
                >
                  <span
                    className="sim-elec-grip"
                    aria-label={tx('dragHandle')}
                    onPointerDown={(e) => onHandleDown(e, id)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </span>
                  <span className="sim-elec-num">{i + 1}</span>
                  <span className="sim-elec-text">
                    {card[lang]}
                    {lotoDone && !right && (
                      <span className="sim-elec-should">{tx('shouldBe', { n: LOTO_IDS.indexOf(id) + 1 })}</span>
                    )}
                  </span>
                  {lotoDone ? (
                    <span className="sim-elec-mark" aria-label={tx(right ? 'correct' : 'incorrect')}>
                      {right ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
                    </span>
                  ) : (
                    <span className="row sim-elec-arrows">
                      <button type="button" className="icon-btn" aria-label={tx('moveUp')} disabled={i === 0} onClick={() => move(id, -1)}>
                        <ChevronUp size={18} aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn" aria-label={tx('moveDown')} disabled={i === order.length - 1} onClick={() => move(id, 1)}>
                        <ChevronDown size={18} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="row between wrap">
            <span className="small strong">
              {lotoDone ? tx('orderScore', { c: order.filter((id, i) => id === LOTO_IDS[i]).length }) : ''}
            </span>
            {lotoDone ? (
              <button type="button" className="btn primary" onClick={goWiring}>{tx('next')}</button>
            ) : (
              <button type="button" className="btn primary" onClick={submitOrder}>{tx('submitOrder')}</button>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <div className="small muted">
            <p>{tx('s2Hint1')}</p>
            <p>{tx('s2Hint2')}</p>
          </div>

          <svg className="sim-elec-svg" viewBox="0 0 360 316" role="group" aria-label={tx('s2Title')}>
            <rect className={`sim-elec-box${tripped ? ' err' : power ? ' live' : ''}`} x="16" y="24" width="104" height="88" />
            <text className="sim-elec-title" x="24" y="44">{tx('supply')}</text>

            <rect className="sim-elec-box" x="240" y="24" width="104" height="88" />
            <text className="sim-elec-title" x="248" y="44">{tx('lamp')}</text>
            <circle className={`sim-elec-bulb${lampLit ? ' on' : ''}`} cx="316" cy="50" r="13" />
            <path className="sim-elec-filament" d="M309 52 l4 -6 l3 6 l3 -6 l4 6" />

            <SwitchBox x={16} title={tx('switchA')} titleX={24} anchor="start" pivot={TERMS['A.COM']} dir={1}
              angle={posA === 'L1' ? -BLADE : BLADE} onFlip={() => flip('A')} />
            <SwitchBox x={224} title={tx('switchB')} titleX={336} anchor="end" pivot={TERMS['B.COM']} dir={-1}
              angle={posB === 'L1' ? BLADE : -BLADE} onFlip={() => flip('B')} />

            {wires.map((w, n) => {
              const a = TERMS[w.a]
              const b = TERMS[w.b]
              return (
                <g
                  key={w.id}
                  className="sim-elec-wire"
                  role="button"
                  tabIndex={0}
                  aria-label={tx('wire', { n: n + 1 })}
                  onClick={() => removeWire(w)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      removeWire(w)
                    }
                  }}
                >
                  <line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <line className="core" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                </g>
              )
            })}

            {TERM_IDS.map((id) => {
              const t = TERMS[id]
              return (
                <g
                  key={id}
                  className={`sim-elec-term${pick === id ? ' picked' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={tx('terminal', { n: id.replace('LP.', `${tx('lamp')} `).replace('S.', `${tx('supply')} `) })}
                  aria-pressed={pick === id}
                  onClick={() => tapTerminal(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      tapTerminal(id)
                    }
                  }}
                >
                  <circle className="hit" cx={t.x} cy={t.y} r="16" />
                  <circle className="ring" cx={t.x} cy={t.y} r="7" />
                  <circle className="screw" cx={t.x} cy={t.y} r="2.5" />
                  <text className="sim-elec-tlabel" x={t.lx} y={t.ly} textAnchor={t.anchor || 'middle'}>{t.label}</text>
                </g>
              )
            })}
          </svg>

          <div className="sim-elec-controls">
            <button type="button" className={`btn small${power ? '' : ' primary'}`} onClick={togglePower}>
              <Power size={16} aria-hidden="true" />
              {tx(power ? 'mcbOff' : 'mcbOn')}
            </button>
            <button type="button" className="btn small" onClick={() => flip('A')}>
              <ArrowUpDown size={16} aria-hidden="true" />
              {tx('flipA')} ({posA})
            </button>
            <button type="button" className="btn small" onClick={() => flip('B')}>
              <ArrowUpDown size={16} aria-hidden="true" />
              {tx('flipB')} ({posB})
            </button>
            <span className={`tag${power ? ' ok' : ''}`}>{tx(power ? 'powered' : 'unpowered')}</span>
          </div>

          {tripped && (
            <div className="alert" role="alert">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>{tx('short')}</span>
            </div>
          )}
          {liveEdit && (
            <div className="note warn" role="status">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>{tx('liveEdit')}</span>
            </div>
          )}

          <div className="stack-1">
            <span className="small strong">{tx('tested', { n: nTested })}</span>
            <div className="sim-elec-combos">
              {COMBOS.map((c) => {
                const [a, b] = c.split('/')
                const res = tested[c]
                const current = c === `${posA}/${posB}`
                return (
                  <div key={c} className={`sim-elec-combo${current ? ' current' : ''}${res === undefined ? '' : res ? ' on' : ' off'}`}>
                    <span className="tiny mono">A {a} · B {b}</span>
                    <span className="row tiny">
                      <Lightbulb size={14} aria-hidden="true" />
                      {res === undefined ? tx('untested') : tx(res ? 'lampOn' : 'lampOff')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="row end">
            <button type="button" className="btn primary" disabled={done} onClick={finish}>
              <Check size={18} aria-hidden="true" />
              {tx('finish')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SwitchBox({ x, title, titleX, anchor, pivot, dir, angle, onFlip }) {
  return (
    <g>
      <rect className="sim-elec-box" x={x} y="200" width="120" height="104" />
      <text className="sim-elec-title" x={titleX} y="218" textAnchor={anchor}>{title}</text>
      <g
        className="sim-elec-blade"
        onClick={onFlip}
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${pivot.x}px ${pivot.y}px` }}
      >
        <line className="hit" x1={pivot.x} y1={pivot.y} x2={pivot.x + dir * 76} y2={pivot.y} />
        <line className="core" x1={pivot.x} y1={pivot.y} x2={pivot.x + dir * 76} y2={pivot.y} />
      </g>
    </g>
  )
}
