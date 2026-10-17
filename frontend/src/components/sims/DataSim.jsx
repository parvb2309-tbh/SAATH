import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ChartColumn, ChartLine, ChartPie, Check, ChevronLeft, CircleAlert, CircleCheck, Flag, Ruler, Sigma, Trash } from 'lucide-react'
import { FormulaError, collectRefs, evaluate, parseFormula, shiftRows } from './formula'
import './data.css'

const L = {
  s0: { en: 'Duplicates', hi: 'डुप्लीकेट' },
  s1: { en: 'Units', hi: 'इकाई' },
  s2: { en: 'Formulas', hi: 'फ़ॉर्मूला' },
  s3: { en: 'Chart', hi: 'चार्ट' },
  step: { en: 'Step', hi: 'चरण' },
  sheet: { en: 'FPO crop stock', hi: 'एफ़पीओ फसल स्टॉक' },
  t0: { en: 'Remove duplicate rows', hi: 'डुप्लीकेट पंक्तियाँ हटाएँ' },
  i0: { en: 'Two records were typed twice. Tick only the extra copies, then delete.', hi: 'दो रिकॉर्ड दो बार लिखे गए हैं। सिर्फ़ फालतू कॉपी पर टिक करें, फिर हटाएँ।' },
  t1: { en: 'Convert kg to quintal', hi: 'किलो को क्विंटल में बदलें' },
  i1: { en: 'Rate is per quintal. Tap a cell in C or D to fix rows in kg. 1 quintal = 100 kg.', hi: 'दर प्रति क्विंटल है। किलो वाली पंक्तियाँ ठीक करने के लिए C या D की सेल पर टैप करें। 1 क्विंटल = 100 किलो।' },
  t2: { en: 'Calculate totals with formulas', hi: 'फ़ॉर्मूले से कुल रकम निकालें' },
  i2: { en: 'Total = Quantity x Rate, e.g. =C2*E2. Then add the column in the total row with =SUM(...).', hi: 'कुल = मात्रा x दर, जैसे =C2*E2। फिर कुल वाली पंक्ति में =SUM(...) से जोड़ें।' },
  t3: { en: 'Make a chart for the FPO meeting', hi: 'एफ़पीओ मीटिंग के लिए चार्ट बनाएँ' },
  i3: { en: 'Show the total value of each crop.', hi: 'हर फसल की कुल कीमत दिखाएँ।' },
  delCheck: { en: 'Delete selected and check', hi: 'चुनी पंक्तियाँ हटाएँ और जाँचें' },
  selected: { en: 'selected', hi: 'चुनी गईं' },
  check: { en: 'Check', hi: 'जाँचें' },
  next: { en: 'Next step', hi: 'अगला चरण' },
  moveOn: { en: 'Move on', hi: 'आगे बढ़ें' },
  finish: { en: 'Finish', hi: 'पूरा करें' },
  restored: { en: "{names}: not an extra copy. Restored from backup.", hi: '{names}: यह फालतू कॉपी नहीं थी। बैकअप से वापस लाई गई।' },
  dupLeft: { en: '{n} duplicate row(s) still in the sheet.', hi: 'शीट में अभी भी {n} डुप्लीकेट पंक्ति बची है।' },
  dedupeOk: { en: 'Duplicates removed. {n} unique records left.', hi: 'डुप्लीकेट हट गए। {n} अलग रिकॉर्ड बचे।' },
  unitsOk: { en: 'All quantities are in quintal now.', hi: 'अब सारी मात्रा क्विंटल में है।' },
  unitsBad: { en: '{n} row(s) still need fixing.', hi: '{n} पंक्ति अभी ठीक करनी है।' },
  fillAll: { en: 'Fill every cell in column F first, including the total.', hi: 'पहले F कॉलम की हर सेल भरें, कुल वाली भी।' },
  formulasOk: { en: 'All formulas are correct.', hi: 'सारे फ़ॉर्मूले सही हैं।' },
  formulasBad: { en: '{n} cell(s) are not correct.', hi: '{n} सेल सही नहीं हैं।' },
  fillDown: { en: 'Fill down from F{r}', hi: 'F{r} से नीचे तक भरें' },
  tapCell: { en: 'Tap a cell to edit', hi: 'बदलने के लिए सेल पर टैप करें' },
  enter: { en: 'Enter', hi: 'दर्ज करें' },
  notNumber: { en: 'Enter a number', hi: 'संख्या लिखें' },
  total: { en: 'Total', hi: 'कुल' },
  kg: { en: 'kg', hi: 'किलो' },
  quintal: { en: 'quintal', hi: 'क्विंटल' },
  hA: { en: 'Farmer', hi: 'किसान' },
  hB: { en: 'Crop', hi: 'फसल' },
  hC: { en: 'Quantity', hi: 'मात्रा' },
  hD: { en: 'Unit', hi: 'इकाई' },
  hE: { en: 'Rate (₹/quintal)', hi: 'दर (₹/क्विंटल)' },
  hF: { en: 'Total (₹)', hi: 'कुल (₹)' },
  chartType: { en: 'Chart type', hi: 'चार्ट का प्रकार' },
  labelCol: { en: 'Labels from column', hi: 'लेबल किस कॉलम से' },
  valueCol: { en: 'Values from column', hi: 'मान किस कॉलम से' },
  bar: { en: 'Bar', hi: 'बार' },
  pie: { en: 'Pie', hi: 'पाई' },
  line: { en: 'Line', hi: 'लाइन' },
  back: { en: 'Back', hi: 'पीछे' },
  create: { en: 'Create chart', hi: 'चार्ट बनाएँ' },
  chartOf: { en: '{v} by {l}', hi: '{l} के अनुसार {v}' },
  chartOk: { en: 'Clear crop-wise view for the meeting.', hi: 'मीटिंग के लिए फसल के हिसाब से साफ़ तस्वीर।' },
  chartBad: { en: 'This chart does not show the total value of each crop.', hi: 'यह चार्ट हर फसल की कुल कीमत नहीं दिखाता।' },
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
const FARMERS = {
  f1: { en: 'Ramesh Yadav', hi: 'रमेश यादव' },
  f2: { en: 'Sita Devi', hi: 'सीता देवी' },
  f3: { en: 'Mohan Kushwaha', hi: 'मोहन कुशवाहा' },
  f4: { en: 'Geeta Kumari', hi: 'गीता कुमारी' },
  f5: { en: 'Arjun Singh', hi: 'अर्जुन सिंह' },
  f6: { en: 'Lakshmi Prasad', hi: 'लक्ष्मी प्रसाद' },
  f7: { en: 'Rakesh Maurya', hi: 'राकेश मौर्य' },
  f8: { en: 'Pooja Verma', hi: 'पूजा वर्मा' },
}
const CROPS = {
  wheat: { en: 'Wheat', hi: 'गेहूं', rate: 2425 },
  paddy: { en: 'Paddy', hi: 'धान', rate: 2369 },
  mustard: { en: 'Mustard', hi: 'सरसों', rate: 5950 },
  lentil: { en: 'Lentil', hi: 'मसूर', rate: 6700 },
  soybean: { en: 'Soybean', hi: 'सोयाबीन', rate: 5328 },
}
const PIE_COLORS = ['#087F8C', '#17324D', '#F2A541', '#19B5A5', '#657386', '#C43D4B', '#21865B', '#B7791F', '#22476B', '#9AA7B6']

function seedRows(lat) {
  const pulse = typeof lat === 'number' && lat < 24 ? 'soybean' : 'lentil'
  const base = [
    ['f1', 'wheat', 12, 'quintal'],
    ['f2', 'paddy', 850, 'kg'],
    ['f3', 'mustard', 6, 'quintal'],
    ['f4', 'wheat', 250, 'kg'],
    ['f3', 'mustard', 6, 'quintal'],
    ['f5', pulse, 4, 'quintal'],
    ['f6', 'paddy', 15, 'quintal'],
    ['f7', 'mustard', 320, 'kg'],
    ['f6', 'paddy', 15, 'quintal'],
    ['f8', 'wheat', 9, 'quintal'],
  ]
  return base.map(([farmer, crop, qty, unit], i) => ({
    id: i + 1, farmer, crop, qty, unit, rate: CROPS[crop].rate,
    origQty: qty, origUnit: unit, key: `${farmer}|${crop}|${qty}|${unit}`,
  }))
}

const close = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b))
const isNumeric = (s) => /^-?(\d+(\.\d+)?|\.\d+)$/.test(s)
const unitOk = (r) => r.unit === 'quintal' && close(r.qty, r.origUnit === 'kg' ? r.origQty / 100 : r.origQty)
const fmtNum = (v) => (typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : v)

