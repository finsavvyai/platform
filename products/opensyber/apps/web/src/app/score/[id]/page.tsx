import ScorecardClient from './ScorecardClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id: _id } = await params;
  return {
    title: `Security Scorecard — OpenSyber`,
    description: `View the security scorecard for this AI agent on OpenSyber.`,
    openGraph: {
      title: `Security Scorecard — OpenSyber`,
      description: `View the security scorecard for this AI agent on OpenSyber.`,
      type: 'website',
    },
  };
}

export default async function ScorePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <ScorecardClient instanceId={id} />
      </div>
    </div>
  );
}
