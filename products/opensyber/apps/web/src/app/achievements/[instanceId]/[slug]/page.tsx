import { Shield } from 'lucide-react';
import { ShareButtons } from '@/components/ShareButtons';
import { ACHIEVEMENT_BY_SLUG } from '@opensyber/shared';

interface PageProps {
  params: Promise<{ instanceId: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const achievement = ACHIEVEMENT_BY_SLUG[slug];
  const title = achievement
    ? `${achievement.title} — OpenSyber Achievement`
    : 'Achievement — OpenSyber';
  const description = achievement?.description ?? 'Security achievement on OpenSyber.';

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
  };
}

export default async function AchievementSharePage({ params }: PageProps) {
  const { instanceId, slug } = await params;
  const achievement = ACHIEVEMENT_BY_SLUG[slug];

  if (!achievement) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-text-dim mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Achievement Not Found</h1>
          <p className="text-sm text-text-secondary">This achievement does not exist.</p>
        </div>
      </div>
    );
  }

  const shareUrl = `/achievements/${instanceId}/${slug}`;

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-lg px-6 py-16 md:py-24">
        {/* Achievement Card */}
        <div className="rounded border border-amber-500/40 bg-amber-500/5 p-8 text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
            {achievement.category}
          </span>

          <h1 className="text-3xl font-bold mt-3">{achievement.title}</h1>
          <p className="text-sm text-text-secondary mt-2">{achievement.description}</p>

          <div className="mt-6 flex justify-center">
            <ShareButtons
              url={shareUrl}
              text={achievement.shareText}
              title={achievement.title}
            />
          </div>
        </div>

        {/* Branding */}
        <div className="text-center mt-6">
          <p className="text-xs text-text-dim">
            Secured by{' '}
            <a
              href="https://opensyber.cloud"
              className="font-medium text-text-secondary hover:text-white transition"
            >
              OpenSyber
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