function computeSheet(rows, fcells, lang) {
  const n = rows.length
  const totalRow = n + 2
  const memo = new Map()
  const visiting = new Set()
  const fCell = (r) => {
    if (memo.has(r)) {
      const m = memo.get(r)
      if (m.err) throw new FormulaError(m.err)
      return m.v
    }
    if (visiting.has(r)) throw new FormulaError('#REF')
    const raw = (fcells[r] ?? '').trim()
    let out
    if (!raw) out = { v: null }
    else if (isNumeric(raw)) out = { v: +raw }
    else {
      visiting.add(r)
      try {
        out = { v: evaluate(parseFormula(raw), get) }
      } catch (e) {
        out = { err: e instanceof FormulaError ? e.code : '#ERROR' }
      }
      visiting.delete(r)
    }
    memo.set(r, out)
    if (out.err) throw new FormulaError(out.err)
    return out.v
  }
  const get = (col, r) => {
    if (r === 1) return L[`h${col}`][lang]
    const row = rows[r - 2]
    if (row) {
      if (col === 'A') return FARMERS[row.farmer][lang]
      if (col === 'B') return CROPS[row.crop][lang]
      if (col === 'C') return row.qty
      if (col === 'D') return L[row.unit][lang]
      if (col === 'E') return row.rate
      return fCell(r)
    }
    if (r === totalRow) {
      if (col === 'A') return L.total[lang]
      if (col === 'F') return fCell(r)
    }
    return null
  }
  const f = (r) => {
    try { return { v: fCell(r) } } catch (e) { return { err: e.code || '#ERROR' } }
  }
  return { get, f, totalRow, n }
}

