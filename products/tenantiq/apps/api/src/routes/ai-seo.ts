/**
 * AI SEO Optimizer & Publisher API Routes
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { analyzePageContent, generateContentSuggestions } from '../lib/seo/analyzer';
import { generateContent } from '../lib/seo/content-generator';

export const aiSeoRoutes = new Hono<AppEnv>();
aiSeoRoutes.use('*', authMiddleware);

// POST /api/ai-seo/audit — Run an AI SEO audit on a domain
aiSeoRoutes.post('/audit', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{ domain: string; competitors?: string[] }>();
	if (!body.domain) return c.json({ error: 'Domain is required' }, 400);

	const domain = body.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const auditId = crypto.randomUUID();

	try {
		// Fetch the page HTML
		const response = await fetch(`https://${domain}`, {
			headers: { 'User-Agent': 'TenantIQ-SEO-Analyzer/1.0' },
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			return c.json({ error: `Failed to fetch ${domain}: HTTP ${response.status}` }, 400);
		}

		const html = await response.text();
		const analysis = analyzePageContent(html, domain);
		const suggestions = generateContentSuggestions(analysis, domain);

		// Store audit in D1
		const now = Math.floor(Date.now() / 1000);
		await c.env.DB.prepare(
			`INSERT INTO seo_audits (id, org_id, domain, overall_score, ai_visibility_score, content_score, structured_data_score, citation_score, findings, competitors, status, started_at, completed_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
		).bind(
			auditId, user.orgId, domain,
			analysis.overallScore, analysis.aiVisibilityScore,
			analysis.contentScore, analysis.structuredDataScore,
			analysis.citationScore, JSON.stringify(analysis.findings),
			JSON.stringify(body.competitors || []),
			now, now, now
		).run();

		// Cache latest in KV
		await c.env.KV.put(`seo:${user.orgId}:${domain}:latest`, JSON.stringify({
			...analysis, domain, auditId, suggestions,
			auditedAt: new Date().toISOString(),
		}), { expirationTtl: 3600 });

		return c.json({ success: true, auditId, analysis, suggestions });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Audit failed';
		return c.json({ error: msg }, 500);
	}
});

// GET /api/ai-seo/audits — List audits for the org
aiSeoRoutes.get('/audits', async (c) => {
	const user = c.get('user');
	const result = await c.env.DB.prepare(
		'SELECT * FROM seo_audits WHERE org_id = ? ORDER BY created_at DESC LIMIT 20'
	).bind(user.orgId).all();

	return c.json({ audits: result.results });
});

// GET /api/ai-seo/audit/:id — Get a specific audit
aiSeoRoutes.get('/audit/:id', async (c) => {
	const user = c.get('user');
	const auditId = c.req.param('id');

	const audit = await c.env.DB.prepare(
		'SELECT * FROM seo_audits WHERE id = ? AND org_id = ?'
	).bind(auditId, user.orgId).first();

	if (!audit) return c.json({ error: 'Audit not found' }, 404);
	return c.json({ audit });
});

// POST /api/ai-seo/content/generate — Generate AI-optimized content
aiSeoRoutes.post('/content/generate', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{
		domain: string;
		contentType: string;
		brandName: string;
		description: string;
		keywords: string[];
		targetPrompts: string[];
		faqs?: { question: string; answer: string }[];
	}>();

	if (!body.domain || !body.contentType || !body.brandName) {
		return c.json({ error: 'domain, contentType, and brandName are required' }, 400);
	}

	const result = generateContent({
		domain: body.domain,
		contentType: body.contentType as any,
		brandName: body.brandName,
		description: body.description || '',
		keywords: body.keywords || [],
		targetPrompts: body.targetPrompts || [],
	}, body.faqs);

	// Store generated content
	const contentId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	await c.env.DB.prepare(
		`INSERT INTO seo_content (id, org_id, domain, content_type, title, content, metadata, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
	).bind(
		contentId, user.orgId, body.domain,
		result.contentType, `${body.brandName} - ${result.contentType}`,
		result.content,
		JSON.stringify({ keywords: body.keywords, targetPrompts: body.targetPrompts }),
		now, now
	).run();

	return c.json({ success: true, contentId, content: result.content, contentType: result.contentType });
});

// GET /api/ai-seo/content — List generated content
aiSeoRoutes.get('/content', async (c) => {
	const user = c.get('user');
	const result = await c.env.DB.prepare(
		'SELECT * FROM seo_content WHERE org_id = ? ORDER BY created_at DESC LIMIT 50'
	).bind(user.orgId).all();

	return c.json({ content: result.results });
});

// PATCH /api/ai-seo/content/:id — Update content (edit or publish)
aiSeoRoutes.patch('/content/:id', async (c) => {
	const user = c.get('user');
	const contentId = c.req.param('id');
	const body = await c.req.json<{ content?: string; status?: string; title?: string }>();

	const existing = await c.env.DB.prepare(
		'SELECT id FROM seo_content WHERE id = ? AND org_id = ?'
	).bind(contentId, user.orgId).first();
	if (!existing) return c.json({ error: 'Content not found' }, 404);

	const updates: string[] = [];
	const values: any[] = [];

	if (body.content) { updates.push('content = ?'); values.push(body.content); }
	if (body.title) { updates.push('title = ?'); values.push(body.title); }
	if (body.status) {
		updates.push('status = ?'); values.push(body.status);
		if (body.status === 'published') {
			updates.push('published_at = ?'); values.push(Math.floor(Date.now() / 1000));
		}
	}
	updates.push('updated_at = ?'); values.push(Math.floor(Date.now() / 1000));
	values.push(contentId);

	await c.env.DB.prepare(
		`UPDATE seo_content SET ${updates.join(', ')} WHERE id = ?`
	).bind(...values).run();

	return c.json({ success: true });
});

// DELETE /api/ai-seo/content/:id — Delete content
aiSeoRoutes.delete('/content/:id', async (c) => {
	const user = c.get('user');
	const contentId = c.req.param('id');

	await c.env.DB.prepare(
		'DELETE FROM seo_content WHERE id = ? AND org_id = ?'
	).bind(contentId, user.orgId).run();

	return c.json({ success: true });
});

// POST /api/ai-seo/citations/check — Check AI agent citations
aiSeoRoutes.post('/citations/check', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{ domain: string; prompts: string[] }>();
	if (!body.domain || !body.prompts?.length) {
		return c.json({ error: 'domain and prompts are required' }, 400);
	}

	// Store citation check requests (actual AI querying would be async)
	const citations = body.prompts.map((prompt) => ({
		id: crypto.randomUUID(),
		domain: body.domain,
		prompt,
		status: 'pending',
	}));

	const now = Math.floor(Date.now() / 1000);
	for (const citation of citations) {
		await c.env.DB.prepare(
			`INSERT INTO seo_citations (id, org_id, domain, ai_agent, prompt, mentioned, checked_at)
			 VALUES (?, ?, ?, 'pending', ?, 0, ?)`
		).bind(citation.id, user.orgId, body.domain, citation.prompt, now).run();
	}

	return c.json({ success: true, citations });
});

// POST /api/ai-seo/share/generate — Generate a viral share message
aiSeoRoutes.post('/share/generate', async (c) => {
	const body = await c.req.json<{
		domain: string;
		score: number;
		aiVisibility: number;
		contentScore: number;
		structuredData: number;
		citationScore: number;
		criticalCount: number;
		style?: string;
	}>();

	if (!body.domain || body.score == null) {
		return c.json({ error: 'domain and score are required' }, 400);
	}

	const grade = body.score >= 90 ? 'A+' : body.score >= 80 ? 'A' : body.score >= 70 ? 'B' : body.score >= 60 ? 'C' : body.score >= 50 ? 'D' : 'F';
	const style = body.style || 'random';

	// Pools of viral message templates
	const roastMessages = [
		`Just ran my site through an AI SEO scanner... ${body.score}/100. ${grade === 'A+' || grade === 'A' ? `Turns out the robots DO love me.` : grade === 'F' ? `I'm literally invisible to ChatGPT. My site is the dark web of AI search.` : `Not great, not terrible. My site is the "we have food at home" of AI results.`} Scan yours 👉`,
		`POV: You ask ChatGPT about your industry and your competitor shows up instead. That was me. Then I scored ${body.score}/100 on AI readiness. ${body.score < 60 ? `Pain.` : `At least I know what to fix now.`} Check your score 👀`,
		`AI agents are the new Google. My site scored ${body.score}/100 for AI visibility. ${body.criticalCount > 0 ? `${body.criticalCount} critical issues. My JSON-LD is giving "404 personality".` : `Not bad, but there's room to glow up.`} What's YOUR score?`,
		`Imagine building a beautiful website and then finding out AI agents literally can't see it. That's me. ${body.score}/100 AI readiness. ${body.score < 50 ? `I'm basically a digital ghost 👻` : `Working on my AI glow-up now.`} Dare to check yours?`,
		`Me: "My SEO is fine"\nAI SEO Audit: "${body.score}/100"\nMe: 👁👄👁\n\n${body.criticalCount > 0 ? `${body.criticalCount} critical issues found. Apparently AI agents think my site is a 404.` : `Not as bad as I feared but still humbling.`}\n\nScan your site — it's brutally honest 💀`,
	];

	const bragMessages = [
		`Just scored ${body.score}/100 on AI readiness. ${grade === 'A+' ? `The AI agents are fighting over who gets to cite me first.` : `Not perfect but ChatGPT and I are on speaking terms now.`} Every website needs this audit.`,
		`${body.score}/100 AI visibility score. My structured data game is ${body.structuredData >= 80 ? 'immaculate' : 'a work in progress but I see the path'}. When someone asks an AI about ${body.domain.split('.')[0]}, they'll get the FACTS. Check yours 💪`,
		`Ran an AI SEO audit on ${body.domain} — ${body.score}/100.\n\n${body.aiVisibility >= 80 ? '✅ AI Visibility: Elite' : '⚡ AI Visibility: Needs work'}\n${body.contentScore >= 80 ? '✅ Content Quality: Chef\'s kiss' : '⚡ Content: Good but not great'}\n${body.structuredData >= 80 ? '✅ Structured Data: Clean' : '⚡ Schema: Missing pieces'}\n${body.citationScore >= 80 ? '✅ Citation Ready: Absolutely' : '⚡ Citations: Room to grow'}\n\nWhat's YOUR AI readiness score?`,
	];

	const urgentMessages = [
		`🚨 PSA: If you haven't checked how AI agents see your website, you're flying blind in 2026. I just found ${body.criticalCount} critical issues on mine. AI is the new search — your site needs to speak its language. Free scan 👇`,
		`Everybody's optimizing for Google. Nobody's optimizing for ChatGPT, Claude, and Perplexity. Just audited my site: ${body.score}/100 AI readiness. ${body.score < 60 ? `Turns out I've been invisible to half the internet.` : `Some wins, some "oh no" moments.`} Don't sleep on this.`,
		`Hot take: If your website doesn't have JSON-LD, FAQ schema, and AI-crawlable content in 2026, you don't have a website. You have a digital pamphlet. My AI readiness: ${body.score}/100. Check yours before your competitors do.`,
	];

	const funnyMessages = [
		`My website's AI readiness score: ${body.score}/100\nMy confidence before the scan: 100/100\n\n${body.score < 60 ? `The gap between these numbers is called "delusion" 😭` : `OK not bad but I've never been so anxious waiting for a score since school`}\n\nYour turn. I dare you.`,
		`Therapist: "What's bothering you?"\nMe: "I just found out AI agents can't read my website properly"\nTherapist: "That's... not a real problem"\nMe: *shows ${body.score}/100 AI readiness score*\nTherapist: "...let me scan my site too"\n\nIt's free. It's humbling. Try it.`,
		`Stages of running an AI SEO audit:\n1. Confidence: "My site is great"\n2. Curiosity: "Let me just check"\n3. Denial: "${body.score}/100? That can't be right"\n4. Acceptance: "OK let me fix this"\n5. Evangelism: "EVERYONE NEEDS TO DO THIS"\n\nI'm at stage 5. You're welcome.`,
		`Started an AI SEO audit expecting a 95.\nGot a ${body.score}.\n${body.score >= 80 ? `OK fine that's still good but WHERE ARE MY 5 POINTS` : body.score >= 60 ? `My ego will recover. Probably.` : `Calling out sick tomorrow to fix my JSON-LD.`}\n\nMisery loves company — check yours 🫠`,
	];

	// Larry David "Pretty... Pretty... Insecure" viral one-liners
	const larryMessages = [
		`"You think your site is AI-ready? That's adorable." — My AI readiness: ${body.score}/100. TenantIQ doesn't lie. It just judges. Scan yours 👇`,
		`"Every admin thinks they're doing a great job… until TenantIQ shows up." My score: ${body.score}/100. ${body.score < 60 ? `I am no longer that admin.` : `At least I faced the music.`} Your turn.`,
		`"It's not that your site is broken… it's just… aggressively misconfigured." I scored ${body.score}/100 on AI visibility. ${body.criticalCount > 0 ? `${body.criticalCount} critical issues.` : `Not terrible.`} Pretty... pretty... insecure. Check yours.`,
		`"We didn't build TenantIQ because everything was fine. We built it because nothing was fine." My AI readiness: ${body.score}/100. The truth hurts. The scan is free. 💀`,
		`"TenantIQ doesn't panic. It just quietly proves that you should." Score: ${body.score}/100. ${body.score < 50 ? `I should panic.` : `I should... mildly concern myself.`} What about you?`,
		`"Oh, you trust your configurations? TenantIQ doesn't trust you trusting them." AI readiness: ${body.score}/100. ${body.criticalCount > 0 ? `${body.criticalCount} issues say I shouldn't have trusted them either.` : `Trust but verify, I guess.`}`,
		`"TenantIQ is basically a mirror—but for your worst configuration choices." I looked. I saw ${body.score}/100. I'm working on it. Dare to look? 🪞`,
		`"You didn't misconfigure anything? Wow. That's… statistically unlikely." My site: ${body.score}/100. Statistics confirmed. Check yours before your competitors do.`,
		`"We don't create problems. We just reveal the ones you've been ignoring." AI readiness: ${body.score}/100. Turns out I had ${body.criticalCount > 0 ? `${body.criticalCount} problems` : `some problems`} to reveal. 🫠`,
		`"TenantIQ is like hiring a security guy who never sleeps… and also judges you a little." He judged my site: ${body.score}/100. ${body.score < 60 ? `Harsh but fair.` : `Could be worse. Could be my neighbor's site.`}`,
		`"We scan your site so thoroughly, even your bad decisions feel exposed." My bad decisions scored ${body.score}/100. ${body.score >= 70 ? `Apparently some were OK.` : `All exposed. All judged.`} Your turn.`,
		`"TenantIQ: because 'it works' is not the same as 'it's secure,' and deep down—you know that." My AI readiness: ${body.score}/100. Deep down, I knew. Now I know for sure.`,
		`"TenantIQ finds problems you didn't know existed—and frankly, would've preferred not knowing." I found ${body.criticalCount > 0 ? `${body.criticalCount} of them` : `a few`}. Score: ${body.score}/100. Ignorance was bliss. Knowledge is power. 💪`,
		`"You ever look at your website and think 'this seems fine'? Yeah, TenantIQ hates that energy." It hated my energy so much it gave me ${body.score}/100. Fair enough.`,
		`Pretty... pretty... pretty... ${body.score >= 80 ? `pretty good actually.` : body.score >= 60 ? `pretty mid.` : `pretty insecure.`}\n\nMy AI readiness: ${body.score}/100.\nYours: Unknown.\nFix that. 👇`,
	];

	let pool: string[];
	if (style === 'roast') pool = roastMessages;
	else if (style === 'brag') pool = bragMessages;
	else if (style === 'urgent') pool = urgentMessages;
	else if (style === 'funny') pool = funnyMessages;
	else if (style === 'larry') pool = larryMessages;
	else {
		// Random from all pools
		pool = [...roastMessages, ...bragMessages, ...urgentMessages, ...funnyMessages, ...larryMessages];
	}

	const message = pool[Math.floor(Math.random() * pool.length)];
	return c.json({ message, grade, style });
});

// GET /api/ai-seo/citations — Get citation tracking results
aiSeoRoutes.get('/citations', async (c) => {
	const user = c.get('user');
	const domain = c.req.query('domain');

	let query = 'SELECT * FROM seo_citations WHERE org_id = ?';
	const bindings: string[] = [user.orgId];
	if (domain) { query += ' AND domain = ?'; bindings.push(domain); }
	query += ' ORDER BY checked_at DESC LIMIT 50';

	const result = await c.env.DB.prepare(query).bind(...bindings).all();
	return c.json({ citations: result.results });
});

// ─── Advanced Features ─────────────────────────────────────────────────────

// POST /api/ai-seo/simulate — AI Agent Simulator: how would AI answer about your brand
aiSeoRoutes.post('/simulate', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{ domain: string; prompt: string; agent?: string }>();
	if (!body.domain || !body.prompt) return c.json({ error: 'domain and prompt are required' }, 400);

	const domain = body.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const agent = body.agent || 'chatgpt';

	// Fetch latest cached audit data
	const cached = await c.env.KV.get(`seo:${user.orgId}:${domain}:latest`);
	let auditData: Record<string, unknown> | null = null;
	if (cached) {
		try { auditData = JSON.parse(cached); } catch { /* ignore */ }
	}

	// Build simulated AI response based on available data
	const hasJsonLd = auditData ? (auditData.structuredDataScore as number) >= 60 : false;
	const hasFaq = auditData ? (auditData.findings as Array<{ category: string }>)?.some(f => f.category === 'structured_data') === false : false;
	const contentScore = (auditData?.contentScore as number) ?? 40;
	const brandName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

	// Simulate different AI agent response styles
	const agentStyles: Record<string, { prefix: string; style: string; citationFormat: string }> = {
		chatgpt: {
			prefix: 'Based on available information',
			style: 'conversational and thorough',
			citationFormat: 'inline references',
		},
		claude: {
			prefix: 'From what I can find',
			style: 'precise and balanced',
			citationFormat: 'sourced with context',
		},
		perplexity: {
			prefix: 'According to search results',
			style: 'research-oriented with citations',
			citationFormat: '[1] numbered sources',
		},
		gemini: {
			prefix: 'Here\'s what I found',
			style: 'concise with key highlights',
			citationFormat: 'brief inline links',
		},
	};

	const agentStyle = agentStyles[agent] || agentStyles.chatgpt;
	const mentioned = hasJsonLd && contentScore >= 50;
	const confidence = mentioned ? (contentScore >= 70 ? 'high' : 'medium') : 'low';

	let simulatedResponse: string;
	if (mentioned) {
		simulatedResponse = `${agentStyle.prefix}, **${brandName}** (${domain}) is ${contentScore >= 80 ? 'a well-established' : 'an emerging'} platform${hasJsonLd ? ' with structured data that makes it easy to reference' : ''}. ${hasFaq ? `Their FAQ section provides direct answers to common questions.` : `Their content covers key topics in the space.`}\n\nKey information I can cite:\n- Website: ${domain}\n${contentScore >= 70 ? `- Content depth is sufficient for detailed answers\n` : `- Limited detailed content available\n`}${hasJsonLd ? `- Structured data (JSON-LD) present — makes citations more reliable\n` : `- No structured data detected — harder to cite accurately\n`}\n\n*This is a ${agentStyle.style} response with ${agentStyle.citationFormat}.*`;
	} else {
		simulatedResponse = `${agentStyle.prefix}, I don't have detailed information specifically about **${brandName}** (${domain}). ${contentScore < 40 ? `The website appears to have limited content that AI systems can index.` : `While some content exists, it's not structured in a way that's easy for AI systems to cite.`}\n\n**Why your brand isn't being mentioned:**\n${!hasJsonLd ? '- No JSON-LD structured data — AI agents can\'t reliably extract facts\n' : ''}${contentScore < 50 ? '- Content lacks depth for authoritative citations\n' : ''}${!hasFaq ? '- No FAQ schema — missing easy citation opportunities\n' : ''}- Competitors with better structured content may be cited instead\n\n*This simulates a ${agentStyle.style} response.*`;
	}

	// Store the simulation
	const simId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	await c.env.DB.prepare(
		`INSERT INTO seo_citations (id, org_id, domain, ai_agent, prompt, mentioned, context, checked_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(simId, user.orgId, domain, agent, body.prompt, mentioned ? 1 : 0, simulatedResponse, now).run();

	return c.json({
		simulation: {
			agent,
			prompt: body.prompt,
			response: simulatedResponse,
			mentioned,
			confidence,
			factors: {
				hasJsonLd,
				hasFaq,
				contentScore,
				structuredDataScore: (auditData?.structuredDataScore as number) ?? 0,
			},
		},
	});
});

// POST /api/ai-seo/competitor-battle — Head-to-head comparison
aiSeoRoutes.post('/competitor-battle', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{ domain: string; competitor: string }>();
	if (!body.domain || !body.competitor) {
		return c.json({ error: 'domain and competitor are required' }, 400);
	}

	const domain = body.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const competitor = body.competitor.replace(/^https?:\/\//, '').replace(/\/+$/, '');

	// Analyze both in parallel
	const [yourHtml, compHtml] = await Promise.all([
		fetch(`https://${domain}`, {
			headers: { 'User-Agent': 'TenantIQ-SEO-Analyzer/1.0' },
			signal: AbortSignal.timeout(10000),
		}).then(r => r.ok ? r.text() : '').catch(() => ''),
		fetch(`https://${competitor}`, {
			headers: { 'User-Agent': 'TenantIQ-SEO-Analyzer/1.0' },
			signal: AbortSignal.timeout(10000),
		}).then(r => r.ok ? r.text() : '').catch(() => ''),
	]);

	if (!yourHtml && !compHtml) return c.json({ error: 'Could not fetch either domain' }, 400);

	const yourAnalysis = yourHtml ? analyzePageContent(yourHtml, domain) : null;
	const compAnalysis = compHtml ? analyzePageContent(compHtml, competitor) : null;

	// Build comparison with winner per category
	const categories = ['overallScore', 'aiVisibilityScore', 'contentScore', 'structuredDataScore', 'citationScore'] as const;
	const comparison = categories.map(cat => {
		const yours = yourAnalysis?.[cat] ?? 0;
		const theirs = compAnalysis?.[cat] ?? 0;
		return {
			category: cat.replace('Score', '').replace(/([A-Z])/g, ' $1').trim(),
			yours,
			theirs,
			winner: yours > theirs ? 'you' as const : yours < theirs ? 'them' as const : 'tie' as const,
			diff: yours - theirs,
		};
	});

	const yourWins = comparison.filter(c => c.winner === 'you').length;
	const theirWins = comparison.filter(c => c.winner === 'them').length;

	return c.json({
		battle: {
			domain,
			competitor,
			comparison,
			yourTotal: yourAnalysis?.overallScore ?? 0,
			theirTotal: compAnalysis?.overallScore ?? 0,
			winner: yourWins > theirWins ? domain : yourWins < theirWins ? competitor : 'tie',
			yourWins,
			theirWins,
			verdict: yourWins > theirWins
				? `${domain} leads in ${yourWins}/5 categories. You're ahead but keep optimizing!`
				: yourWins < theirWins
					? `${competitor} leads in ${theirWins}/5 categories. Time to close the gap.`
					: `Dead even! Both sites have similar AI visibility.`,
		},
	});
});

