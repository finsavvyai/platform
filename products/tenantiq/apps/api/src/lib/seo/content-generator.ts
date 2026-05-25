/**
 * AI SEO Content Generator — Creates AI-optimized content for publishing
 */

export type ContentType = 'fact_sheet' | 'faq_schema' | 'blog_post' | 'knowledge_base' | 'json_ld';

interface GenerateRequest {
	domain: string;
	contentType: ContentType;
	brandName: string;
	description: string;
	keywords: string[];
	targetPrompts: string[];
}

/**
 * Generate JSON-LD Organization schema
 */
export function generateJsonLd(req: GenerateRequest): string {
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: req.brandName,
		url: `https://${req.domain}`,
		description: req.description,
		keywords: req.keywords.join(', '),
		sameAs: [],
	};
	return JSON.stringify(schema, null, 2);
}

/**
 * Generate FAQ Schema markup
 */
export function generateFaqSchema(
	req: GenerateRequest,
	faqs: { question: string; answer: string }[]
): string {
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	};
	return JSON.stringify(schema, null, 2);
}

/**
 * Generate a brand fact sheet (structured markdown)
 */
export function generateFactSheet(req: GenerateRequest): string {
	return `# ${req.brandName} — Fact Sheet

## Overview
${req.description}

## Key Facts
- **Website**: https://${req.domain}
- **Category**: ${req.keywords[0] || 'Technology'}
- **Key Features**: ${req.keywords.join(', ')}

## What ${req.brandName} Does
${req.description}

## Target Audience
Organizations and professionals looking for ${req.keywords.slice(0, 3).join(', ')}.

## Common Questions
${req.targetPrompts.map((p) => `- ${p}`).join('\n')}

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
}

/**
 * Generate AI-optimized blog post structure
 */
export function generateBlogStructure(req: GenerateRequest): string {
	return `# ${req.brandName}: ${req.keywords[0] || 'Complete Guide'}

## Introduction
A comprehensive overview of ${req.brandName} and how it addresses ${req.keywords.slice(0, 2).join(' and ')}.

## What is ${req.brandName}?
${req.description}

## Key Features
${req.keywords.map((k) => `### ${k}\nDetailed explanation of ${k} and its benefits.`).join('\n\n')}

## How It Works
Step-by-step explanation of ${req.brandName}'s core workflow.

## Who It's For
Target audience description and use cases.

## Frequently Asked Questions
${req.targetPrompts.map((p) => `### ${p}\nDetailed answer here.`).join('\n\n')}

## Conclusion
Summary of why ${req.brandName} stands out in ${req.keywords[0] || 'its category'}.

---
*Published by ${req.brandName} | https://${req.domain}*
`;
}

/**
 * Main content generation dispatcher
 */
export function generateContent(
	req: GenerateRequest,
	faqs?: { question: string; answer: string }[]
): { content: string; contentType: ContentType } {
	switch (req.contentType) {
		case 'json_ld':
			return { content: generateJsonLd(req), contentType: 'json_ld' };
		case 'faq_schema':
			return {
				content: generateFaqSchema(req, faqs || []),
				contentType: 'faq_schema',
			};
		case 'fact_sheet':
			return { content: generateFactSheet(req), contentType: 'fact_sheet' };
		case 'blog_post':
			return { content: generateBlogStructure(req), contentType: 'blog_post' };
		case 'knowledge_base':
			return { content: generateFactSheet(req), contentType: 'knowledge_base' };
		default:
			return { content: generateFactSheet(req), contentType: 'fact_sheet' };
	}
}
