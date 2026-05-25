<script lang="ts">
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import LandingFooter from '$lib/components/landing/LandingFooter.svelte';
	import { Check, X, Minus, ShieldCheck, FileText, Activity, Zap, Lock, Rocket, GitBranch, Layers, Globe } from 'lucide-svelte';

	type Status = 'yes' | 'no' | 'partial' | 'unique';

	interface Row {
		feature: string;
		detail?: string;
		tenantiq: { status: Status; note?: string };
		optimize365: { status: Status; note?: string };
	}

	interface Section {
		title: string;
		icon: typeof Check;
		rows: Row[];
	}

	interface HorizontalRow {
		feature: string;
		detail?: string;
		tenantiq: { status: Status; note?: string };
		horizontal: { status: Status; note?: string };
	}
	const horizontalAiRows: HorizontalRow[] = [
		{ feature: 'Multi-tenant scope (one console, every customer\'s tenant)', detail: 'MSPs manage 9–250+ Azure AD tenants concurrently — horizontal Claude lives inside ONE tenant\'s M365 at a time', tenantiq: { status: 'unique' }, horizontal: { status: 'no' } },
		{ feature: 'Per-tenant CIS benchmark overrides with audit trail', detail: 'Each customer accepts/omits controls independently with justification; ScubaGear-style', tenantiq: { status: 'unique' }, horizontal: { status: 'no' } },
		{ feature: 'Drift attribution to actor (who-did-it across tenants)', detail: 'Cross-references directoryAudits — Claude in Excel sees the file, not the change history of 25 customer tenants', tenantiq: { status: 'unique' }, horizontal: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (per-tenant)', detail: '402 LICENSE_UPGRADE_REQUIRED with concrete cost per tenant — needed for MSP cost-pass-through', tenantiq: { status: 'unique' }, horizontal: { status: 'no' } },
		{ feature: 'Cross-tenant rollups (MSP backup health / benchmark / alerts)', detail: 'Single page showing every customer\'s posture; horizontal AI has no concept of "all customers"', tenantiq: { status: 'unique' }, horizontal: { status: 'no' } },
		{ feature: 'Account-deletion cascade across MSP\'s data (GDPR Art. 17)', detail: '33-table cascade with contract test; horizontal AI doesn\'t own customer-facing data lifecycle', tenantiq: { status: 'unique' }, horizontal: { status: 'no' } },
		{ feature: 'MSP-billing integration (per-tenant + Microsoft Marketplace co-sell)', tenantiq: { status: 'yes' }, horizontal: { status: 'no' } },
		{ feature: 'AI explainer for security findings (Claude per-control)', detail: 'TenantIQ uses Claude FOR security analysis; horizontal AI uses Claude for productivity', tenantiq: { status: 'yes' }, horizontal: { status: 'partial', note: 'Same model, different surface' } },
		{ feature: 'Lives in Excel/Word/PowerPoint/Outlook to draft documents', tenantiq: { status: 'no', note: 'Not the goal' }, horizontal: { status: 'yes' } },
	];

	interface CoreViewRow {
		feature: string;
		detail?: string;
		tenantiq: { status: Status; note?: string };
		coreview: { status: Status; note?: string };
	}
	const coreviewRows: CoreViewRow[] = [
		{ feature: 'Public per-tenant pricing (no "Request a quote" gate)', detail: 'CoreView gates all 4 tiers behind a sales conversation; TenantIQ ships transparent $45–$99/tenant/mo on the pricing page', tenantiq: { status: 'unique' }, coreview: { status: 'no', note: 'All tiers are "Request pricing"' } },
		{ feature: 'Per-tenant CIS overrides with audit-grade justification', detail: 'CoreView treats exceptions as documentary process (accepted-risk + owner + review date); TenantIQ stores them as structural per-control rows with attribution', tenantiq: { status: 'unique' }, coreview: { status: 'partial', note: 'Documentary only' } },
		{ feature: 'Drift attribution to actor (who changed what when)', detail: 'CoreView compares state vs template; the "who" is missing publicly. TenantIQ cross-references directoryAudits for actor attribution', tenantiq: { status: 'unique' }, coreview: { status: 'no' } },
		{ feature: 'MSP-native model (per-tenant pricing, white-label, MSP RBAC)', detail: 'CoreView\'s MSP page reuses enterprise messaging; logos are Panasonic / Morgan Stanley / Nintendo / Berkshire Hathaway — not MSP partners', tenantiq: { status: 'unique' }, coreview: { status: 'partial' } },
		{ feature: 'MCP server (own + composer of external MCP servers)', detail: 'TenantIQ is registry-listable; Corey AI is non-autonomous + no developer agent surface', tenantiq: { status: 'unique' }, coreview: { status: 'no' } },
		{ feature: 'Autonomous agent loop with rollback (auto-fix + 60s anomaly watch)', tenantiq: { status: 'unique' }, coreview: { status: 'no', note: 'Corey is read-only / per-action approval' } },
		{ feature: 'General CRUD admin API (not just workflow triggers)', detail: 'CoreView API is OAuth + workflow-trigger only; no GraphQL, no third-party UI on top', tenantiq: { status: 'partial', note: 'Tenant-scoped REST + MCP' }, coreview: { status: 'partial', note: 'Workflow-trigger only' } },
		{ feature: 'Free public no-auth scan (lead-gen funnel)', detail: 'CoreView has free Tenant Security Scanner — comparable funnel', tenantiq: { status: 'yes' }, coreview: { status: 'yes' } },
		{ feature: 'CIS Microsoft 365 v3.1 evaluation', tenantiq: { status: 'yes', note: '121 controls, 31+ wired to live Graph' }, coreview: { status: 'yes', note: 'CIS baselines + drift alerts' } },
		{ feature: 'ISO 27001:2022 Annex A telemetry-evaluable controls', detail: 'TenantIQ ships 25 evaluable + honest disclosure of 68 organisational. CoreView is CIS-only', tenantiq: { status: 'yes' }, coreview: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (with concrete cost)', detail: 'CoreView\'s per-user model can\'t cleanly price this per remediation', tenantiq: { status: 'unique' }, coreview: { status: 'no' } },
		{ feature: '"Tenant resilience" / golden-image restore', detail: 'CoreView\'s anchor message — backed by years of enterprise references. TenantIQ doesn\'t fight here', tenantiq: { status: 'partial', note: 'Snapshot + revert exists; not the pitch' }, coreview: { status: 'yes' } },
		{ feature: 'GovRAMP Premier Member', tenantiq: { status: 'no' }, coreview: { status: 'yes' } },
		{ feature: 'Self-serve trial (no demo gate)', tenantiq: { status: 'yes', note: '14-day, no credit card' }, coreview: { status: 'partial', note: 'Free tools only; full platform demo-gated' } },
	];

	interface CompetitorRow {
		feature: string;
		detail?: string;
		tenantiq: { status: Status; note?: string };
		them: { status: Status; note?: string };
	}

	// Nerdio — toughest direct competitor: MSP-native, public per-tenant
	// pricing, $500M Series C, 23k customers, 2024 Microsoft Partner of the
	// Year. Source: .luna/tenantiq/competitive/nerdio-analysis.md
	const nerdioRows: CompetitorRow[] = [
		{ feature: 'CIS Microsoft 365 v3.1 — L1 + L2 across all 7 domains', detail: 'Nerdio CIS partnership ships L1 only; L2 + macOS/iOS "forthcoming". TenantIQ ships 121 controls, L1+L2 tagged, 31+ wired to live Graph today', tenantiq: { status: 'yes' }, them: { status: 'partial', note: 'L1 only; L2 forthcoming' } },
		{ feature: 'Per-tenant CIS overrides with audit-grade justification', detail: 'Nerdio is template-and-deploy or skip-entirely; TenantIQ ships ScubaGear-style per-control overrides with attribution', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Compliance frameworks beyond CIS (SOC 2 / HIPAA / GDPR / ISO 27001:2022)', detail: 'Nerdio publicly maps CIS + CMMC only. ISO 27001 Annex A and SOC 2 are TenantIQ\'s biggest wedge for the compliance-officer buyer', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Drift attribution to actor + generic one-click revert', detail: 'Nerdio drift advertises "track changes over time"; actor attribution + generic revert not observed', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Tracks changes, no actor attribution' } },
		{ feature: 'MCP server (own + composer of external MCP servers)', detail: 'Nerdio Copilot is read-only / script-generative — Script Pro generates a script for a human to run', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Autonomous agent loop with rollback', detail: 'Nerdio AI is non-autonomous; TenantIQ auto-remediator + 60s anomaly watch', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (concrete cost)', detail: 'Nerdio licensing is per-tenant flat; no per-remediation upsell motion', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Public per-tenant pricing for M365 management', detail: 'Both ship public per-tenant pricing — Nerdio $50/tenant/mo, TenantIQ $45–$99 with volume tiers. Even match.', tenantiq: { status: 'yes' }, them: { status: 'yes' } },
		{ feature: 'MSP-native multi-tenant scope', detail: 'Both ship multi-tenant rollups for MSPs. Even match.', tenantiq: { status: 'yes' }, them: { status: 'yes' } },
		{ feature: 'Azure Virtual Desktop / Cloud PC management', detail: 'Nerdio\'s anchor product since 2018; TenantIQ does not ship this surface', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Microsoft 2024 Partner of the Year + Microsoft co-sell', detail: 'Honest disclosure: Nerdio has the marketshare moat; TenantIQ is pre-launch on this dimension', tenantiq: { status: 'no' }, them: { status: 'yes' } },
	];

	// Syskit Point — established (Zagreb-based, founded 2009). Per-user
	// pricing with 100-user floor structurally excludes SMB MSPs. No CIS
	// engine. Source: .luna/tenantiq/competitive/syskit-point-analysis.md
	const syskitRows: CompetitorRow[] = [
		{ feature: 'No per-user floor on small tenants', detail: 'Syskit pricing is €10–€30/user/yr × 100-user minimum = €1,000+/yr/customer floor. TenantIQ\'s $45–$99/tenant/mo covers the entire SMB tail Syskit excludes', tenantiq: { status: 'unique' }, them: { status: 'no', note: '100-user minimum' } },
		{ feature: 'CIS Microsoft 365 v3.1 control engine', detail: 'Syskit ships a "vulnerabilities dashboard" tied to Microsoft Secure Score; the word "CIS" doesn\'t appear in product copy', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'MSP-native multi-tenant scope', detail: 'Syskit has no MSP page, no per-tenant rollup, no white-label, no partner program returned in search', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'AI-powered Copilot readiness analysis', detail: 'Syskit\'s "Copilot Readiness" is rule-based permission scanning. TenantIQ uses Claude for tenant-context-aware reasoning', tenantiq: { status: 'yes' }, them: { status: 'partial', note: 'Rules-based, not AI' } },
		{ feature: 'MCP server + autonomous agents', detail: 'Syskit\'s "AI" is exclusively defensive — preventing Copilot data leaks. No agent, no MCP, no NL admin assistant', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'General platform API (not provisioning-only)', detail: 'Syskit REST API has 4 narrow scopes (Provisioning, AsyncRequests, …); cannot build a third-party UI on top. TenantIQ ships a tenant-scoped REST + MCP', tenantiq: { status: 'yes' }, them: { status: 'partial', note: 'Provisioning-only' } },
		{ feature: 'ISO 27001:2022 Annex A control engine', detail: 'Syskit holds ISO 27001 internally but does not surface it as a control engine for customers', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (concrete cost)', detail: 'Syskit\'s per-user pricing makes this UX impossible', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Self-serve trial (no credit card)', detail: '21-day trial with sandbox demo data — both ship this. Honest match', tenantiq: { status: 'yes' }, them: { status: 'yes' } },
	];

	// AvePoint — public (NASDAQ: AVPT), $416.8M ARR (+27%), 25k customers,
	// 5k channel partners. AgentPulse (governance over external agents) +
	// Elements (M365 multi-tenant, Ydentic-acquired) + Cense (license).
	// Source: .luna/tenantiq/competitive/avepoint-analysis.md
	const avepointRows: CompetitorRow[] = [
		{ feature: 'CIS Microsoft 365 v3.1 — first-class control engine (not template-similarity)', detail: 'AvePoint Baseline Management compares state-vs-template; CIS appears only as a framework reference in marketing — not 100+ controls evaluated against Graph telemetry per-tenant', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Drift-vs-template, not control-by-control' } },
		{ feature: 'Per-tenant CIS overrides with audit-grade justification', detail: 'AvePoint baselines do not advertise per-tenant override + ScubaGear-style justification per control', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Drift attribution to actor (who changed what when)', detail: 'AvePoint detects drift + restores baselines; actor attribution per change not publicly documented', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Drift detection, no actor join' } },
		{ feature: 'ISO 27001:2022 Annex A as a customer-facing control engine', detail: 'AvePoint *holds* ISO 27001 cert; TenantIQ ships 25 evaluable Annex A controls inside the customer\'s tenant view. Different product, same words', tenantiq: { status: 'unique' }, them: { status: 'no', note: 'Holds vendor cert; not a customer engine' } },
		{ feature: 'MCP server + autonomous agents (TenantIQ-as-tool-source)', detail: 'AgentPulse governs / observes external AI agents; AvePoint does not expose itself as an MCP tool surface', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Mailbox-rule + federated-identity + cross-tenant trust + SAML auditors', detail: 'Four detection categories AvePoint does not advertise', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (concrete cost)', detail: 'Cense is license-optimization plumbing — not remediation-time tier upsell', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Public per-tenant pricing (no sales gate)', detail: 'AvePoint is fully sales-gated — G2 reviewers cite "licensing has been a pain to keep updated"', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'FedRAMP Moderate authorization', detail: 'AvePoint has 19 FedRAMP-authorized SaaS solutions + AOS-UG at High. TenantIQ has none — federal motion is structurally theirs to keep', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Records management depth (defensible deletion, retention, classification)', detail: '20-year AvePoint pillar. TenantIQ does not yet ship this; we read M365 Retention Labels but no deletion automation', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Public-company financial transparency', detail: 'NASDAQ-listed; 10-Q/10-K, $416.8M ARR / +27%. Institutional buyers can underwrite vendor risk', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Multi-cloud + cross-platform (Salesforce / GWS / Dynamics / Power Platform)', tenantiq: { status: 'no', note: 'M365-only by design' }, them: { status: 'yes' } },
	];

	// Augmentt — Ottawa-based, MSP-native, CAD $18M Series A Nov 2025,
	// 46 employees. Free 100-seat Discover SKU is their funnel.
	// Source: .luna/tenantiq/competitive/augmentt-analysis.md
	const augmenttRows: CompetitorRow[] = [
		{ feature: 'Compliance breadth (SOC 2 / HIPAA / GDPR / ISO 27001 Annex A)', detail: 'Augmentt advertises none — buyer is the MSP technician, not the compliance officer', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Per-tenant CIS overrides with audit-grade justification', detail: 'Augmentt Secure Autopilot applies templates + drift; no audit-grade per-control exception flow advertised', tenantiq: { status: 'unique' }, them: { status: 'partial' } },
		{ feature: 'Drift attribution to actor + generic one-click revert', detail: 'Augmentt detects + auto-corrects drift; actor attribution + generic revert not advertised', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Detect + auto-correct only' } },
		{ feature: 'AI-powered CIS control explainer (LLM, tenant-context-aware)', detail: 'Augmentt "Autopilot" is scheduled rule automation, not LLM reasoning', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'MCP server + skill marketplace + autonomous agents', detail: 'Augmentt API is partner-gated and report-shaped; cannot host third-party agents', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Mailbox-rule BEC + federated identity + SAML + cross-tenant trust', detail: 'Four detection categories Augmentt doesn\'t advertise', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Microsoft Commercial Marketplace (co-sell + committed-spend retirement)', detail: 'Augmentt sells via Pax8/distribution; not on AppSource', tenantiq: { status: 'yes' }, them: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (per-action 402)', detail: 'Augmentt is per-seat; per-action 402 with named tier/cost requires a different billing model', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Free tier MSPs can stand up without a demo call', detail: 'Augmentt Discover ships 100 free seats. TenantIQ public scan is no-auth but rate-limited; deeper free tier is roadmap, not shipped', tenantiq: { status: 'partial', note: 'Public scan only' }, them: { status: 'yes', note: '100 free Discover seats' } },
		{ feature: 'Google Workspace user-discovery (mixed M365 + GWS estates)', detail: 'Augmentt Discover ingests both. TenantIQ is M365-only by design', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Pax8 / Bluechip distribution muscle', detail: 'Augmentt is in MSP distribution channels TenantIQ has not yet entered', tenantiq: { status: 'no' }, them: { status: 'yes' } },
	];

	// Microsoft 365 Lighthouse — free, but ONLY for CSP partners with
	// customers on Business Premium / E3 / E5 / Defender for Business etc.,
	// max 2,500 users per tenant. The "why pay anyone if Microsoft does
	// this for free" objection-handler.
	// Source: .luna/tenantiq/competitive/m365-lighthouse-analysis.md
	const lighthouseRows: CompetitorRow[] = [
		{ feature: 'Works for non-CSP MSPs and direct buyers (no partner-relationship gate)', detail: 'Lighthouse is gated to Microsoft Cloud Solution Provider partners only — non-CSP MSPs and direct buyers cannot access it', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Works for tenants without Business Premium / E3 / E5 license', detail: 'Lighthouse requires every customer have a qualifying SKU (Business Premium / E3 / E5 / Defender for Business / Windows 365 / Frontline / EDU)', tenantiq: { status: 'unique' }, them: { status: 'no', note: 'SKU minimum required' } },
		{ feature: 'Works for tenants over 2,500 users', detail: 'Lighthouse has a 2,500-user cap per customer tenant — explicitly mid-market-and-up excluded', tenantiq: { status: 'unique' }, them: { status: 'no', note: '2,500-user cap' } },
		{ feature: 'CIS Microsoft 365 v3.1 with per-tenant overrides + audit-grade justification', detail: 'Lighthouse ships an SMB-tailored security baseline, not CIS. CIS / ISO / SOC 2 / HIPAA framework mapping live in (paid) Purview Compliance Manager', tenantiq: { status: 'unique' }, them: { status: 'no', note: 'SMB baseline only' } },
		{ feature: 'ISO 27001:2022 Annex A / SOC 2 / HIPAA / GDPR control mapping', detail: 'Microsoft routes this to paid Purview Compliance Manager. Lighthouse has none', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Drift attribution to actor + one-click revert', detail: 'Lighthouse can tell you something changed, but not who changed it or how to undo', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Drift visible, no actor / no revert' } },
		{ feature: 'Mailbox-rule BEC + federated-identity + cross-tenant trust + SAML auditors', detail: 'None of these detection categories are in Lighthouse', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Production-supported API + MCP server + autonomous agents', detail: 'Lighthouse Graph API has been beta for 5+ years (since 2022 GA), explicitly "not supported for production." No ISV extensibility surface', tenantiq: { status: 'unique' }, them: { status: 'no', note: 'API still beta after 5+ years' } },
		{ feature: 'Public no-auth prospect scan as a sales motion', detail: 'Lighthouse is post-CSP-relationship only — no marketing-funnel use', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'License-tier upsell on remediation block (concrete cost UX)', detail: 'Microsoft monetizes elsewhere; can\'t price this in Lighthouse', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Free for eligible CSP partners', detail: 'Lighthouse is free for any CSP partner managing customers with the right SKUs. TenantIQ is paid software', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Microsoft-native (no Graph rate limits, no third-party vendor risk)', detail: 'Lighthouse runs inside Microsoft\'s own backplane. We can\'t match the depth of native integration or the no-vendor-risk story', tenantiq: { status: 'no' }, them: { status: 'yes' } },
	];

	// BetterCloud — acquired by CoreStack 2026-03-31. Breadth-first SaaS
	// management (100+ apps), shallow per-app. No MSP surface, all pricing
	// gated. Source: .luna/tenantiq/competitive/bettercloud-analysis.md
	const bettercloudRows: CompetitorRow[] = [
		{ feature: 'M365-depth (CIS / Entra drift / SAML / mailbox rules / federated identity)', detail: 'BetterCloud covers 100+ SaaS apps but goes shallow in any single one — none of these M365-specific surfaces are advertised', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Generic file/access governance' } },
		{ feature: 'Public per-tenant pricing (no "Get a quote" gate)', detail: 'BetterCloud pricing is per-user × per-app × per-module — entirely behind sales. TenantIQ ships $45–$99/tenant/mo public', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'MSP-native (multi-tenant, white-label, per-tenant pricing)', detail: 'BetterCloud has no MSP page. CoreStack acquisition (2026-03-31) doubles down on enterprise cloud-governance, not MSP', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'CIS Microsoft 365 v3.1 control engine', detail: 'CIS benchmarking is not a marketed surface at BetterCloud; compliance is generic file/access governance', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'Autonomous agents + MCP server', detail: 'BetterCloud "Self Service Agent" is Slack-bound chatops for password resets / Okta unlocks. CoreStack\'s "Agentic Governance OS" is press-release marketing, not shipping product', tenantiq: { status: 'unique' }, them: { status: 'partial', note: 'Slack chatops, not autonomous' } },
		{ feature: 'Drift attribution to actor', detail: 'BetterCloud automation is workflow-condition-driven; "who changed this and when" is not a surfaced answer', tenantiq: { status: 'unique' }, them: { status: 'no' } },
		{ feature: 'ISO 27001:2022 Annex A engine', detail: 'BetterCloud compliance story is DLP + file governance, not ISO control mapping', tenantiq: { status: 'yes' }, them: { status: 'no' } },
		{ feature: 'Sprint-cadence shipping velocity', detail: 'CoreStack acquisition closed 2026-03-31; integration is the work for the next 12–18 months. TenantIQ ships monthly', tenantiq: { status: 'yes' }, them: { status: 'partial', note: 'Post-acquisition integration window' } },
		{ feature: 'Connected SaaS apps beyond M365 (Google Workspace, Slack, Salesforce, …)', detail: 'BetterCloud\'s 100+ app coverage is genuine breadth. TenantIQ is M365-only by design', tenantiq: { status: 'no' }, them: { status: 'yes' } },
		{ feature: 'Public REST API documentation', detail: 'BetterCloud ships developer.bettercloud.com with ~7 documented APIs + Postman collection — more mature than CoreView. Honest match', tenantiq: { status: 'yes' }, them: { status: 'yes' } },
	];

	const sections: Section[] = [
		{
			title: 'CIS Microsoft 365 Foundations Benchmark',
			icon: ShieldCheck,
			rows: [
				{ feature: '100+ control catalog', tenantiq: { status: 'yes', note: '121 controls across 7 domains' }, optimize365: { status: 'yes' } },
				{ feature: 'Real Graph evaluation per control', detail: 'Not just a checklist — actually checks the tenant', tenantiq: { status: 'yes', note: '31+ wired to live Graph + DoH + Secure Score' }, optimize365: { status: 'partial', note: 'Many controls listed but require manual verification' } },
				{ feature: 'L1 / L2 implementation level tagging', tenantiq: { status: 'yes', note: 'Required field, every control tagged per CIS v3.1' }, optimize365: { status: 'partial' } },
				{ feature: 'Per-tenant control overrides with justification', detail: 'Accept-risk + omit decisions logged for auditor evidence', tenantiq: { status: 'unique', note: 'ScubaGear-style override engine' }, optimize365: { status: 'no' } },
				{ feature: 'NIST 800-53 + MITRE ATT&CK mapping field', tenantiq: { status: 'partial', note: 'Type-defined; populating in progress' }, optimize365: { status: 'no' } },
			],
		},
		{
			title: 'Email security & BEC detection',
			icon: ShieldCheck,
			rows: [
				{ feature: 'SPF / DMARC / DKIM check', tenantiq: { status: 'yes', note: '6 selectors probed via DoH' }, optimize365: { status: 'yes' } },
				{ feature: 'Multi-selector DKIM (Microsoft + Google + custom)', tenantiq: { status: 'yes' }, optimize365: { status: 'partial' } },
				{ feature: 'Mailbox rule audit (BEC indicators)', detail: 'Flags external_redirect + forward-and-delete + suspicious rule names', tenantiq: { status: 'unique', note: '6 risk types, severity-tiered' }, optimize365: { status: 'no' } },
				{ feature: 'Anti-phishing policy evaluation via Secure Score', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
			],
		},
		{
			title: 'Drift detection & rollback',
			icon: GitBranch,
			rows: [
				{ feature: 'Config snapshot capture', tenantiq: { status: 'yes', note: '10 config categories, 90-day KV retention' }, optimize365: { status: 'yes' } },
				{ feature: 'Recursive object diff', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
				{ feature: 'Named baselines (lock "post-SOC2" config)', detail: 'Compare drift against a labeled baseline, not just last snapshot', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'Drift attribution to actor (who-did-it)', detail: 'Cross-references directoryAudits to identify the user that caused the change', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'Generic drift revert via Graph PATCH/POST/DELETE', detail: '3 categories supported initially: CA, authorization, auth methods', tenantiq: { status: 'unique', note: 'Plan + audit-logged apply' }, optimize365: { status: 'no' } },
			],
		},
		{
			title: 'License optimization',
			icon: Layers,
			rows: [
				{ feature: 'Unused license detection', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
				{ feature: 'E5 → E3 downgrade recommendations', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
				{ feature: 'Real Graph activity (mailbox/Teams/SharePoint D30)', tenantiq: { status: 'yes', note: '~600 LOC of real data path' }, optimize365: { status: 'yes' } },
				{ feature: 'License-tier upsell on remediation block', detail: '402 with concrete seat count + monthly cost when action requires Entra P1/P2 you don\'t have', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'Reclamation workflow with approval + dry-run preview', tenantiq: { status: 'yes' }, optimize365: { status: 'partial' } },
			],
		},
		{
			title: 'Compliance frameworks',
			icon: FileText,
			rows: [
				{ feature: 'SOC 2 control mapping', tenantiq: { status: 'partial', note: '4 controls (CC6.1, CC6.2, CC7.2, CC8.1)' }, optimize365: { status: 'yes', note: 'Broader catalog' } },
				{ feature: 'HIPAA control mapping', tenantiq: { status: 'partial', note: '4 controls (164.312a-e)' }, optimize365: { status: 'yes' } },
				{ feature: 'GDPR control mapping', tenantiq: { status: 'partial', note: '4 controls (5.1, 32, 33, 25)' }, optimize365: { status: 'yes' } },
				{ feature: 'ISO 27001:2022 Annex A mapping', detail: '25 telemetry-evaluable controls in 5.x organisational + 8.x technological themes', tenantiq: { status: 'unique', note: 'Honest "68 controls require organisational evidence" disclosure' }, optimize365: { status: 'partial' } },
				{ feature: 'Israeli/EU banking frameworks (BOI 357, PSD2, MiCA, DORA)', tenantiq: { status: 'partial', note: 'Engine pattern in place; 1-2 weeks per framework' }, optimize365: { status: 'no' } },
			],
		},
		{
			title: 'Identity & access governance',
			icon: Lock,
			rows: [
				{ feature: 'Federated identity auditor (Entra workload identity)', detail: 'Flags wildcard subjects, broad repo scopes, privileged SPs, unknown OIDC issuers', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'Cross-tenant trust analyzer', detail: '6 finding types incl. critical Direct Connect inbound from any external tenant', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'SAML federation metadata audit', detail: 'Cert expiry windows (30/60/90d), SHA-1 detection, AuthnRequest signing check', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'PIM-aware admin role review', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
				{ feature: 'Risky user / sign-in monitoring', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
			],
		},
		{
			title: 'GTM & customer-facing',
			icon: Rocket,
			rows: [
				{ feature: 'Public prospect scan (no-auth, domain → gap report)', detail: 'Drop a domain, get DNS auth + tenant ID + federation type + risk score in seconds', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'Branded MSP dashboard (white-label)', tenantiq: { status: 'yes', note: 'R2 logo upload + custom-domain DNS verification flow' }, optimize365: { status: 'partial' } },
				{ feature: 'Per-customer custom domain via DNS challenge', tenantiq: { status: 'yes' }, optimize365: { status: 'no' } },
				{ feature: 'SCIM 2.0 (eq + ne + co + sw + ew + pr + and/or)', detail: 'Full IdP-emitted query support — Okta, Entra ID, OneLogin all work out of the box', tenantiq: { status: 'yes' }, optimize365: { status: 'partial' } },
				{ feature: 'Skill marketplace (modular workflow library)', tenantiq: { status: 'yes', note: '~20 skills incl. credential rotation, group cleanup, license autopilot' }, optimize365: { status: 'no' } },
			],
		},
		{
			title: 'Operational depth',
			icon: Activity,
			rows: [
				{ feature: 'Account-deletion cascade (GDPR Art. 17 / M365 Cert C7)', detail: '33 tables hit with contract test that fails CI on missed table', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: 'Cron + queue infrastructure (Cloudflare Workers)', tenantiq: { status: 'yes', note: '26 cron jobs, 3 queue producers + DLQ' }, optimize365: { status: 'yes' } },
				{ feature: 'Real-time WebSocket alerts (Durable Objects)', tenantiq: { status: 'yes', note: '60s scoped WS tickets' }, optimize365: { status: 'partial' } },
				{ feature: 'AI-powered anomaly detection (Claude)', tenantiq: { status: 'yes' }, optimize365: { status: 'partial' } },
				{ feature: 'Dynamic remediation time estimates from history', detail: 'Median + p90 from remediation_log instead of hardcoded "5-10 minutes"', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
			],
		},
		{
			title: 'Pricing & MSP economics',
			icon: Globe,
			rows: [
				{ feature: 'Per-tenant pricing (not per-user)', tenantiq: { status: 'yes' }, optimize365: { status: 'partial' } },
				{ feature: 'Volume discounts at 10+ / 25+ / 50+ tenants', tenantiq: { status: 'yes' }, optimize365: { status: 'no' } },
				{ feature: 'Free public prospect scan (lead generation)', tenantiq: { status: 'unique' }, optimize365: { status: 'no' } },
				{ feature: '14-day free trial, no credit card', tenantiq: { status: 'yes' }, optimize365: { status: 'yes' } },
			],
		},
	];

	function statusIcon(s: Status) {
		switch (s) {
			case 'yes': return Check;
			case 'no': return X;
			case 'partial': return Minus;
			case 'unique': return Zap;
		}
	}

	const statusClass: Record<Status, string> = {
		yes: 'status-yes',
		no: 'status-no',
		partial: 'status-partial',
		unique: 'status-unique',
	};

	const statusLabel: Record<Status, string> = {
		yes: 'Yes', no: 'No', partial: 'Partial', unique: 'TenantIQ only',
	};

	const totals = $derived.by(() => {
		const flat = sections.flatMap(s => s.rows);
		const tCounts = { yes: 0, no: 0, partial: 0, unique: 0 };
		const oCounts = { yes: 0, no: 0, partial: 0, unique: 0 };
		for (const r of flat) {
			tCounts[r.tenantiq.status]++;
			oCounts[r.optimize365.status]++;
		}
		return { total: flat.length, t: tCounts, o: oCounts };
	});
</script>

<svelte:head>
	<title>TenantIQ vs Optimize365 — Feature Comparison</title>
	<meta name="description" content="Side-by-side comparison: TenantIQ vs Optimize365 across CIS, drift detection, BEC, license optimization, compliance, identity, and MSP economics." />
	<link rel="canonical" href="https://app.tenantiq.app/compare" />
</svelte:head>

<div class="landing">
	<LandingNav />
	{#snippet statusCell(status: Status, note: string | undefined)}
		{@const Icon = statusIcon(status)}
		<div class="cell {statusClass[status]}">
			<span class="status-pill">
				<Icon size={14} />
				{statusLabel[status]}
			</span>
			{#if note}<small>{note}</small>{/if}
		</div>
	{/snippet}
	{#snippet sectionIcon(IconComp: typeof Check)}
		<IconComp size={20} />
	{/snippet}
	<main id="main-content">
		<section class="hero">
			<div class="container">
				<h1>TenantIQ vs Optimize365</h1>
				<p class="lede">
					Honest, audited comparison across {totals.total} features in 9 categories.
					Built from reading the source, not from marketing copy.
				</p>

				<div class="totals">
					<div class="total-card t-us">
						<span class="brand">TenantIQ</span>
						<div class="counts">
							<span class="c-unique">{totals.t.unique} unique</span>
							<span class="c-yes">{totals.t.yes} yes</span>
							<span class="c-partial">{totals.t.partial} partial</span>
							<span class="c-no">{totals.t.no} no</span>
						</div>
					</div>
					<div class="total-card t-them">
						<span class="brand">Optimize365</span>
						<div class="counts">
							<span class="c-unique">{totals.o.unique} unique</span>
							<span class="c-yes">{totals.o.yes} yes</span>
							<span class="c-partial">{totals.o.partial} partial</span>
							<span class="c-no">{totals.o.no} no</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="cmp-section vs-horizontal">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs horizontal AI assistants (Claude in M365 / Copilot)</h2>
					<p class="cmp-subhead">
						When Anthropic shipped Claude-as-one-agent across Excel/Word/PowerPoint/Outlook (May 2026),
						horizontal AI inside a single tenant became commoditized. TenantIQ is built for the part
						horizontal AI can't do: managing <em>other people's</em> tenants at MSP scale.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>Horizontal AI in M365</span>
					</div>
					{#each horizontalAiRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.horizontal.status, r.horizontal.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-coreview">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs CoreView (M365 management incumbent)</h2>
					<p class="cmp-subhead">
						CoreView is the established enterprise M365-management platform — strong references at Panasonic / Morgan Stanley / Nintendo, anchored on "tenant resilience." Their MSP angle is soft (enterprise messaging reused), Corey AI is explicitly non-autonomous, all four pricing tiers are gated behind a sales conversation. TenantIQ's wedge: MSP-native pricing, autonomous agents with rollback, MCP server, drift attribution to actor, ISO 27001:2022 Annex A. We don't fight on golden-image restore.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>CoreView</span>
					</div>
					{#each coreviewRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.coreview.status, r.coreview.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-competitor">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs Nerdio (the MSP-native challenger)</h2>
					<p class="cmp-subhead">
						Nerdio is the toughest competitor in this list. MSP-native, public per-tenant pricing, $500M Series C, 23k customers, 2024 Microsoft Partner of the Year. Don't fight on AVD / Cloud PC / marketshare — sidestep to <strong>compliance breadth</strong> (CIS L1+L2, SOC 2, HIPAA, GDPR, ISO 27001:2022 Annex A vs Nerdio's CIS-L1 + CMMC), <strong>per-tenant CIS overrides</strong>, <strong>autonomous agents + MCP</strong> (Nerdio Copilot is read-only / script-generative), and <strong>drift attribution to actor</strong>.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>Nerdio</span>
					</div>
					{#each nerdioRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.them.status, r.them.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-competitor">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs Syskit Point (M365 governance, Zagreb)</h2>
					<p class="cmp-subhead">
						Syskit Point ships per-user pricing with a <strong>100-user minimum</strong> — €1,000+/yr floor per customer tenant, structurally excluding the SMB tail TenantIQ targets. No CIS engine, no MSP page, no MCP, "AI" is exclusively defensive Copilot-readiness scanning. Their REST API is provisioning-scoped only — cannot host third-party UIs.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>Syskit Point</span>
					</div>
					{#each syskitRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.them.status, r.them.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-competitor">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs BetterCloud (SaaS management, post-acquisition)</h2>
					<p class="cmp-subhead">
						<strong>Acquired by CoreStack 2026-03-31</strong> — five weeks ago. The next 12–18 months are platform-integration work, not feature velocity. BetterCloud's 100+ app coverage is genuine breadth but means each app gets shallow coverage. M365-specific surfaces (CIS / drift attribution / SAML / federated identity) are not advertised. AI is Slack chatops for password resets, not autonomous remediation.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>BetterCloud</span>
					</div>
					{#each bettercloudRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.them.status, r.them.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-competitor">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs AvePoint (public-company governance incumbent)</h2>
					<p class="cmp-subhead">
						AvePoint is NASDAQ-listed (AVPT), $416.8M ARR (+27% YoY), 25,000 customers, 5,000 channel partners, 5x Microsoft Global Partner of the Year. <strong>FedRAMP Moderate</strong> + <strong>records-management depth</strong> are real moats — TenantIQ doesn't fight either. Wedge: CIS as a first-class control engine (not template-similarity), per-tenant overrides with audit-grade justification, ISO 27001:2022 Annex A as a customer-facing engine (not just AvePoint's own vendor cert), MCP + autonomous agents (AgentPulse <em>governs</em> external agents but doesn't expose AvePoint as one), and public per-tenant pricing.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>AvePoint</span>
					</div>
					{#each avepointRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.them.status, r.them.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-competitor">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs Augmentt (low-end MSP-native, Pax8-distributed)</h2>
					<p class="cmp-subhead">
						Augmentt is the SMB-MSP wedge — Ottawa-based, CAD $18M Series A (Nov 2025), 46 employees, in Pax8 distribution. Their <strong>100 free Discover seats</strong> + per-seat economics are real strengths at the bottom of the market; their <strong>Google Workspace user-discovery</strong> works for mixed-estate MSPs. We don't fight per-seat at SMB. Wedge: compliance breadth (SOC 2 / HIPAA / GDPR / ISO), audit-grade CIS (vs their template+drift), MCP + autonomous agents, drift attribution to actor, Microsoft Marketplace co-sell.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>Augmentt</span>
					</div>
					{#each augmenttRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.them.status, r.them.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="cmp-section vs-competitor">
			<div class="container">
				<header class="cmp-header">
					<Zap size={20} />
					<h2>vs Microsoft 365 Lighthouse ("why pay if Microsoft does this for free?")</h2>
					<p class="cmp-subhead">
						Lighthouse is free, Microsoft-native, no vendor risk — we don't compete on any of those. It's also gated: <strong>CSP partners only</strong>, every customer needs Business Premium / E3 / E5 / Defender for Business / Windows 365 / Frontline / EDU, hard <strong>2,500-user cap per tenant</strong>. The Graph API has been beta for 5+ years — explicitly "not supported for production." If you're a CSP managing all-Business-Premium SMB customers under 2,500 users with a basic security-baseline + lifecycle need, Lighthouse is fine. Here's everything it can't do.
					</p>
				</header>
				<div class="cmp-table">
					<div class="cmp-row cmp-row-head">
						<span>Capability</span>
						<span>TenantIQ</span>
						<span>M365 Lighthouse</span>
					</div>
					{#each lighthouseRows as r (r.feature)}
						<div class="cmp-row">
							<div class="feature">
								<strong>{r.feature}</strong>
								{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
							</div>
							{ statusCell(r.tenantiq.status, r.tenantiq.note)}
							{ statusCell(r.them.status, r.them.note)}
						</div>
					{/each}
				</div>
			</div>
		</section>

		{#each sections as section (section.title)}
			<section class="cmp-section">
				<div class="container">
					<header class="cmp-header">
						{@render sectionIcon(section.icon)}
						<h2>{section.title}</h2>
					</header>
					<div class="cmp-table">
						<div class="cmp-row cmp-row-head">
							<span>Capability</span>
							<span>TenantIQ</span>
							<span>Optimize365</span>
						</div>
						{#each section.rows as r (r.feature)}
							<div class="cmp-row">
								<div class="feature">
									<strong>{r.feature}</strong>
									{#if r.detail}<p class="feature-detail">{r.detail}</p>{/if}
								</div>
								{ statusCell(r.tenantiq.status, r.tenantiq.note)}
								{ statusCell(r.optimize365.status, r.optimize365.note)}
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/each}

		<section class="cta">
			<div class="container">
				<h2>See the difference yourself</h2>
				<p>Drop your domain into the public scan. No login, no credit card. Get a real gap report in 30 seconds.</p>
				<div class="cta-actions">
					<a href="/prospect" class="btn-primary">Run free prospect scan</a>
					<a href="/pricing" class="btn-secondary">See pricing</a>
				</div>
			</div>
		</section>
	</main>
	<LandingFooter />
</div>

<style>
	.landing { min-height: 100vh; background: var(--color-bg); padding-top: 5rem; }
	.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

	.hero { padding: 3rem 0 2rem 0; }
	.hero h1 { font-size: 2.5rem; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
	.lede { font-size: 1.0625rem; color: var(--color-text-secondary); max-width: 680px; line-height: 1.5; margin: 1rem 0 2rem 0; }

	.totals { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
	.total-card { padding: 1rem 1.25rem; border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); }
	.total-card.t-us { border-color: color-mix(in srgb, var(--color-primary) 40%, transparent); background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); }
	.total-card .brand { font-weight: 600; font-size: 0.875rem; }
	.total-card .counts { display: flex; gap: 0.875rem; flex-wrap: wrap; margin-top: 0.5rem; font-size: 0.8125rem; }
	.c-unique { color: var(--color-primary); font-weight: 600; }
	.c-yes { color: var(--color-success); }
	.c-partial { color: var(--color-warning); }
	.c-no { color: var(--color-text-secondary); }

	.cmp-section { padding: 1.5rem 0; }
	.cmp-section.vs-horizontal,
	.cmp-section.vs-coreview,
	.cmp-section.vs-competitor { padding-top: 2rem; border-top: 1px dashed var(--color-border); }
	.cmp-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
	.cmp-header h2 { font-size: 1.25rem; font-weight: 600; margin: 0; }
	.cmp-subhead { width: 100%; font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.55; margin: 0.5rem 0 0 0; max-width: 760px; }

	.cmp-table { border: 1px solid var(--color-border); border-radius: 0.75rem; overflow: hidden; background: var(--color-surface); }
	.cmp-row { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; padding: 0.875rem 1rem; border-bottom: 1px solid var(--color-border); }
	.cmp-row:last-child { border-bottom: none; }
	.cmp-row-head { background: color-mix(in srgb, var(--color-bg-secondary) 60%, transparent); font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--color-text-secondary); letter-spacing: 0.04em; padding: 0.625rem 1rem; }

	.feature strong { display: block; font-size: 0.9375rem; font-weight: 600; line-height: 1.3; }
	.feature-detail { margin: 0.25rem 0 0 0; font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.4; }

	.cell { display: flex; flex-direction: column; gap: 0.25rem; }
	.cell small { font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.3; }

	.status-pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500; width: fit-content; }
	.status-yes .status-pill { background: color-mix(in srgb, var(--color-success) 12%, transparent); color: var(--color-success); }
	.status-no .status-pill { background: color-mix(in srgb, var(--color-text-secondary) 10%, transparent); color: var(--color-text-secondary); }
	.status-partial .status-pill { background: color-mix(in srgb, var(--color-warning) 12%, transparent); color: var(--color-warning); }
	.status-unique .status-pill { background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); font-weight: 600; }

	.cta { padding: 4rem 0 6rem 0; text-align: center; }
	.cta h2 { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.5rem 0; }
	.cta p { color: var(--color-text-secondary); max-width: 560px; margin: 0 auto 1.5rem auto; }
	.cta-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.btn-primary, .btn-secondary { padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 500; text-decoration: none; }
	.btn-primary { background: var(--color-primary); color: white; }
	.btn-secondary { background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); }

	@media (max-width: 768px) {
		.totals { grid-template-columns: 1fr; }
		.cmp-row { grid-template-columns: 1fr; }
		.cmp-row-head { display: none; }
		.cell::before { content: attr(data-label); font-size: 0.75rem; color: var(--color-text-secondary); display: block; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.04em; }
		.hero h1 { font-size: 1.75rem; }
	}
</style>
