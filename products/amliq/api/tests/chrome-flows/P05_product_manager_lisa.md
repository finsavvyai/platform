# AMLIQ AML Platform - Test Flow P05
## Persona: Lisa Thompson - Product Manager UX Evaluator

### Persona Profile
- **Name:** Lisa Thompson
- **Role:** Product Manager (Competitive Analysis & UX)
- **Company:** TechPro Analytics (competitive evaluation for feature adoption)
- **Experience Level:** 8 years product management, expert in UX/UI design systems
- **Goals:** Evaluate UX design, responsive functionality, Apple HIG compliance, overall product polish
- **Success Criteria:** Complete comprehensive UX audit across all screen sizes, verify Apple design compliance, test all navigation and interactive elements

---

## Prerequisites
- [ ] Chrome browser with responsive design tools
- [ ] DevTools open (F12) for responsive testing
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] Test account or create during flow
- [ ] Ability to resize browser window to specific dimensions

---

## Test Flow Steps

### Step 1: Full Marketing Landing Page Review
**Action:** Scroll entire marketing page and evaluate all sections
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] **Verify:** Page loads completely
- [ ] **Screenshot:** Hero section - full viewport height
- [ ] Evaluate hero section:
  - [ ] Headline: "AMLIQ AML Screening" or similar - clear and prominent
  - [ ] Subheadline: Value proposition visible
  - [ ] CTA button: "Get Started" - stands out visually
  - [ ] Hero image/background: Professional, relevant
  - [ ] Text contrast: Readable against background
- [ ] **Selector:** Hero section elements
- [ ] **Screenshot:** Hero section with all elements visible
- [ ] Scroll down to Features section
- [ ] **Verify:** Features section visible with cards
- [ ] **Selector:** `.features-section` or feature cards
- [ ] Check each feature card contains:
  - [ ] Icon/illustration
  - [ ] Title (e.g., "Real-time Screening")
  - [ ] Description text
  - [ ] Optional: Learn more link
- [ ] **Screenshot:** Feature cards section
- [ ] Scroll to "How It Works" section
- [ ] **Verify:** 4-step process visible with:
  - [ ] Step numbers/indicators
  - [ ] Step titles
  - [ ] Step descriptions
  - [ ] Visual progression (arrows, lines, etc.)
- [ ] **Selector:** How it works steps
- [ ] **Screenshot:** How It Works section showing all 4 steps
- [ ] Scroll to Pricing section preview
- [ ] **Verify:** Pricing tiers visible (at least 3 tiers)
- [ ] **Verify:** Price points visible
- [ ] **Verify:** Feature comparison highlights
- [ ] **Selector:** Pricing cards
- [ ] **Screenshot:** Pricing section on landing page
- [ ] Scroll to Testimonials or Social Proof section
- [ ] **Verify:** Company logos or testimonials visible
- [ ] **Selector:** Testimonial cards or logo section
- [ ] **Screenshot:** Social proof section
- [ ] Scroll to FAQ section if present
- [ ] **Verify:** Accordion-style Q&A visible
- [ ] Click one FAQ item to expand
- [ ] **Verify:** Answer expands/collapses smoothly
- [ ] **Screenshot:** FAQ section with expanded item
- [ ] Scroll to footer
- [ ] **Verify:** Footer contains:
  - [ ] Logo/company name
  - [ ] Navigation links (About, Blog, Careers, Contact)
  - [ ] Legal links (Privacy, Terms, Cookies)
  - [ ] Social media icons
  - [ ] Copyright notice
- [ ] **Selector:** Footer elements
- [ ] **Screenshot:** Complete footer
- [ ] **Pass/Fail:** ☐ All landing page sections complete and visible

---

### Step 2: Test Mobile Responsive - 375px Width
**Action:** Resize browser to mobile dimension and test layout
- [ ] Open DevTools (F12)
- [ ] Click device toggle or responsive design mode
- [ ] **Selector:** DevTools responsive mode icon
- [ ] **Screenshot:** DevTools responsive mode toolbar
- [ ] Set viewport width: 375px (mobile width)
- [ ] Set viewport height: 812px (mobile height)
- [ ] **Verify:** Viewport set to 375x812
- [ ] **Selector:** Dimension input fields in DevTools
- [ ] **Screenshot:** Viewport resized to 375px
- [ ] Navigate to home page (or refresh if already loaded)
- [ ] **Verify:** Page loads at mobile dimensions
- [ ] **Screenshot:** Hero section on mobile (375px)
- [ ] Check mobile layout:
  - [ ] No horizontal scrolling
  - [ ] Text remains readable (font size adequate)
  - [ ] CTAs remain large enough to tap (44x44px minimum)
  - [ ] Images/icons scale appropriately
  - [ ] Spacing/padding maintained
