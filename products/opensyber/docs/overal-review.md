# What Else Is Crucial — The Things That Could Kill You

I did a deep technical, SEO, security, and infrastructure audit beyond the design and UX review we already covered. Here's what I found, ranked from "fix this today" to "fix this before your next funding round."

---

## TIER 1: FIX IMMEDIATELY (This Weekend)

### 1. Your Clerk Auth Is Running in TEST Mode on Production

Your Clerk publishable key is `pk_test_...` and both the sign-in and sign-up pages display an orange "Development mode" badge at the bottom. This is visible to every visitor. For a company selling *security infrastructure*, having your own authentication running in development mode is devastating to credibility. Anyone who inspects your auth flow will see this immediately.

What to do: Switch to your Clerk production instance. This means creating a production Clerk app, swapping the publishable key to `pk_live_...`, configuring your production domain, and removing the dev watermark. This is a 30-minute fix that eliminates the single most embarrassing issue on the site.

### 2. Your OG Image Is a 404

The meta tag references `https://opensyber.cloud/og-image.png` but that URL returns a 404 page. This means every time someone shares your link on Twitter/X, LinkedIn, Slack, Discord, or anywhere else, they see either a blank preview or a broken image. For an early-stage product, social sharing is your primary distribution channel, and you're getting zero visual impact from every share.

What to do: Create a 1200×630 PNG with your brand, tagline, and a visual of the dashboard. Upload it to your public directory. Verify it works at the URL. Test it with Twitter's Card Validator and LinkedIn's Post Inspector.

### 3. Multiple Dashboard Pages Are Throwing Errors

I found "Security Dashboard Error" on at least three pages: `/dashboard/security`, `/dashboard/security/threats` (Threat Map), and `/dashboard/security/network` (Network Activity). The error message even leaks internal details: "Cannot read properties of undefined (reading 'length')" and "An error occurred in the Server Components render." These are navigation items in the sidebar that users will click on. Hitting an error page from your own nav destroys confidence, especially in a security product.

What to do: Either fix the underlying data issues or temporarily remove these pages from the sidebar navigation until they work. A link to a broken page is worse than no link at all.

### 4. ZERO Security Headers

I checked every standard security header. Every single one is missing:

Content-Security-Policy — MISSING. Strict-Transport-Security (HSTS) — MISSING. X-Content-Type-Options — MISSING. X-Frame-Options — MISSING. X-XSS-Protection — MISSING. Referrer-Policy — MISSING. Permissions-Policy — MISSING. Cross-Origin-Opener-Policy — MISSING.

This is the most damning finding of the entire audit. You are a security company with zero security headers on your own website. Any security researcher, any enterprise buyer, any competitor can run a headers scan and use this against you. SecurityHeaders.com will give you an F rating. This will show up in enterprise vendor assessments.

What to do: Add these headers in your Next.js config (`next.config.js` headers array) or via Cloudflare response header rules. A minimal production-ready set would include: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a Content-Security-Policy that at minimum restricts frame-ancestors and script sources. This is a 1-hour fix.

---

## TIER 2: FIX THIS WEEK

### 5. No Sitemap.xml

`/sitemap.xml` returns a 404. Without a sitemap, Google and other search engines have to discover your pages through crawling alone. For a site with multiple important pages (homepage, pricing, docs, blog posts, marketplace), you're leaving SEO value on the table. Next.js has built-in sitemap generation — there's no excuse for this being missing.

What to do: Add a `sitemap.ts` file to your Next.js app directory. Include all public pages: `/`, `/pricing`, `/marketplace`, `/docs`, `/docs/*`, `/blog`, `/blog/*`, `/demo`, `/threats`. Exclude dashboard routes. Submit the sitemap to Google Search Console.

### 6. No Legal Pages — Privacy Policy, Terms, Security Policy

There are zero links to Privacy Policy, Terms of Service, or a Security Policy anywhere on the site. The footer has Pricing, Skills, Docs, Demo, Blog, and Support — that's it. This is problematic for multiple reasons. You're handling user accounts and potentially credential data — you legally need a privacy policy in most jurisdictions. Enterprise buyers require ToS and privacy policies as part of vendor evaluation. GDPR compliance (you offer EU hosting) mandates a privacy policy. And any investor doing due diligence will flag this as a gap.

What to do: Create `/privacy`, `/terms`, and `/security` pages. For now, even a clear, well-written single-page policy is better than nothing. Add links to the footer. Consider adding a `/security` page that outlines your security practices, responsible disclosure process, and links to your (currently missing) security.txt file.

### 7. No security.txt

`/.well-known/security.txt` returns a 404. This is a web standard (RFC 9116) that tells security researchers how to report vulnerabilities. For a security company, not having this is like a locksmith without a lock on their own door. It's a small file but it signals awareness.

What to do: Create a `security.txt` file with: Contact email for security reports, a PGP key (optional but good), your security policy URL, and an expiration date. Host it at `/.well-known/security.txt`.

### 8. The 404 Page Is Default Next.js — Off-Brand

Any non-existent URL shows the stock Next.js 404 page: white background, black text, centered "404 | This page could not be found." It's completely off-brand — your entire site is dark mode, and suddenly users see a white flash with generic text. No navigation, no way to get back to your site.

What to do: Create a custom `not-found.tsx` page that matches your dark theme, includes your nav, has a helpful message, and provides links back to the homepage, docs, and dashboard.

### 9. No Analytics, No Error Tracking

