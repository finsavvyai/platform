/**
 * Server-rendered OG card SVG for /scan/:domain shareable URLs.
 *
 * Returns `image/svg+xml` — Slack/Discord/LinkedIn/Telegram render SVG
 * unfurls correctly. Twitter requires PNG/JPEG, but B2B social shares
 * predominantly land on Slack/LinkedIn so SVG covers the bulk of traffic.
 *
 * 1200x630 is the spec for og:image (1.91:1). Layout:
 *   ┌──────────────────────────────────────┐
 *   │  TenantIQ                            │
 *   │  domain.com                          │
 *   │                                      │
 *   │   [score ring]   123 findings        │
 *   │                  Mail: M365          │
 *   │                  Tenant: Verified    │
 *   │                                      │
 *   │  Free public scan · 4 sources        │
 *   └──────────────────────────────────────┘
 */

import type { ProspectScanResult } from './public-scan';

function gradeFor(score: number): string {
	if (score >= 90) return 'A';
	if (score >= 75) return 'B';
	if (score >= 60) return 'C';
	if (score >= 45) return 'D';
	return 'F';
}

function colorFor(score: number): string {
	if (score >= 75) return '#34C759';
	if (score >= 50) return '#FF9500';
	return '#FF3B30';
}

function escapeXml(s: string): string {
	return s.replace(/[<>&'"]/g, (c) => ({
		'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
	}[c] as string));
}

export function renderOgCard(result: ProspectScanResult): string {
	const grade = gradeFor(result.score);
	const color = colorFor(result.score);
	const domain = escapeXml(result.domain);
	const findings = result.findings.length;
	const tenantStatus = result.tenant.tenantExists ? 'Verified' : 'Not found';
	const mailProvider = escapeXml(result.mailProvider.provider);

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#0b0d12"/>
			<stop offset="1" stop-color="#1a1d28"/>
		</linearGradient>
	</defs>
	<rect width="1200" height="630" fill="url(#bg)"/>

	<!-- Brand -->
	<text x="80" y="100" font-family="-apple-system, system-ui, sans-serif" font-size="28" font-weight="700" fill="#007AFF">TenantIQ</text>
	<text x="80" y="135" font-family="-apple-system, system-ui, sans-serif" font-size="16" font-weight="500" fill="#8E8E93">M365 Security Scan · Free</text>

	<!-- Domain -->
	<text x="80" y="220" font-family="-apple-system, system-ui, sans-serif" font-size="56" font-weight="800" fill="#FFFFFF">${domain}</text>

	<!-- Score ring -->
	<circle cx="220" cy="400" r="105" fill="none" stroke="#2a2d38" stroke-width="14"/>
	<circle cx="220" cy="400" r="105" fill="none" stroke="${color}"
		stroke-width="14" stroke-linecap="round"
		stroke-dasharray="${(result.score / 100 * 660).toFixed(1)} 660"
		transform="rotate(-90 220 400)"/>
	<text x="220" y="395" font-family="-apple-system, system-ui, sans-serif" font-size="28" font-weight="700" fill="${color}" text-anchor="middle">${grade}</text>
	<text x="220" y="440" font-family="-apple-system, system-ui, sans-serif" font-size="48" font-weight="800" fill="#FFFFFF" text-anchor="middle">${result.score}<tspan font-size="20" fill="#8E8E93">/100</tspan></text>

	<!-- Stats -->
	<g font-family="-apple-system, system-ui, sans-serif" fill="#FFFFFF">
		<text x="380" y="345" font-size="22" font-weight="600">Findings</text>
		<text x="380" y="380" font-size="36" font-weight="800" fill="${findings > 0 ? '#FF3B30' : '#34C759'}">${findings}</text>

		<text x="380" y="430" font-size="22" font-weight="600">Mail provider</text>
		<text x="380" y="465" font-size="28" font-weight="700">${mailProvider}</text>

		<text x="780" y="345" font-size="22" font-weight="600">Microsoft tenant</text>
		<text x="780" y="380" font-size="28" font-weight="700" fill="${result.tenant.tenantExists ? '#34C759' : '#FF9500'}">${tenantStatus}</text>

		<text x="780" y="430" font-size="22" font-weight="600">Federation</text>
		<text x="780" y="465" font-size="22" font-weight="500" fill="#C7C7CC">${escapeXml(result.tenant.federationType)}</text>
	</g>

	<!-- Footer -->
	<line x1="80" y1="540" x2="1120" y2="540" stroke="#2a2d38" stroke-width="1"/>
	<text x="80" y="585" font-family="-apple-system, system-ui, sans-serif" font-size="18" font-weight="500" fill="#8E8E93">Free scan · 4 public sources · No signup</text>
	<text x="1120" y="585" font-family="-apple-system, system-ui, sans-serif" font-size="18" font-weight="600" fill="#007AFF" text-anchor="end">app.tenantiq.app/scan/${domain}</text>
</svg>`;
}
