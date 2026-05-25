The **actual dashboard is better than the marketing site in one important way**:

It looks like there is a **real product behind it**.

But it still has serious problems. Right now it feels like a **founder-built internal admin panel**, not a polished compliance platform a bank, MSB, or serious fintech team would trust every day.

Here is the brutal read.

## Executive read

**What works**

* The nav breadth is strong. It suggests real scope: alerts, screening, monitoring, cases, risk, media, crypto, audit, lists, billing, team, admin.
* The product is clearly more than a landing page. That helps trust.
* The primary actions are visible: Screen Entity, PEP Check, Crypto Scan, Transaction Screen, Freetext Scan, Batch Jobs.
* Language selector is a good sign for cross-border compliance use.

**What is wrong**

* The dashboard feels **empty, generic, and under-designed**.
* It mixes **customer UI, internal ops UI, and platform admin UI** in one messy left nav.
* Naming is inconsistent and amateur in places.
* The zero-state experience is weak and low-trust.
* The metrics are not decision-useful.
* There are visible signs of unfinished product quality.

**My blunt verdict**
This is a **real backend wearing a rough frontend**.
A buyer might believe the engine exists, but a daily user will still feel they are operating an unfinished system.

---

# Top critical issues

## 1. The information architecture is bloated and confused

**Severity:** Critical
**Area:** UX / IA / Trust

You have all of this in one nav:

* customer workflows
* compliance workflows
* system settings
* admin tools
* platform controls

That is bad.

A normal tenant user should not feel like they are living inside:

* product app
* tenant admin
* internal staff console
* superadmin console

all at once.

### Why this matters

This creates:

* cognitive overload
* permission confusion
* trust issues
* “what am I even looking at?” friction

### Fix

Split the product into explicit scopes:

* **Operations**: Dashboard, Alerts, Screening, Monitoring, Batch
* **Compliance**: Cases, Risk, PEP, Media, Transactions, Crypto
* **Administration**: Team, Billing, API Keys, Webhooks, Configuration
* **Advanced / Admin-only**: Tenants, System Health, Data Sources, Operations, Scheduled Tasks

Then hide sections based on role.

Right now it looks like **everyone can see the wiring**.

---

## 2. Naming is inconsistent and visibly amateur

**Severity:** Critical
**Area:** UX / Trust / Product polish

You have menu items like:

* `task_history`
* `operations`
* `scheduled_tasks`

This is unacceptable in a production fintech dashboard.

That looks like raw internal route names leaked into the UI.

### Why this matters

This instantly signals:

* unfinished product
* developer-first UI
* low polish
* weak QA discipline

### Fix

Rename immediately:

* `task_history` → **Task History**
* `operations` → **Operations**
* `scheduled_tasks` → **Scheduled Tasks**

Also audit the entire UI for snake_case, raw IDs, raw enum names, or backend terminology exposed to users.

This is one of the fastest trust killers in the whole dashboard.

---

## 3. The dashboard homepage is too empty and not operationally useful

**Severity:** High
**Area:** UX / Product usefulness

The main screen shows:

* Total Alerts: 0
* Cleared Today: 0
* Escalated: 0
* Avg Resolution: 0h
* Compliance Overview: all 0
* Recent Activity: “No activity yet”
* Top Entities: “alerts / Unknown”

This is a weak first-run state.

### Why this matters

A new user logging in should feel:

* guided
* oriented
* confident
* shown what to do next

Instead they get:

* empty metrics
* dead charts
* no meaningful onboarding
* weird filler

### Fix

Create a proper **first-run empty state dashboard**:

* headline: “You haven’t run any screenings yet”
* 3 guided actions:

  * Screen your first entity
  * Upload a batch file
  * Connect API keys / webhooks
* show a sample workflow
* show what data will appear after first use
* link to docs / sample API request

Right now the dashboard feels empty, not welcoming.

---

## 4. “Top Entities” is broken or useless

**Severity:** High
**Area:** QA / UX

It currently shows:

* `01`
* `alerts`
* `Unknown`

