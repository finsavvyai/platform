import ThreatFeedClient from './ThreatFeedClient';

export const metadata = {
  title: 'Threat Intelligence Feed — OpenSyber',
  description: 'Live indicators of compromise for AI agent security. Updated continuously from OpenSyber Research, NVD, and CIRCL.',
  openGraph: {
    title: 'Threat Intelligence Feed — OpenSyber',
    description: 'Live IOC feed for AI agent security — campaigns, CVEs, techniques, and advisories.',
    type: 'website' as const,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'OpenSyber Threat Intelligence' }],
  },
};

export default function ThreatsPage() {
  return <ThreatFeedClient />;
}
