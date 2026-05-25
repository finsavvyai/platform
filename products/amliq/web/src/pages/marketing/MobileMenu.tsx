import { useNavigate } from 'react-router-dom'

interface Props { onClose: () => void }

const links = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Security', href: '/security' },
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
]

export default function MobileMenu({ onClose }: Props) {
  const navigate = useNavigate()
  const go = (path: string) => { navigate(path); onClose() }

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute top-[72px] left-3 right-3 rounded-2xl overflow-hidden bg-token-bg border border-[#E8E5DF] shadow-[0_20px_48px_rgba(26,24,20,0.12)]">
        <div className="p-2">
          {links.map(l => (
            <a key={l.label} href={l.href} onClick={onClose}
              className="flex items-center px-4 py-3.5 rounded-xl text-sm font-medium text-token-fg hover:bg-[#F4F3EF] min-h-[44px] transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="mx-4 h-px bg-[#E8E5DF]" />
        <div className="p-2">
          <button type="button" onClick={() => go('/login')}
            className="w-full px-4 py-3.5 rounded-xl text-sm font-medium text-[#5C5852] text-left cursor-pointer min-h-[44px] hover:bg-[#F4F3EF] transition-colors">
            Sign in
          </button>
        </div>
        <div className="px-3 pb-3">
          <button type="button"
            onClick={() => window.open('https://calendly.com/amliq', '_blank')}
            className="w-full text-center py-3.5 text-sm font-semibold rounded-xl bg-token-surface text-token-fg cursor-pointer min-h-[44px] hover:bg-[#2C2A25] transition-colors">
            Book a Demo
          </button>
        </div>
      </div>
    </div>
  )
}