That is either broken placeholder logic or garbage data formatting.

### Why this matters

This makes the whole dashboard feel unreliable.

If a compliance user sees one broken widget, they start wondering:

* are the metrics also wrong?
* are the alerts trustworthy?
* are the lists updating properly?

### Fix

Either:

* hide the widget until real data exists
* or show a meaningful empty state:

  * “No screened entities yet”
  * “Run screening to populate top entities”

Never show junk placeholders in regulated software.

---

## 5. The metrics are shallow and don’t help a compliance team operate

**Severity:** High
**Area:** Product / UX

Current top-level metrics:

* Total Alerts
* Cleared Today
* Escalated
* Avg Resolution

These are not enough.

### Why this matters

A compliance dashboard should help answer:

* what needs attention now?
* where is risk rising?
* what queue is growing?
* what should the analyst do next?
* where are bottlenecks?

### What is missing

You should have metrics like:

* pending reviews
* high-risk matches
* SLA breaches
* unresolved transaction alerts
* new list updates affecting monitored entities
* screening volume by channel
* false positive rate
* top sanction list hit sources
* case aging buckets

### Fix

Redesign dashboard KPIs around operational decision-making, not generic SaaS analytics.

Right now it feels like “dashboard cards because dashboards have cards.”

---

## 6. The primary actions are decent, but the grouping is weak

**Severity:** Medium
**Area:** UX

You have 6 prominent action buttons:

* Screen Entity
* PEP Check
* Crypto Scan
* Transaction Screen
* Freetext Scan
* Batch Jobs

That’s good in concept. But they currently read like a loose button wall.

### Why this matters

A compliance user thinks in workflow groups, not feature list groups.

### Fix

Group them under categories:

**Screening**

* Screen Entity
* Transaction Screen
* Crypto Scan

**Enhanced Due Diligence**

* PEP Check
* Freetext Scan

**Bulk Operations**

* Batch Jobs

That makes the homepage feel intentional.

---

## 7. The dashboard mixes product seriousness with startup gimmick language

**Severity:** Medium
**Area:** Tone / Trust

You still have phrases like:

* “Run 6-layer sanctions screening”

That is okay for marketing, but inside the dashboard the user does not need brand theater.

### Fix

Replace with more operational wording:

* “Run entity screening against sanctions lists”
* “Review politically exposed person risk”
* “Screen wallet addresses against sanctions and risk lists”

Inside the product, clarity beats branding.

---

## 8. There are still ambiguous icon-only controls

**Severity:** High
**Area:** UX / Accessibility / Trust

I can see:

* Close menu button
* Collapse button
* Switch to light mode button
* Toggle menu button
* an empty button near the language selector
* logout icon button

Some are labeled, which is good for accessibility, but visually this still risks becoming icon soup.

### Why this matters

Icon clutter makes enterprise products feel harder to use and less polished.

### Fix

* remove the unlabeled empty button entirely
* ensure visible tooltips for icon-only controls
* reduce redundant controls
* unify header actions into a cleaner top bar

The empty button near the language selector is especially bad. It looks broken.

---

## 9. Role boundaries are unclear and dangerous-looking

**Severity:** High
**Area:** Security UX / Trust

The presence of:

* Admin
* Platform
* Tenants
* Data Sources
* System Health

inside the same visible nav as normal workflows raises questions.

### Why this matters

Even if permissions are enforced correctly server-side, the UI currently signals:

* overexposed power
* unclear tenant boundaries
* mixed audience design
* potential accidental misuse

### Fix

You need visible role segmentation:

* Analyst
* Compliance Manager
* Tenant Admin
* Platform Admin

And the UI should reflect that.

A customer should not feel like they are one click away from internal platform internals unless that is truly their role.

---

## 10. Search is too generic

**Severity:** Medium
**Area:** UX

Current control:

* `Search... ⌘K`

That’s fine as a shell, but in this product it should do more.

### It should search across:

* entities
* alerts
* cases
* wallets
* lists
* API keys
* docs/help
* settings pages

### Fix

Turn global search into a real command center:

