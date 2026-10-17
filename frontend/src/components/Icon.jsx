// Maps icon names stored in data (trades, concerns, activities, priorities) to lucide icons.
import {
  BookOpen, Briefcase, Brush, Camera, Car, CircleHelp, ClipboardList, FlaskConical, Flag, GraduationCap, Hammer, Hand,
  HeartHandshake, HeartPulse, IndianRupee, Keyboard, LifeBuoy, MapPin, MessageCircle, MessageSquare, Package, Palette,
  Phone, Plug, Puzzle, Scissors, Search, Shield, ShoppingBag, Siren, Snowflake, Sparkle, Store, Sun, Table, Users,
  Wallet, Wrench, Zap,
} from 'lucide-react'

const ICONS = {
  'book-open': BookOpen, briefcase: Briefcase, brush: Brush, camera: Camera, car: Car, 'circle-help': CircleHelp,
  'clipboard-list': ClipboardList, 'flask-conical': FlaskConical, flag: Flag, 'graduation-cap': GraduationCap,
  hammer: Hammer, hand: Hand, 'heart-handshake': HeartHandshake, 'heart-pulse': HeartPulse, 'indian-rupee': IndianRupee,
  keyboard: Keyboard, 'life-buoy': LifeBuoy, 'map-pin': MapPin, 'message-circle': MessageCircle,
  'message-square': MessageSquare, package: Package, palette: Palette, phone: Phone, plug: Plug, puzzle: Puzzle,
  scissors: Scissors, search: Search, shield: Shield, 'shopping-bag': ShoppingBag, siren: Siren, snowflake: Snowflake,
  sparkle: Sparkle, store: Store, sun: Sun, table: Table, users: Users, wallet: Wallet, wrench: Wrench, zap: Zap,
}

export default function Icon({ name, size = 18, ...rest }) {
  const C = ICONS[name] || MessageSquare
  return <C size={size} strokeWidth={1.75} aria-hidden {...rest} />
}

export function TradeIcon({ trade, size = 20, teal = false }) {
  return <span className={`trade-ico ${teal ? 'teal' : ''}`}><Icon name={trade?.icon} size={size} /></span>
}
