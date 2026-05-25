import { Menu } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import Logo from '../brand/Logo'

interface MobileHeaderProps {
  onMenuToggle: () => void
}

export function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="md:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4"
      style={{
        background: 'var(--dash-nav-bg)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        borderBottom: '0.5px solid var(--dash-border)',
      }}>
      <button type="button" onClick={onMenuToggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl
          transition-all cursor-pointer active:scale-90"
        style={{ color: 'var(--dash-text-secondary)' }}>
        <Menu className="w-5 h-5" />
      </button>

      <Logo size={22} />

      <NotificationBell />
    </header>
  )
}