* recent entities
* recent cases
* quick actions
* page navigation
* keyboard-first ops

Otherwise it is just cosmetic SaaS furniture.

---

# Detailed dashboard audit by area

## 1. Dashboard homepage

### What works

* Quick actions are visible
* Basic summary exists
* Compliance overview exists conceptually

### What is weak

* No narrative
* No onboarding
* No prioritization
* Metrics too generic

### What is broken

* “Top Entities” content
* dead/empty visuals
* all-zero state with weak guidance

### What feels amateur

* placeholder-like charts
* no explanatory context
* no useful “why am I here?” layer

### What hurts trust

* junk widget output
* all-zero metrics with no support
* unclear whether the system is properly configured

### Fixes

* create a first-run dashboard state
* create an active-ops dashboard state
* create a manager dashboard state
* hide useless widgets if there is no data

### Priority

**P0**

---

## 2. Navigation

### What works

* breadth of product surface area is strong
* nav is comprehensive

### What is weak

* too many items
* poor grouping
* mixed role scopes

### What is broken

* raw route names leaking into UI

### What feels amateur

* `task_history`
* `scheduled_tasks`

### What hurts trust

* customers seeing internal-looking sections

### Fixes

* role-based nav
* collapse advanced sections
* rename all backend-style labels
* add active-state clarity and group headers that are actually meaningful

### Priority

**P0**

---

## 3. Screening workflows

### What works

* the key workflows are clearly present
* strong product breadth:

  * entity
  * PEP
  * crypto
  * transaction
  * freetext
  * batch

### What is weak

* not grouped by user goal
* not explained in business terms

### What feels amateur

* internal brand language in operational UI

### Fixes

* restructure homepage action groups
* add one-line outcome-based labels
* show which flow is recommended for which need

### Priority

**P1**

---

## 4. Compliance tooling depth

### What works

* Cases
* Risk Assessment
* PEP
* Adverse Media
* Transactions
* Crypto Screening

This is good. It gives the product legitimacy.

### What is weak

* we cannot see whether these are coherent together
* likely too many parallel surfaces without one operational case model

### Risk

This may be feature sprawl rather than unified workflow.

### Fix

Make “Cases” the central object:

* alerts feed into cases
* transactions feed into cases
* PEP/media enrich cases
* crypto attaches evidence to cases

If every module is separate, the product becomes fragmented fast.

### Priority

**P1**

---

## 5. Visual design / polish

### What works

* the app appears structured
* likely dark-mode capable
* modern admin shell baseline

### What is weak

* unclear hierarchy
* too many nav items
* too much utilitarian text
* not enough design distinction between primary and secondary content

### What feels cheap

* empty buttons
* raw route labels
* dead widgets
* generic cards

### Fix

* stronger spacing system
* more meaningful widget hierarchy
* consistent card styles
* better zero states
* remove all UI artifacts that look accidental

### Priority

**P1**

---

## 6. Accessibility

### Likely positives

* several aria-labels exist, which is better than nothing

### Issues

* too many icon-only controls
* unclear visible labels
* likely keyboard complexity in giant nav
* possible weak focus hierarchy
* dense sidebar may be difficult for assistive users

### Fix

* ensure visible focus states
* reduce icon-only ambiguity
* improve semantic grouping
* support skip links and keyboard flows through nav/action area

### Priority

**P2**

---

## 7. Trust and security perception

### What works

* Audit Log, API Keys, Webhooks, Team, Billing all exist
* that helps the product feel real

### What hurts trust

* mixed admin/platform exposure
* unfinished labels
* broken data widgets
* weak zero-state messaging

### Fix

* make role boundaries obvious
* show configuration completeness
* show system health only to correct roles
* add “workspace health” / “setup checklist” for new tenants

### Priority

**P0**

---

# Persona-by-persona reaction

## Compliance analyst

**First thought:** “There’s a lot here. Where do I start?”
**Stops them:** empty state, weak guidance, nav overload
**Needs:** case-driven workflow, clearer queues, real priorities

## Compliance manager

