'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { clients } from './getting-started-data';

export default function IntegrationGuides() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-primary mb-2">
        Integration Guides
      </h2>
      {clients.map((client, index) => {
        const Icon = client.icon;
        const isOpen = openId === client.id;
        return (
          <div
            key={client.id}
            className="rounded border border-border bg-panel/30 overflow-hidden"
          >
            <button
              onClick={() => setOpenId(isOpen ? null : client.id)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-surface/40 transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface">
                  <Icon className={`h-4 w-4 ${client.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{client.name}</h3>
                  <span className="text-[10px] text-text-dim">
                    ~{client.time} setup
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-text-secondary font-mono">
                  {index + 1}/{clients.length}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-text-dim" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-dim" />
                )}
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-border/50">
                <ol className="space-y-2.5 mt-4 mb-4">
                  {client.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-text-primary"
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-signal/10 text-[10px] font-bold text-signal">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                {client.note && (
                  <div className="rounded-lg bg-surface/30 px-4 py-2.5 text-xs text-text-dim italic">
                    {client.note}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
