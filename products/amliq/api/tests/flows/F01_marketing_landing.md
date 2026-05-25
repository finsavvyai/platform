# F01: Marketing Landing Page

**Objective:** Verify landing page renders correctly with hero, navigation, and feature sections.
**Prerequisites:** Navigate to `/` without authentication

## Test Steps

1. **Hero Section:** Navigate to `/`, verify title "AML Screening That Catches Everything", subtitle, and CTA buttons ("Start Free Trial", "View Docs")
2. **Navigation:** Verify sticky navbar with: Features, Pricing, Docs, Sign In, Start Free Trial. Click each—verify scroll/navigation works.
3. **Features Grid:** Scroll to "Why Choose AMLIQ", verify 6 feature cards with icons/titles (Real-time Matching, Multiple Lists, Smart Deduplication)
4. **Logo Cloud:** Verify "Trusted by Industry Leaders" section with ≥5 logos
5. **Interactive Demo:** Locate "See It In Action" section, type "Vladimir Putin", verify results in <2 seconds with confidence score badge
6. **Comparison Table:** Verify AMLIQ vs World-Check vs Manual with correct checkmarks/X marks
7. **Stats Section:** Verify metrics: "15M+ Entities", "99.98% Uptime", "<100ms Response Time"
8. **Testimonials:** Verify 3 testimonial cards with quotes, author names, titles, companies, and 5-star ratings
9. **Final CTA:** Verify "Ready to get started?" section with "Start Free Trial" button redirects to checkout
10. **Footer:** Verify footer sections (Company, Product, Legal, Contact) with links and copyright
11. **Mobile (375px):** Resize to mobile width, verify hamburger menu, feature cards stack vertically, no horizontal scroll, CTA buttons touchable (44px+)

## Validation

- No console errors; all images load; page load <3 seconds
- All links functional; smooth scrolling works
- Mobile menu closes on click outside
- No horizontal scroll on mobile

## Expected Result

All sections render correctly with proper formatting and responsive behavior across devices.

---

*F01 | Marketing Landing Page | 2026-03-26*
