const COLS = 'ABCDEF'

export class FormulaError extends Error {
  constructor(code, message) {
    super(message || code)
    this.code = code
  }
}

function tokenize(src) {
  const tokens = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+(\.\d+)?|\.\d+)/.exec(src.slice(i))
      if (!m) throw new FormulaError('#ERROR', 'bad number')
      tokens.push({ t: 'num', v: parseFloat(m[0]) })
      i += m[0].length
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      const m = /^[A-Za-z]+\d*/.exec(src.slice(i))
      const word = m[0].toUpperCase()
      i += m[0].length
      const ref = /^([A-Z])(\d+)$/.exec(word)
      if (ref) {
        if (!COLS.includes(ref[1]) || +ref[2] < 1) throw new FormulaError('#ERROR', 'bad reference')
        tokens.push({ t: 'ref', col: ref[1], row: +ref[2] })
      } else if (word === 'SUM') {
        tokens.push({ t: 'fn', v: word })
      } else {
        throw new FormulaError('#ERROR', `unknown name ${word}`)
      }
      continue
    }
    if ('+-*/(),:'.includes(ch)) { tokens.push({ t: ch }); i++; continue }
    throw new FormulaError('#ERROR', `unexpected ${ch}`)
  }
  return tokens
}

export function parseFormula(text) {
  const src = String(text ?? '').trim()
  if (!src.startsWith('=')) throw new FormulaError('#ERROR', 'formula must start with =')
  const tokens = tokenize(src.slice(1))
  let pos = 0
  const peek = () => tokens[pos]
  const take = (type) => {
    const tok = tokens[pos]
    if (!tok || (type && tok.t !== type)) throw new FormulaError('#ERROR', `expected ${type || 'token'}`)
    pos++
    return tok
  }

  const expr = () => {
    let node = term()
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = take().t
      node = { k: 'bin', op, a: node, b: term() }
    }
    return node
  }
  const term = () => {
    let node = unary()
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = take().t
      node = { k: 'bin', op, a: node, b: unary() }
    }
    return node
  }
  const unary = () => {
    if (peek() && (peek().t === '-' || peek().t === '+')) {
      const op = take().t
      const a = unary()
      return op === '-' ? { k: 'neg', a } : a
    }
    return primary()
  }
  const primary = () => {
    const tok = peek()
    if (!tok) throw new FormulaError('#ERROR', 'unexpected end')
    if (tok.t === 'num') { pos++; return { k: 'num', v: tok.v } }
    if (tok.t === 'ref') {
      pos++
      if (peek() && peek().t === ':') throw new FormulaError('#ERROR', 'range outside SUM')
      return { k: 'ref', col: tok.col, row: tok.row }
    }
    if (tok.t === 'fn') {
      pos++
      take('(')
      const args = [arg()]
      while (peek() && peek().t === ',') { pos++; args.push(arg()) }
      take(')')
      return { k: 'sum', args }
    }
    if (tok.t === '(') {
      pos++
      const node = expr()
      take(')')
      return node
    }
    throw new FormulaError('#ERROR', `unexpected ${tok.t}`)
  }
  const arg = () => {
    const a = peek(), b = tokens[pos + 1], c = tokens[pos + 2]
    if (a && a.t === 'ref' && b && b.t === ':' ) {
      if (!c || c.t !== 'ref') throw new FormulaError('#ERROR', 'bad range')
      pos += 3
      return { k: 'range', from: a, to: c }
    }
    return expr()
  }

  if (!tokens.length) throw new FormulaError('#ERROR', 'empty formula')
  const ast = expr()
  if (pos !== tokens.length) throw new FormulaError('#ERROR', 'unexpected trailing input')
  return ast
}

// getCell(col, row) -> number | string | null; may throw FormulaError (e.g. #REF for cycles)
export function evaluate(ast, getCell) {
  const num = (v) => {
    if (v === null || v === undefined || v === '') return 0
    if (typeof v === 'number') return v
    throw new FormulaError('#VALUE')
  }
  const run = (n) => {
    switch (n.k) {
      case 'num': return n.v
      case 'ref': return num(getCell(n.col, n.row))
      case 'neg': return -run(n.a)
      case 'bin': {
        const a = run(n.a), b = run(n.b)
        if (n.op === '+') return a + b
        if (n.op === '-') return a - b
        if (n.op === '*') return a * b
        if (b === 0) throw new FormulaError('#DIV/0')
        return a / b
      }
      case 'sum': {
        let total = 0
        for (const a of n.args) {
          if (a.k !== 'range') { total += run(a); continue }
          const c1 = COLS.indexOf(a.from.col), c2 = COLS.indexOf(a.to.col)
          const r1 = Math.min(a.from.row, a.to.row), r2 = Math.max(a.from.row, a.to.row)
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            for (let r = r1; r <= r2; r++) {
              const v = getCell(COLS[c], r)
              if (typeof v === 'number') total += v
            }
          }
        }
        return total
      }
      default: throw new FormulaError('#ERROR')
    }
  }
  return run(ast)
}

export function collectRefs(ast, out = []) {
  if (!ast) return out
  if (ast.k === 'ref') out.push(ast)
  if (ast.k === 'range') out.push(ast.from, ast.to)
  if (ast.a) collectRefs(ast.a, out)
  if (ast.b) collectRefs(ast.b, out)
  if (ast.args) ast.args.forEach((a) => collectRefs(a, out))
  return out
}

export function shiftRows(formula, delta) {
  return String(formula).replace(/\b([A-Fa-f])(\d+)\b/g, (_, c, r) => `${c.toUpperCase()}${Math.max(1, +r + delta)}`)
}
