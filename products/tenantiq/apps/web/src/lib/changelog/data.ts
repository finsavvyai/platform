/**
 * Changelog data — themed groupings of shipped commits on `main`.
 *
 * Snapshot date: 2026-05-07. Each entry maps to one or more real commits
 * verifiable on GitHub at github.com/finsavvyai/tenantiq/commits/main.
 * Unlike most marketing changelogs, this one only lists work that has
 * actually shipped to production (api.tenantiq.app + app.tenantiq.app).
 */

export type EntryType = 'feat' | 'fix' | 'docs' | 'security' | 'infra';

export interface ChangelogEntry {
	date: string; // ISO yyyy-mm-dd
	type: EntryType;
	title: string;
	body: string;
	commits?: string[]; // short SHAs
}

export interface ChangelogWeek {
	label: string;
	entries: ChangelogEntry[];
}

export const CHANGELOG_GENERATED_AT = '2026-05-08';

export const CHANGELOG: ChangelogWeek[] = [
	{
		label: 'Week of May 5 — competitive coverage + per-vendor permalinks',
		entries: [
			{
				date: '2026-05-06', type: 'docs',
				title: 'Per-vendor /compare permalinks + printable 1-pagers',
				body: '8 deep-linkable vendor URLs (/compare/coreview, /compare/nerdio, /compare/syskit, /compare/bettercloud, /compare/avepoint, /compare/augmentt, /compare/lighthouse, /compare/horizontal-ai). Each ships a printable /print sub-route — Cmd+P / Ctrl+P produces a clean PDF directly from the browser, no server-side renderer.',
			},
			{
				date: '2026-05-06', type: 'docs',
				title: 'Six competitor analyses with cited research',
				body: 'CoreView, Nerdio, Syskit Point, BetterCloud, AvePoint, Augmentt, Microsoft 365 Lighthouse — internal docs at .luna/tenantiq/competitive/, every claim sourced. /compare page now shows 9 frames (8 competitors + the original Optimize365 9-category table).',
			},
			{
				date: '2026-05-06', type: 'fix',
				title: 'SSE / WebSocket 401 on logged-in marketing pages',
				body: 'Layout opened tenant-scoped real-time pipes on /ciso-demo and /compare causing reconnect-storms in console. Cookie-name drift (`__tenantiq_session` vs canonical `tenantiq_session`) in 2 files. WS handshake switched to fetch-then-ticket flow because SameSite=Lax blocks cross-subdomain cookies on Upgrade.',
			},
			{
				date: '2026-05-05', type: 'docs',
				title: 'CISO demo — architecture explainer + 15-minute talk track + guided page',
				body: 'docs/sales/HOW_IT_WORKS.md (one-pager: 5-layer architecture, agent loop, 10 safety controls, trust boundaries, compliance map). docs/sales/CISO_DEMO_SCRIPT.md (8-step talk track, no slides, anticipated questions). Live page at app.tenantiq.app/ciso-demo.',
			},
		],
	},
	{
		label: 'Week of May 5 — autonomy + composer + timewarp',
		entries: [
			{
				date: '2026-05-06', type: 'feat',
				title: 'TenantIQ-as-MCP-client (composer)',
				body: 'TenantIQ now both ships and consumes MCP. Per-org KV-backed registry of external MCP servers (Microsoft Graph MCP, GitHub MCP, Moody\'s MCP, your own); aggregated tools/list across registered servers; tools/call forward via /api/mcp-external. Settings UI at /settings/mcp-clients. 6 unit tests.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Time-traveling agent — reconstruct any past tenant state',
				body: 'POST /api/timewarp/:tenantId { at: ISO } reconstructs tenant config from latest snapshot before target + every drift in chronological order until target + audit log narrative. UI at /security/timewarp with datetime picker + 5 presets (1h–90d ago). 5 unit tests.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Sub-second SSE push via Durable Object pub/sub',
				body: 'logAgentAction now publishes to TenantEvents Durable Object after every D1 insert. /api/agent-actions/stream forwards SSE through the DO; falls back to D1 poll if binding unavailable. 11 caller sites migrated.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: '/agents live-activity dashboard with approve/abort',
				body: 'Public-facing autonomous-agent feed scoped to the calling org. 24h summary cards (success / failed / rolled-back), filters by agent + status, AgentActionRow component with action-icon and metadata-aware subtitle. Pending-approval rows surface Approve & Abort buttons; Approve re-enqueues live with a 60s anomaly watch.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Autonomous remediator queue + scanner cron',
				body: 'auto-fix-scanner cron picks eligible drift events hourly, matches against source-pinned recipes (only 2 ship today: legacy-auth CA revert, Microsoft Authenticator method re-enable), enqueues with per-tenant dryRun flag. auto-fix-handler runs runRemediation against real Graph; 60s anomaly watch; auto-rollback on alert spike. Per-tenant daily cap of 5.',
			},
		],
	},
	{
		label: 'Week of May 5 — MCP server expansion',
		entries: [
			{
				date: '2026-05-06', type: 'feat',
				title: 'MCP server — 13 tools, 6 prompts, 3 resources',
				body: '/api/mcp full Streamable HTTP transport: initialize, tools/list+call, resources/list+read, prompts/list+get, SSE stream. 10 read tools (CIS / compliance / Intune / PIM / Defender / drift / alerts / skills / MSP-backups / tenants), 3 write tools (acknowledge_alert, acknowledge_drift, apply_skill_template — admin-role-gated server-side). 6 prompts wrap skill templates + posture explainer + QBR. Public unauthenticated /api/mcp-public namespace with scan_domain.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Long-lived MCP API keys (tiq_*)',
				body: 'GET / POST / DELETE /api/mcp-keys. Plaintext shown once, SHA-256 hash stored. Auth middleware accepts Authorization: Bearer tiq_*. UI at /settings/api-keys with one-time copy, revoke, embedded Claude Desktop config snippet.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Demo MCP key — 60-second Claude Desktop trial',
				body: 'Fixed key tiq_demo_visitor_2026 maps to a synthetic 3-tenant org (Acme / Globex / Initech) with realistic CIS posture and drift events. Anyone can paste into Claude Desktop config and have a working integration in 60 seconds with no signup.',
			},
		],
	},
	{
		label: 'Week of May 5 — viral + autonomous foundation',
		entries: [
			{
				date: '2026-05-06', type: 'feat',
				title: 'Public live counter + /leaderboard',
				body: 'Anonymized aggregate counters on the landing — total scans, controls audited, findings raised, fixes auto-applied, drift reverts. Polls /api/stats/public every 30s with lerp animation. Full /leaderboard page with 7d agent activity rollup by agent / severity / action.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Agent-narrated public scan via SSE',
				body: '/scan/:domain now consumes SSE narration from /api/prospect/scan/sse — DNS / tenant / mail / federation / report stages emit running→done events as the page paints. Feels like watching a Claude agent work in real time.',
			},
			{
				date: '2026-05-06', type: 'feat',
				title: 'Autonomous Tenant Auditor cron',
				body: 'Every 6h per active tenant: pick top 3 unfixed CIS controls, Claude drafts MSP-branded remediation email, Resend ships it to org\'s notification email. Skill-gated per tenant (auto-remediator skill must be active). 5h cooldown.',
			},
			{
				date: '2026-05-06', type: 'infra',
				title: 'agent_actions table — autonomous activity log',
				body: 'Every Claude-driven agent action records one row. Powers the live counter, /leaderboard rollups, and per-MSP timeline. Migration 0023 applied to prod D1.',
			},
		],
	},
	{
		label: 'Week of May 5 — security depth',
		entries: [
			{
				date: '2026-05-04', type: 'feat',
				title: 'PIM audit + Defender XDR coverage',
				body: 'Privileged Identity Management audit: standing privileged role assignments, perpetual assignments, MFA gap on privileged users, 4+ roles on one user. UI at /security/pim. Defender coverage from secureScoreControlProfiles classified office / endpoint / identity / cloud-apps. UI at /security/defender. 17 unit tests across both.',
			},
			{
				date: '2026-05-04', type: 'feat',
				title: 'Intune endpoint posture + MSP all-tenant backup overview',
				body: 'Intune scanner: 8 finding types across device hygiene + compliance policy + MAM. UI at /security/intune. MSP-wide /msp/backups rollup — every customer\'s backup health (ok / warning / error / off) in one view. Fixes 2 backups bugs found in audit (missing schedule routes, no MSP cross-tenant view).',
			},
			{
				date: '2026-05-04', type: 'feat',
				title: 'Compliance trend chart + AI explainer UI + dynamic OG image',
				body: 'CIS score-trend SVG chart with improving / regressing / stable verdict. Compliance gap explainer (Claude per-control, KV-cached 24h). Dynamic OG image for /scan/:domain shareable URLs.',
			},
		],
	},
	{
		label: 'Week of May 5 — auth + onboarding fixes',
		entries: [
			{
				date: '2026-05-05', type: 'fix',
				title: 'Cookie-name drift — login appeared to succeed then 401d',
				body: 'OAuth callback wrote __tenantiq_session; auth middleware read tenantiq_session. Login completed, browser stored cookie under wrong name, /auth/me 401d. Imported SESSION_COOKIE from middleware/auth.ts so writer + reader stay locked. 2 regression tests pin the cookie-name contract.',
			},
			{
				date: '2026-05-05', type: 'fix',
				title: 'Stuck "Permissions granted" page + tenant onboarding on consent',
				body: 'Two stacked bugs. /api/auth/onboard-org didn\'t carry orgId in the OAuth state, so the admin-consent callback couldn\'t link the tenant to anyone. Page relied on window.close() which silently no-ops for non-popup tabs. Both fixed; 4 regression tests pin the state→orgId stash flow.',
			},
			{
				date: '2026-05-05', type: 'fix',
				title: 'Layout stuck on Loading… without localStorage',
				body: 'Layout effects gated on localStorage.tenantiq_user existing — when missing, auth.loading stayed true forever. Always probe /api/auth/me on mount; HttpOnly cookie is the only source of truth. Subsequently dropped localStorage entirely.',
			},
		],
	},
];
