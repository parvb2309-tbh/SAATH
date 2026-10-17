import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Sequential single-hue ramps (light = low, dark = high).
export const RAMPS = {
  orange: ['#fbe3c7', '#f6c48a', '#f2a541', '#c9821f', '#8f5a10'],
  teal: ['#d3eef0', '#9fd9dd', '#4fb6bd', '#087f8c', '#05505a'],
}
export const SUPPRESSED = '#c3ccd7'

export function bucket(value, breaks) {
  if (value === null || value === undefined) return -1
  const i = breaks.findIndex((b) => value < b)
  return i === -1 ? breaks.length : i
}

// districts: [{ id, lat, lng, ... }]; colorOf/sizeOf/tip are per-district callbacks.
export default function DistrictMap({ districts, colorOf, sizeOf, tip, legend, height }) {
  return (
    <div className="map-wrap">
      <MapContainer center={[25.2, 80.6]} zoom={6} scrollWheelZoom={false} className="map" style={height ? { height } : undefined}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.map((d) => (
          <CircleMarker key={d.id} center={[d.lat, d.lng]} radius={sizeOf ? sizeOf(d) : 12}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: colorOf(d), fillOpacity: 0.95 }}>
            <Tooltip direction="top" offset={[0, -6]}>{tip(d)}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {legend && (
        <div className="map-legend" aria-label="Legend">
          <div className="legend-title">{legend.title}</div>
          {legend.rows.map((r) => <div key={r.label} className="legend-row"><span className="swatch" style={{ background: r.color }} />{r.label}</div>)}
          {legend.note && <div className="legend-note">{legend.note}</div>}
        </div>
      )}
    </div>
  )
}