// GET /api/ai-seo/timeline — Score history over time for a domain
aiSeoRoutes.get('/timeline', async (c) => {
	const user = c.get('user');
	const domain = c.req.query('domain');
	if (!domain) return c.json({ error: 'domain query param is required' }, 400);

	const result = await c.env.DB.prepare(
		`SELECT overall_score, ai_visibility_score, content_score, structured_data_score,
		        citation_score, created_at
		 FROM seo_audits WHERE org_id = ? AND domain = ?
		 ORDER BY created_at ASC LIMIT 30`
	).bind(user.orgId, domain).all();

	const points = result.results.map((r: Record<string, unknown>) => ({
		date: r.created_at,
		overall: r.overall_score,
		aiVisibility: r.ai_visibility_score,
		content: r.content_score,
		structuredData: r.structured_data_score,
		citation: r.citation_score,
	}));

	// Calculate trend
	let trend = 'stable' as 'up' | 'down' | 'stable';
	if (points.length >= 2) {
		const first = (points[0] as { overall: number }).overall;
		const last = (points[points.length - 1] as { overall: number }).overall;
		if (last - first >= 5) trend = 'up';
		else if (first - last >= 5) trend = 'down';
	}

	return c.json({ timeline: { domain, points, trend, totalAudits: points.length } });
});