- [ ] **Verify:** All elements responsive
- [ ] **Screenshot:** Mobile layout with content stacking vertically
- [ ] Scroll through full page on mobile
- [ ] **Verify:** Features section responsive
- [ ] **Verify:** How It Works section responsive (likely single column)
- [ ] **Verify:** Pricing section responsive
- [ ] **Screenshot:** Features section on mobile
- [ ] **Screenshot:** Pricing section on mobile
- [ ] Check mobile navigation
- [ ] **Verify:** Menu hamburger/mobile nav visible
- [ ] **Selector:** Mobile menu button or hamburger
- [ ] Click mobile menu
- [ ] **Verify:** Menu expands/slides in
- [ ] **Screenshot:** Mobile menu open
- [ ] Check touchable elements
- [ ] **Verify:** All buttons/links are 44x44px minimum
- [ ] **Verify:** No elements too close together for finger touch
- [ ] **Pass/Fail:** ☐ Mobile (375px) layout responsive and usable

---

### Step 3: Test Tablet Responsive - 768px Width
**Action:** Resize to tablet dimension and verify layout
- [ ] Adjust viewport width to: 768px
- [ ] Set viewport height: 1024px (landscape tablet)
- [ ] **Selector:** Dimension input in DevTools
- [ ] **Screenshot:** Viewport resized to 768px
- [ ] Navigate to home page or refresh
- [ ] **Verify:** Page loads at tablet dimensions
- [ ] **Screenshot:** Hero on tablet (768px)
- [ ] Check tablet layout changes from mobile
- [ ] **Verify:** Likely 2-column layout for features
- [ ] **Verify:** Better use of horizontal space
- [ ] **Verify:** Text remains readable
- [ ] Scroll through page
- [ ] **Screenshot:** Features section on tablet
- [ ] **Screenshot:** Pricing section on tablet (2 columns expected)
- [ ] Verify no content overflow
- [ ] **Verify:** No horizontal scrolling
- [ ] **Verify:** Images scale appropriately
- [ ] **Pass/Fail:** ☐ Tablet (768px) layout responsive

---

### Step 4: Test Desktop Responsive - 1440px Width
**Action:** Resize to desktop dimension and verify full layout
- [ ] Adjust viewport width to: 1440px
- [ ] Set viewport height: 900px (desktop height)
- [ ] **Selector:** Dimension input in DevTools
- [ ] **Screenshot:** Viewport resized to 1440px
- [ ] Navigate to home page or refresh
- [ ] **Verify:** Page optimized for desktop
- [ ] **Screenshot:** Hero section on desktop (1440px)
- [ ] Check desktop layout
- [ ] **Verify:** 3-column layouts for features likely
- [ ] **Verify:** Pricing shows 3+ columns side-by-side
- [ ] **Verify:** Proper max-width container (not stretching edge-to-edge)
- [ ] **Verify:** Generous whitespace/padding
- [ ] Scroll through page
- [ ] **Screenshot:** Features section on desktop
- [ ] **Screenshot:** Pricing section on desktop (full 3+ columns visible)
- [ ] **Screenshot:** Footer on desktop (likely horizontal layout)
- [ ] Check for desktop-specific features
- [ ] **Verify:** Hover states on interactive elements
- [ ] Hover over a button and check for visual feedback
- [ ] **Screenshot:** Button with hover state
- [ ] **Pass/Fail:** ☐ Desktop (1440px) layout optimized

---

