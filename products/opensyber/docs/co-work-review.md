
OpenSyber
UX/UI Review & Recommendations
Production Dashboard + Landing Page
Date: March 21, 2026
Site: opensyber.cloud
Reviewed by: Automated Browser Testing + Manual Inspection
  Executive Summary
OpenSyber's dashboard at opensyber.cloud delivers a comprehensive AI agent security platform with 18+ sidebar pages covering agent monitoring, cloud security posture management, compliance, attack path analysis, and marketplace functionality. The dark-themed UI is visually consistent and professional. All pages load correctly, navigation works flawlessly, and empty states provide clear guidance.
However, the landing page has a critical CSS animation bug that renders most content nearly invisible, and several UX improvements would strengthen the product for enterprise buyers. This review covers all tested pages with prioritized findings and actionable recommendations.
Testing Scope
Pages Tested
Navigation SectionPage NameStatusTop NavOverview (Dashboard)PassTop NavSkillsPassTop NavAudit LogsPassTop NavNotificationsPassTop NavMarketplacePassTop NavSettingsPassSecurityAgent ActivityPassSecurityCloud SecurityPassSecurityCSPM FindingsPassSecurityTeam AgentsPassSecurityAgent PoliciesPassSecurityAlert ChannelsPassSecurityViolationsPassSecurityAttack PathsPassSecurityAsset InventoryPassSecurityOASF CompliancePassSecuritySOC2 ReadinessPassSecuritySLA MonitorPassExternalLanding PageIssues FoundExternalPublic MarketplacePass  Findings
IDSeverityPageFindingDescription & RecommendationF-01CriticalLanding PageCSS scroll animations brokenIntersectionObserver-based scroll animations are not firing, leaving multiple sections stuck at opacity:0. Hero section is visible but most body sections (problem statement, three layers, TokenForge, deploy, testimonials, footer CTA) are nearly invisible against the dark background. This is the single biggest issue: first-time visitors see an almost blank page. FIX: Either remove the animation CSS entirely and set opacity:1 by default, or debug the IntersectionObserver thresholds and ensure the .visible class is being applied on scroll.F-02HighLanding PageClerk in Development ModeThe sign-in page shows a 'Development mode' badge from Clerk. This significantly undermines trust for enterprise prospects evaluating the platform. FIX: Switch to a production Clerk instance in the Clerk dashboard and update environment variables.F-03MediumDashboardInstance name typo: 'Trst Agent'The main dashboard and Settings page show the instance named 'Trst Agent' instead of 'Test Agent' (or a real name). This appears on the overview card and Settings. FIX: Rename the instance in Settings or via API.F-04MediumMarketplaceEmpty marketplace with no seeded contentBoth the dashboard Marketplace and public /marketplace page show 'No skills found.' An empty marketplace reduces perceived platform maturity. FIX: Seed 5-10 built-in security skills (e.g., OWASP scanner, secret detector, dependency auditor) so new users see an active ecosystem.F-05MediumOverviewSecurity Score shows 72/100 without explanationThe security score badge shows 72/100 but there is no breakdown or explanation of what factors contribute to this score or how to improve it. FIX: Add a tooltip or drill-down showing score components (e.g., agent config, policies, cloud accounts connected).F-06MediumAgent ActivityExtension sync warning lacks direct linkThe yellow 'Extension not yet syncing' banner tells users to open VS Code settings but doesn't provide a direct link to the VS Code extension in the marketplace. FIX: Add an 'Install Extension' deep link to the VS Code marketplace listing.F-07LowAll PagesNo loading indicators on page transitionsNavigating between sidebar pages has no loading skeleton or spinner. On slower connections this may cause users to click multiple times. FIX: Add a subtle top progress bar or skeleton loaders for content areas.F-08LowSettingsSecurity Badge URL uses workers.dev domainThe embeddable security badge markdown/HTML snippet references opensyber-api.broad-dew-49ad.workers.dev instead of a branded API domain. FIX: Use a custom domain like api.opensyber.cloud for the badge endpoint.F-09LowSOC2 ReadinessNo subtitle or description textSOC2 Readiness page has only a title and empty state, unlike OASF Compliance which has '15 controls for agent governance' as a subtitle. FIX: Add a subtitle like 'Map your security posture to SOC2 Trust Service Criteria'.F-10LowSLA MonitorMissing subtitle and CTASLA Monitor has no descriptive subtitle and no action button. Other pages consistently have both. FIX: Add subtitle like 'Track uptime and response time SLAs' and a 'Configure SLA' button.F-11InfoSidebarSidebar label inconsistencyThe sidebar has 'Dashboard' at the very bottom which navigates to /dashboard (the Overview). This duplicates the 'Overview' link at the top. Consider removing one to reduce confusion.F-12InfoAll PagesNo breadcrumbs for deep navigationPages under Security don't show breadcrumbs. For enterprise dashboards with 18+ pages, breadcrumbs help with orientation. Consider adding them below the page title.  UX Strengths
The platform demonstrates several strong design patterns worth preserving:
•	Consistent dark theme across all pages with good contrast ratios on cards and text.
•	Every empty state provides contextual guidance (what the page does + how to get started).
•	Clear visual hierarchy: page title, subtitle, action button (top-right), then content area.
•	Color-coded severity indicators (red/orange/yellow/white/green) used consistently across CSPM, Violations, and Agent Activity.
•	Settings page is feature-rich: subscription info, Growth Kit with embeddable badges, referral program, credential vault, and danger zone. This is enterprise-grade.
•	Attack Paths page with Agent Sessions, Crown Jewels, and Blast Radius metrics is a strong differentiator.
•	Sidebar navigation is well-organized with a clear 'Security' section divider.
•	OASF Compliance with 15 controls and 'Run Assessment' CTA clearly communicates value.
•	Notifications page has an inline form for adding channels (Email/Webhook/Slack), reducing friction.
•	Audit Logs include date range pickers and CSV export, critical for compliance workflows.
  Priority Recommendations
