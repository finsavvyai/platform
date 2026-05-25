import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import OnboardingChecklist from './OnboardingChecklist';
import PrereqStatus from './PrereqStatus';
import IntegrationGuides from './IntegrationGuides';

export const metadata = { title: 'Getting Started — OpenSyber' };

export default function GettingStartedPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-signal" />
          Getting Started
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Complete the checklist below, then connect your tools using the integration guides
        </p>
      </div>

      {/* Dynamic onboarding checklist */}
      <div className="mb-8">
        <OnboardingChecklist />
      </div>

      {/* Live prerequisite checks */}
      <PrereqStatus />

      {/* Collapsible integration guides */}
      <IntegrationGuides />

      {/* Bottom CTA */}
      <div className="mt-10 rounded border border-border bg-panel/30 p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">
          Need a platform we don&apos;t have yet?
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          OpenSyber&apos;s integration catalog is growing fast. Request an integration or build your own using the Skill SDK.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard/integrations"
            className="rounded-lg bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-signal-hover transition"
          >
            Browse All Integrations
          </Link>
          <Link
            href="/docs/skills"
            className="rounded-lg border border-wire px-5 py-2.5 text-sm font-medium text-text-primary hover:border-neutral-600 hover:text-white transition"
          >
            Build Your Own
          </Link>
        </div>
      </div>
    </div>
  );
}
