import Link from 'next/link';
import { Star, Download, ShieldCheck } from 'lucide-react';
import type { MarketplaceSkill } from '@/app/marketplace/demo-skills';

interface FeaturedSkillsProps {
  skills: MarketplaceSkill[];
}

export function FeaturedSkills({ skills }: FeaturedSkillsProps) {
  const featured = skills
    .filter((s) => s.installCount > 1000)
    .sort((a, b) => b.installCount - a.installCount)
    .slice(0, 3);

  if (featured.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Star className="h-5 w-5 text-amber-400" />
        Featured Skills
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {featured.map((skill) => (
          <Link
            key={skill.id}
            href={`/marketplace/${skill.slug}`}
            className="group rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-900/50 p-6 hover:border-info/40 transition"
          >
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold group-hover:text-info transition">
                {skill.name}
              </h3>
              {skill.verificationStatus === 'approved' && (
                <ShieldCheck className="h-4 w-4 text-green-400" />
              )}
            </div>
            <p className="text-xs text-neutral-400 line-clamp-2 mb-4">
              {skill.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {skill.installCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400" />
                {skill.ratingAvg.toFixed(1)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