### Step 5: Test Mobile Navigation Links
**Action:** Verify all mobile navigation elements are functional
- [ ] Close DevTools responsive mode or minimize
- [ ] Resize browser to mobile (375px) if not already
- [ ] **Verify:** Mobile menu visible (hamburger icon)
- [ ] Click hamburger menu icon
- [ ] **Selector:** `.mobile-menu-button`, `.hamburger`, or similar
- [ ] **Screenshot:** Mobile menu opened
- [ ] Check menu items visible
- [ ] **Verify:** Menu includes: Home, Pricing, Docs, Blog (or similar)
- [ ] Click "Pricing" in mobile menu
- [ ] **Verify:** Navigates to pricing page
- [ ] **Screenshot:** Pricing page on mobile
- [ ] Click logo to return home
- [ ] **Verify:** Returns to home page
- [ ] Click "Docs" or "Documentation"
- [ ] **Verify:** Navigates to API docs page
- [ ] **Screenshot:** Docs page
- [ ] Use browser back button to return home
- [ ] Verify back button works
- [ ] **Pass/Fail:** ☐ All mobile navigation links functional

---

### Step 6: Pricing Page - Tab 1 Review
**Action:** Navigate to pricing and review first product tab
- [ ] Navigate to /pricing or click Pricing link
- [ ] **Verify:** Pricing page loads
- [ ] **Screenshot:** Pricing page overview
- [ ] Identify product tabs/cards
- [ ] **Verify:** Multiple tabs visible (Web Platform, API, Enterprise, etc.)
- [ ] **Selector:** Tab buttons or product card buttons
- [ ] **Screenshot:** All product tabs/cards visible
- [ ] Click first tab (likely "Web Platform" or "Dashboard")
- [ ] **Verify:** Tab content displays
- [ ] **Screenshot:** First product tab content
- [ ] **Pass/Fail:** ☐ First pricing tab loaded

---

### Step 7: Pricing Page - All 5 Tabs Review
**Action:** Switch through all pricing tabs/products
- [ ] Continue from Step 6 or open pricing page
- [ ] Check all 5 product tabs if available
- [ ] If only 3 tabs, test all available tabs
- [ ] Click Tab 2
- [ ] **Verify:** Content changes to Tab 2
- [ ] **Screenshot:** Tab 2 content
- [ ] Click Tab 3
- [ ] **Verify:** Content changes
- [ ] **Screenshot:** Tab 3 content
- [ ] Click Tab 4 (if exists)
- [ ] **Verify:** Content changes
- [ ] **Screenshot:** Tab 4 content
- [ ] Click Tab 5 (if exists)
- [ ] **Verify:** Content changes
- [ ] **Screenshot:** Tab 5 content
- [ ] Verify tab switching is smooth/no lag
- [ ] **Pass/Fail:** ☐ All pricing tabs functional

---

### Step 8: Toggle Monthly/Annual Pricing
**Action:** Switch between monthly and annual billing options
- [ ] On pricing page, locate toggle for monthly/annual billing
- [ ] **Selector:** Toggle switch or buttons (Monthly/Annual)
- [ ] **Verify:** Toggle visible
- [ ] **Screenshot:** Monthly/Annual toggle control
- [ ] Current state shows Monthly pricing
- [ ] Click "Annual" or toggle to annual
- [ ] **Verify:** All prices update to annual amounts
- [ ] **Selector:** Price cells in tier comparison
- [ ] **Screenshot:** Annual pricing displayed
- [ ] Check discount callout
- [ ] **Verify:** "Save 20%" or similar discount displayed
- [ ] **Selector:** Discount badge or callout
- [ ] **Screenshot:** Discount badge visible
- [ ] Click back to "Monthly"
- [ ] **Verify:** Prices revert to monthly amounts
- [ ] **Screenshot:** Monthly pricing restored
- [ ] **Pass/Fail:** ☐ Monthly/Annual toggle working

---

### Step 9: Verify 20% Annual Discount Calculation
**Action:** Manually verify discount math is correct
- [ ] View annual pricing (from Step 8)
- [ ] Select one pricing tier (e.g., "Growth" at $500/month)
- [ ] Calculate expected annual:
  - [ ] Monthly: $500/month × 12 months = $6,000/year
  - [ ] With 20% discount: $6,000 × 0.8 = $4,800/year
  - [ ] Monthly equivalent: $4,800 ÷ 12 = $400/month
