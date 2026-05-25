'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Lock } from 'lucide-react';
import type { NavItem, SidebarGroup } from './sidebar-config';
import { homeItem, sidebarGroups, bottomRailItems, allGroupHrefs } from './sidebar-config';

const LINK_CLS = [
  'flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm min-h-[44px]',
  'transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
].join(' ');

function isActive(href: string, pathname: string): boolean {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}

function activeCls(href: string, pathname: string): string {
  return isActive(href, pathname)
    ? 'nav-item-active text-signal font-medium'
    : 'text-text-secondary hover:bg-surface hover:text-text-primary';
}

interface Props {
  hasOrg: boolean;
  collapsed?: boolean;
}

export function SidebarNav({ hasOrg, collapsed }: Props) {
  const pathname = usePathname();

  const findActiveGroups = useCallback(() => {
    const ids = new Set<string>();
    for (const g of sidebarGroups) {
      if (allGroupHrefs(g).some((h) => isActive(h, pathname))) ids.add(g.id);
    }
    return ids;
  }, [pathname]);

  const [openIds, setOpenIds] = useState<Set<string>>(findActiveGroups);

  useEffect(() => {
    const active = findActiveGroups();
    queueMicrotask(() => setOpenIds((prev) => new Set([...prev, ...active])));
  }, [pathname, findActiveGroups]);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <nav className="flex flex-col flex-1 overflow-hidden" aria-label="Main navigation">
      <div className="px-3 pt-3">
        <NavLink item={homeItem} pathname={pathname} collapsed={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin">
        {sidebarGroups.map((group) => (
          <CollapsibleGroup
            key={group.id}
            group={group}
            isOpen={openIds.has(group.id)}
            isLocked={!!group.planGated && !hasOrg}
            pathname={pathname}
            collapsed={collapsed}
            onToggle={() => toggle(group.id)}
          />
        ))}
      </div>

      <div className="border-t border-border px-3 py-2 space-y-0.5">
        {bottomRailItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </nav>
  );
}

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`${LINK_CLS} ${activeCls(item.href, pathname)} ${collapsed ? 'justify-center px-0' : ''}`}
      aria-current={isActive(item.href, pathname) ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function CollapsibleGroup({
  group, isOpen, isLocked, pathname, collapsed, onToggle,
}: {
  group: SidebarGroup;
  isOpen: boolean;
  isLocked: boolean;
  pathname: string;
  collapsed?: boolean;
  onToggle: () => void;
}) {
  const GroupIcon = group.icon;
  const hasActiveChild = allGroupHrefs(group).some((h) => isActive(h, pathname));
  const totalItems = (group.items?.length ?? 0)
    + (group.subGroups?.reduce((n, sg) => n + (sg.items?.length ?? 0) + 1, 0) ?? 0);

  return (
    <div className="border-t border-border/50 pt-1 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={isLocked ? undefined : onToggle}
        className={[
          'group-header flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium min-h-[44px]',
          'transition-all duration-200',
          hasActiveChild ? 'text-signal bg-signal/[0.04]' : 'text-text-secondary',
          isLocked ? 'opacity-50 cursor-default' : 'hover:bg-surface cursor-pointer',
          collapsed ? 'justify-center px-0' : '',
        ].join(' ')}
        aria-expanded={isLocked ? undefined : isOpen}
        aria-disabled={isLocked || undefined}
        title={collapsed ? group.title : isLocked ? 'Upgrade to Team plan to unlock' : undefined}
      >
        <GroupIcon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{group.title}</span>
            {isLocked ? (
              <Lock className="h-3 w-3 text-text-dim" aria-label="Requires Team plan" />
            ) : (
              <ChevronRight
                className={`h-3.5 w-3.5 text-text-dim transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
              />
            )}
          </>
        )}
      </button>

      {!collapsed && (
        <div
          className="overflow-hidden transition-[max-height,opacity] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
          style={{
            maxHeight: isOpen ? `${totalItems * 44 + 16}px` : '0px',
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div className="pl-3 py-1 space-y-0.5">
            {group.items?.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
            {group.subGroups?.map((sg) => (
              <div key={sg.label} className="pt-1">
                <p className="px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-text-dim font-bold">
                  {sg.label}
                </p>
                {sg.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
