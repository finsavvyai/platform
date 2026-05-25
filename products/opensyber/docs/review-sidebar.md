# Sidebar Navigation — Full Audit & Restructure Proposal

---

## THE CURRENT STATE: 29 Items, 1 Group Label, Chaos

Here's what you have right now in the sidebar. I've clicked through every single page:

**Top section (no label):** Overview, Skills, Audit Logs, Notifications, Marketplace, Settings — 6 items

**"SECURITY" label:** Agent Activity, Cloud Security, CSPM Findings, Team Agents, Agent Policies, Alert Channels, Violations, Attack Paths, Asset Inventory, OASF Compliance, SOC2 Readiness, SLA Monitor — 12 items

**Then (no label, continues scrolling):** Dashboard (Security), Alerts, Incidents, Policies, Network, File Integrity, Vulnerabilities, Compliance, Threat Map, Uptime, Achievements — 11 items

That's **29 navigation items** with only one section header ("SECURITY"), and you need to scroll the sidebar itself to see them all. Several pages are throwing "Security Dashboard Error" (Dashboard/Security, Network, Threat Map, and possibly others). Some pages show empty states with no data. And items like "Policies" appear twice (Agent Policies AND Policies under the security section), as do "Compliance" (OASF Compliance AND Compliance).

This is a serious UX problem. You're right that it's too crowded. But it's not just a density issue — it's an information architecture problem. There's no hierarchy, no logical grouping, duplicate concepts, broken pages sitting next to functional ones, and the user has no mental model for where anything lives.

---

## WHY THIS HURTS (PER PERSONA)

For the **indie builder** (your free tier user), 29 items is completely overwhelming. They need 4–5 things: Overview, Skills, Marketplace, Logs, and Settings. Everything else is noise that makes your product feel complicated and unfinished.

For the **platform engineer**, the lack of structure means they can't find what they need. Is network monitoring under "Security > Network" or "Agent Activity"? Is compliance under "OASF Compliance" or "Compliance" or "SOC2 Readiness"? They'll click three wrong things before finding the right one.

For the **CISO/security leader**, an unorganized sidebar signals immature product thinking. Enterprise security tools (Wiz, Snyk, CrowdStrike) all have clean, hierarchical navs. This feels like a prototype.

---

## PROPOSED RESTRUCTURE

I'm going to map all 29 items into a collapsible sidebar with 5 top-level groups. Each group starts collapsed (showing just the icon + label) and expands to reveal sub-items. Only the active group stays open. This drops the visible items from 29 down to roughly 5–7 at any time.

### New Structure:

**1. Home** (no sub-items, always visible)
→ `/dashboard` — Your current Overview page. The landing pad. Shows security score, instance status, health metrics, recent events.

**2. Agent** (collapsible group)
This is everything about YOUR agent instance — its skills, its logs, what it's doing.

Sub-items:
- **Skills** → `/dashboard/skills` — Installed skills on your agent
- **Marketplace** → `/dashboard/marketplace` — Browse and install new skills
- **Activity** → `/dashboard/agents` — Current "Agent Activity" page (renamed, shorter)
- **Audit Logs** → `/dashboard/logs` — Event history