- [ ] **Verify:** Displayed annual price is $4,800 (or equivalent calculation)
- [ ] Check if tier shows monthly equivalent
- [ ] **Verify:** Shows ~$400/month or similar
- [ ] **Selector:** Annual price display cells
- [ ] **Screenshot:** Annual pricing with discount calculations visible
- [ ] Repeat for another tier if multiple visible
- [ ] **Verify:** Discount consistently applied (20%)
- [ ] **Pass/Fail:** ☐ Discount calculation correct

---

### Step 10: Sign Up Flow
**Action:** Test account creation process
- [ ] Click "Get Started" CTA on pricing page
- [ ] **Selector:** CTA button on pricing tier
- [ ] **Verify:** Redirects to signup or opens signup modal
- [ ] **Screenshot:** Signup form/page
- [ ] Check form fields
- [ ] **Verify:** Email field present
- [ ] **Verify:** Password field present
- [ ] **Verify:** Company name field present
- [ ] **Verify:** Product tier selection (if not pre-selected)
- [ ] Enter email: `lisa.thompson.pm@techpro.io`
- [ ] **Selector:** `input[type="email"]`
- [ ] Enter password: `ProductTest456!@#`
- [ ] **Selector:** `input[type="password"]`
- [ ] Enter company: `TechPro Analytics`
- [ ] **Selector:** Company input
- [ ] Select tier: Growth (or selected tier from pricing)
- [ ] **Selector:** Tier selection radio or dropdown
- [ ] Check Terms checkbox
- [ ] **Selector:** Terms checkbox
- [ ] Click "Create Account"
- [ ] **Verify:** Account created, redirected to dashboard
- [ ] **Screenshot:** Dashboard post-signup
- [ ] **Pass/Fail:** ☐ Signup flow completed

---

### Step 11: Dashboard UX Review
**Action:** Evaluate main dashboard layout and design
- [ ] **Verify:** Dashboard loads (from Step 10)
- [ ] **Screenshot:** Full dashboard view
- [ ] Check layout structure
- [ ] **Verify:** Left sidebar navigation visible
- [ ] **Verify:** Main content area on right
- [ ] **Verify:** Top header/navbar with user profile
- [ ] Check information hierarchy
- [ ] **Verify:** Key metrics prominently displayed
- [ ] **Verify:** Primary CTA buttons obvious
- [ ] **Verify:** Secondary actions de-emphasized
- [ ] Evaluate spacing and alignment
- [ ] **Verify:** Consistent padding/margins throughout
- [ ] **Verify:** Cards/sections well-aligned
- [ ] **Verify:** No visual clutter
- [ ] Check color usage
- [ ] **Verify:** Color scheme consistent with branding
- [ ] **Verify:** Status colors clear (green=good, red=alert, etc.)
- [ ] Check typography
- [ ] **Verify:** Font hierarchy clear (heading sizes distinct)
- [ ] **Verify:** SF Pro (Apple) or consistent system font
- [ ] **Selector:** Body font family (check in DevTools)
- [ ] **Screenshot:** DevTools showing font stack
- [ ] **Pass/Fail:** ☐ Dashboard UX polished

---

### Step 12: Sidebar Navigation - All Items
**Action:** Test all left sidebar navigation items
- [ ] **Verify:** Sidebar visible on left of dashboard
- [ ] **Selector:** `.sidebar` or `.nav-sidebar`
- [ ] **Screenshot:** Full sidebar with all items
- [ ] Check navigation items
- [ ] **Verify:** See: Dashboard, Screen Entity, Alert Queue, Configuration, Analytics, Billing, Settings, Logout
- [ ] Click "Screen Entity"
- [ ] **Verify:** Navigates to screening form page
- [ ] **Screenshot:** Screening page
- [ ] Click "Alert Queue" from sidebar
- [ ] **Verify:** Navigates to alert queue
- [ ] **Screenshot:** Alert queue page
- [ ] Click "Configuration"
- [ ] **Verify:** Navigates to settings/config page
- [ ] **Screenshot:** Configuration page
- [ ] Click "Analytics"
- [ ] **Verify:** Navigates to analytics dashboard
- [ ] **Screenshot:** Analytics page
- [ ] Click "Billing"
- [ ] **Verify:** Navigates to billing/subscription page
- [ ] **Screenshot:** Billing page
- [ ] Click "Settings"
- [ ] **Verify:** Navigates to user/account settings
- [ ] **Screenshot:** Settings page
- [ ] Return to Dashboard
- [ ] Click "Dashboard" in sidebar
- [ ] **Verify:** Back at main dashboard
- [ ] **Pass/Fail:** ☐ All sidebar items functional

