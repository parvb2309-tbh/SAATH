import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'

// Sequential single-hue (orange) ramp: light = low resistance, dark = high resistance.
export const RESIST_RAMP = [
  { max: 30, color: '#fbd5b5', label: '< 30%' },
  { max: 40, color: '#f6ab74', label: '30–40%' },
  { max: 50, color: '#e8833a', label: '40–50%' },
  { max: 60, color: '#bb5a17', label: '50–60%' },
  { max: 101, color: '#7a3508', label: '≥ 60%' },
]
export const resistColor = (v) => (v === null || v === undefined ? '#c9ced6' : RESIST_RAMP.find((s) => v < s.max).color)

export default function DistrictMap({ districts, concerns }) {
  return (
    <div className="map-wrap">
      <MapContainer center={[25.2, 80.6]} zoom={6} scrollWheelZoom={false} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.map((d) => (
          <CircleMarker
            key={d.id}
            center={[d.lat, d.lng]}
            radius={8 + Math.sqrt(d.sessions || 0) * 2.2}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: resistColor(d.resistance), fillOpacity: 0.92 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{d.name_en}</strong>, {d.state}<br />
              Resistance: <strong>{d.resistance ?? '—'}%</strong> of {d.sessions} families<br />
              Top worry: {d.top_concern ? `${concerns[d.top_concern].icon} ${concerns[d.top_concern].en}` : '—'}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend" aria-label="Legend">
        <div className="legend-title">Family resistance</div>
        {RESIST_RAMP.map((s) => (
          <div key={s.label} className="legend-row"><span className="swatch" style={{ background: s.color }} />{s.label}</div>
        ))}
        <div className="legend-note">Circle size = number of families</div>
      </div>
    </div>
  )
}