**First thought:** “Does this help me run the team?”
**Stops them:** shallow metrics, all-zero cards, unclear operational dashboard
**Needs:** SLA, case aging, backlog, risk trends

## Technical buyer

**First thought:** “Okay, this is a real product.”
**Stops them:** raw labels, role confusion, weak polish
**Needs:** confidence that the frontend discipline matches backend seriousness

## Enterprise buyer

**First thought:** “This is promising but still rough.”
**Stops them:** amateur details, mixed admin exposure, unfinished elements
**Needs:** cleaner information architecture, role segmentation, more mature ops UX

---

# What to fix first

## Phase 1 — immediate

1. Remove/fix all empty buttons
2. Rename leaked backend labels
3. Build proper zero-state dashboard
4. Separate nav by role and product area
5. Fix broken “Top Entities” widget

## Phase 2 — operational maturity

6. Redesign KPIs around compliance operations
7. Group actions by workflow
8. Make Cases the center of the operating model
9. Add setup checklist for new tenants

## Phase 3 — polish and trust

10. Clean top bar actions
11. Improve visual hierarchy
12. Improve responsive/mobile dashboard behavior
13. Strengthen accessibility and keyboard UX

---

# Final brutal verdict

## What makes the dashboard look weak

* leaked internal naming
* broken/empty widgets
* mixed scopes in the nav
* poor zero-state design

## What makes it hard to trust

* unfinished controls
* role confusion
* operational metrics that do not actually help operate compliance

## What would stop a buyer

* the feeling that the system is powerful but not yet disciplined
* the fear that the UI is exposing too much internal complexity
* uncertainty that day-to-day analyst workflows are actually smooth

## What absolutely must be fixed before serious customer rollout

* nav architecture
* naming polish
* zero states
* KPI usefulness
* widget correctness
* role segmentation

## Would I approve this dashboard as-is for serious fintech customers?

**Not yet.**

I would say:

* **backend/product scope:** promising
* **frontend maturity:** not ready
* **daily operational UX:** undercooked
* **trust polish:** insufficient

This dashboard proves you have product substance.
It does **not yet prove operational maturity**.

If you want, I’ll turn this into a **dashboard rebuild spec in Markdown** with:
**navigation redesign, homepage widget layout, zero states, role-based dashboard variants, and mobile behavior.**
mm

# AMLIQ — I18N ARCHITECTURE, RTL COMPONENT PATTERNS, AND TRANSLATION DICTIONARY GUIDELINES

---

# 1. PURPOSE

Define the implementation guidelines for:

* internationalization architecture
* RTL-safe component behavior
* translation file structure
* terminology consistency across English, Hebrew, and Arabic

This is a product requirement, not a content task.

---

# 2. I18N ARCHITECTURE GUIDELINES

---

## 2.1 Supported locales

```md
en
he
ar
```

---

## 2.2 Direction mapping

```md
en → ltr
he → rtl
ar → rtl
```

---

## 2.3 Locale must control

* UI labels
* layout direction
* navigation order
* placeholder text
* validation messages
* date/time formatting
* number formatting where applicable

Locale must **not** change:

* API payload shape
* entity identifiers
* sanctions list raw names
* audit event storage
* internal codes
* wallet addresses
* email addresses
* API keys

---

## 2.4 Route strategy

Pick one approach and keep it consistent.

### Preferred

```md
/en/...
/he/...
/ar/...
```

This is better because:

* explicit locale routing
* better SEO control
* easier QA
* easier previewing
* easier language switching

---

## 2.5 Language switcher rules

Language switcher must:

* preserve current page when possible
* preserve user context
* update `lang`
* update `dir`
* update translated labels
* update locale-specific formatting

Language switcher must **not**:

* throw user back to homepage every time
* reset forms unnecessarily
* change stored data
* create broken back-button behavior

---

## 2.6 Root document requirements

At the root layout level, always set:

```md
lang
dir
```

Example behavior:

```md
en → <html lang="en" dir="ltr">
he → <html lang="he" dir="rtl">
ar → <html lang="ar" dir="rtl">
```

---

