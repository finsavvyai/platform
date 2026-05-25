# TokenForge — LemonSqueezy Overlay Fix
> One agent. Two files. 30 minutes.
> Hides finsavvy URL completely — checkout opens as modal on tokenforge.opensyber.cloud

---

# AGENT — LEMONSQUEEZY OVERLAY CHECKOUT

```prompt
You are fixing the LemonSqueezy checkout on tokenforge.opensyber.cloud.

PROBLEM:
  Clicking "Subscribe to Pro" or "Subscribe to Team" redirects users
  to finsavvy.lemonsqueezy.com — a completely different brand.
  For a security product this kills trust immediately.

SOLUTION:
  LemonSqueezy's Lemon.js overlay mode opens the checkout as a floating
  modal on top of tokenforge.opensyber.cloud. Users never leave the site.
  The finsavvy URL never appears in the browser bar.
  Two changes required: one script tag, one CSS class on each button.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — Load Lemon.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: src/app.html (or src/routes/+layout.svelte <svelte:head>)

Add this script tag. Use defer so it doesn't block page load:

  <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>

If adding to src/app.html, place it inside <head>:

  <!DOCTYPE html>
  <html>
    <head>
      %sveltekit.head%
      <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
    </head>
    <body>%sveltekit.body%</body>
  </html>

If adding to +layout.svelte, place in <svelte:head>:

  <svelte:head>
    <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
  </svelte:head>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — Add lemonsqueezy-button class
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: src/routes/pricing/+page.svelte
FILE: src/routes/+page.svelte (homepage pricing section)

Find EVERY anchor tag that points to a LemonSqueezy checkout URL.
They look like: href="https://finsavvy.lemonsqueezy.com/checkout/buy/..."

Add class="lemonsqueezy-button" to each one.
Keep the existing href and all other attributes — only add the class.

Examples of what to find and how to change them:

  BEFORE:
    <a href="https://finsavvy.lemonsqueezy.com/checkout/buy/d947a1bf-c05a-421e-8882-6f4dd88e1a92">
      Subscribe to Pro
    </a>

  AFTER:
    <a
      href="https://finsavvy.lemonsqueezy.com/checkout/buy/d947a1bf-c05a-421e-8882-6f4dd88e1a92"
      class="lemonsqueezy-button"
    >
      Subscribe to Pro
    </a>

  BEFORE:
    <a href="https://finsavvy.lemonsqueezy.com/checkout/buy/b0e3e490-bee4-4c37-ad65-a79d039e5818">
      Subscribe to Team
    </a>

  AFTER:
    <a
      href="https://finsavvy.lemonsqueezy.com/checkout/buy/b0e3e490-bee4-4c37-ad65-a79d039e5818"
      class="lemonsqueezy-button"
    >
      Subscribe to Team
    </a>

If the button already has a class attribute, append the new class:
  class="btn btn-primary lemonsqueezy-button"

Search the ENTIRE codebase for finsavvy.lemonsqueezy.com to find
every checkout link. Add lemonsqueezy-button to ALL of them.
Do not miss any.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — Remove the checkout-note disclaimer (if it exists)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If there is any text near the pricing buttons that says something like:
  "Secure checkout via LemonSqueezy"
  "You'll be redirected briefly"
  "Powered by LemonSqueezy"

Remove it. It's no longer needed — users never leave the site.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO VERIFY IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In development (localhost):
  npm run dev
  Open /pricing in browser
  Click "Subscribe to Pro"
  Expected: a modal overlay appears on top of the page
  Expected: browser URL stays as localhost:5174/pricing
  Expected: no redirect to finsavvy.lemonsqueezy.com

If the modal doesn't appear:
  Check browser console for errors
  Verify the script tag loaded: type window.LemonSqueezy in console
  Verify the button has class="lemonsqueezy-button" in the DOM inspector

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- DO NOT change the href URLs — they must stay as finsavvy.lemonsqueezy.com
  The overlay intercepts the click BEFORE the redirect happens
  Lemon.js reads the href to know what to load in the modal
  Changing the URL would break the checkout

- The class name must be exactly: lemonsqueezy-button
  No typos. No variations. Lemon.js looks for this exact string.

- The script tag must load on the same page as the buttons
  If pricing is a separate route, the script in +layout.svelte
  covers all routes automatically — preferred approach

- This works in production exactly the same as development
  No environment-specific changes needed

WHEN DONE: verify in browser that clicking a pricing button
opens a modal overlay WITHOUT leaving tokenforge.opensyber.cloud

Output: "LEMONSQUEEZY OVERLAY COMPLETE — finsavvy URL hidden"
```
