import { useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { RAMPS, SUPPRESSED, bucket } from './DistrictMap'

const NO_DATA = '#EEF2F6'
const BOUNDS = [[7.5, 68.2], [36.5, 97.4]]
let cache = null

// Leaflet measures its container once; re-fit after layout so the whole country shows at any size.
function FitIndia() {
  const map = useMap()
  useEffect(() => {
    const fit = () => {
      map.invalidateSize()
      const { x, y } = map.getSize()
      if (x > 50 && y > 50) map.fitBounds(BOUNDS, { padding: [4, 4] })
    }
    const id = setTimeout(() => map.whenReady(fit), 50)
    window.addEventListener('resize', fit)
    return () => { clearTimeout(id); window.removeEventListener('resize', fit) }
  }, [map])
  return null
}

// State choropleth drawn from boundary data only (no base tiles). values: { [stateName]: number|null }
export default function IndiaMap({ values, suppressed, pilot, selected, onSelect, format, legendTitle, metricKey }) {
  const [geo, setGeo] = useState(cache)
  const layer = useRef(null)
  useEffect(() => {
    if (!cache) fetch('/geo/india_states.geojson').then((r) => r.json()).then((g) => { cache = g; setGeo(g) })
  }, [])

  const breaks = useMemo(() => {
    const v = Object.values(values).filter((x) => x !== null && x !== undefined).sort((a, b) => a - b)
    const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))] ?? 0
    return [q(0.2), q(0.4), q(0.6), q(0.8)]
  }, [values])
  const colorOf = (name) => {
    if (suppressed.has(name)) return SUPPRESSED
    const v = values[name]
    return v === null || v === undefined ? NO_DATA : RAMPS.teal[bucket(v, breaks)]
  }
  const style = (f) => {
    const name = f.properties.name
    const isSel = name === selected
    return {
      fillColor: colorOf(name), fillOpacity: 1, color: isSel ? '#F2A541' : pilot.has(name) ? '#17324D' : '#FFFFFF',
      weight: isSel ? 3 : pilot.has(name) ? 2 : 1,
    }
  }
  const onEach = (f, l) => {
    const name = f.properties.name
    const v = values[name]
    l.bindTooltip(`<strong>${name}</strong><br/>${suppressed.has(name) ? 'Fewer than 50 users: hidden' : v === undefined || v === null ? 'No users yet' : format(v)}${pilot.has(name) ? '<br/><em>Pilot state</em>' : ''}`, { sticky: true })
    l.on({ click: () => onSelect(name), mouseover: () => l.setStyle({ weight: 3, color: '#F2A541' }), mouseout: () => layer.current?.resetStyle(l) })
  }
  const fmtBreak = (x) => (x >= 100 ? Math.round(x).toString() : x.toFixed(x < 10 ? 1 : 0))

  return (
    <div className="map-wrap">
      {!geo ? <div className="india-map loading">…</div> : (
        <MapContainer bounds={BOUNDS} boundsOptions={{ padding: [4, 4] }} zoomSnap={0.1} scrollWheelZoom={false} className="india-map"
          attributionControl={false} zoomControl>
          <FitIndia />
          <GeoJSON key={`${metricKey}-${selected}`} ref={layer} data={geo} style={style} onEachFeature={onEach} />
        </MapContainer>
      )}
      <div className="map-legend india-legend" aria-label="Legend">
        <div className="legend-title">{legendTitle}</div>
        {RAMPS.teal.map((c, i) => (
          <div key={c} className="legend-row"><span className="swatch" style={{ background: c }} />
            {i === 0 ? `< ${fmtBreak(breaks[0])}` : i === 4 ? `≥ ${fmtBreak(breaks[3])}` : `${fmtBreak(breaks[i - 1])}–${fmtBreak(breaks[i])}`}</div>
        ))}
        <div className="legend-row"><span className="swatch" style={{ background: SUPPRESSED }} />Fewer than 50 users</div>
        <div className="legend-row"><span className="swatch" style={{ background: '#fff', outline: '2px solid #17324D', outlineOffset: -2 }} />Pilot state</div>
      </div>
    </div>
  )
}
