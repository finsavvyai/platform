/**
 * Vendor metadata for /compare permalinks. Each entry powers:
 *   - The row group on the main /compare page
 *   - The single-frame view at /compare/<slug>
 *   - The printable 1-pager at /compare/<slug>/print
 *
 * Row arrays themselves still live in /compare/+page.svelte for now
 * (they're large; importing into the [vendor] route works via the
 *  rowsBySlug map built in data.ts).
 */

export type Status = 'yes' | 'no' | 'partial' | 'unique';

export interface CompetitorRow {
	feature: string;
	detail?: string;
	tenantiq: { status: Status; note?: string };
	them: { status: Status; note?: string };
}

export interface VendorMeta {
	slug: string;
	name: string;
	tagline: string;
	subhead: string;
	dontFightOn: string[];
	dossierUrl?: string;
}

export const VENDORS: VendorMeta[] = [
	{
		slug: 'horizontal-ai',
		name: 'Horizontal AI assistants (Claude in M365 / Copilot)',
		tagline: 'AI inside one tenant — TenantIQ is the layer above',
		subhead: 'When Anthropic shipped Claude-as-one-agent across Excel/Word/PowerPoint/Outlook (May 2026), horizontal AI inside a single tenant became commoditized. TenantIQ is built for the part horizontal AI can\'t do: managing other people\'s tenants at MSP scale.',
		dontFightOn: ['AI inside Excel/Word/PowerPoint', 'Single-tenant productivity'],
	},
	{
		slug: 'coreview',
		name: 'CoreView',
		tagline: 'M365 management incumbent — anchored on tenant resilience',
		subhead: 'CoreView is the established enterprise M365-management platform — strong references at Panasonic / Morgan Stanley / Nintendo, anchored on "tenant resilience." MSP angle is soft (enterprise messaging reused), Corey AI is explicitly non-autonomous, all four pricing tiers gated behind a sales conversation.',
		dontFightOn: ['Tenant resilience / golden-image restore', 'GovRAMP Premier Member', 'Enterprise scale references'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/coreview-analysis.md',
	},
	{
		slug: 'nerdio',
		name: 'Nerdio',
		tagline: 'The MSP-native challenger — toughest direct competitor',
		subhead: 'Nerdio is MSP-native, $500M Series C ($1B+ valuation), 23k customers, 2024 Microsoft Partner of the Year, ships public per-tenant pricing. Don\'t fight on AVD / Cloud PC / marketshare. Wedge: compliance breadth (CIS L1+L2, SOC 2, HIPAA, GDPR, ISO 27001:2022 Annex A vs Nerdio\'s CIS-L1 + CMMC), per-tenant CIS overrides, autonomous agents + MCP (Nerdio Copilot is read-only / script-generative), drift attribution to actor.',
		dontFightOn: ['Azure Virtual Desktop / Cloud PC', 'MSP marketshare (23k customers)', 'Microsoft co-sell motion', 'General automation breadth'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/nerdio-analysis.md',
	},
	{
		slug: 'syskit',
		name: 'Syskit Point',
		tagline: 'Zagreb-based M365 governance — per-user with 100-user floor',
		subhead: 'Syskit Point ships per-user pricing with a 100-user minimum (€1,000+/yr floor per customer tenant) — structurally excludes the SMB tail TenantIQ targets. No CIS engine, no MSP page, no MCP. "AI" is exclusively defensive Copilot-readiness scanning. REST API is provisioning-scoped only.',
		dontFightOn: ['REST API maturity (Swagger spec + GitHub mirror)', 'Self-serve trial UX'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/syskit-point-analysis.md',
	},
	{
		slug: 'bettercloud',
		name: 'BetterCloud',
		tagline: 'SaaS management — acquired by CoreStack 2026-03-31',
		subhead: 'Acquired by CoreStack five weeks ago. The next 12–18 months are platform-integration work, not feature velocity. BetterCloud\'s 100+ app coverage is genuine breadth but means each app gets shallow coverage. M365-specific surfaces (CIS / drift attribution / SAML / federated identity) are not advertised. AI is Slack chatops for password resets, not autonomous remediation.',
		dontFightOn: ['100+ SaaS app breadth', 'Public REST API maturity', 'Google Workspace coverage'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/bettercloud-analysis.md',
	},
	{
		slug: 'avepoint',
		name: 'AvePoint',
		tagline: 'Public-company governance incumbent (NASDAQ: AVPT)',
		subhead: 'NASDAQ-listed, $416.8M ARR (+27% YoY), 25,000 customers, 5,000 channel partners, 5x Microsoft Global Partner of the Year. FedRAMP Moderate + records-management depth are real moats. Wedge: CIS as a first-class control engine (not template-similarity), per-tenant overrides with audit-grade justification, ISO 27001:2022 Annex A as a customer-facing engine (not just AvePoint\'s own vendor cert), MCP + autonomous agents, public per-tenant pricing.',
		dontFightOn: ['FedRAMP Moderate authorization', 'Records management depth (defensible deletion)', 'Public-company financial transparency', 'Multi-cloud breadth'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/avepoint-analysis.md',
	},
	{
		slug: 'augmentt',
		name: 'Augmentt',
		tagline: 'Low-end MSP-native, Pax8-distributed',
		subhead: 'Ottawa-based, CAD $18M Series A (Nov 2025), 46 employees, in Pax8 distribution. 100 free Discover seats + per-seat economics are real strengths at the bottom of the market. We don\'t fight per-seat at SMB. Wedge: compliance breadth (SOC 2 / HIPAA / GDPR / ISO), audit-grade CIS (vs their template+drift), MCP + autonomous agents, drift attribution to actor, Microsoft Marketplace co-sell.',
		dontFightOn: ['100 free Discover seats', 'Google Workspace user-discovery', 'Pax8 / Bluechip distribution'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/augmentt-analysis.md',
	},
	{
		slug: 'lighthouse',
		name: 'Microsoft 365 Lighthouse',
		tagline: '"Why pay anyone if Microsoft does this for free?"',
		subhead: 'Lighthouse is free, Microsoft-native, no vendor risk — we don\'t compete on any of those. It\'s also gated: CSP partners only, every customer needs Business Premium / E3 / E5 / Defender for Business / Windows 365 / Frontline / EDU, hard 2,500-user cap per tenant. Graph API has been beta for 5+ years — explicitly "not supported for production." If you\'re a CSP managing all-Business-Premium SMB customers under 2,500 users with a basic security-baseline + lifecycle need, Lighthouse is fine. Here\'s everything it can\'t do.',
		dontFightOn: ['Free for eligible CSP partners', 'Microsoft-native (no Graph rate limits)', 'Zero third-party vendor risk'],
		dossierUrl: 'https://github.com/finsavvyai/tenantiq/blob/main/.luna/tenantiq/competitive/m365-lighthouse-analysis.md',
	},
];

export function vendorBySlug(slug: string): VendorMeta | null {
	return VENDORS.find((v) => v.slug === slug) ?? null;
}
