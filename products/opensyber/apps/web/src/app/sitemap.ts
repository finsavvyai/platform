import type { MetadataRoute } from 'next';
import { comparePages } from './compare/compare-pages';

const BASE = 'https://opensyber.cloud';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const compareEntries = [
    { url: `${BASE}/compare`, changeFrequency: 'monthly' as const, priority: 0.7 },
    ...comparePages.map((page) => ({
      url: `${BASE}${page.href}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];

  const staticPages = [
    { url: `${BASE}/`, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${BASE}/pricing`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${BASE}/marketplace`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${BASE}/demo`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${BASE}/security`, changeFrequency: 'yearly' as const, priority: 0.4 },
    { url: `${BASE}/docs/skills/audit-methodology`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE}/docs/oasf`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/docs/faq`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/docs/getting-started`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/tokenforge`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/enterprise`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/partners`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE}/compliance`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/threats`, changeFrequency: 'daily' as const, priority: 0.6 },
    // Comparison pages (high value for AI search)
    ...compareEntries,
    // Blog
    { url: `${BASE}/blog`, changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${BASE}/blog/ai-agent-kill-chain`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/blog/slopsquatting-npm-attacks`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/blog/secure-ai-coding-agents`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/blog/complete-guide-ai-agent-security`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${BASE}/blog/introducing-opensyber`, changeFrequency: 'yearly' as const, priority: 0.5 },
    { url: `${BASE}/blog/why-self-hosted-ai-agents-are-a-security-risk`, changeFrequency: 'yearly' as const, priority: 0.5 },
    { url: `${BASE}/blog/supply-chain-attacks-targeting-ai-agents`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/blog/trivy-attack-inevitable`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/blog/ai-agents-attacking-ai-agents`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/blog/mcp-security-best-practices`, changeFrequency: 'monthly' as const, priority: 0.7 },
    // Marketplace catalog (AI-discoverable)
    { url: `${BASE}/marketplace/catalog`, changeFrequency: 'weekly' as const, priority: 0.8 },
    // AI agent discovery files
    { url: `${BASE}/llms.txt`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE}/llms-full.txt`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE}/skills-catalog.txt`, changeFrequency: 'weekly' as const, priority: 0.6 },
  ];

  return staticPages.map((page) => ({ ...page, lastModified: now }));
}
