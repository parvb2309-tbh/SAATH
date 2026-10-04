// Shows which engine is answering: Gemini, or the offline rule-based engine.
export default function EngineBadge({ engine, compact = false }) {
  if (typeof engine === 'string') {
    const gem = engine.startsWith('gemini')
    const label = engine === 'gemini+guard' ? 'Gemini → number guard → template' : gem ? 'Gemini' : engine === 'template' ? 'Template' : 'Offline engine'
    return <span className={`engine ${gem ? 'gem' : 'off'} ${compact ? 'compact' : ''}`} title={engine}>{label}</span>
  }
  const on = engine?.available
  const title = engine?.configured
    ? on ? `Gemini (${engine.model})` : `Gemini paused: ${engine.last_error || 'rate limit'}`
    : 'No GEMINI_API_KEY set: using the offline rule-based engine'
  return (
    <span className={`engine ${on ? 'gem' : 'off'}`} title={title}>
      <span className="dot" />
      {on ? `Gemini · ${engine.model}` : 'Offline engine'}
    </span>
  )
}
