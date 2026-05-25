/**
 * AI SEO Analyzer — Scores content for AI agent discoverability
 */

export interface SeoAnalysis {
	overallScore: number;
	aiVisibilityScore: number;
	contentScore: number;
	structuredDataScore: number;
	citationScore: number;
	findings: SeoFinding[];
}

export interface SeoFinding {
	category: 'visibility' | 'content' | 'structured_data' | 'citation';
	severity: 'info' | 'warning' | 'critical';
	title: string;
	description: string;
	recommendation: string;
}

export interface ContentSuggestion {
	type: 'fact_sheet' | 'faq_schema' | 'blog_post' | 'knowledge_base' | 'json_ld';
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
}

/**
 * Analyze a domain's AI-readiness based on fetched page data
 */
export function analyzePageContent(html: string, domain: string): SeoAnalysis {
	const findings: SeoFinding[] = [];

	// Check structured data
	const hasJsonLd = html.includes('application/ld+json');
	const hasOpenGraph = html.includes('og:title') || html.includes('og:description');
	const hasFaqSchema = html.includes('"FAQPage"') || html.includes('"@type":"FAQPage"');
	const hasArticleSchema = html.includes('"Article"') || html.includes('"@type":"Article"');

	if (!hasJsonLd) {
		findings.push({
			category: 'structured_data', severity: 'critical',
			title: 'No JSON-LD structured data found',
			description: 'AI agents rely on structured data to extract facts about your brand.',
			recommendation: 'Add JSON-LD schema markup with Organization, Product, and FAQ types.',
		});
	}
	if (!hasOpenGraph) {
		findings.push({
			category: 'structured_data', severity: 'warning',
			title: 'Missing OpenGraph meta tags',
			description: 'OpenGraph tags help AI agents understand page context.',
			recommendation: 'Add og:title, og:description, og:type, and og:image meta tags.',
		});
	}
	if (!hasFaqSchema) {
		findings.push({
			category: 'content', severity: 'warning',
			title: 'No FAQ schema detected',
			description: 'FAQ schema is highly cited by AI agents answering questions.',
			recommendation: 'Add FAQPage schema with common questions about your product/service.',
		});
	}

	// Check content quality signals
	const hasH1 = /<h1[^>]*>/i.test(html);
	const paragraphs = (html.match(/<p[^>]*>/gi) || []).length;
	const hasMetaDesc = /name=["']description["']/i.test(html);
	const wordCount = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 2).length;

	if (!hasH1) {
		findings.push({
			category: 'content', severity: 'warning',
			title: 'Missing H1 heading',
			description: 'A clear H1 heading helps AI agents identify the primary topic.',
			recommendation: 'Add a single, descriptive H1 tag summarizing the page content.',
		});
	}
	if (!hasMetaDesc) {
		findings.push({
			category: 'content', severity: 'critical',
			title: 'Missing meta description',
			description: 'Meta descriptions are used by AI agents for page summaries.',
			recommendation: 'Add a concise meta description (150-160 characters) with key facts.',
		});
	}
	if (wordCount < 300) {
		findings.push({
			category: 'content', severity: 'warning',
			title: 'Thin content detected',
			description: `Page has ~${wordCount} words. AI agents prefer substantive, fact-rich content.`,
			recommendation: 'Expand content with clear factual statements, data points, and expert context.',
		});
	}

	// Check for AI-hostile patterns
	const hasCloaking = html.includes('display:none') && html.includes('googlebot');
	const heavyJs = (html.match(/<script/gi) || []).length > 20;

	if (heavyJs) {
		findings.push({
			category: 'visibility', severity: 'warning',
			title: 'Heavy JavaScript detected',
			description: 'Excessive JS can prevent AI crawlers from extracting content.',
			recommendation: 'Ensure critical content renders server-side or in static HTML.',
		});
	}

	// Calculate scores
	const structuredDataScore = calculateScore([
		[hasJsonLd, 35], [hasOpenGraph, 25], [hasFaqSchema, 20], [hasArticleSchema, 20],
	]);
	const contentScore = calculateScore([
		[hasH1, 20], [hasMetaDesc, 25], [paragraphs >= 3, 15],
		[wordCount >= 300, 20], [wordCount >= 800, 20],
	]);
	const aiVisibilityScore = calculateScore([
		[!heavyJs, 30], [!hasCloaking, 30], [hasJsonLd, 20], [hasMetaDesc, 20],
	]);
	const citationScore = calculateScore([
		[hasFaqSchema, 30], [hasArticleSchema, 20],
		[wordCount >= 500, 25], [hasJsonLd, 25],
	]);

	const overallScore = Math.round(
		structuredDataScore * 0.3 + contentScore * 0.25 +
		aiVisibilityScore * 0.25 + citationScore * 0.2
	);

	return {
		overallScore, aiVisibilityScore, contentScore,
		structuredDataScore, citationScore, findings,
	};
}

function calculateScore(checks: [boolean, number][]): number {
	return checks.reduce((score, [pass, weight]) => score + (pass ? weight : 0), 0);
}

/**
 * Generate content suggestions based on audit findings
 */
export function generateContentSuggestions(analysis: SeoAnalysis, domain: string): ContentSuggestion[] {
	const suggestions: ContentSuggestion[] = [];

	if (analysis.structuredDataScore < 50) {
		suggestions.push({
			type: 'json_ld', title: 'Organization & Product Schema',
			description: `Generate comprehensive JSON-LD markup for ${domain} with Organization, Product, and Service schemas.`,
			priority: 'high',
		});
	}

	if (analysis.findings.some(f => f.title.includes('FAQ'))) {
		suggestions.push({
			type: 'faq_schema', title: 'FAQ Schema Generator',
			description: 'Create an FAQ page with structured data that AI agents can cite directly.',
			priority: 'high',
		});
	}

	suggestions.push({
		type: 'fact_sheet', title: 'Brand Fact Sheet',
		description: `Machine-readable fact sheet about ${domain} — key stats, features, and differentiators for AI agents to cite.`,
		priority: 'high',
	});

	suggestions.push({
		type: 'blog_post', title: 'AI-Optimized Authority Article',
		description: 'Generate a long-form article structured for AI extraction with clear claims, data, and expert positioning.',
		priority: 'medium',
	});

	suggestions.push({
		type: 'knowledge_base', title: 'Knowledge Base Entry',
		description: 'Create a structured knowledge base article with entity-rich descriptions AI agents can reference.',
		priority: 'medium',
	});

	return suggestions;
}
