import Link from 'next/link';
import { Package, Plus, Star } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import type { SkillCategory, VerificationStatus } from '@opensyber/shared';
import { SKILL_CATEGORY_LABELS } from '@opensyber/shared';

export const metadata = { title: 'My Published Skills' };

interface PublishedSkill {
  id: string;
  name: string;
  slug: string;
  category: SkillCategory;
  currentVersion: string | null;
  verificationStatus: VerificationStatus;
  installCount: number;
  ratingAvg: number;
  ratingCount: number;
}

const statusStyles: Record<string, string> = {
  approved: 'bg-green-500/10 text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
  scanning: 'bg-yellow-500/10 text-yellow-400',
  reviewing: 'bg-info/10 text-info',
  rejected: 'bg-red-500/10 text-red-400',
  revoked: 'bg-red-500/10 text-red-400',
};

export default async function MySkillsPage() {
  let skills: PublishedSkill[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ data: PublishedSkill[] }>(
        '/api/marketplace/my-skills',
        { token },
      );
      skills = data.data ?? [];
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Published Skills</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage skills you have published to the marketplace
          </p>
        </div>
        <Link
          href="/dashboard/skills/submit"
          className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium hover:bg-info transition"
        >
          <Plus className="h-4 w-4" />
          Submit New Skill
        </Link>
      </div>

      {skills.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-400">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Version</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Installs</th>
                <th className="px-6 py-3 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {skills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill }: { skill: PublishedSkill }) {
  const badgeClass = statusStyles[skill.verificationStatus] ?? statusStyles.pending;
  return (
    <tr className="hover:bg-neutral-800/30 transition">
      <td className="px-6 py-4">
        <Link
          href={`/marketplace/${skill.slug}`}
          className="font-medium hover:text-info transition"
        >
          {skill.name}
        </Link>
      </td>
      <td className="px-6 py-4 text-neutral-400">
        {SKILL_CATEGORY_LABELS[skill.category] ?? skill.category}
      </td>
      <td className="px-6 py-4 font-mono text-xs">
        {skill.currentVersion ?? 'N/A'}
      </td>
      <td className="px-6 py-4">
        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${badgeClass}`}>
          {skill.verificationStatus}
        </span>
      </td>
      <td className="px-6 py-4 text-neutral-400">{skill.installCount}</td>
      <td className="px-6 py-4">
        <span className="flex items-center gap-1 text-neutral-400">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {skill.ratingAvg.toFixed(1)}
          <span className="text-xs text-neutral-500">({skill.ratingCount})</span>
        </span>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
        <Package className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold mb-1">No published skills</h3>
      <p className="text-sm text-neutral-400 max-w-sm mb-4">
        You have not published any skills yet. Submit your first skill to the marketplace.
      </p>
      <Link
        href="/dashboard/skills/submit"
        className="text-sm text-info hover:text-info"
      >
        Submit a Skill &rarr;
      </Link>
    </div>
  );
}