// POST /api/ai-seo/autofix — Generate one-click fixes for common issues
aiSeoRoutes.post('/autofix', async (c) => {
	const user = c.get('user');
	const body = await c.req.json<{ domain: string; fixType: string; brandName?: string }>();
	if (!body.domain || !body.fixType) return c.json({ error: 'domain and fixType are required' }, 400);

	const domain = body.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const brand = body.brandName || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

	let fix: { code: string; instructions: string; type: string };

	switch (body.fixType) {
		case 'json_ld':
			fix = {
				type: 'JSON-LD Organization Schema',
				code: JSON.stringify({
					'@context': 'https://schema.org',
					'@type': 'Organization',
					'name': brand,
					'url': `https://${domain}`,
					'logo': `https://${domain}/logo.png`,
					'description': `${brand} — Official website`,
					'sameAs': [],
					'contactPoint': {
						'@type': 'ContactPoint',
						'contactType': 'customer service',
						'url': `https://${domain}/contact`,
					},
				}, null, 2),
				instructions: `Add this to your <head> tag:\n\n<script type="application/ld+json">\n[PASTE CODE HERE]\n</script>\n\nThis tells AI agents who you are, what you do, and how to contact you. It's the single most impactful change for AI visibility.`,
			};
			break;
		case 'faq_schema':
			fix = {
				type: 'FAQ Schema Markup',
				code: JSON.stringify({
					'@context': 'https://schema.org',
					'@type': 'FAQPage',
					'mainEntity': [
						{ '@type': 'Question', 'name': `What is ${brand}?`, 'acceptedAnswer': { '@type': 'Answer', 'text': `${brand} is [your description here]. Visit ${domain} for more.` } },
						{ '@type': 'Question', 'name': `How does ${brand} work?`, 'acceptedAnswer': { '@type': 'Answer', 'text': `${brand} works by [explain your process]. Learn more at ${domain}.` } },
						{ '@type': 'Question', 'name': `What are ${brand}'s key features?`, 'acceptedAnswer': { '@type': 'Answer', 'text': `${brand}'s key features include [list features]. See details at ${domain}.` } },
						{ '@type': 'Question', 'name': `How much does ${brand} cost?`, 'acceptedAnswer': { '@type': 'Answer', 'text': `${brand} offers [pricing info]. Visit ${domain}/pricing for current plans.` } },
					],
				}, null, 2),
				instructions: `Add this to any page's <head> tag:\n\n<script type="application/ld+json">\n[PASTE CODE HERE]\n</script>\n\nFAQ schema is the #1 way to get cited by AI agents. When someone asks "What is ${brand}?", this schema gives AI a direct answer to quote.`,
			};
			break;
		case 'meta_tags':
			fix = {
				type: 'AI-Optimized Meta Tags',
				code: `<!-- AI-Optimized Meta Tags for ${brand} -->
<meta name="description" content="${brand} — [Your 150-char description here]. Learn more at ${domain}." />
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
<meta property="og:title" content="${brand} — [Tagline]" />
<meta property="og:description" content="[150-char description matching meta description]" />
<meta property="og:url" content="https://${domain}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://${domain}/og-image.png" />
<meta property="og:site_name" content="${brand}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${brand}" />
<meta name="twitter:description" content="[Same as OG description]" />
<link rel="canonical" href="https://${domain}" />`,
				instructions: `Replace your current meta tags with these in your <head>.\n\nKey changes:\n• max-snippet:-1 allows AI agents to extract longer passages\n• OpenGraph tags ensure AI agents get the right preview info\n• Canonical URL prevents duplicate content confusion`,
			};
			break;
		case 'robots_ai':
			fix = {
				type: 'AI-Friendly Robots.txt',
				code: `# ${brand} robots.txt — AI-agent friendly
User-agent: *
Allow: /

# Allow AI crawlers explicitly
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Amazonbot
Allow: /

# Sitemap
Sitemap: https://${domain}/sitemap.xml`,
				instructions: `Replace your robots.txt at ${domain}/robots.txt with this content.\n\nMany sites accidentally block AI crawlers (GPTBot, Claude-Web, PerplexityBot). This explicitly allows them to index your content. Without this, AI agents literally cannot see your website.`,
			};
			break;
		default:
			return c.json({ error: `Unknown fix type: ${body.fixType}` }, 400);
	}

	// Store the generated fix
	const fixId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	await c.env.DB.prepare(
		`INSERT INTO seo_content (id, org_id, domain, content_type, title, content, metadata, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
	).bind(fixId, user.orgId, domain, body.fixType, fix.type, fix.code, JSON.stringify({ instructions: fix.instructions }), now, now).run();

	return c.json({ fix: { id: fixId, ...fix } });
});

// ─── Viral Thread Generator ────────────────────────────────────────────────

// POST /api/ai-seo/thread/generate — Generate a viral Twitter/LinkedIn thread
aiSeoRoutes.post('/thread/generate', async (c) => {
	const body = await c.req.json<{
		domain: string; score: number; criticalCount: number;
		platform: string; tone?: string;
	}>();
	if (!body.domain || body.score == null) {
		return c.json({ error: 'domain and score are required' }, 400);
	}

	const grade = body.score >= 90 ? 'A+' : body.score >= 80 ? 'A' : body.score >= 70 ? 'B' : body.score >= 60 ? 'C' : body.score >= 50 ? 'D' : 'F';
	const platform = body.platform || 'twitter';
	const tone = body.tone || 'larry';
	const d = body.domain;
	const s = body.score;
	const cc = body.criticalCount || 0;

	type Thread = { tweets: string[] } | { post: string };

	const twitterThreads: { tweets: string[] }[] = [
		{
			tweets: [
				`I just ran an AI SEO audit on my website.\n\nScore: ${s}/100\nGrade: ${grade}\n${cc > 0 ? `Critical issues: ${cc}` : 'Critical issues: surprisingly few'}\n\nHere's the thread nobody asked for but everyone needs 🧵`,
				`First: AI agents (ChatGPT, Claude, Perplexity, Gemini) are the new Google.\n\nIf your website can't be read by AI, you're invisible to half the internet.\n\nPretty... pretty... insecure.`,
				`My structured data situation was... "${s >= 70 ? 'not terrible' : 'a crime scene'}."\n\n${s < 60 ? 'No JSON-LD. No FAQ schema. My website was basically screaming into the void.' : 'Some JSON-LD present, but gaps everywhere.'}\n\n"You didn't misconfigure anything? Wow. That's… statistically unlikely."`,
				`The audit found ${cc > 0 ? `${cc} critical issues` : 'some concerning gaps'}.\n\nThings like:\n- Missing structured data\n- No FAQ schema for AI citations\n- Robots.txt blocking AI crawlers\n- Meta descriptions from 2019\n\n"We don't create problems. We just reveal the ones you've been ignoring."`,
				`Here's what I learned:\n\n1. JSON-LD is the #1 way to get cited by AI\n2. FAQ schema = free AI citations\n3. Most sites accidentally BLOCK AI crawlers\n4. Your competitors might already be optimized\n\n"Every admin thinks they're doing a great job… until TenantIQ shows up."`,
				`Bottom line: If you haven't checked your AI readiness, you're flying blind.\n\nThe scan takes 30 seconds. The results last... well, they might haunt you.\n\nFree tool: app.tenantiq.app/seo\n\nYou've been warned. 💀`,
			]
		},
		{
			tweets: [
				`"You think your website is ready for AI search?"\n\nI did too.\n\nThen I scored ${s}/100.\n\n${s < 60 ? 'I am no longer that person.' : 'Not great, not terrible.'}\n\nThread on what AI agents actually see when they look at your site 👇`,
				`AI agents don't see your pretty design.\nThey don't care about your color scheme.\nThey don't admire your hero section.\n\nThey see: HTML, schema, structured data, and content.\n\nIf those are broken? You don't exist.`,
				`My audit breakdown:\n\n🔍 AI Visibility: ${s >= 70 ? 'decent' : 'invisible'}\n📝 Content Quality: ${s >= 60 ? 'passable' : 'needs CPR'}\n🏗 Structured Data: ${s >= 70 ? 'present' : 'absent without leave'}\n📎 Citation Ready: ${s >= 60 ? 'getting there' : 'not even close'}\n\n"TenantIQ doesn't panic. It just quietly proves that you should."`,
				`The scariest finding?\n\nMy competitors probably already fixed this stuff.\n\nWhile I was tweaking fonts, they were adding JSON-LD.\nWhile I was A/B testing buttons, they were building FAQ schema.\n\n"TenantIQ is basically a mirror—but for your worst configuration choices."`,
				`What I'm fixing first:\n\n✅ Adding JSON-LD Organization schema\n✅ Building FAQ schema for top pages\n✅ Updating robots.txt to allow AI crawlers\n✅ Rewriting meta descriptions for AI\n\nThe tool even generates the code for you. One click.\n\nScan yours free: app.tenantiq.app/seo`,
			]
		},
	];

	const linkedInThreads: { post: string }[] = [
		{
			post: `I just discovered something uncomfortable about my website.\n\nI ran an AI SEO audit. My score: ${s}/100. Grade: ${grade}.\n\n${s < 60 ? `That's not a score. That's a cry for help.` : `Not catastrophic. But definitely not "we're fine."`}\n\nHere's the thing nobody's talking about:\n\nAI agents (ChatGPT, Claude, Perplexity, Gemini) are becoming how people find businesses. Not Google. Not social media. AI.\n\nAnd if your website isn't structured for AI to read?\nYou. Don't. Exist.\n\nMy audit found:\n${cc > 0 ? `→ ${cc} critical issues` : '→ Several gaps in AI readiness'}\n→ Missing structured data (JSON-LD)\n→ No FAQ schema for easy AI citations\n→ Content not optimized for AI extraction\n\nAs someone once said: "You think your website is fine? That's adorable. TenantIQ thinks otherwise."\n\nThe free scan took 30 seconds.\nThe ego recovery is ongoing.\n\nCheck yours: app.tenantiq.app/seo\n\n#AISEO #SEO #AI #DigitalMarketing`
		},
		{
			post: `Every business owner thinks their website is doing great.\n\nEvery business owner is wrong.\n\nI ran my site through an AI readiness scanner. The kind that checks whether ChatGPT, Claude, and Perplexity can actually find and cite your business.\n\nMy score: ${s}/100.\n\n${s >= 70 ? `Not bad. But "not bad" isn't a strategy.` : `To quote someone wiser than me: "We didn't build this because everything was fine. We built it because nothing was fine."`}\n\nWhat I learned:\n\n1. 73% of websites block AI crawlers without knowing it\n2. JSON-LD structured data is the #1 factor for AI citations\n3. FAQ schema is free real estate for AI answers\n4. Your competitors are probably already doing this\n\nThe gap between "we have a website" and "AI agents can actually cite us" is massive.\n\nAnd most businesses don't even know it exists.\n\n"TenantIQ doesn't just monitor your setup… it watches it like a suspicious neighbor who already called the police."\n\nFree scan (brutally honest): app.tenantiq.app/seo\n\n#Marketing #AISearch #WebStrategy`
		},
	];

	let thread: Thread;
	if (platform === 'linkedin') {
		thread = linkedInThreads[Math.floor(Math.random() * linkedInThreads.length)];
	} else {
		thread = twitterThreads[Math.floor(Math.random() * twitterThreads.length)];
	}

	return c.json({ thread, platform, tone, grade });
});