---

### Step 13: Screen Entity Page UX
**Action:** Evaluate screening form UX and layout
- [ ] Navigate to "Screen Entity" page
- [ ] **Verify:** Form loads
- [ ] **Screenshot:** Screening form
- [ ] Check form layout
- [ ] **Verify:** Clear labels for each field
- [ ] **Verify:** Logical field grouping
- [ ] **Verify:** Input fields clearly defined with placeholders/hints
- [ ] **Verify:** Submit button prominent and clear
- [ ] Check for visual feedback
- [ ] **Verify:** Focus states visible when clicking input
- [ ] **Selector:** Focused input border/color
- [ ] **Screenshot:** Input field with focus state
- [ ] Check validation messaging
- [ ] Leave required field empty and try to submit
- [ ] **Verify:** Error message appears inline or in alert
- [ ] **Verify:** Error message is clear (not technical jargon)
- [ ] **Selector:** Error message text
- [ ] **Screenshot:** Validation error message
- [ ] Fill form with valid data and submit
- [ ] **Verify:** Smooth submission (loading spinner appears)
- [ ] **Verify:** Results display in clear format
- [ ] **Screenshot:** Form results display
- [ ] **Pass/Fail:** ☐ Screening form UX clear and usable

---

### Step 14: Alert Queue Filtering UX
**Action:** Test filter controls usability and responsiveness
- [ ] Navigate to Alert Queue
- [ ] **Verify:** Filter controls visible at top
- [ ] **Selector:** Filter toolbar/section
- [ ] **Screenshot:** Filter controls area
- [ ] Check filter types available
- [ ] **Verify:** Priority filter (dropdown or buttons)
- [ ] **Verify:** Date range filter
- [ ] **Verify:** Status filter (Resolved/Pending/etc.)
- [ ] **Verify:** Search field
- [ ] Test each filter
- [ ] Click Priority filter
- [ ] **Verify:** Dropdown or options appear
- [ ] **Verify:** Options clearly labeled
- [ ] **Screenshot:** Priority filter options
- [ ] Select a priority
- [ ] **Verify:** Results update immediately or with "Apply" button
- [ ] **Screenshot:** Filtered results
- [ ] Test search field
- [ ] Type entity name in search
- [ ] **Verify:** Results filter as you type or on Enter
- [ ] **Screenshot:** Search results
- [ ] Test date range
- [ ] Click date range picker
- [ ] **Verify:** Date picker interface appears and is usable
- [ ] **Screenshot:** Date range picker
- [ ] **Pass/Fail:** ☐ Alert Queue filters UX working well

---

### Step 15: Configuration Sliders UX
**Action:** Test configuration/settings slider controls
- [ ] Navigate to Configuration page
- [ ] **Verify:** Settings loaded
- [ ] Look for slider/range input controls
- [ ] **Verify:** Fuzzy threshold slider visible
- [ ] **Selector:** Slider input for settings
- [ ] **Screenshot:** Slider control
- [ ] Check slider design
- [ ] **Verify:** Slider has clear track/thumb
- [ ] **Verify:** Min/max values labeled
- [ ] **Verify:** Current value displayed
- [ ] Test slider interaction
- [ ] Click and drag slider left
- [ ] **Verify:** Smooth dragging, no jumps
- [ ] **Verify:** Value updates as you drag
- [ ] **Screenshot:** Slider being adjusted
- [ ] Release slider
- [ ] **Verify:** Final value is readable
- [ ] Check for numeric input alternative
- [ ] **Verify:** Can also type value directly (if applicable)
- [ ] **Selector:** Numeric input field alongside slider
- [ ] **Screenshot:** Slider with numeric input
- [ ] **Pass/Fail:** ☐ Slider controls intuitive

---

