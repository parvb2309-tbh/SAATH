// Flat illustrations for career stories: one scene per trade, with a figure drawn to match the story's learner.
// Drawn in the app palette so they need no downloads and work offline.
const C = {
  navy: '#17324D', teal: '#087F8C', bright: '#19B5A5', saffron: '#F2A541', sky: '#E3F2F3', disc: '#CDE8EA',
  ground: '#C9DFE2', white: '#FFFFFF', line: '#9FB3BF', grey: '#D9DFE7', red: '#C43D4B',
}
const SKIN = ['#C68642', '#A86B3C', '#8D5524', '#B9784A']
const OUTFIT = {
  solar: ['#2F5FAE', '#17324D'], electrician: ['#3C6E71', '#17324D'], gda: ['#19B5A5', '#17324D'],
  ac_tech: ['#2F5FAE', '#2B3A4A'], tailoring: ['#C9821F', '#6B3FA0'], beauty: ['#B4446C', '#2B3A4A'],
  auto_tech: ['#3C4F63', '#22313F'], retail: ['#087F8C', '#2B3A4A'], data_entry: ['#5A4FB0', '#2B3A4A'],
}
const HAT = { solar: C.saffron, electrician: C.saffron, auto_tech: '#C43D4B' }

function hash(s) {
  return [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
}

function Person({ x, gender, trade, seed }) {
  const skin = SKIN[seed % SKIN.length]
  const [top, bottom] = OUTFIT[trade] || OUTFIT.retail
  const f = gender === 'f'
  const hat = HAT[trade]
  return (
    <g>
      {/* legs and shoes */}
      <rect x={x - 15} y={150} width={12} height={52} rx={3} fill={bottom} />
      <rect x={x + 3} y={150} width={12} height={52} rx={3} fill={bottom} />
      <rect x={x - 18} y={199} width={16} height={7} rx={3} fill={C.navy} />
      <rect x={x + 2} y={199} width={16} height={7} rx={3} fill={C.navy} />
      {/* long hair behind the shoulders */}
      {f && <path d={`M${x - 19} 70 Q${x - 24} 112 ${x - 16} 126 L${x + 16} 126 Q${x + 24} 112 ${x + 19} 70 Z`} fill="#1E1A18" />}
      {/* torso: kurta for girls, shirt for boys */}
      <rect x={x - 24} y={92} width={48} height={f ? 80 : 64} rx={11} fill={top} />
      {f && <path d={`M${x - 24} 104 L${x + 24} 140 L${x + 24} 150 L${x - 24} 114 Z`} fill={C.saffron} opacity="0.85" />}
      {/* arms: left down, right reaching towards the work */}
      <rect x={x - 33} y={96} width={11} height={50} rx={5} fill={top} />
      <circle cx={x - 27.5} cy={148} r={6} fill={skin} />
      <g transform={`rotate(-62 ${x + 24} 100)`}>
        <rect x={x + 18} y={96} width={11} height={52} rx={5} fill={top} />
        <circle cx={x + 23.5} cy={150} r={6} fill={skin} />
      </g>
      {/* neck, head, face */}
      <rect x={x - 5} y={80} width={10} height={14} fill={skin} />
      <circle cx={x} cy={68} r={18} fill={skin} />
      <circle cx={x - 6} cy={67} r={1.8} fill={C.navy} />
      <circle cx={x + 6} cy={67} r={1.8} fill={C.navy} />
      <path d={`M${x - 5} 75 Q${x} 79 ${x + 5} 75`} stroke={C.navy} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* hair or helmet */}
      {hat ? (
        <g>
          <path d={`M${x - 20} 62 Q${x} 36 ${x + 20} 62 Z`} fill={hat} />
          <rect x={x - 23} y={59} width={46} height={6} rx={3} fill={hat} />
        </g>
      ) : f ? (
        <path d={`M${x - 19} 66 Q${x - 18} 46 ${x} 47 Q${x + 18} 46 ${x + 19} 66 Q${x + 8} 55 ${x - 2} 56 Q${x - 12} 57 ${x - 19} 66 Z`} fill="#1E1A18" />
      ) : (
        <path d={`M${x - 18} 64 Q${x - 16} 47 ${x} 47 Q${x + 16} 47 ${x + 18} 62 Q${x + 4} 54 ${x - 18} 64 Z`} fill="#1E1A18" />
      )}
      {f && hat && <path d={`M${x - 18} 64 Q${x - 22} 96 ${x - 14} 104 L${x - 10} 70 Z`} fill="#1E1A18" />}
    </g>
  )
}

