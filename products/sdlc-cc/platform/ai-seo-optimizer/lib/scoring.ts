import type { ContentSignal, AgentScore } from './types';

export function scoreSignal(
  name: string,
  value: boolean | number,
  maxScore: number,
  recommendation: string
): ContentSignal {
  const score = typeof value === 'boolean' ? (value ? maxScore : 0) : Math.min(value, maxScore);
  const pct = score / maxScore;
  const status = pct >= 0.7 ? 'pass' : pct >= 0.4 ? 'warn' : 'fail';
  return { name, score, maxScore, status, recommendation };
}

export function analyzeStructure(meta: PageMeta): ContentSignal[] {
  return [
    scoreSignal(
      'Heading Hierarchy',
      meta.hasH1 && meta.headingDepth >= 2,
      15,
      'Use a single H1 with nested H2-H3 subheadings for clear topic structure.'
    ),
    scoreSignal(
      'Schema.org Markup',
      meta.hasSchema,
      15,
      'Add JSON-LD structured data (Article, FAQ, HowTo) so AI agents can parse entities.'
    ),
    scoreSignal(
      'FAQ Blocks',
      meta.hasFAQ,
      10,
      'Add an FAQ section with concise Q&A pairs. AI agents heavily favor this format.'
    ),
    scoreSignal(
      'Content Length',
      Math.min(meta.wordCount / 20, 10),
      10,
      'Aim for 1,500-2,500 words of substantive content per page.'
    ),
  ];
}

export function analyzeAuthority(meta: PageMeta): ContentSignal[] {
  return [
    scoreSignal(
      'Factual Density',
      meta.hasStatistics ? 10 : meta.hasCitations ? 6 : 2,
      10,
      'Include specific statistics, data points, and cite authoritative sources.'
    ),
    scoreSignal(
      'Author Attribution',
      meta.hasAuthor,
      10,
      'Add author name, credentials, and schema markup for authorship signals.'
    ),
    scoreSignal(
      'Publication Date',
      meta.hasDate,
      5,
      'Include a visible publish/update date. AI agents prefer recent, dated content.'
    ),
    scoreSignal(
      'Source Citations',
      meta.hasCitations,
      10,
      'Reference and link to primary sources. AI agents trace citation chains.'
    ),
  ];
}

export function analyzeAiReadiness(meta: PageMeta): ContentSignal[] {
  return [
    scoreSignal(
      'Answer-Ready Paragraphs',
      meta.hasShortParagraphs,
      10,
      'Write concise paragraphs (2-3 sentences) that directly answer questions.'
    ),
    scoreSignal(
      'Definition Patterns',
      meta.hasDefinitions,
      10,
      'Use "X is..." patterns. AI agents extract these as direct answer snippets.'
    ),
    scoreSignal(
      'Comparison Tables',
      meta.hasTables,
      5,
      'Add comparison tables. AI agents often surface tabular data in responses.'
    ),
    scoreSignal(
      'Numbered/Step Lists',
      meta.hasLists,
      10,
      'Use numbered lists for processes and bullets for features. Highly extractable.'
    ),
  ];
}

export function analyzeTechnical(meta: PageMeta): ContentSignal[] {
  return [
    scoreSignal(
      'Meta Description',
      meta.hasMetaDesc,
      5,
      'Add a concise meta description (120-155 chars) summarizing the page content.'
    ),
    scoreSignal(
      'Canonical URL',
      meta.hasCanonical,
      5,
      'Set a canonical URL to prevent duplicate content confusion for AI crawlers.'
    ),
    scoreSignal(
      'llms.txt Present',
      meta.hasLlmsTxt,
      10,
      'Add /llms.txt to guide AI models to your most important content.'
    ),
    scoreSignal(
      'AI Crawler Access',
      meta.allowsAiCrawlers,
      10,
      'Ensure robots.txt allows GPTBot, ClaudeBot, and PerplexityBot access.'
    ),
  ];
}

export function calculateAgentScores(overall: number): AgentScore[] {
  const variance = () => Math.floor(Math.random() * 16) - 8;
  const agents = ['ChatGPT', 'Perplexity', 'Claude', 'Gemini'];
  return agents.map((agent) => {
    const score = Math.max(0, Math.min(100, overall + variance()));
    return {
      agent,
      score,
      citationLikelihood: score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low',
    };
  });
}

export function calculateOverallScore(signals: ContentSignal[]): number {
  const total = signals.reduce((sum, s) => sum + s.maxScore, 0);
  const earned = signals.reduce((sum, s) => sum + s.score, 0);
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

export interface PageMeta {
  hasH1: boolean;
  headingDepth: number;
  hasSchema: boolean;
  hasFAQ: boolean;
  wordCount: number;
  hasStatistics: boolean;
  hasCitations: boolean;
  hasAuthor: boolean;
  hasDate: boolean;
  hasShortParagraphs: boolean;
  hasDefinitions: boolean;
  hasTables: boolean;
  hasLists: boolean;
  hasMetaDesc: boolean;
  hasCanonical: boolean;
  hasLlmsTxt: boolean;
  allowsAiCrawlers: boolean;
}

export function generateSummary(score: number, failCount: number): string {
  if (score >= 80) {
    return `Strong AI visibility. Your content is well-structured for AI agent discovery. ${failCount > 0 ? `Fix ${failCount} remaining issue${failCount > 1 ? 's' : ''} to maximize citations.` : 'Keep monitoring for changes.'}`;
  }
  if (score >= 50) {
    return `Moderate AI visibility. AI agents can find your content but may not cite it consistently. Address ${failCount} issue${failCount > 1 ? 's' : ''} to improve your score.`;
  }
  return `Low AI visibility. Your content is unlikely to be cited by AI agents. Focus on the ${failCount} critical issues identified below.`;
}