### Step 16: Billing Page Layout
**Action:** Review billing/subscription page design
- [ ] Navigate to Billing page
- [ ] **Verify:** Page loads
- [ ] **Screenshot:** Billing page overview
- [ ] Check page sections
- [ ] **Verify:** Current Plan/Subscription info visible
- [ ] **Verify:** Plan name, tier, renewal date
- [ ] **Verify:** "Manage Plan" or "Change Plan" button
- [ ] **Screenshot:** Current plan section
- [ ] Look for billing history/invoices section
- [ ] **Verify:** Invoice list visible
- [ ] **Verify:** Download/view options for invoices
- [ ] **Selector:** Invoice list and download buttons
- [ ] **Screenshot:** Invoice list
- [ ] Check payment method section
- [ ] **Verify:** Current payment method displayed
- [ ] **Verify:** Add/change payment method option
- [ ] **Screenshot:** Payment method section
- [ ] **Pass/Fail:** ☐ Billing page layout clear

---

### Step 17: Seat Management
**Action:** Test user/seat management interface
- [ ] On Billing or Settings page, find "Team" or "Seats" section
- [ ] **Verify:** Seat management visible
- [ ] **Selector:** Team members or seats list
- [ ] **Screenshot:** Seat management interface
- [ ] Check current seats
- [ ] **Verify:** Shows number of seats used vs. available
- [ ] **Verify:** Team members listed
- [ ] **Verify:** Role/permission of each member
- [ ] Check add user functionality
- [ ] **Verify:** "Invite Member" or "Add Seat" button visible
- [ ] Click to add new team member
- [ ] **Verify:** Dialog/form appears
- [ ] **Selector:** Add user form/dialog
- [ ] **Screenshot:** Add team member dialog
- [ ] **Pass/Fail:** ☐ Seat management interface functional

---

### Step 18: Invoice List Display
**Action:** Review invoice list and download functionality
- [ ] Return to Billing page if not there
- [ ] Locate invoice list section
- [ ] **Verify:** Multiple invoices visible in table/list
- [ ] **Selector:** Invoice list/table
- [ ] **Screenshot:** Invoice list
- [ ] Check invoice table columns
- [ ] **Verify:** Date column (sortable ideally)
- [ ] **Verify:** Amount column
- [ ] **Verify:** Status column (Paid, Pending, etc.)
- [ ] **Verify:** Action column (Download, View, etc.)
- [ ] Test sorting (if available)
- [ ] Click on "Date" column header
- [ ] **Verify:** List sorts by date
- [ ] **Screenshot:** Sorted invoice list
- [ ] Download an invoice
- [ ] Click "Download" or download icon on an invoice
- [ ] **Verify:** PDF downloads
- [ ] **Screenshot:** Download started confirmation
- [ ] **Pass/Fail:** ☐ Invoice list functional

---

### Step 19: Analytics Charts
**Action:** Review analytics dashboard charts and visualizations
- [ ] Navigate to Analytics page
- [ ] **Verify:** Analytics dashboard loads
- [ ] **Screenshot:** Analytics page
- [ ] Check chart types visible
- [ ] **Verify:** Line charts for trends (screenings over time)
- [ ] **Verify:** Bar charts for comparisons
- [ ] **Verify:** Pie/donut charts for distribution
- [ ] **Verify:** Metric cards with big numbers/KPIs
- [ ] **Selector:** Chart/visualization elements
- [ ] **Screenshot:** Various chart types
- [ ] Test chart interactivity
- [ ] Hover over line chart data point
- [ ] **Verify:** Tooltip appears with data
- [ ] **Selector:** Chart tooltip
- [ ] **Screenshot:** Chart with tooltip
- [ ] Test date range selector on analytics
- [ ] Change date range
- [ ] **Verify:** Charts update with new data
- [ ] **Screenshot:** Charts with updated date range
- [ ] **Pass/Fail:** ☐ Analytics charts functional and interactive

---