Rationale: These four items are the day-to-day operational pages. A developer lands here, manages their agent, and checks logs. "Activity" is the renamed "Agent Activity" (shorter, less redundant since it's already under the Agent group). "Marketplace" moves inside this group because installing skills is an agent-level action, not a top-level destination.

**3. Security** (collapsible group)
This is the investigative/monitoring layer — what's happening from a security perspective.

Sub-items:
- **Score Dashboard** → `/dashboard/security` — The security score breakdown (currently broken — fix this first)
- **Alerts** → `/dashboard/security/alerts` — Active alerts
- **Incidents** → `/dashboard/security/incidents` — Incident history with timeline
- **Vulnerabilities** → `/dashboard/security/vulnerabilities` — CVE tracking
- **Network** → `/dashboard/security/network` — Network activity monitoring (currently broken)
- **File Integrity** → `/dashboard/security/files` — File change monitoring
- **Threat Map** → `/dashboard/security/threats` — Geographic threat visualization (currently broken)

Rationale: This is the "SOC analyst" view. Everything here is about detecting, investigating, and responding to security events. The Score Dashboard becomes the landing page for this group. "Alerts" and "Incidents" are the two most-used items, so they're at the top.

**4. Governance** (collapsible group)
This is the policy, compliance, and posture management layer — the CISO cares about this.

Sub-items:
- **Policies** → `/dashboard/security/policies` — Security policies and rules (merge "Agent Policies" and "Policies" into one page)
- **Compliance** → `/dashboard/security/compliance` — Compliance overview (merge "OASF Compliance" and "Compliance")
- **SOC2 Readiness** → `/dashboard/soc2` — SOC2 assessment
- **CSPM Findings** → `/dashboard/cloud/findings` — Cloud posture findings
- **Attack Paths** → `/dashboard/attack-paths` — Blast radius visualization
- **Asset Inventory** → `/dashboard/assets` — All discovered assets

Rationale: This groups everything about "proving you're secure" and "defining what secure means." Policies go first because they're the foundation. The duplicates (Agent Policies + Policies, OASF Compliance + Compliance) get merged into single pages. "CSPM Findings" stays separate from "Cloud Security" — the Cloud Security page becomes a setup/integration page, not a nav item (it's just "Connect Account" — that belongs in Settings).

**5. Team** (collapsible group — only visible on Team/Enterprise plans)
This is everything about multi-user and multi-instance management.

Sub-items:
- **Members** → `/dashboard/agents/team` — Renamed from "Team Agents" (confusing name — are these agents that belong to the team, or team member management?)
- **Alert Channels** → `/dashboard/agents/alert-channels` — Slack, email, webhook config
- **Violations** → `/dashboard/agents/violations` — Policy violation tracking
- **SLA Monitor** → `/dashboard/sla` — Uptime and SLA tracking

Rationale: For the indie builder on a free plan, none of this is relevant. Hide it entirely. For Team/Enterprise users, this is where they manage the organizational layer. "Violations" goes here because it's about policy enforcement across the team, not individual security events.

