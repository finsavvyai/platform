'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Cpu, ShieldCheck, Scale, MoreHorizontal, X } from 'lucide-react';
import { sidebarGroups, bottomRailItems, allGroupHrefs } from './sidebar-config';
import type { NavItem } from './sidebar-config';

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, groupId: null },
  { href: '/dashboard/agents', label: 'Agent', icon: Cpu, groupId: 'agent' },
  { href: '/dashboard/security', label: 'Security', icon: ShieldCheck, groupId: 'security' },
  { href: '/dashboard/oasf', label: 'Gov', icon: Scale, groupId: 'governance' },
] as const;

function isTabActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  const group = sidebarGroups.find((g) =>
    allGroupHrefs(g).some((h) => pathname.startsWith(h)),
  );
  if (href === '/dashboard/agents' && group?.id === 'agent') return true;
  if (href === '/dashboard/security' && group?.id === 'security') return true;
  if (href === '/dashboard/oasf' && group?.id === 'governance') return true;
  return false;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden sidebar-glass border-t border-white/[0.06] pb-[env(safe-area-inset-bottom,0px)]"
        style={{ minHeight: 49 }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-full px-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center transition-colors active:scale-95 ${
                  active ? 'text-signal' : 'text-text-dim active:text-text-primary'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium leading-tight">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center text-text-dim active:text-text-primary transition-colors"
            aria-label="More navigation options"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Full-screen "More" sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSheetOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-2xl sidebar-glass border-t border-white/[0.08] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Navigation</h2>
              <button
                onClick={() => setSheetOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/[0.06]"
              >
                <X className="h-5 w-5 text-text-secondary" />
              </button>
            </div>
            {sidebarGroups.map((group) => (
              <div key={group.id} className="mb-5">
                <p className="text-[11px] uppercase tracking-wider text-text-dim font-semibold mb-2 px-1">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items?.map((item) => (
                    <SheetLink key={item.href} item={item} pathname={pathname} close={() => setSheetOpen(false)} />
                  ))}
                  {group.subGroups?.map((sg) =>
                    sg.items.map((item) => (
                      <SheetLink key={item.href} item={item} pathname={pathname} close={() => setSheetOpen(false)} />
                    )),
                  )}
                </div>
              </div>
            ))}
            <div className="border-t border-white/[0.06] pt-4 space-y-0.5">
              {bottomRailItems.map((item) => (
                <SheetLink key={item.href} item={item} pathname={pathname} close={() => setSheetOpen(false)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SheetLink({ item, pathname, close }: { item: NavItem; pathname: string; close: () => void }) {
  const Icon = item.icon;
  const active = pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={close}
      className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 min-h-[44px] text-sm ${
        active ? 'nav-item-active text-signal font-medium' : 'text-text-primary'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}
