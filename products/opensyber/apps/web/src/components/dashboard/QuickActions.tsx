'use client';

import Link from 'next/link';
import { Rocket, Package, Shield, Brain } from 'lucide-react';

const ACTIONS = [
  { label: 'Deploy Agent', description: 'Launch a secure AI container', href: '/dashboard', icon: Rocket, color: 'bg-info/10 text-info' },
  { label: 'Browse Skills', description: 'Install from the marketplace', href: '/dashboard/marketplace', icon: Package, color: 'bg-purple-500/10 text-purple-400' },
  { label: 'View Security', description: 'Check your security posture', href: '/dashboard/security', icon: Shield, color: 'bg-green-500/10 text-green-400' },
  { label: 'AI Query', description: 'Ask about your environment', href: '/dashboard/ai/query', icon: Brain, color: 'bg-amber-500/10 text-amber-400' },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {ACTIONS.map(({ label, description, href, icon: Icon, color }) => (
        <Link
          key={label}
          href={href}
          className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 hover:bg-neutral-800/50 hover:border-neutral-700 transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.98]"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color} mb-3 group-hover:scale-105 transition-transform`}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        </Link>
      ))}
    </div>
  );
}
