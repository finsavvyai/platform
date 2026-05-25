'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';

interface Props {
  skillName: string;
}

export function ActivateStep({ skillName }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded border border-green-500/20 bg-green-500/5 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mx-auto mb-4">
          <Check className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{skillName} is Active</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          The skill is now running on your agent instance. Security events matching its criteria will be processed automatically.
        </p>
      </div>

      <div className="flex gap-3 justify-center">
        <Link
          href="/dashboard/skills"
          className="rounded-lg bg-signal px-6 py-3 text-sm font-medium text-white hover:bg-signal-hover transition"
        >
          View All Skills
        </Link>
        <Link
          href="/dashboard/marketplace"
          className="rounded-lg border border-wire px-6 py-3 text-sm hover:bg-surface transition"
        >
          Install More Skills
        </Link>
      </div>
    </div>
  );
}