## 2.7 Translation loading rules

Use translation files by:

* locale
* namespace
* page or domain area

Do **not** store all strings in one massive file.

That becomes unmaintainable fast.

---

## 2.8 Recommended namespace structure

```md
common
navigation
dashboard
screening
cases
compliance
billing
settings
auth
errors
forms
marketing
faq
security
about
```

---

# 3. TRANSLATION FILE STRUCTURE GUIDELINES

---

## 3.1 Recommended folder structure

```md
/locales
  /en
    common.json
    navigation.json
    dashboard.json
    screening.json
    compliance.json
    forms.json
    errors.json
  /he
    common.json
    navigation.json
    dashboard.json
    screening.json
    compliance.json
    forms.json
    errors.json
  /ar
    common.json
    navigation.json
    dashboard.json
    screening.json
    compliance.json
    forms.json
    errors.json
```

---

## 3.2 Key naming rules

Use semantic keys, not English text as keys.

### Good

```md
dashboard.welcome.title
dashboard.welcome.description
screening.actions.entity
cases.status.pending
navigation.menu.alerts
```

### Bad

```md
"Welcome to AMLIQ"
"Screen Entity"
"Pending"
```

Bad keys become impossible to maintain cleanly.

---

## 3.3 Key naming conventions

* lowercase
* dot notation
* stable meaning
* no UI-specific visual instructions in keys

### Good

```md
alerts.empty.title
alerts.empty.description
alerts.actions.create_case
```

### Bad

```md
alerts.bigBlueTitle
leftSidebarCasesLabel
```

---

## 3.4 Reuse rules

Reuse shared terms only when meaning is truly identical.

Example:

* `common.save`
* `common.cancel`
* `common.search`

Do **not** force reuse for domain-specific meanings that differ by context.

Example:

* “screen”
* “review”
* “clear”
* “match”

These often need domain-aware wording.

---

# 4. TERMINOLOGY GUIDELINES

---

## 4.1 Use domain-correct terminology

This product is compliance infrastructure.

Translation must reflect compliance language, not literal app-store language.

---

## 4.2 Approved terminology examples

| English                    | Hebrew         | Arabic              |
| -------------------------- | -------------- | ------------------- |
| Sanctions Screening        | סינון סנקציות  | فحص العقوبات        |
| Case                       | תיק            | قضية                |
| Alert                      | התראה          | تنبيه               |
| Match                      | התאמה          | تطابق               |
| False Positive             | חיובי שגוי     | نتيجة إيجابية خاطئة |
| Screening Result           | תוצאת סינון    | نتيجة الفحص         |
| Audit Log                  | יומן ביקורת    | سجل التدقيق         |
| Risk Assessment            | הערכת סיכון    | تقييم المخاطر       |
| Monitoring                 | ניטור          | المراقبة            |
| Watchlists                 | רשימות מעקב    | قوائم المراقبة      |
| Politically Exposed Person | איש ציבור בכיר | شخص معرّض سياسياً   |
| Adverse Media              | תקשורת שלילית  | أخبار سلبية         |
| Transaction Screening      | סינון עסקאות   | فحص المعاملات       |

---

## 4.3 Terms requiring extra care

These should not be translated casually:

* sanctions
* screening
* match
* score
* review
* monitoring
* escalation
* due diligence
* case
* watchlist
* adverse media
* politically exposed person
* regulated institution
* compliance workflow

These should be approved once and reused consistently.

---

## 4.4 Avoid AI-marketing terminology in translations

Do not emphasize:

* AI magic
* intelligence
* smart engine
* futuristic language

Prefer:

* controlled review
* explainable scoring
* multi-layer matching
* audit-ready results
* compliance workflow

---

# 5. RTL COMPONENT GUIDELINES

---

# 5.1 Global rule

All reusable components must support both:

* LTR
* RTL

from the start.

Do not patch this later.

---

## 5.2 Component design rules

Every shared component must avoid:

* hardcoded left/right
* forced text-left
* forced ml-/mr- assumptions
* absolute-position assumptions tied to one direction

