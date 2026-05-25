import type { NextApiRequest, NextApiResponse } from 'next';
import {
  analyzeStructure,
  analyzeAuthority,
  analyzeAiReadiness,
  analyzeTechnical,
  calculateOverallScore,
  calculateAgentScores,
  generateSummary,
} from '../../lib/scoring';
import type { PageMeta } from '../../lib/scoring';
import type { ContentSignal, AnalysisResult } from '../../lib/types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Simulated analysis — in production, this would fetch and parse the page
  const meta = simulatePageMeta(url);
  const structure = analyzeStructure(meta);
  const authority = analyzeAuthority(meta);
  const aiReadiness = analyzeAiReadiness(meta);
  const technical = analyzeTechnical(meta);

  const allSignals: ContentSignal[] = [
    ...structure, ...authority, ...aiReadiness, ...technical,
  ];
  const overallScore = calculateOverallScore(allSignals);
  const failCount = allSignals.filter((s) => s.status === 'fail').length;

  const result: AnalysisResult = {
    url,
    overallScore,
    timestamp: new Date().toISOString(),
    signals: { structure, authority, aiReadiness, technical },
    agentScores: calculateAgentScores(overallScore),
    summary: generateSummary(overallScore, failCount),
  };

  return res.status(200).json(result);
}

function simulatePageMeta(url: string): PageMeta {
  // Deterministic-ish simulation based on URL characteristics
  const hasPath = new URL(url).pathname.length > 1;
  const hasDocs = url.includes('doc') || url.includes('guide') || url.includes('blog');
  const hasApi = url.includes('api') || url.includes('reference');

  return {
    hasH1: true,
    headingDepth: hasDocs ? 3 : 2,
    hasSchema: hasApi || Math.random() > 0.5,
    hasFAQ: hasDocs && Math.random() > 0.4,
    wordCount: hasPath ? 1200 + Math.floor(Math.random() * 800) : 400,
    hasStatistics: hasDocs && Math.random() > 0.3,
    hasCitations: hasDocs,
    hasAuthor: Math.random() > 0.4,
    hasDate: Math.random() > 0.3,
    hasShortParagraphs: Math.random() > 0.3,
    hasDefinitions: hasDocs,
    hasTables: hasApi || Math.random() > 0.6,
    hasLists: true,
    hasMetaDesc: Math.random() > 0.2,
    hasCanonical: Math.random() > 0.3,
    hasLlmsTxt: Math.random() > 0.7,
    allowsAiCrawlers: Math.random() > 0.4,
  };
}