### Step 20: Audit Trail Pagination
**Action:** Test pagination and list view of audit trail
- [ ] Navigate to an alert's audit trail (from earlier test or navigate to Alert Queue > open alert)
- [ ] Scroll to Audit Trail section
- [ ] **Verify:** Audit trail list visible
- [ ] **Selector:** Audit trail list/table
- [ ] **Screenshot:** Audit trail entries
- [ ] Check for pagination controls
- [ ] **Verify:** See "Page 1 of X" or pagination buttons
- [ ] **Selector:** Pagination controls
- [ ] **Screenshot:** Pagination buttons/indicators
- [ ] Test next page (if multiple pages)
- [ ] Click "Next" or page 2 button
- [ ] **Verify:** List updates to show next set of entries
- [ ] **Verify:** Page indicator updates
- [ ] **Screenshot:** Page 2 of audit trail
- [ ] Test previous page
- [ ] Click "Previous" or page 1 button
- [ ] **Verify:** Back to original page
- [ ] Test items per page (if available)
- [ ] **Verify:** Can change rows shown per page
- [ ] **Pass/Fail:** ☐ Audit trail pagination working

---

### Step 21: Keyboard Navigation
**Action:** Test Tab navigation through interactive elements
- [ ] Return to main dashboard
- [ ] Press Tab key repeatedly
- [ ] **Verify:** Focus moves through interactive elements in logical order
- [ ] **Verify:** Focus indicator visible (outline or highlight)
- [ ] **Selector:** Focus outline style
- [ ] **Screenshot:** Focused button/element with visible outline
- [ ] Continue tabbing through form
- [ ] **Verify:** All buttons, links, inputs are reachable by Tab
- [ ] **Verify:** Tab order logical (left-to-right, top-to-bottom)
- [ ] **Verify:** No focus trap (can escape all elements)
- [ ] Test form submission via keyboard
- [ ] Tab to Submit button
- [ ] Press Enter
- [ ] **Verify:** Form submits
- [ ] **Screenshot:** Form submitted via keyboard
- [ ] Test menu navigation
- [ ] Open sidebar or header menu
- [ ] Press Arrow keys (up/down)
- [ ] **Verify:** Menu items navigate with arrow keys
- [ ] **Verify:** Enter activates menu item
- [ ] **Screenshot:** Menu with focus
- [ ] **Pass/Fail:** ☐ Keyboard navigation fully functional

---

### Step 22: Empty States Testing
**Action:** Verify empty state messaging when no data available
- [ ] Clear filters or create fresh account for empty states
- [ ] Navigate to Alert Queue
- [ ] Try filter that results in no data
- [ ] **Verify:** Empty state message appears
- [ ] **Selector:** Empty state container/message
- [ ] **Screenshot:** Empty state with helpful message
- [ ] Check empty state quality
- [ ] **Verify:** Includes icon/illustration
- [ ] **Verify:** Clear message explaining why empty
- [ ] **Verify:** Call-to-action suggesting next step
- [ ] **Selector:** CTA button in empty state
- [ ] **Screenshot:** Complete empty state with CTA
- [ ] Test other empty states
- [ ] Try empty analytics (no data period)
- [ ] **Verify:** Empty state appears with message
- [ ] **Screenshot:** Analytics empty state
- [ ] Test empty sidebar menu (if applicable)
- [ ] **Verify:** Empty states throughout are consistent in style
- [ ] **Pass/Fail:** ☐ Empty states helpful and consistent

---

### Step 23: Loading States Testing
**Action:** Verify loading indicators and states during async operations
- [ ] Trigger a long-running operation (screening, report generation)
- [ ] **Verify:** Loading spinner or progress indicator appears
- [ ] **Selector:** `.spinner`, `.loader`, or loading indicator
- [ ] **Screenshot:** Loading spinner visible
- [ ] Check loading state quality
- [ ] **Verify:** Spinner is animated (not static)
- [ ] **Verify:** Loading text/message present if applicable
- [ ] **Verify:** Disabled state on submit button during load
- [ ] **Selector:** Disabled button during loading
- [ ] **Screenshot:** Loading state with disabled button
- [ ] Wait for operation to complete
- [ ] **Verify:** Spinner removed, results displayed
- [ ] **Verify:** Button re-enabled
- [ ] **Screenshot:** Operation complete, loading gone
- [ ] **Pass/Fail:** ☐ Loading states clear and functional

---

