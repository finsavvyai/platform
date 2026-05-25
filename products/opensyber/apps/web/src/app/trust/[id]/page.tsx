import TrustPageClient from './TrustPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id: _id } = await params;
  return {
    title: 'OpenSyber Trust Page',
    description: 'Live security posture, scorecard, and badge for an OpenSyber-protected AI agent.',
    openGraph: {
      title: 'OpenSyber Trust Page',
      description: 'Live security posture, scorecard, and badge for an OpenSyber-protected AI agent.',
      type: 'website',
    },
  };
}

export default async function TrustPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <TrustPageClient instanceId={id} />
      </div>
    </div>
  );
}