Immediate (This Week)
1.	Fix landing page CSS opacity bug (F-01). This is blocking all organic traffic conversion. Either set all animated elements to opacity:1 as default, or fix the IntersectionObserver script.
2.	Switch Clerk to production mode (F-02). The development badge is the second-most damaging issue for credibility.
3.	Rename 'Trst Agent' to a proper demo name like 'Production Agent' (F-03).
Short-term (Next 2 Weeks)
4.	Seed the marketplace with 5-10 built-in skills (F-04). This shows platform maturity and gives users something to explore immediately.
5.	Add security score breakdown tooltip or detail page (F-05). Enterprise buyers want to understand scoring methodology.
6.	Update the security badge URL to use a branded domain (F-08).
7.	Add subtitles/CTAs to SOC2 Readiness and SLA Monitor pages (F-09, F-10) for consistency.
Medium-term (Next Month)
8.	Add loading skeletons for page transitions (F-07) to improve perceived performance.
9.	Consider adding breadcrumbs for deep navigation (F-12).
10.	Remove the duplicate Dashboard/Overview sidebar link (F-11).
11.	Add an onboarding wizard or guided tour for new users to reduce time-to-value.
12.	Consider adding a global search (Cmd+K) for quickly finding pages, settings, and findings.
Summary
OpenSyber's dashboard is well-built with a professional, consistent dark UI and comprehensive feature set across 18+ pages. The core product architecture is solid. The most urgent fix is the landing page opacity bug (F-01), which effectively hides the marketing site from visitors. Combined with switching Clerk to production mode (F-02), these two fixes alone will dramatically improve the first-impression experience for enterprise prospects.
The dashboard itself is in good shape with consistent empty states, clear navigation, and enterprise-grade features like audit logs, credential vault, referral program, and embeddable security badges. Seeding the marketplace and adding score breakdowns will round out the experience for evaluation-stage buyers.
Finding Count by Severity
SeverityCountCritical1High1Medium4Low4Info2Total12