// POST /api/ai-seo/share/generate/fintech — Fintech & compliance humor variants
aiSeoRoutes.post('/share/generate/fintech', async (c) => {
	const body = await c.req.json<{
		domain: string; score: number; criticalCount: number; style?: string;
	}>();
	if (!body.domain || body.score == null) {
		return c.json({ error: 'domain and score are required' }, 400);
	}

	const s = body.score;
	const cc = body.criticalCount || 0;
	const grade = s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : s >= 50 ? 'D' : 'F';
	const style = body.style || 'random';

	const fintechMessages = [
		`My site's AI readiness: ${s}/100. That's worse than my compliance audit last quarter. And THAT had findings. AI visibility is the new regulatory requirement nobody told you about. Check yours 👇`,
		`In fintech, we audit everything. Except apparently our AI visibility. My site scored ${s}/100. ${cc > 0 ? `${cc} critical issues.` : ''} The SEC might not care yet, but ChatGPT definitely does.`,
		`Ran an AI SEO audit. Score: ${s}/100. In compliance terms, that's a ${grade}. ${s < 60 ? `My risk team would classify this as "material weakness."` : `Passable, but my auditor would want a remediation plan.`} Does your site pass? 🏦`,
		`Your website's AI readiness is basically a compliance control nobody's checking yet. Mine scored ${s}/100. ${s < 50 ? `That's a SOC 2 exception waiting to happen.` : `Not a finding, but definitely an observation.`} Audit yours.`,
		`In fintech we have KYC. Know Your Customer. But do you KYW? Know Your Website? AI agents see ${s}/100 of my site. The rest is a mystery even to ChatGPT. That's concerning.`,
	];

	const complianceMessages = [
		`If your AI readiness score were an audit finding, mine would be ${s < 60 ? 'a material weakness' : s < 80 ? 'a significant deficiency' : 'a passing control'}. ${s}/100. ${cc > 0 ? `${cc} critical findings.` : ''} Time to remediate. 📋`,
		`Auditor: "How discoverable is your website to AI agents?"\nMe: "Very."\nTenantIQ: "${s}/100."\nAuditor: 👀\n\nCompliance doesn't end at SOC 2. If AI can't find you, customers can't either.`,
		`My AI readiness: ${s}/100.\nMy confidence before scanning: "We're SOC 2 certified, we're fine."\n\nTurns out AI visibility and compliance are different things. Both matter. Only one is being ignored.\n\n"Passing an audit and being actually compliant are two different things."`,
		`SOC 2: ✅ HIPAA: ✅ GDPR: ✅ AI Visibility: ${grade} (${s}/100)\n\nYou can be compliant with every framework and still invisible to AI. ${cc > 0 ? `I had ${cc} critical AI issues.` : ''} That's the gap nobody's talking about.`,
		`CFO: "Are we visible in AI search?"\nCTO: "Probably."\nTenantIQ: "${s}/100."\nCFO: "..."\nCTO: "..."\n\n${s < 60 ? `The silence was deafening.` : `At least it wasn't worse.`}\n\nFree audit. Brutally honest.`,
	];

	const darkMessages = [
		`My AI readiness: ${s}/100. My site is basically an unpatched server of AI visibility. "It's not that your site is broken. It's just... aggressively misconfigured." 💀`,
		`I asked TenantIQ to check my AI readiness. It responded with ${s}/100 and what I can only describe as digital disappointment. ${cc > 0 ? `${cc} criticals.` : ''} Check yours if you dare.`,
		`"How bad is it?"\n"${s}/100."\n"Is that good?"\n"It's like asking if your house is on fire. The answer should never be 'a little bit.'" 🔥`,
		`Ran my AI readiness audit. The good news: my site exists. The bad news: AI agents can barely tell. ${s}/100. ${s < 50 ? `My digital presence is a digital absence.` : `Working on it.`}\n\n"TenantIQ finds problems you didn't know existed—and frankly, would've preferred not knowing."`,
	];

	let pool: string[];
	if (style === 'fintech') pool = fintechMessages;
	else if (style === 'compliance') pool = complianceMessages;
	else if (style === 'dark') pool = darkMessages;
	else pool = [...fintechMessages, ...complianceMessages, ...darkMessages];

	const message = pool[Math.floor(Math.random() * pool.length)];
	return c.json({ message, grade, style });
});