function parses(raw) {
  try { parseFormula(raw); return true } catch { return false }
}

function rowFormulaOk(raw, r, row, sheet) {
  const src = (raw ?? '').trim()
  if (!src.startsWith('=')) return false
  let ast
  try { ast = parseFormula(src) } catch { return false }
  const refs = collectRefs(ast)
  const res = sheet.f(r)
  return refs.some((x) => x.col === 'C' && x.row === r) && refs.some((x) => x.col === 'E' && x.row === r) && close(res.v, row.qty * row.rate)
}

function totalFormulaOk(raw, sheet) {
  const src = (raw ?? '').trim()
  if (!src.startsWith('=')) return false
  let ast
  try { ast = parseFormula(src) } catch { return false }
  if (!collectRefs(ast).some((x) => x.col === 'F')) return false
  let expected = 0
  for (let r = 2; r < sheet.totalRow; r++) {
    const v = sheet.f(r).v
    if (typeof v === 'number') expected += v
  }
  return close(sheet.f(sheet.totalRow).v, expected)
}

export default function DataSim({ lang = 'en', context, onComplete }) {
  const tx = (k, vars) => {
    let s = L[k][lang]
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, b)
    return s
  }
  const district = context?.districtName || ''
  const [rows, setRows] = useState(() => seedRows(context?.districtLat))
  const [step, setStep] = useState(0)
  const [msg, setMsg] = useState(null)
  const [fails, setFails] = useState(0)
  const [passed, setPassed] = useState(false)
  const [marks, setMarks] = useState({})

  const [selected, setSelected] = useState(() => new Set())
  const [dedupe, setDedupe] = useState({ checks: 0, wrong_deletes: 0, missed_checks: 0, rows_deleted: 0 })
  const [units, setUnits] = useState({ checks: 0, edits: 0, first_check_correct: null, total_rows: 0 })
  const [fcells, setFcells] = useState({})
  const [formulas, setFormulas] = useState({ checks: 0, entries: 0, syntax_errors: 0, first_check_correct: null, total_cells: 0, fill_down_used: false, fill_down_rows: 0 })
  const [chart, setChart] = useState({ sub: 0, type: null, label: null, value: null, made: false })
  const [destructive, setDestructive] = useState(0)

  const [sel, setSel] = useState(null)
  const [draft, setDraft] = useState('')
  const [barError, setBarError] = useState(null)
  const inputRef = useRef(null)

  const startRef = useRef(performance.now())
  const stepStartRef = useRef(performance.now())
  const stepMsRef = useRef({})
  const logRef = useRef([])
  const penalizedRef = useRef(new Set())
  const doneRef = useRef(false)
  const now = () => Math.round(performance.now() - startRef.current)
  const log = (entry) => { if (logRef.current.length < 400) logRef.current.push({ t_ms: now(), step: step + 1, ...entry }) }

  const sheet = useMemo(() => computeSheet(rows, fcells, lang), [rows, fcells, lang])
  const dataRowNums = rows.map((_, i) => i + 2)

  useEffect(() => {
    if (sel && inputRef.current) inputRef.current.focus()
  }, [sel])

  const editable = (col, r) => {
    if (step === 1) return (col === 'C' || col === 'D') && r >= 2 && r < sheet.totalRow
    if (step === 2) return col === 'F' && r >= 2 && r <= sheet.totalRow
    return false
  }
  const rawOf = (col, r) => {
    if (col === 'F') return fcells[r] ?? ''
    const row = rows[r - 2]
    if (!row) return ''
    return col === 'C' ? String(row.qty) : row.unit
  }
  const selectCell = (col, r) => {
    if (!editable(col, r)) return
    setSel({ col, r })
    setDraft(rawOf(col, r))
    setBarError(null)
  }

  const goNext = () => {
    stepMsRef.current[['dedupe', 'units', 'formulas', 'chart'][step]] = Math.round(performance.now() - stepStartRef.current)
    stepStartRef.current = performance.now()
    log({ action: 'step_done', passed })
    setStep((s) => s + 1)
    setMsg(null); setFails(0); setPassed(false); setMarks({}); setSel(null); setBarError(null)
  }

  const toggleRow = (id) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const checkDedupe = () => {
    const groups = new Map()
    rows.forEach((r) => groups.set(r.key, [...(groups.get(r.key) || []), r]))
    const restore = new Set()
    const names = []
    for (const g of groups.values()) {
      if (g.every((r) => selected.has(r.id))) {
        restore.add(g[0].id)
        names.push(FARMERS[g[0].farmer][lang])
      }
    }
    const nextRows = rows.filter((r) => !selected.has(r.id) || restore.has(r.id))
    const dupLeft = nextRows.length - new Set(nextRows.map((r) => r.key)).size
    const removed = rows.length - nextRows.length
    const ok = restore.size === 0 && dupLeft === 0
    setRows(nextRows)
    setSelected(new Set())
    setDedupe((d) => ({ checks: d.checks + 1, wrong_deletes: d.wrong_deletes + restore.size, missed_checks: d.missed_checks + (dupLeft ? 1 : 0), rows_deleted: d.rows_deleted + removed }))
    if (restore.size) setDestructive((x) => x + restore.size)
    log({ action: 'dedupe_check', removed, wrong_deletes: restore.size, duplicates_left: dupLeft, ok })
    const parts = []
    if (restore.size) parts.push(tx('restored', { names: names.join(', ') }))
    if (dupLeft) parts.push(tx('dupLeft', { n: dupLeft }))
    if (dupLeft === 0) {
      setPassed(true)
      if (!restore.size) parts.push(tx('dedupeOk', { n: nextRows.length }))
    } else setFails((f) => f + 1)
    setMsg({ kind: dupLeft === 0 && !restore.size ? 'ok' : 'warn', text: parts.join(' ') })
  }

  const commit = (value = draft) => {
    if (!sel) return
    const { col, r } = sel
    const i = r - 2
    if (col === 'C') {
      const v = value.trim().replace(',', '.')
      if (!isNumeric(v)) { setBarError(tx('notNumber')); return }
      if (+v !== rows[i].qty) {
        setRows((rs) => rs.map((row, j) => (j === i ? { ...row, qty: +v } : row)))
        setUnits((u) => ({ ...u, edits: u.edits + 1 }))
        log({ action: 'edit', cell: `C${r}`, value: +v })
      }
    } else if (col === 'D') {
      if (value !== rows[i].unit) {
        setRows((rs) => rs.map((row, j) => (j === i ? { ...row, unit: value } : row)))
        setUnits((u) => ({ ...u, edits: u.edits + 1 }))
        setMarks((m) => {
          if (!(r in m)) return m
          const next = { ...m }
          delete next[r]
          return next
        })
        log({ action: 'edit', cell: `D${r}`, value })
      }
      return
    } else {
      const v = value.trim()
      if (v !== (fcells[r] ?? '')) {
        setFcells((fc) => ({ ...fc, [r]: v }))
        if (v) {
          const bad = !isNumeric(v) && !parses(v)
          setFormulas((f) => ({ ...f, entries: f.entries + 1, syntax_errors: f.syntax_errors + (bad ? 1 : 0) }))
          log({ action: 'formula', cell: `F${r}`, value: v, syntax_error: bad })
        }
      }
    }
    setBarError(null)
    setMarks((m) => {
      if (!(r in m)) return m
      const next = { ...m }
      delete next[r]
      return next
    })
    const lastRow = col === 'F' ? sheet.totalRow : sheet.totalRow - 1
    if (r < lastRow) {
      setSel({ col, r: r + 1 })
      setDraft(rawOf(col, r + 1))
    } else setSel(null)
  }

  const checkUnits = () => {
    const bad = rows.filter((r) => !unitOk(r))
    const newlyBroken = bad.filter((r) => (r.qty !== r.origQty || r.unit !== r.origUnit) && !penalizedRef.current.has(r.id))
    newlyBroken.forEach((r) => penalizedRef.current.add(r.id))
    if (newlyBroken.length) setDestructive((x) => x + newlyBroken.length)
    setUnits((u) => ({
      ...u, checks: u.checks + 1, total_rows: rows.length,
      first_check_correct: u.first_check_correct ?? rows.length - bad.length,
    }))
    setMarks(Object.fromEntries(rows.map((r, i) => [i + 2, unitOk(r)])))
    log({ action: 'units_check', wrong_rows: bad.length, overwritten: newlyBroken.length })
    if (bad.length) {
      setFails((f) => f + 1)
      setMsg({ kind: 'warn', text: tx('unitsBad', { n: bad.length }) })
    } else {
      setPassed(true)
      setMsg({ kind: 'ok', text: tx('unitsOk') })
    }
  }

  const fOk = (r) => (r === sheet.totalRow ? totalFormulaOk(fcells[r], sheet) : rowFormulaOk(fcells[r], r, rows[r - 2], sheet))
  const fCellsAll = [...dataRowNums, sheet.totalRow]

  const checkFormulas = () => {
    if (fCellsAll.some((r) => !(fcells[r] ?? '').trim())) {
      setMsg({ kind: 'warn', text: tx('fillAll') })
      return
    }
    const results = Object.fromEntries(fCellsAll.map((r) => [r, fOk(r)]))
    const badCount = fCellsAll.filter((r) => !results[r]).length
    setFormulas((f) => ({
      ...f, checks: f.checks + 1, total_cells: fCellsAll.length,
      first_check_correct: f.first_check_correct ?? fCellsAll.length - badCount,
    }))
    setMarks(results)
    log({ action: 'formulas_check', wrong_cells: badCount })
    if (badCount) {
      setFails((f) => f + 1)
      setMsg({ kind: 'warn', text: tx('formulasBad', { n: badCount }) })
    } else {
      setPassed(true)
      setMsg({ kind: 'ok', text: tx('formulasOk') })
    }
  }

  const fillFrom = step === 2 ? dataRowNums.find((r) => fOk(r)) : undefined
  const lastData = dataRowNums[dataRowNums.length - 1]
  const canFillDown = fillFrom !== undefined && fillFrom < lastData && dataRowNums.some((r) => r > fillFrom && !fOk(r))
  const fillDown = () => {
    const src = fcells[fillFrom]
    const add = {}
    for (let r = fillFrom + 1; r <= lastData; r++) add[r] = shiftRows(src, r - fillFrom)
    setFcells((fc) => ({ ...fc, ...add }))
    setFormulas((f) => ({ ...f, fill_down_used: true, fill_down_rows: f.fill_down_rows + Object.keys(add).length }))
    log({ action: 'fill_down', from: `F${fillFrom}`, rows: Object.keys(add).length })
    setSel(null)
  }

  const chartData = useMemo(() => {
    if (!chart.made) return []
    const groups = new Map()
    rows.forEach((row, i) => {
      const label = chart.label === 'A' ? FARMERS[row.farmer][lang] : CROPS[row.crop][lang]
      const raw = chart.value === 'F' ? sheet.f(i + 2).v : chart.value === 'C' ? row.qty : row.rate
      groups.set(label, (groups.get(label) || 0) + (typeof raw === 'number' ? raw : 0))
    })
    return [...groups].map(([label, value]) => ({ label, value }))
  }, [chart, rows, sheet, lang])

  const chartCorrect = (c) => (c.type === 'bar' || c.type === 'pie') && c.label === 'B' && c.value === 'F'
  const makeChart = () => {
    const correct = chartCorrect(chart)
    setChart((c) => ({ ...c, made: true }))
    setPassed(true)
    setMsg({ kind: correct ? 'ok' : 'warn', text: correct ? tx('chartOk') : tx('chartBad') })
    log({ action: 'chart', type: chart.type, label: chart.label, value: chart.value, correct })
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    stepMsRef.current.chart = Math.round(performance.now() - stepStartRef.current)
    const dedupeScore = Math.max(0, 1 - 0.25 * (dedupe.wrong_deletes + dedupe.missed_checks))
    const unitScore = units.first_check_correct === null ? 0 : units.first_check_correct / units.total_rows
    const formulaScore = formulas.first_check_correct === null ? 0 : formulas.first_check_correct / formulas.total_cells
    const chartScore = chart.made && chartCorrect(chart) ? 1 : 0
    const accuracy = (dedupeScore + unitScore + formulaScore + chartScore) / 4
    const safety = Math.max(0, 1 - 0.15 * destructive)
    const validNow = fCellsAll.filter((r) => (fcells[r] ?? '').trim() && !sheet.f(r).err).length
    const transformation = (dedupeScore + unitScore) / 2
    const telemetry = {
      sim: 'data_entry_fpo_sheet',
      district: district || null,
      steps: logRef.current,
      step_ms: { ...stepMsRef.current },
      total_ms: now(),
      dedupe: { ...dedupe, score: dedupeScore },
      units: { ...units, score: unitScore },
      formulas: { ...formulas, valid_formulas: validNow, formula_cells: fCellsAll.length, score: formulaScore },
      chart: { type: chart.type, label: chart.label, value: chart.value, correct: chartScore === 1 },
      destructive_errors: destructive,
      final_rows: rows.length,
    }
    onComplete?.({
      accuracy: Math.round(accuracy * 1000) / 1000,
      safety_score: Math.round(safety * 1000) / 1000,
      telemetry,
      indicators: [
        { en: 'Data transformation accuracy', hi: 'डेटा सुधार की सटीकता', value: `${Math.round(transformation * 100)}%`, good: transformation >= 0.75 },
        { en: 'Formulas that execute', hi: 'सही चलने वाले फ़ॉर्मूले', value: `${validNow}/${fCellsAll.length}`, good: validNow === fCellsAll.length },
        { en: 'Syntax errors', hi: 'सिंटैक्स गलतियाँ', value: String(formulas.syntax_errors), good: formulas.syntax_errors === 0 },
        { en: 'Valid data deleted or overwritten', hi: 'सही डेटा मिटाया या बदला', value: String(destructive), good: destructive === 0 },
      ],
    })
  }

  const steps = ['s0', 's1', 's2', 's3']
  const icons = [Trash, Ruler, Sigma, ChartColumn]
  const StepIcon = icons[step]
  const showTotal = step >= 2
  const lastRowNum = showTotal ? sheet.totalRow : sheet.totalRow - 1

  const cellView = (col, r) => {
    if (col === 'F') {
      const res = sheet.f(r)
      if (res.err) return { text: res.err === '#ERROR' ? '#ERROR' : res.err, err: true }
      return { text: res.v === null ? '' : fmtNum(res.v), num: true }
    }
    const v = sheet.get(col, r)
    return { text: v === null ? '' : fmtNum(v), num: typeof v === 'number' }
  }

  return (
    <div className="sim-data">
      <ol className="sim-data-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span className="sim-data-stepnum">{i < step ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
            <span className="sim-data-steplabel">{tx(s)}</span>
          </li>
        ))}
      </ol>

      <div className="sim-data-task">
        <span className="sim-data-taskico"><StepIcon size={18} aria-hidden="true" /></span>
        <div>
          <h3>{tx(`t${step}`)}</h3>
          <p className="small muted">{tx(`i${step}`)}</p>
        </div>
      </div>

      {(step === 1 || step === 2) && (
        <div className="sim-data-bar">
          <span className="sim-data-addr mono">{sel ? `${sel.col}${sel.r}` : '--'}</span>
          {!sel && <span className="small muted">{tx('tapCell')}</span>}
          {sel && sel.col === 'D' && (
            <div className="sim-data-units">
              {['kg', 'quintal'].map((u) => (
                <button key={u} type="button" className={`chip ${rows[sel.r - 2]?.unit === u ? 'on' : ''}`} onClick={() => commit(u)}>{tx(u)}</button>
              ))}
            </div>
          )}
          {sel && sel.col !== 'D' && (
            <form className="sim-data-barform" onSubmit={(e) => { e.preventDefault(); commit() }}>
              <input
                ref={inputRef}
                className="input mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setSel(null) }}
                inputMode={sel.col === 'C' ? 'decimal' : 'text'}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`${sel.col}${sel.r}`}
              />
              <button type="submit" className="btn primary" aria-label={tx('enter')}><Check size={16} aria-hidden="true" /><span className="sim-data-hide-xs">{tx('enter')}</span></button>
            </form>
          )}
          {sel && sel.col === 'F' && (
            <div className="sim-data-keys">
              {['=', '*', '+', '(', ')', ':', 'SUM('].map((k) => (
                <button key={k} type="button" className="sim-data-key mono" onPointerDown={(e) => e.preventDefault()} onClick={() => setDraft((d) => d + k)}>{k}</button>
              ))}
            </div>
          )}
          {barError && <span className="small sim-data-err">{barError}</span>}
        </div>
      )}

      {step < 3 && <div className="small muted">{tx('sheet')}{district ? ` · ${district}` : ''}</div>}
      {step < 3 && (
        <div className="table-wrap sim-data-gridwrap">
          <table className="sim-data-grid">
            <thead>
              <tr>
                <th className="sim-data-corner" />
                {COLS.map((c) => <th key={c} className={sel?.col === c ? 'hl' : ''}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lastRowNum }, (_, k) => k + 1).map((r) => {
                const row = rows[r - 2]
                const isHead = r === 1
                const isTotal = showTotal && r === sheet.totalRow
                const mark = marks[r]
                return (
                  <tr key={row ? row.id : `r${r}`} className={`${isHead ? 'head' : ''} ${isTotal ? 'total' : ''} ${row && selected.has(row.id) ? 'picked' : ''}`}>
                    <th className={`sim-data-rownum ${sel?.r === r ? 'hl' : ''}`}>
                      {step === 0 && row ? (
                        <label className="sim-data-pick">
                          <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`${r} ${FARMERS[row.farmer][lang]}`} />
                          <span>{r}</span>
                        </label>
                      ) : r}
                    </th>
                    {COLS.map((col) => {
                      const view = cellView(col, r)
                      const canEdit = editable(col, r)
                      const isSel = sel && sel.col === col && sel.r === r
                      const markCls = mark === undefined || (step === 2 && col !== 'F') || (step === 1 && col !== 'C' && col !== 'D') ? '' : mark ? 'good' : 'bad'
                      const cls = ['sim-data-cell', view.num ? 'num' : '', view.err ? 'err' : '', canEdit ? 'edit' : '', isSel ? 'sel' : '', markCls].join(' ')
                      return (
                        <td key={col} className={cls}>
                          {canEdit ? (
                            <button type="button" onClick={() => selectCell(col, r)} aria-label={`${col}${r}`}>
                              {view.text || ' '}
                            </button>
                          ) : <span>{view.text}</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {step === 3 && (
        <div className="sim-data-wizard">
          {!chart.made && (
            <>
              <div className="sim-data-wizsteps small muted">{chart.sub + 1} / 3</div>
              {chart.sub === 0 && (
                <fieldset className="sim-data-fs">
                  <legend className="section-title">{tx('chartType')}</legend>
                  <div className="chips">
                    {[['bar', ChartColumn], ['pie', ChartPie], ['line', ChartLine]].map(([t, Icon]) => (
                      <button key={t} type="button" className={`chip ${chart.type === t ? 'on' : ''}`} onClick={() => setChart((c) => ({ ...c, type: t }))}>
                        <Icon size={16} aria-hidden="true" />{tx(t)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {chart.sub === 1 && (
                <fieldset className="sim-data-fs">
                  <legend className="section-title">{tx('labelCol')}</legend>
                  <div className="chips">
                    {['B', 'A'].map((c) => (
                      <button key={c} type="button" className={`chip ${chart.label === c ? 'on' : ''}`} onClick={() => setChart((s) => ({ ...s, label: c }))}>
                        <span className="mono">{c}</span>{tx(`h${c}`)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {chart.sub === 2 && (
                <fieldset className="sim-data-fs">
                  <legend className="section-title">{tx('valueCol')}</legend>
                  <div className="chips">
                    {['C', 'E', 'F'].map((c) => (
                      <button key={c} type="button" className={`chip ${chart.value === c ? 'on' : ''}`} onClick={() => setChart((s) => ({ ...s, value: c }))}>
                        <span className="mono">{c}</span>{tx(`h${c}`)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="row">
                {chart.sub > 0 && (
                  <button type="button" className="btn ghost" onClick={() => setChart((c) => ({ ...c, sub: c.sub - 1 }))}><ChevronLeft size={16} aria-hidden="true" />{tx('back')}</button>
                )}
                {chart.sub < 2 ? (
                  <button type="button" className="btn primary" disabled={chart.sub === 0 ? !chart.type : !chart.label} onClick={() => setChart((c) => ({ ...c, sub: c.sub + 1 }))}>{tx('next')}</button>
                ) : (
                  <button type="button" className="btn primary" disabled={!chart.value} onClick={makeChart}>{tx('create')}</button>
                )}
              </div>
            </>
          )}
          {chart.made && (
            <figure className="sim-data-chart">
              <figcaption className="small strong">
                {tx('chartOf', { v: tx(`h${chart.value}`), l: tx(`h${chart.label}`) })}{district ? ` · ${district}` : ''}
              </figcaption>
              <ChartView type={chart.type} data={chartData} />
            </figure>
          )}
        </div>
      )}

      {msg && (
        <div className={`note ${msg.kind === 'ok' ? 'ok' : 'warn'} small`} role="status">
          {msg.kind === 'ok' ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="sim-data-actions">
        {step === 0 && !passed && (
          <>
            <span className="small muted">{selected.size} {tx('selected')}</span>
            <button type="button" className="btn primary" disabled={!selected.size} onClick={checkDedupe}><Trash size={16} aria-hidden="true" />{tx('delCheck')}</button>
          </>
        )}
        {step === 1 && !passed && <button type="button" className="btn primary" onClick={checkUnits}><Check size={16} aria-hidden="true" />{tx('check')}</button>}
        {step === 2 && !passed && (
          <>
            {canFillDown && (
              <button type="button" className="btn" onClick={fillDown}><ArrowDownToLine size={16} aria-hidden="true" />{tx('fillDown', { r: fillFrom })}</button>
            )}
            <button type="button" className="btn primary" onClick={checkFormulas}><Check size={16} aria-hidden="true" />{tx('check')}</button>
          </>
        )}
        {step < 3 && !passed && fails >= 2 && <button type="button" className="btn ghost" onClick={goNext}>{tx('moveOn')}</button>}
        {step < 3 && passed && <button type="button" className="btn primary" onClick={goNext}>{tx('next')}</button>}
        {step === 3 && chart.made && <button type="button" className="btn primary" onClick={finish}><Flag size={16} aria-hidden="true" />{tx('finish')}</button>}
      </div>
    </div>
  )
}

function ChartView({ type, data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const short = (s, n = 12) => (s.length > n ? `${s.slice(0, n - 1)}.` : s)
  if (type === 'pie') {
    const total = data.reduce((a, d) => a + d.value, 0) || 1
    let angle = -Math.PI / 2
    const cx = 80, cy = 80, rad = 70
    const slices = data.map((d, i) => {
      const a0 = angle
      const a1 = angle + (d.value / total) * Math.PI * 2
      angle = a1
      const large = a1 - a0 > Math.PI ? 1 : 0
      const p = (a) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`
      const path = d.value >= total ? null : `M ${cx} ${cy} L ${p(a0)} A ${rad} ${rad} 0 ${large} 1 ${p(a1)} Z`
      return { ...d, path, color: PIE_COLORS[i % PIE_COLORS.length] }
    })
    return (
      <svg viewBox={`0 0 340 ${Math.max(170, data.length * 20 + 20)}`} className="sim-data-svg" role="img">
        {slices.map((s) => (s.path
          ? <path key={s.label} d={s.path} style={{ fill: s.color }} className="sim-data-slice" />
          : <circle key={s.label} cx={cx} cy={cy} r={rad} style={{ fill: s.color }} />))}
        {slices.map((s, i) => (
          <g key={`l${s.label}`} transform={`translate(176 ${16 + i * 20})`}>
            <rect width="10" height="10" y="-9" style={{ fill: s.color }} />
            <text x="16" className="sim-data-tl">{short(s.label)} {Math.round((s.value / total) * 100)}%</text>
          </g>
        ))}
      </svg>
    )
  }
  if (type === 'line') {
    const w = 340, h = 180, left = 8, right = 8, top = 16, bottom = 36
    const step = data.length > 1 ? (w - left - right) / (data.length - 1) : 0
    const pts = data.map((d, i) => [left + i * step + (data.length > 1 ? 0 : (w - left - right) / 2), top + (1 - d.value / max) * (h - top - bottom)])
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="sim-data-svg" role="img">
        <line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} className="sim-data-axis" />
        <polyline points={pts.map((p) => p.join(',')).join(' ')} className="sim-data-line" />
        {pts.map(([x, y], i) => (
          <g key={data[i].label}>
            <circle cx={x} cy={y} r="3" className="sim-data-dot" />
            <text x={x} y={h - bottom + 14} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="sim-data-tl">{short(data[i].label, 7)}</text>
          </g>
        ))}
      </svg>
    )
  }
  const rowH = 30, labelW = 96, valueW = 72, w = 340
  const barMax = w - labelW - valueW
  return (
    <svg viewBox={`0 0 ${w} ${data.length * rowH + 8}`} className="sim-data-svg" role="img">
      <line x1={labelW} x2={labelW} y1="0" y2={data.length * rowH + 8} className="sim-data-axis" />
      {data.map((d, i) => (
        <g key={d.label} transform={`translate(0 ${i * rowH + 4})`}>
          <text x={labelW - 6} y={rowH / 2 + 4} textAnchor="end" className="sim-data-tl">{short(d.label)}</text>
          <rect x={labelW} y="5" height={rowH - 10} width={Math.max(1, (d.value / max) * barMax)} className="sim-data-barrect" />
          <text x={labelW + (d.value / max) * barMax + 6} y={rowH / 2 + 4} className="sim-data-tv">{fmtNum(Math.round(d.value * 100) / 100)}</text>
        </g>
      ))}
    </svg>
  )
}
