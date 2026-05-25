/**
 * Public share message generator — no auth required.
 * Generates funny, viral share messages about TenantIQ using Claude.
 */
import { Hono } from 'hono';
import { AI } from '../lib/constants';
import type { AppEnv } from '../app/types';

export const shareRoutes = new Hono<AppEnv>();

const SYSTEM_PROMPT = `You are Larry David having a COMPLETE meltdown about Microsoft 365 security on social media. You're writing posts about TenantIQ (an M365 security platform for MSPs).

This is peak Curb Your Enthusiasm energy — the kind of scene where the tuba hits and everyone stares. You are UNHINGED about IT problems the way Larry gets unhinged about someone taking his parking spot.

Generate ONE short, funny share message (max 200 chars for Twitter, 280 for LinkedIn).

CRITICAL COMEDY RULES:
- Every IT problem is a PERSONAL attack on you. MFA disabled? That's a BETRAYAL. License waste? That's THEFT. No compliance? You can't BREATHE.
- Escalate absurdly. A missing security policy becomes a reason to question the entire relationship. An unused license is grounds for divorce.
- Use the EXACT cadence: start calm, discover something insane, spiral into indignant disbelief, then land on a punchline
- Larry's greatest hits: the long uncomfortable stare, "Do you respect wood?"-level obsession applied to M365, getting kicked out of places for being right about security, losing friends over MFA
- Physical comedy in text: describe the awkward silence, the stare, people backing away, security being called
- The funniest posts feel like Larry recounting a REAL incident that escalated WAY beyond reason
- TenantIQ is the only thing keeping Larry from total societal collapse
- NO emojis, NO hashtags, NO corporate speak, NO "game-changer"
- Make it so funny that IT people screenshot it and send it to their group chat
- End with the URL: https://app.tenantiq.app

Examples of ENERGY LEVEL (don't copy, but match this insanity):
- "My dentist asked what I do. I said I secure M365 tenants. He said 'oh is that hard?' IS THAT HARD?! I stood up. Still had the bib on. Walked out. Mouth still open from the cleaning. I will NOT be disrespected."
- "Found 200 unused licenses at a client. $47K a year. I presented this at their meeting. They said 'let's table it.' TABLE IT?! I flipped the table. Not literally. But spiritually? That table was FLIPPED."
- "Jeff told me he doesn't believe in zero trust. I said Jeff, I don't believe in YOUR MARRIAGE but I don't go around broadcasting it. Use TenantIQ. Fix your tenants. Fix your life, Jeff."`;

const FALLBACK_MESSAGES = [
	"My dentist asked what I do. I said I secure M365 tenants. He said 'is that hard?' IS THAT HARD?! I stood up. Still had the bib on. Walked out. Mouth still open from the cleaning. Drove straight home. Opened TenantIQ. All green. THAT'S how hard it is. https://app.tenantiq.app",
	"Found 200 unused E5 licenses at a client. $47K a year. I presented this at their meeting. They said 'let's table it.' TABLE IT?! I stood up so fast my chair rolled into the VP of Finance. Security escorted me out. I emailed them the TenantIQ report from the parking lot. https://app.tenantiq.app",
	"Jeff told me he doesn't believe in zero trust. I said Jeff, I don't believe in YOUR MARRIAGE but I don't go around broadcasting it. Use TenantIQ. Fix your tenants. Fix your life, Jeff. Jeff unfriended me. Jeff's tenants are still a disaster. https://app.tenantiq.app",
	"Guy at a conference tells me he manages 40 tenants with spreadsheets. SPREADSHEETS. I grabbed his badge to make sure he was a real person and not some kind of performance artist. He was real. I'm still processing this. TenantIQ exists, sir. https://app.tenantiq.app",
	"My client had MFA disabled for every admin. EVERY. ADMIN. I called an emergency meeting. They said 'Larry, calm down.' CALM DOWN?! Your front door is WIDE OPEN and you're telling ME to calm down?! I set up TenantIQ on their tenant DURING the argument. https://app.tenantiq.app",
	"Auditor walks in, very smug, clipboard, the whole thing. 'Show me your compliance evidence.' I spin my laptop around. One click. TenantIQ. Full report. 94 controls passing. He just... stood there. Didn't know what to do with his clipboard. Best moment of my career. https://app.tenantiq.app",
	"I asked a colleague how many CIS controls he's passing. He said 'most of them.' MOST OF THEM. That's like a pilot saying he lands MOST of his planes. I can't talk to this man anymore. I physically cannot. TenantIQ tracks all 100+. Like an ADULT. https://app.tenantiq.app",
	"My wife asked why I check TenantIQ before breakfast. I said 'because if a tenant's MFA is off, I can't enjoy eggs.' She said 'that's insane.' I said 'NO. What's insane is 60% of breaches start with compromised credentials. You want me to eat EGGS while that's happening?' We ate in silence. https://app.tenantiq.app",
	"Someone told me they don't need AI for security in 2026. I did the stare. You know the stare. Thirty seconds of unbroken eye contact. He looked away first. I win. Also, TenantIQ's AI caught 14 anomalies at his org last week. But sure, he doesn't NEED it. https://app.tenantiq.app",
	"I lost a friend over license optimization. A FRIEND. He was wasting $3K a month on licenses for employees who LEFT THE COMPANY. I told him. He said 'mind your business.' I said 'THIS IS MY BUSINESS. LITERALLY. I DO THIS FOR A LIVING.' TenantIQ would've caught it day one. RIP friendship. https://app.tenantiq.app",
	"Got kicked out of a dinner party for talking about tenant security. The HOST asked me to leave. I said 'fine, but your SharePoint permissions are a NIGHTMARE and everyone at this table knows it.' Nobody backed me up. TenantIQ would've backed me up. https://app.tenantiq.app",
	"My barber asked if I'm stressed. I said 'I manage M365 security for 30 tenants.' He said 'that sounds easy.' I got out of the chair. Half my hair was cut. I drove home like that. Opened TenantIQ. Everything was fine. It was the only thing in my life that was fine. https://app.tenantiq.app",
];

shareRoutes.post('/generate', async (c) => {
	const apiKey = c.env.ANTHROPIC_API_KEY;
	const body = await c.req.json<{ platform?: string }>().catch((): { platform?: string } => ({}));
	const platform = body.platform || 'twitter';

	// Try AI generation first, fall back to pre-written messages
	if (apiKey) {
		try {
			const platformHint = platform === 'linkedin'
				? 'Generate for LinkedIn (professional but still funny, can be slightly longer, 280 chars max).'
				: 'Generate for Twitter/X (punchy, max 200 chars including the URL).';

			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': AI.API_VERSION,
				},
				body: JSON.stringify({
					model: AI.MODEL,
					max_tokens: 256,
					system: SYSTEM_PROMPT,
					messages: [{ role: 'user', content: `${platformHint}\n\nGenerate a fresh, funny share message. Be creative and unpredictable.` }],
				}),
			});

			const data = await res.json() as any;
			const text = data.content?.[0]?.text;
			if (text) {
				return c.json({ message: text.trim(), source: 'ai' });
			}
		} catch {
			// Fall through to fallback
		}
	}

	// Fallback: random pre-written message
	const msg = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
	return c.json({ message: msg, source: 'curated' });
});

// GET version for simple fetching
shareRoutes.get('/random', (c) => {
	const msg = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
	return c.json({ message: msg, source: 'curated' });
});