**Bottom rail (always visible, pinned to bottom):**
- **Settings** → `/dashboard/settings` — Subscription, instance config, integrations
- **Notifications** → `/dashboard/settings/notifications` — Alert preferences
- **Achievements** → `/dashboard/achievements` — Gamification (cute, keep it, but don't give it equal weight to security tooling)
- **User avatar / profile** — Current user, plan badge

---

### Items I'm REMOVING from the sidebar entirely:

**"Cloud Security"** → This is just a "Connect Account" setup screen. Move it into Settings as an "Integrations" tab. It's not a page you visit daily — it's a one-time setup action.

**"Dashboard" (the one under Security at #19)** → This conflicts with the main Overview. Rename and merge into "Score Dashboard" under the Security group.

**"Uptime"** → Merge into SLA Monitor. They're essentially the same concept.

**"OASF Compliance"** → Merge into a single "Compliance" page with tabs for different frameworks (OASF, SOC2, ISO 27001). Having three separate compliance pages (OASF, SOC2, and Compliance) is fragmented.

---

## VISUAL DESIGN OF THE NEW SIDEBAR

**Collapsed state:** Each group shows an icon + label. A small chevron indicates expandability. The active group has a subtle left border highlight in blue-400.

**Expanded state:** Sub-items indent slightly (12–16px) and use a lighter font weight (400 vs 500 for group headers). The active page gets a bg-blue-500/10 highlight with a blue-400 left border.

**Animation:** Smooth 200ms ease-out expand/collapse. Items don't pop — they slide.

**Group icons:** Home (grid/dashboard icon), Agent (cpu/bot icon), Security (shield icon), Governance (scale/document icon), Team (users icon). Each icon uses neutral-400 when inactive, blue-400 when active.

**Plan-gated items:** For Team group on Free/Personal plans, show the group header grayed out with a small lock icon and a tooltip: "Available on Team plan." This creates gentle upsell pressure without cluttering the nav.

**Badge indicators:** Show a small red dot on "Alerts" when there are unresolved alerts. Show a number badge on "Violations" if there are active violations. This gives the sidebar functional value beyond navigation.

---

## PER-PERSONA SIDEBAR EXPERIENCE

### Persona 1: Indie Builder (Free plan)

They see:
- **Home** (always open)
- **Agent** → Skills, Marketplace, Activity, Audit Logs
- **Security** → Score Dashboard, Alerts, Vulnerabilities
- **Team** (locked, grayed out, with "Upgrade" tooltip)
- **Settings**, **Achievements** (bottom rail)

That's roughly 10 visible items max when fully expanded — versus the current 29. The Security group starts collapsed. They primarily live in Home and Agent.

### Persona 2: Platform Engineer (Pro/Team plan)

They see everything:
- **Home**
- **Agent** → full list
- **Security** → full list (this is their primary working area)
- **Governance** → Policies, Compliance, CSPM, Attack Paths, Assets
- **Team** → Members, Alert Channels, Violations, SLA
- **Settings** (bottom rail)

They'll keep Security expanded most of the time, with Governance as their secondary. The collapsible groups mean they can hide what they're not actively using.

### Persona 3: CISO (Enterprise plan)

They primarily care about:
- **Home** (executive summary)
- **Governance** → Compliance, SOC2 Readiness, Policies, Attack Paths
- **Security** → Score Dashboard, Incidents (for investigations)
- **Team** → SLA Monitor, Violations

They may never touch the Agent group directly. Consider allowing role-based sidebar customization: let admins configure which groups are visible for each role.

### Persona 4: MSP/Agency Operator (Team/Enterprise)

They need an additional layer the current structure doesn't support: a **client/instance switcher** at the very top of the sidebar, above all groups. Something like a dropdown: "Trst Agent ▾" that lets them switch between client instances. Each switch reloads the dashboard for that client. This is more important than any sidebar restructure — without it, managing multiple clients is impossible.

---

## ADDITIONAL SIDEBAR ISSUES TO FIX

**Broken pages must not be in the nav.** The Security Dashboard, Network, and Threat Map all throw "Security Dashboard Error." Either fix them or remove them from the sidebar until they work. A navigation item that leads to an error page is worse than no navigation item at all.

**The "Unbound" badge next to the user avatar.** This refers to TokenForge device binding. It's a small detail but it currently looks like an error state — gray text, no context. Add a tooltip explaining what it means and a one-click action to bind the device. Right now it's a confusing dead badge.

**The plan badge at the bottom ("Plan: Team").** Good that it's visible, but make it actionable — clicking it should open the billing/plan page, not just be a label.

**Sidebar width.** At 240px, it's slightly narrow for some of the longer labels ("CSPM Findings", "Agent Policies", "Alert Channels"). The restructured version with shorter sub-item labels inside groups should help, but consider testing at 256px.

**Empty states.** When someone clicks into a section with no data (Asset Inventory, SLA Monitor, Attack Paths), the empty states are inconsistent. Some say "No data" with a CTA, others just show a blank table. Standardize all empty states to follow the pattern: icon + heading + one line of explanation + primary action button. The Cloud Security empty state actually does this well — use that as the template.

---

## QUICK COMPARISON: BEFORE vs. AFTER

**Before (current):**
29 flat items, 1 section header, requires scrolling, duplicates, broken links, overwhelming for every persona.

**After (proposed):**
5 collapsible groups + 3 bottom-rail items. Maximum ~10 items visible at a time. Plan-gated visibility. Badge indicators for actionable items. No broken pages in the nav. No duplicates. Each persona has a clear "home base" group.

This is one of the highest-impact changes you can make to the product right now. The sidebar is where users form their mental model of what your product does and how to navigate it. Right now it's saying "we built 29 features and threw them all in a list." The restructured version says "we built a security platform with a clear architecture, and here are the layers."