Use logical layout behavior instead.

---

# 6. COMPONENT-SPECIFIC GUIDELINES

---

## 6.1 Navbar

### Must support

* reversed layout in RTL
* correct item spacing
* correct CTA placement
* correct dropdown alignment

### Rules

* logo anchors to start/end based on direction
* CTA flips sides
* dropdown menus open relative to direction
* hamburger button placement follows locale direction

---

## 6.2 Sidebar

### Must support

* left placement in English
* right placement in Hebrew/Arabic
* mirrored collapse behavior
* correct icon/text alignment

### Rules

* active indicator aligns with reading direction
* nested items indent with logical spacing
* collapse/expand animation respects direction

---

## 6.3 Buttons

### Rules

* text aligned logically
* icon placement flips when directional
* full-width mobile buttons remain centered and readable
* arrow icons reverse in RTL

### Example

```md
View Details →
```

becomes visually:

```md
← عرض التفاصيل
```

if the arrow is directional and semantically “forward”.

---

## 6.4 Cards

### Rules

* title aligned to `start`
* metadata aligned logically
* number/value blocks readable even in RTL
* avoid decorative left-border semantics unless direction-aware

---

## 6.5 Forms

### Rules

* label aligned to `start`
* helper text aligned to `start`
* field errors aligned to `start`
* checkbox/radio groups follow locale direction
* input placeholders localize correctly

### Exceptions that remain LTR

* email
* API key
* wallet address
* transaction hash
* URLs

---

## 6.6 Tables

Tables are one of the most common RTL failure points.

### Rules

* preserve data meaning
* preserve consistent column order by product logic
* align cell content with logical start/end
* support horizontal scroll on small screens
* do not mirror tables blindly if it hurts comprehension

### Recommended behavior

Use the same logical column order where necessary for product consistency, but align text and controls appropriately for RTL.

---

## 6.7 Search and command palette

### Rules

* input accepts RTL typing
* results align correctly
* shortcuts remain visible
* categories are readable in both directions
* no broken mixed-language rendering

---

## 6.8 Modals and drawers

### Rules

* drawer origin changes with direction
* close buttons remain obvious
* header and footer actions align correctly
* destructive/secondary buttons remain consistently ordered according to product rules

Do not let button order randomly invert across screens.

---

## 6.9 Breadcrumbs

### Rules

* breadcrumb separator flips in RTL
* order must remain logically readable
* avoid broken arrows pointing the wrong way

---

## 6.10 Tabs

### Rules

* tab alignment uses logical start
* active underline/border respects direction
* label truncation must work in Hebrew and Arabic

---

## 6.11 Charts and graphs

### Rules

* labels translate
* legends localize
* chart values remain readable
* do not flip chart meaning unless analytically required
* keep number rendering stable

Do not mirror charts blindly. That often makes them less usable.

---

# 7. MIXED CONTENT GUIDELINES

---

## 7.1 Numbers

Numbers should remain readable and stable in all locales.

Examples:

* `94%`
* `<1ms`
* `3M+`
* `Case #184`

These should not become visually broken in RTL sentences.

---

## 7.2 Code and structured strings

Always force LTR for:

* code snippets
* endpoint URLs
* JSON examples
* API keys
* wallet addresses
* emails

---

## 7.3 Entity names

Entity names may be:

* English
* Hebrew
* Arabic
* mixed/transliterated

Do not force localization of raw entity data.

Display entity data faithfully.

---

# 8. CONTENT WRITING GUIDELINES FOR TRANSLATIONS

---

## 8.1 Do not translate literally

Translate by meaning, not by word shape.

---

## 8.2 Preserve regulatory tone

Translations must feel:

* serious
* professional
* compliance-aware
* restrained

They must not feel:

* playful
* AI-marketing-driven
* startup-ish
* awkwardly literal

---

## 8.3 Short UI labels

Prefer short labels in navigation and actions.

### Good

* Alerts
* Cases
* Review
* Monitoring
* Team
* Billing

### Bad

* Long sentence-like navigation labels
* Overly verbose literal translations

---

