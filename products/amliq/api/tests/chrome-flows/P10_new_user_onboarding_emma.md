# Test Flow P10: First-Time User Onboarding - Emma Davis

## Persona Profile
- **Name:** Emma Davis
- **Role:** Compliance Officer (First Time AML User)
- **Company:** RetailBank Corp
- **Experience Level:** Beginner (0 AML knowledge, new to compliance systems)
- **Key Goals:** Learn AMLIQ platform, understand screening results, onboard successfully, build confidence
- **Technical Proficiency:** Moderate (comfortable with web apps, no AML background)
- **Focus:** Intuitive UI, clear tooltips, helpful documentation, understanding confidence scores

## Prerequisites
- AMLIQ clean instance at https://2b690a17.aegis-97g.pages.dev
- No prior account (fresh signup)
- Marketing landing page accessible
- Promo code "AMLIQ_FREE" ready
- Documentation available
- Chrome browser, Desktop 1920x1080

## Test Flow: Complete Onboarding from First Visit to First Screening

### Step 1: Land on Marketing Page
- **Action:** Navigate to https://2b690a17.aegis-97g.pages.dev → Wait for page load
- **Expected Result:** Marketing landing page displays: Hero section with headline "AMLIQ: Enterprise AML Screening Platform", subheadline "Streamlined sanctions screening in seconds", "Start Free Trial" button (green/blue, prominent), Navigation menu visible
- **Verify:** Page loads < 3 seconds, images clear, no broken links
- **Screenshot:** Take hero section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 2: Read Hero Section
- **Action:** Read hero headline, subheadline, and value proposition → Check key benefits listed
- **Expected Result:** Hero communicates: Platform name, purpose, value proposition. Key benefits: "✓ Real-time screening | ✓ Multiple sanctions lists | ✓ High accuracy | ✓ Enterprise support"
- **Verify:** Value proposition clear, benefits highlighted, CTA prominent
- **Screenshot:** Already in Step 1
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 3: Scroll Through Features Section
- **Action:** Scroll down to "Features" section → Read feature cards/tiles with icons
- **Expected Result:** Features visible: Real-Time Screening, Multiple Lists, High Accuracy, API Integration, Compliance Dashboard, Audit Trail. Each has icon, title, description.
- **Verify:** All feature cards visible, icons display, descriptions beginner-friendly
- **Screenshot:** Take features section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 4: Watch Matching Demo Video
- **Action:** Locate video demo section → Click "Play Demo" → Watch full video (or first 2 minutes if longer)
- **Expected Result:** Video plays showing: screening an individual, reading results, understanding confidence scores, taking action on flagged matches. Audio clear, subtitles available, visuals high quality.
- **Verify:** Video plays without buffering, audio clear, demo helpful
- **Screenshot:** Take video player during demo
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 5: Read FAQ Section
- **Action:** Scroll to FAQ → Click on 3-4 questions to expand answers
- **Expected Result:** Questions expanded with beginner-friendly answers: "What is sanctions screening?", "How long does screening take?", "What is a confidence score?", "Is AMLIQ compliant?"
- **Verify:** Questions beginner-friendly, answers clear without jargon
- **Screenshot:** Take expanded FAQ
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 6: Click "Start Free Trial" Button
- **Action:** Scroll to top or locate "Start Free Trial" button → Click button
- **Expected Result:** Navigates to signup form. URL = /signup. Form shows fields: First Name, Last Name, Email, Company Name, Password with strength indicator.
- **Verify:** Form displays without errors, fields labeled clearly
- **Screenshot:** Take signup form
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 7: Enter Promo Code "AMLIQ_FREE"
- **Action:** Look for "Promo Code" field in signup form → Enter: "AMLIQ_FREE"
- **Expected Result:** Message appears: "Applied: 100% discount - Free trial includes all features for 30 days." Text green. Button shows "Promo Code Applied ✓".
- **Verify:** Code accepted, discount message shows, 100% discount confirmed
- **Screenshot:** Take form with applied promo code
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 8: Complete Signup Form
- **Action:** Fill form: First: Emma, Last: Davis, Email: emma.davis@retailbank.com, Company: RetailBank Corp, Password: SecurePass#2026 (12+ chars, mixed case, special) → Check "I agree to Terms" → Click "Create Account"
- **Expected Result:** Form validates. Message: "Account created successfully! Welcome, Emma. Redirecting to onboarding..." Redirects to /onboarding. Confirmation email sent.
- **Verify:** No validation errors, redirect successful, no console errors
- **Screenshot:** Take success message
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 9: First Login
- **Action:** After redirect, enter email: emma.davis@retailbank.com → Password: SecurePass#2026 → "Sign In"
- **Expected Result:** Dashboard loads. User menu shows "Emma Davis". Welcome message: "Welcome to AMLIQ, Emma! Here are your next steps..." Onboarding checklist visible with 5 items.
- **Verify:** Login successful, name correct, checklist displays
- **Screenshot:** Take dashboard with checklist
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 10: Explore Dashboard - Read All Labels
- **Action:** Scan dashboard and read all section titles and labels → Look for guidance
- **Expected Result:** Sections visible: "System Overview", "Quick Stats" (Recent Screenings, Flagged Entities, Pending Alerts), "Recent Activity", "Get Started" section. All labels plain English.
- **Verify:** Labels clear and beginner-friendly, no unexplained acronyms
- **Screenshot:** Take full dashboard
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 11: Hover All Tooltips
- **Action:** Hover over metric labels and section titles → Check for tooltip popups
- **Expected Result:** Tooltips appear on hover with explanations: "Recent Screenings: Number of screenings in last 24 hours", "Flagged Entities: Matched against sanctions lists (>0.95 confidence)", "Pending Alerts: Awaiting manual review", "Last Sync: When sanctions lists last updated"
- **Verify:** Tooltips appear < 500ms, text helpful, beginner-friendly
- **Screenshot:** Take tooltip example
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 12: Try Screening with Simple Name
- **Action:** Click "Screen Entity" button → Select "Individual" → Name: John Smith, Nationality: United States, Passport: US-12345678 → "Screen"
- **Expected Result:** Progress bar shows "Screening... 50%". Results load in ~2 seconds: "Screening Complete", Risk: GREEN / LOW RISK, Confidence: 0.12 (very low), Message: "No high-confidence matches found."
- **Verify:** Screening fast, results clear, green color for low risk
- **Screenshot:** Take screening results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 13: Understand Confidence Score
- **Action:** Review confidence score 0.12 → Click "?" or "What is this?" link next to score
- **Expected Result:** Explanation popup: "Confidence Score (0-1) shows match closeness. 0.12 = Low Match, unlikely sanctions entity. Scores > 0.95 flagged as high-risk. Your threshold: 0.72. Visual scale: Green (0-0.50), Yellow (0.50-0.80), Red (0.80-1.0)."
- **Verify:** Explanation clear for beginners, scale visual is helpful
- **Screenshot:** Take explanation popup
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 14: Navigate to Alert Queue
- **Action:** Click "Alerts" in left sidebar → Wait for page load
- **Expected Result:** Alert Queue page displays. Columns: Entity, Risk Level, Confidence, Created, Status. Message: "No alerts yet. Screenings with high-risk matches appear here." Filter options visible.
- **Verify:** Page loads, empty state helpful
- **Screenshot:** Take empty alert queue
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 15: Open First Alert (Demo Alert)
- **Action:** If available, click on any alert in queue → Review alert details
- **Expected Result:** Alert detail page shows: Entity info (name, type, nationality), Matched list entry (if applicable), Risk level and confidence, Evidence sections, Action buttons: "Mark as Reviewed", "Flag for Manual Review", "Resolve", Comments section.
- **Verify:** All info clear, actions obvious
- **Screenshot:** Take alert detail
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 16: Read Evidence Explanation
- **Action:** Review "Evidence" or "Match Details" section → Look for layer explanation
- **Expected Result:** Evidence explains: "Matched on: Name (Exact) + DOB (Exact) + Nationality (Fuzzy). Each layer shows confidence contribution. Visual breakdown of score calculation."
- **Verify:** Explanation understandable, breakdown clear
- **Screenshot:** Take evidence section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 17: Try to Resolve Alert
- **Action:** Click "Resolve" button → Select reason dropdown (e.g., "False Positive", "Approved") → "Resolve"
- **Expected Result:** Modal appears with resolution options: "False Positive", "Approved", "Refer to Legal", "Unable to Determine" → After selection: "Alert resolved as '[reason]' by Emma Davis on [date/time]" → Alert disappears or shows "Resolved".
- **Verify:** Resolution saved, timestamp recorded, status updates
- **Screenshot:** Take resolution confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 18: Navigate to Configuration
- **Action:** Click "Configuration" in left sidebar
- **Expected Result:** Configuration page displays: "Regulatory Presets" (Israeli-Strictest, Balanced-Recommended, Permissive), "Screening Thresholds" showing confidence minimum: 0.72, Current preset: Balanced (highlighted).
- **Verify:** Presets visible and described
- **Screenshot:** Take configuration page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 19: Read Preset Descriptions
- **Action:** Hover or click presets to read descriptions
- **Expected Result:** Descriptions: Israeli: "High-risk jurisdictions, highest thresholds (0.95+), flags more matches." Balanced: "Most organizations, threshold 0.72, good balance." Permissive: "Low-risk, threshold 0.50, fewer false positives."
- **Verify:** Descriptions clear, "Balanced" recommended for beginners
- **Screenshot:** Take preset descriptions
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 20: Select "Balanced" Preset
- **Action:** If not already selected, click "Select Preset" on Balanced → Confirm modal
- **Expected Result:** Message: "Balanced preset applied. Threshold updated to 0.72. Applies to all future screenings."
- **Verify:** Selection saved, threshold updates
- **Screenshot:** Take confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 21: Go Back to Screening & Try Company
- **Action:** Click "Screen Entity" → Select "Company" (instead of Individual) → Company Name: Acme Corporation, Country: United States → "Screen"
- **Expected Result:** Screening processes for company. Results show: Risk: GREEN / LOW RISK, Message: "This company is not on known sanctions lists."
- **Verify:** Company screening works, results clear
- **Screenshot:** Take company results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 22: Navigate to Analytics
- **Action:** Click "Analytics" in left sidebar
- **Expected Result:** Analytics page shows charts: "Screenings Over Time" (line), "Risk Distribution" (pie), "Most Common Matches" (bar), "Entity Types Screened" (pie). Labels clear.
- **Verify:** Charts load, data/empty state shown
- **Screenshot:** Take analytics page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 23: Understand Charts
- **Action:** Hover over charts for tooltips → Read legends and axis labels
- **Expected Result:** Charts readable with legends. "Screenings Over Time: 0 screenings in past 30 days" (new user). Legend shows color meanings. Axis labels clear.
- **Verify:** Charts understandable, legends present
- **Screenshot:** Take chart with tooltip
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 24: Navigate to Billing
- **Action:** Click "Billing" in left sidebar
- **Expected Result:** Billing page shows: "Current Plan: Free Trial", "Status: Active", "Trial Expires: 2026-04-26 (30 days)", "Cost: $0.00/month (100% discount with AMLIQ_FREE)", "Usage: X screenings used of unlimited", "Your free trial includes all features for 30 days."
- **Verify:** Plan info clear, trial duration visible, $0.00 cost
- **Screenshot:** Take billing page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 25: Explore All Sidebar Items
- **Action:** Check left sidebar → Verify all items visible and clickable
- **Expected Result:** All items present: Dashboard, Screen Entity, Alerts, Configuration, Analytics, Audit, Billing, Help/Support, Settings, Logout. No broken links.
- **Verify:** Sidebar complete, all functional
- **Screenshot:** Take full sidebar
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 26: Test Help/Documentation Links
- **Action:** Click "Help" or "Documentation" link → Review resources
- **Expected Result:** Help page displays: "Getting Started" guide, "Screening Tutorial", "Understanding Results" article, "FAQ", "Contact Support" button, Search box.
- **Verify:** Resources accessible, comprehensive
- **Screenshot:** Take help page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 27: Test Accessibility - Font Scaling
- **Action:** Increase text size (Ctrl + Plus 2-3 times) → Navigate several pages
- **Expected Result:** Text scales without breaking layout. All readable. No overlapping elements. Navigation functional.
- **Verify:** Layout doesn't break, content accessible
- **Screenshot:** Take page with enlarged font
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 28: Test Keyboard-Only Navigation
- **Action:** Use Tab key to navigate all interactive elements → Verify focus indicators visible → Click using Enter/Space
- **Expected Result:** All buttons/links reachable via Tab. Focus indicator (blue outline) visible. Enter/Space activate buttons. Forms submittable.
- **Verify:** Focus indicators present, keyboard shortcut works
- **Screenshot:** Take page showing focus indicator
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 29: Mobile View Test (375px Width)
- **Action:** Open DevTools → Device Emulation → Set width 375px (mobile) → Navigate: Dashboard, Screen, Results, Billing
- **Expected Result:** Layout adapts: Sidebar → hamburger menu, content stacks vertically, buttons 48px+, tables scrollable, no horizontal scroll, text readable.
- **Verify:** Mobile layout responsive, all features accessible, no content cut off
- **Screenshot:** Take mobile dashboard
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 30: Return to Desktop View
- **Action:** Close Device Emulation or resize to 1920x1080
- **Expected Result:** Layout returns to desktop correctly. All elements positioned properly.
- **Verify:** Layout responsive and correct
- **Screenshot:** Take desktop view
- **Checkbox:** ☐ PASS / ☐ FAIL

