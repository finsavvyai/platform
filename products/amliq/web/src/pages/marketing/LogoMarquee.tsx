import { Shield, Globe, Database, Lock, FileCheck, Zap, Building2, Landmark } from 'lucide-react'

const sources = [
  { name: 'OFAC SDN', icon: Shield },
  { name: 'UN Sanctions', icon: Globe },
  { name: 'EU Consolidated', icon: Database },
  { name: 'UK OFSI', icon: Lock },
  { name: 'IL NBCTF', icon: Shield },
  { name: 'OpenSanctions', icon: Database },
  { name: 'PEP Lists', icon: FileCheck },
  { name: 'FATF Lists', icon: Landmark },
  { name: 'Swiss SECO', icon: Building2 },
  { name: '1M+ Entity records', icon: Zap },
]

function Badge({ name, icon: Icon }: { name: string; icon: typeof Shield }) {
  return (
    <div className="flex items-center gap-2 px-6 shrink-0 opacity-40 hover:opacity-80 transition-opacity">
      <Icon size={14} className="text-token-gold/60" />
      <span className="text-13 whitespace-nowrap text-slate-600">{name}</span>
    </div>
  )
}

export default function LogoMarquee() {
  return (
    <section className="py-10 overflow-hidden border-t border-slate-200">
      <p className="text-center text-12 uppercase tracking-widest mb-6 text-slate-600">
        Screening against global sanctions & watchlists
      </p>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10"
          style={{ background: 'linear-gradient(90deg, #0F172A, transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10"
          style={{ background: 'linear-gradient(270deg, #0F172A, transparent)' }} />
        <div className="flex items-center animate-marquee">
          {[...sources, ...sources].map((s, i) => (
            <Badge key={`${s.name}-${i}`} name={s.name} icon={s.icon} />
          ))}
        </div>
      </div>
    </section>
  )
}