## 8.4 Error messages

Must be:

* clear
* calm
* actionable
* local-language fluent

### Good pattern

* what happened
* what user can do next

### Bad pattern

* raw system text
* backend error leakage
* translated stack-trace style content

---

# 9. DATE, TIME, AND LOCALE FORMATTING GUIDELINES

---

## 9.1 Localize

* month/day order
* 12h vs 24h where appropriate
* separators
* labels like “Today”, “Yesterday”, “Last updated”

---

## 9.2 Keep operational data readable

Compliance products often rely on timestamps.

Make sure timestamps are:

* consistent
* easy to scan
* not ambiguous across locales

If needed, use:

* localized display
* stable ISO-like detail in tooltips or audit contexts

---

# 10. ACCESSIBILITY GUIDELINES FOR MULTILINGUAL UI

---

## 10.1 Screen readers

* correct `lang` attribute per page
* correct labeling for icon buttons
* translated aria-labels
* correct reading order in RTL

---

## 10.2 Focus states

Visible in all locales.

Do not let RTL cause:

* clipped focus rings
* hidden controls
* unreadable keyboard paths

---

## 10.3 Text scaling

Hebrew and Arabic often need more room.

Test at increased zoom and text scaling.

---

# 11. QA GUIDELINES

---

## 11.1 Test matrix

Every major screen must be tested in:

```md
EN desktop
EN mobile
HE desktop
HE mobile
AR desktop
AR mobile
```

---

## 11.2 Validate on each screen

* page direction correct
* nav placement correct
* sidebar side correct
* icons/arrows correct
* text alignment correct
* numbers readable
* forms behave correctly
* tables usable
* no truncation
* no overflow
* no mirrored nonsense
* no clipped drawers or menus

---

## 11.3 Special regression checks

Always check:

* command palette
* date pickers
* dropdowns
* table filters
* pagination controls
* breadcrumbs
* form validation
* modals
* toasts/notifications

These break often in RTL systems.

---

# 12. WORKFLOW GUIDELINES

---

## Phase 1 — infrastructure

* locale routing
* `lang` and `dir`
* translation provider
* logical CSS refactor

## Phase 2 — shared components

* navbar
* sidebar
* buttons
* cards
* forms
* modals
* tables

## Phase 3 — dashboard surfaces

* dashboard
* alerts
* cases
* screening
* compliance flows

## Phase 4 — marketing and support pages

* homepage
* pricing
* security
* compliance
* about
* docs landing

## Phase 5 — QA and terminology review

* language review
* RTL review
* device review
* accessibility review

---

# 13. TRANSLATION DICTIONARY GUIDELINES

---

## 13.1 Dictionary ownership

Translations for regulated terminology must be reviewed, not crowdsourced casually.

Recommended reviewers:

* product
* compliance/domain owner
* native speaker
* UX/content owner

---

## 13.2 Dictionary categories

Maintain a master glossary for:

* compliance terms
* sanctions terms
* workflow terms
* product terms
* support/error terms

---

## 13.3 Example glossary structure

```md
term
definition
approved_en
approved_he
approved_ar
notes
```

---

## 13.4 Terms to maintain centrally

* sanctions screening
* watchlists
* case
* alert
* escalation
* false positive
* risk assessment
* adverse media
* politically exposed person
* match confidence
* review queue
* audit log
* batch screening
* transaction screening
* crypto screening

---

# 14. FINAL RULES

---

## Do not

* bolt RTL on later
* translate literally
* mirror everything blindly
* expose mixed-direction bugs in production
* use one font for all languages
* hardcode left/right assumptions

---

## Do

* build direction-aware primitives
* keep data readable
* protect trust through precision
* test every major flow in HE and AR
* maintain an approved compliance glossary

---

# 15. FINAL SUMMARY

For AMLIQ, multilingual support is not “nice to have.”

It is part of:

* product credibility
* regional usability
* enterprise readiness
* compliance market fit

If this is done badly, the product looks amateur.
If this is done well, the product becomes credible across English, Hebrew, and Arabic-speaking markets.