## Test Summary

**Total Steps:** 30

**Critical Pass Criteria (Beginner User):**
- ☐ Signup completes with promo code
- ☐ First login works without issues
- ☐ Dashboard intuitive with clear labels
- ☐ First screening completes, results understandable
- ☐ Confidence score explained clearly
- ☐ All sidebar navigation works
- ☐ Preset selection (Balanced) applies
- ☐ Company screening works

**Important Criteria (Usability):**
- ☐ Landing page clear and inviting
- ☐ FAQ answers beginner questions
- ☐ Demo video helpful and clear
- ☐ Tooltips explain all major metrics
- ☐ Alert resolution intuitive
- ☐ Configuration beginner-friendly
- ☐ Billing page shows free trial status

**Nice-to-Have (Accessibility):**
- ☐ Text scaling works without breaking layout
- ☐ Keyboard-only navigation fully functional
- ☐ Mobile responsive at 375px
- ☐ Documentation links accessible
- ☐ Help resources comprehensive

**Onboarding Success Metrics:**
- ☐ User understands sanctions screening
- ☐ User can perform basic screening
- ☐ User understands confidence score system
- ☐ User can navigate all major sections
- ☐ User feels confident using platform
- ☐ User knows how to get help
- ☐ User understands free trial terms
- ☐ No errors or confusing UI

**Notes:**
- Flow prioritizes clarity and simplicity for new users
- Minimal jargon; all terms explained
- Tooltips critical for education
- Mobile responsiveness important
- Documentation comprehensive but not overwhelming
- Support easily accessible
- Onboarding checklist guides through features