const PROPS = {
  solar: (
    <g>
      <circle cx="300" cy="46" r="18" fill={C.saffron} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1={300 + 25 * Math.cos((a * Math.PI) / 180)} y1={46 + 25 * Math.sin((a * Math.PI) / 180)}
          x2={300 + 32 * Math.cos((a * Math.PI) / 180)} y2={46 + 32 * Math.sin((a * Math.PI) / 180)} stroke={C.saffron} strokeWidth="3" strokeLinecap="round" />
      ))}
      <rect x="236" y="150" width="5" height="54" fill={C.line} />
      <rect x="300" y="132" width="5" height="72" fill={C.line} />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${200 + i * 66} ${118 - i * 4})`}>
          <path d="M0 40 L56 22 L64 52 L8 70 Z" fill={C.navy} />
          <path d="M19 34 L27 64 M38 28 L46 58 M4 55 L60 37" stroke={C.bright} strokeWidth="1.4" />
        </g>
      ))}
    </g>
  ),
  electrician: (
    <g>
      <rect x="214" y="70" width="98" height="118" rx="6" fill={C.white} stroke={C.navy} strokeWidth="3" />
      <rect x="226" y="84" width="74" height="18" rx="3" fill={C.grey} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={232 + i * 17} y="87" width="9" height="12" rx="2" fill={i === 1 ? C.red : C.navy} />)}
      {[0, 1].map((i) => <rect key={i} x={234 + i * 34} y="116" width="24" height="30" rx="4" fill={C.sky} stroke={C.navy} strokeWidth="2" />)}
      <circle cx="246" cy="131" r="5" fill={C.teal} /><circle cx="280" cy="131" r="5" fill={C.saffron} />
      <path d="M263 188 Q250 214 196 172" stroke={C.saffron} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="263" cy="40" r="12" fill="#FFE7B0" /><rect x="258" y="50" width="10" height="8" fill={C.line} />
      <path d="M263 20 V12 M281 26 L287 20 M245 26 L239 20" stroke={C.saffron} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  gda: (
    <g>
      <rect x="290" y="30" width="34" height="34" rx="4" fill={C.white} />
      <path d="M307 37 V57 M297 47 H317" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
      <rect x="208" y="78" width="104" height="70" rx="6" fill={C.navy} />
      <polyline points="216,116 236,116 244,98 254,132 262,108 270,116 304,116" fill="none" stroke={C.bright} strokeWidth="3" strokeLinejoin="round" />
      <rect x="254" y="148" width="10" height="40" fill={C.line} />
      <rect x="232" y="186" width="56" height="8" rx="4" fill={C.line} />
      <rect x="186" y="128" width="22" height="30" rx="3" fill={C.white} stroke={C.navy} strokeWidth="2" />
      <path d="M191 138 H203 M191 145 H203 M191 152 H199" stroke={C.line} strokeWidth="2" />
    </g>
  ),
  ac_tech: (
    <g>
      <rect x="204" y="52" width="122" height="46" rx="10" fill={C.white} stroke={C.navy} strokeWidth="3" />
      <path d="M216 86 H314" stroke={C.line} strokeWidth="3" />
      <circle cx="306" cy="66" r="4" fill={C.bright} />
      {[0, 1, 2].map((i) => <path key={i} d={`M${228 + i * 34} 108 q8 10 0 20 q-8 10 0 20`} stroke={C.bright} strokeWidth="3" fill="none" strokeLinecap="round" />)}
      <rect x="250" y="168" width="64" height="36" rx="4" fill={C.saffron} />
      <rect x="272" y="160" width="20" height="10" rx="3" fill="none" stroke={C.navy} strokeWidth="3" />
      <path d="M250 182 H314" stroke={C.navy} strokeWidth="2" />
    </g>
  ),
  tailoring: (
    <g>
      <rect x="196" y="150" width="140" height="10" rx="3" fill="#8C6A4F" />
      <rect x="206" y="160" width="8" height="44" fill="#8C6A4F" /><rect x="318" y="160" width="8" height="44" fill="#8C6A4F" />
      <path d="M226 150 V108 Q226 96 238 96 H300 Q312 96 312 108 V122 H292 V112 H246 V150 Z" fill={C.navy} />
      <rect x="282" y="122" width="8" height="22" fill={C.line} />
      <circle cx="300" cy="104" r="6" fill={C.bright} />
      <path d="M200 150 Q240 136 270 150" fill={C.teal} />
      <rect x="318" y="126" width="12" height="24" rx="2" fill={C.saffron} />
      <path d="M216 72 Q240 60 262 72" stroke={C.saffron} strokeWidth="3" fill="none" strokeDasharray="5 4" />
    </g>
  ),
  beauty: (
    <g>
      <ellipse cx="262" cy="104" rx="44" ry="58" fill={C.white} stroke={C.saffron} strokeWidth="6" />
      {[...Array(8)].map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <circle key={i} cx={262 + 54 * Math.cos(a)} cy={104 + 68 * Math.sin(a)} r="4" fill="#FFE7B0" />
      })}
      <rect x="214" y="170" width="96" height="10" rx="3" fill="#8C6A4F" />
      <rect x="228" y="152" width="10" height="18" rx="3" fill="#B4446C" />
      <rect x="244" y="146" width="8" height="24" rx="3" fill={C.bright} />
      <rect x="280" y="156" width="20" height="14" rx="3" fill={C.navy} />
      <path d="M186 118 L200 104" stroke={C.navy} strokeWidth="4" strokeLinecap="round" /><circle cx="203" cy="101" r="5" fill="#B4446C" />
    </g>
  ),
  auto_tech: (
    <g>
      <path d="M206 168 Q212 128 252 126 L286 126 L300 104 L314 104 L306 132 Q330 140 332 168 Z" fill={C.teal} />
      <rect x="244" y="116" width="40" height="10" rx="5" fill={C.navy} />
      <circle cx="228" cy="178" r="22" fill={C.navy} /><circle cx="228" cy="178" r="9" fill={C.grey} />
      <circle cx="312" cy="178" r="22" fill={C.navy} /><circle cx="312" cy="178" r="9" fill={C.grey} />
      <path d="M186 110 L206 92" stroke={C.line} strokeWidth="6" strokeLinecap="round" />
      <circle cx="209" cy="89" r="7" fill="none" stroke={C.line} strokeWidth="4" />
    </g>
  ),
  retail: (
    <g>
      <rect x="214" y="40" width="112" height="6" fill={C.line} /><rect x="214" y="80" width="112" height="6" fill={C.line} />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={218 + i * 22} y={i % 2 ? 22 : 26} width="16" height={i % 2 ? 18 : 14} rx="2" fill={[C.saffron, C.teal, '#B4446C', C.bright, C.navy][i]} />)}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={222 + i * 26} y={i % 2 ? 62 : 66} width="20" height={i % 2 ? 18 : 14} rx="2" fill={[C.teal, C.saffron, C.navy, '#B4446C'][i]} />)}
      <rect x="196" y="132" width="140" height="72" rx="4" fill={C.navy} />
      <rect x="282" y="104" width="40" height="28" rx="3" fill={C.white} stroke={C.navy} strokeWidth="3" />
      <path d="M290 114 H314 M290 121 H306" stroke={C.bright} strokeWidth="3" />
      <rect x="214" y="120" width="26" height="12" rx="2" fill={C.saffron} />
    </g>
  ),
  data_entry: (
    <g>
      <rect x="196" y="150" width="140" height="9" rx="3" fill="#8C6A4F" />
      <rect x="206" y="159" width="8" height="45" fill="#8C6A4F" /><rect x="318" y="159" width="8" height="45" fill="#8C6A4F" />
      <rect x="226" y="88" width="92" height="58" rx="5" fill={C.navy} />
      <rect x="232" y="94" width="80" height="46" rx="2" fill={C.white} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={240 + i * 18} y={134 - [14, 26, 20, 36][i]} width="11" height={[14, 26, 20, 36][i]} fill={i === 3 ? C.saffron : C.teal} />)}
      <path d="M214 146 H330 L322 150 H222 Z" fill={C.line} />
      <rect x="300" y="136" width="14" height="14" rx="3" fill={C.saffron} />
    </g>
  ),
}

export default function StoryScene({ trade, gender = 'f', seedKey = '', className = '' }) {
  const seed = hash(seedKey || trade)
  return (
    <svg viewBox="0 0 360 240" className={`story-scene ${className}`} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect width="360" height="240" fill={C.sky} />
      <circle cx="268" cy="104" r="96" fill={C.disc} />
      <rect y="204" width="360" height="36" fill={C.ground} />
      {PROPS[trade] || PROPS.retail}
      <Person x={136} gender={gender} trade={trade} seed={seed} />
    </svg>
  )
}