### Step 24: Apple HIG Elements Check
**Action:** Verify Apple Human Interface Guidelines (HIG) compliance
- [ ] Check font usage across platform
- [ ] **Verify:** Uses SF Pro or system font (not web fonts everywhere)
- [ ] **Selector:** Font family in computed styles
- [ ] **Screenshot:** DevTools showing font: -apple-system, SF Pro, or similar
- [ ] Check for vibrancy/glass morphism effects (if on macOS style)
- [ ] **Verify:** Subtle blur/transparency effects present (optional)
- [ ] **Selector:** CSS backdrop-filter or similar
- [ ] **Screenshot:** Any Apple-style vibrancy effects
- [ ] Check segmented controls
- [ ] **Verify:** Tab/filter controls use segmented control style
- [ ] **Selector:** `.segmented-control` or segmented buttons
- [ ] **Screenshot:** Segmented control component
- [ ] Check for iOS-style spacing and sizing
- [ ] **Verify:** Buttons minimum 44x44pt touch target
- [ ] **Verify:** Generous whitespace (consistent with Apple design)
- [ ] **Verify:** Rounded corners (Apple-style: 6-12px radius)
- [ ] **Selector:** Border-radius values in DevTools
- [ ] **Screenshot:** Rounded corner styling
- [ ] Check system icons usage
- [ ] **Verify:** Uses SF Symbols or system icons where appropriate
- [ ] **Selector:** Icon elements
- [ ] **Screenshot:** Icons used in interface
- [ ] Check color palette
- [ ] **Verify:** Uses semantic colors (not just raw hex)
- [ ] **Verify:** Dark mode support (if available)
- [ ] **Screenshot:** Color palette and dark mode toggle if present
- [ ] **Pass/Fail:** ☐ Apple HIG elements present and consistent

---

### Step 25: Responsive Resize Test - All Sizes
**Action:** Final comprehensive responsive test across all breakpoints
- [ ] Resize browser to 320px (small mobile)
- [ ] **Verify:** Page still usable (no broken layout)
- [ ] **Screenshot:** 320px viewport
- [ ] Resize to 480px (larger mobile)
- [ ] **Verify:** Layout adjusts appropriately
- [ ] **Screenshot:** 480px viewport
- [ ] Resize to 768px (tablet)
- [ ] **Verify:** Tablet layout displays correctly
- [ ] **Screenshot:** 768px viewport
- [ ] Resize to 1024px (large tablet)
- [ ] **Verify:** Large tablet layout correct
- [ ] **Screenshot:** 1024px viewport
- [ ] Resize to 1440px (desktop)
- [ ] **Verify:** Desktop layout optimal
- [ ] **Screenshot:** 1440px viewport
- [ ] Resize to 1920px (large desktop)
- [ ] **Verify:** Max-width constraint applied, not stretching
- [ ] **Verify:** Still readable and well-proportioned
- [ ] **Screenshot:** 1920px viewport
- [ ] **Pass/Fail:** ☐ Responsive at all breakpoints

---

## Summary
- [ ] All 25 UX test steps completed
- [ ] Full marketing page review comprehensive
- [ ] Mobile (375px) layout responsive and usable
- [ ] Tablet (768px) layout optimized
- [ ] Desktop (1440px) layout polished
- [ ] All navigation links functional
- [ ] All pricing tabs/products functional
- [ ] Monthly/Annual toggle working with correct discount
- [ ] Signup flow intuitive
- [ ] Dashboard UX clean and organized
- [ ] All sidebar items navigating correctly
- [ ] Screening form UX clear
- [ ] Alert Queue filters working smoothly
- [ ] Configuration sliders intuitive
- [ ] Billing page layout logical
- [ ] Seat management functional
- [ ] Invoice list display and download working
- [ ] Analytics charts interactive
- [ ] Audit trail pagination working
- [ ] Keyboard navigation fully functional
- [ ] Empty states helpful and consistent
- [ ] Loading states clear and functional
- [ ] Apple HIG elements present
- [ ] Responsive across all breakpoints

**Overall Result:** ☐ PASS / ☐ FAIL

**UX Audit Findings:**

**Strengths:**
- [List any standout positive UX findings]

**Areas for Improvement:**
- [List any UX issues or polish opportunities]

**Competitive Analysis Notes:**
[Comparison to competitor products if applicable]

**Recommendations for Polish:**
- [List specific recommendations for UX refinement]

**Overall UX Rating:** ☐ Excellent / ☐ Good / ☐ Average / ☐ Needs Work