The only third-party scripts are Clerk (auth) and Cloudflare Web Analytics (the beacon). There's no Sentry, no PostHog, no Mixpanel, no Google Analytics, no Hotjar. You're flying completely blind. You don't know how users navigate, where they drop off, which pages get the most engagement, or when your app throws errors in the wild (like those Security Dashboard errors).

What to do: At minimum, add PostHog or Mixpanel for product analytics (funnels, retention, feature usage) and Sentry for error tracking. PostHog is open source and has a generous free tier — it's a natural fit for your brand. Sentry will catch those server component errors before users report them.

---

## TIER 3: FIX BEFORE YOUR NEXT MILESTONE

### 10. 503 Errors on RSC Prefetch Requests

I observed multiple 503 status codes on React Server Component prefetch requests (the `?_rsc=` URLs for `/dashboard`, `/marketplace`, `/pricing`). These are Next.js prefetching pages for faster navigation, and they're failing silently. This means client-side navigations may be slower than they should be, and it suggests either your server is under-provisioned, your middleware is interfering, or there's a deployment configuration issue.

What to do: Investigate why prefetch requests return 503. Check your Cloudflare or hosting configuration for rate limiting that might be blocking RSC requests. Check your Next.js middleware — it may be intercepting and failing on these requests. This affects perceived performance.

### 11. The `X-Powered-By: Next.js` Header Is Exposed

Your response headers include `X-Powered-By: Next.js`. This is a minor information disclosure — it tells attackers exactly what framework you're running. Best practice is to remove it.

What to do: Add `poweredByHeader: false` to your `next.config.js`. One line.

### 12. Instance IDs Are Leaking in Public Page Source

I found UUIDs (`cd087432-7bc8-4db5-a19b-e6fd28e0afad`) in the public page source from the RSC payload. These appear to be instance identifiers. While publishable keys and instance IDs aren't secret per se, leaking infrastructure identifiers in public-facing HTML is unnecessarily sloppy for a security company.

What to do: Review what data is included in your server component responses on public pages. Ensure that authenticated user data (instance IDs, hostnames, gateway tokens) is only included in responses for authenticated routes.

### 13. No Skip-to-Content Link (Accessibility)

The site has no skip-to-content link for keyboard and screen reader users. While you have `lang="en"` on the HTML element and ARIA landmarks, the lack of skip navigation means keyboard users have to tab through the entire nav on every page load.

What to do: Add a visually hidden skip link as the first focusable element: `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>`. Add `id="main-content"` to your `<main>` element.

### 14. The Robots.txt Blocks ALL AI Crawlers Including Search

Your robots.txt (managed by Cloudflare) blocks ClaudeBot, GPTBot, Google-Extended, Bytespider, CCBot, and others. This is fine for AI training. But it also means your content won't appear in AI-powered search answers (Perplexity, ChatGPT with browsing, Google AI Overviews). For a product in the AI space, being invisible to AI search is a significant discovery disadvantage. Many of your target users search with AI tools.

What to do: This is a strategic decision, not a bug. Consider setting `Content-Signal: ai-input=yes` if you want to appear in AI search results while still blocking training. Review the Cloudflare managed rules and customize them for your needs.

### 15. No Structured Data (JSON-LD)

The page has no JSON-LD structured data. Adding Organization, Product, and FAQ schema would improve how your site appears in Google search results — potentially showing pricing, FAQs, and organization info directly in the SERP.

What to do: Add JSON-LD for Organization (name, logo, URL, social profiles), SoftwareApplication (your product), and FAQ schema on the homepage for the "Why not just self-host?" section.

### 16. Build a Proper Trust Page

I noticed in your Settings you already have a "Growth Kit" feature that generates a public trust page URL (`/trust/{instance-id}`) and an embeddable security badge for README files. This is a brilliant feature — but it's buried inside settings and I'd never have known it existed from the public site. This should be a headline feature on your homepage and docs.

What to do: Showcase the trust page and security badge on the homepage. Add a "Trust & Transparency" section showing what these look like. For the indie builder persona, the ability to embed a security badge in their GitHub README is a powerful viral loop — it advertises OpenSyber to every person who reads that README.

### 17. The Referral Program Needs Visibility

You have a referral system ("Earn free months by referring friends") with a unique invite link, share buttons for X/LinkedIn/email, and a tracker for users referred and months earned. But it's buried at the bottom of the Settings page. Nobody will find it there.

What to do: Add a "Refer & Earn" link in the sidebar bottom rail (next to the user avatar). Send an email 7 days after signup promoting the referral program. Show a referral prompt when someone hits certain milestones (first skill installed, first week active, security score above 80).

### 18. The Credential Vault Needs Promotion

I saw a "Credential Vault" section in Settings with the description "Store secrets that are encrypted at rest and injected into your agent as environment variables." This is a core security feature that directly addresses one of the four problems on your homepage (exposed credentials / plaintext .env files). But it's hidden in settings.

What to do: Make the credential vault a first-class experience. It should have its own sidebar item under the Agent group (not buried in Settings). The first time a user visits the dashboard, prompt them to store their first secret. This connects the homepage promise ("AES-256 encrypted credential vault") to the actual product experience.

---

## THE ONE-LINE SUMMARY

You're building a security product that currently fails its own security audit. The irony is fixable — most of these are 1-hour to 1-day fixes. But every day they remain unfixed, they undermine the core promise of your entire business. Tier 1 items (test mode auth, missing OG image, broken pages, zero security headers) should be resolved before you share this URL with another investor, post on Hacker News, or pitch to an enterprise customer. Everything else compounds your credibility over time but won't stop you from launching.