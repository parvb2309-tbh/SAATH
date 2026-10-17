// RIASEC hexagon: one axis per Holland letter, the filled shape is the student's normalised interest vector.
const ORDER = ['R', 'I', 'A', 'S', 'E', 'C']

export default function Hexagon({ riasec, labels, lang = 'en', size = 300, compare }) {
  const c = size / 2
  const r = c - 44
  const max = Math.max(0.34, ...ORDER.map((d) => riasec?.[d] || 0), ...ORDER.map((d) => compare?.[d] || 0))
  const pt = (i, v) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]
  }
  const poly = (vec) => ORDER.map((d, i) => pt(i, (vec?.[d] || 0) / max).join(',')).join(' ')
  const top = riasec ? ORDER.reduce((a, b) => ((riasec[a] || 0) >= (riasec[b] || 0) ? a : b)) : null
  return (
    <svg className="hexagon" viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={ORDER.map((d) => `${labels?.[d]?.[lang] ?? d} ${Math.round(100 * (riasec?.[d] || 0))}%`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} className="grid" points={ORDER.map((_, i) => pt(i, f).join(',')).join(' ')} />)}
      {ORDER.map((d, i) => <line key={d} className="axis" x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} />)}
      {compare && <polygon points={poly(compare)} fill="none" stroke="var(--saffron)" strokeWidth="2" strokeDasharray="4 3" />}
      {riasec && <polygon className="area" points={poly(riasec)} />}
      {ORDER.map((d, i) => {
        const [x, y] = pt(i, 1.2)
        return (
          <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className={d === top ? 'dim-top' : ''}>
            <tspan x={x} dy="-0.5em" fontWeight="700">{d}</tspan>
            <tspan x={x} dy="1.2em">{labels?.[d]?.[`short_${lang}`] ?? ''}</tspan>
          </text>
        )
      })}
    </svg>
  )
}
