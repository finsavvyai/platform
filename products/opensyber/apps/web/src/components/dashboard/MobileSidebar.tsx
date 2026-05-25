'use client';

import { useState } from 'react';
import { Menu, X, Shield } from 'lucide-react';
import Link from 'next/link';
import { Portal } from '@/components/ui/Portal';
import { SidebarNav } from './SidebarNav';

interface MobileSidebarProps {
  hasOrg: boolean;
}

export function MobileSidebar({ hasOrg }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/80 px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-info" />
          <span className="font-bold">OpenSyber</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                  <Shield className="h-5 w-5 text-info" />
                  <span className="font-bold">OpenSyber</span>
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div onClick={() => setOpen(false)}>
                <SidebarNav hasOrg={hasOrg} />
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
