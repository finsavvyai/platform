/**
 * Record a cinematic LunaOS demo using CodeRailFlow's overlay system.
 *
 * Injects CodeRailFlow-style captions, highlights, and transitions
 * into a Playwright recording — same visual language as the platform.
 *
 * Usage: node scripts/record-demo.js
 * Output: /tmp/lunaos-demo/
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/lunaos-demo';

// ── CodeRailFlow overlay injection ───────────────────────────
const CODERAIL_OVERLAY = `
<style id="coderail-styles">
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

  .cr-caption {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.8) 70%, transparent 100%);
    padding: 48px 40px 32px; z-index: 99999; font-family: 'Inter', sans-serif;
    animation: crSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .cr-caption-title {
    font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 6px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  .cr-caption-sub {
    font-size: 14px; color: rgba(255,255,255,0.7); font-weight: 400;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  .cr-step-badge {
    position: fixed; top: 20px; left: 20px;
    background: rgba(139,92,246,0.9); color: #fff;
    padding: 6px 14px; border-radius: 20px; font-family: 'Inter', sans-serif;
    font-size: 12px; font-weight: 600; z-index: 99999;
    letter-spacing: 0.05em; backdrop-filter: blur(8px);
  }
  .cr-brand-badge {
    position: fixed; top: 20px; right: 20px;
    background: rgba(10,10,15,0.85); border: 1px solid rgba(139,92,246,0.3);
    color: #fff; padding: 6px 14px; border-radius: 20px;
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600;
    z-index: 99999; letter-spacing: 0.08em; backdrop-filter: blur(8px);
  }
  .cr-highlight {
    position: fixed; border: 2px solid rgba(139,92,246,0.7); border-radius: 12px;
    background: rgba(139,92,246,0.06); pointer-events: none; z-index: 99998;
    box-shadow: 0 0 20px rgba(139,92,246,0.15);
    animation: crPulse 2s ease-in-out infinite;
  }
  .cr-pointer {
    position: fixed; width: 24px; height: 24px; border-radius: 50%;
    background: rgba(139,92,246,0.5); border: 2px solid #8b5cf6;
    pointer-events: none; z-index: 99999; transform: translate(-50%, -50%);
    animation: crPointerPulse 1s ease-in-out infinite;
  }
  .cr-transition { animation: crFadeIn 0.6s ease-out; }
  @keyframes crSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes crPulse { 0%,100% { box-shadow: 0 0 20px rgba(139,92,246,0.15); } 50% { box-shadow: 0 0 30px rgba(139,92,246,0.3); } }
  @keyframes crPointerPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.3); } }
  @keyframes crFadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>`;

// ── Story flow (CodeRailFlow DSL-compatible) ─────────────────
const FLOW = [
  { type: 'goto', url: 'https://lunaos.ai', narrate: 'LunaOS — AI-Native Backend Platform', sub: 'Build full-stack apps with AI. Backend included.', step: 'Homepage', highlight: 'h1', pointer: '.btn-primary', wait: 3500 },
  { type: 'scroll', target: '#use-cases', narrate: 'What you can build', sub: 'SaaS \u2022 AI APIs \u2022 Chatbots \u2022 Internal Tools \u2022 Automation \u2022 Full-Stack Apps', step: 'Use Cases', highlight: '.use-case-grid', wait: 3500 },
  { type: 'scroll', target: '#platform', narrate: 'Everything you need. Nothing you don\'t.', sub: 'Database \u2022 API Gateway \u2022 Auth \u2022 AI Agents \u2022 RAG Search \u2022 Billing', step: 'Platform', highlight: '.platform-grid', wait: 3500 },
  { type: 'scroll', target: '#demo', narrate: 'Build an app in 60 seconds', sub: 'Install \u2192 Init \u2192 Add agents \u2192 Deploy to Cloudflare edge', step: 'Live Demo', highlight: '.demo-terminal', wait: 4000 },
  { type: 'scroll', target: '#pricing', narrate: 'Start free. Scale as you grow.', sub: 'Free $0 forever \u2022 Pro $29/mo \u2022 Team $79/mo \u2022 No credit card', step: 'Pricing', highlight: '.price-card.featured', pointer: '.price-card.featured .btn', wait: 3500 },
  { type: 'goto', url: 'https://agents.lunaos.ai/auth/login', narrate: 'One-click authentication', sub: 'Google \u2022 GitHub \u2022 Microsoft \u2022 Email — or use the CLI', step: 'Sign In', wait: 3000 },
  { type: 'goto', url: 'https://studio.lunaos.ai', narrate: 'LunaOS Studio', sub: 'Visual workflow builder — drag, connect, deploy AI agent workflows', step: 'Studio', highlight: 'h1', wait: 3000 },
  { type: 'scroll', target: 'h2', narrate: 'No code required', sub: 'Visual canvas \u2022 Real-time execution \u2022 Version control \u2022 Team collaboration', step: 'Studio Features', wait: 3000 },
  { type: 'goto', url: 'https://docs.lunaos.ai', narrate: 'Complete documentation', sub: '28 agents \u2022 API reference \u2022 Getting started \u2022 Deployment guides', step: 'Docs', wait: 2500 },
  { type: 'goto', url: 'https://status.lunaos.ai', narrate: 'Production-grade infrastructure', sub: 'Cloudflare edge \u2022 Sub-200ms globally \u2022 Real-time monitoring', step: 'Status', wait: 2500 },
  { type: 'goto', url: 'https://lunaos.ai', narrate: 'Start building today', sub: 'npm i -g luna-agents-cli && luna init my-app', step: 'Get Started', highlight: '.hero-actions', pointer: '.btn-primary', wait: 4000, final: true },
];

// ── Overlay helpers ──────────────────────────────────────────
async function injectOverlays(page) {
  await page.evaluate((css) => {
    if (!document.getElementById('coderail-styles')) {
      document.body.insertAdjacentHTML('beforeend', css);
    }
  }, CODERAIL_OVERLAY);
}

async function showCaption(page, title, sub, stepLabel, isFinal) {
  await page.evaluate(({ title, sub, stepLabel, isFinal }) => {
    document.querySelectorAll('.cr-caption,.cr-step-badge,.cr-brand-badge').forEach(e => e.remove());

    const caption = document.createElement('div');
    caption.className = 'cr-caption';
    caption.innerHTML = `<div class="cr-caption-title">${title}</div><div class="cr-caption-sub">${sub}</div>`;
    if (isFinal) caption.style.borderTop = '2px solid rgba(52,211,153,0.5)';
    document.body.appendChild(caption);

    const step = document.createElement('div');
    step.className = 'cr-step-badge';
    step.textContent = stepLabel;
    document.body.appendChild(step);

    const brand = document.createElement('div');
    brand.className = 'cr-brand-badge';
    brand.textContent = 'LUNAOS PRODUCT TOUR';
    document.body.appendChild(brand);
  }, { title, sub, stepLabel, isFinal });
}

async function showHighlight(page, selector) {
  await page.evaluate((sel) => {
    document.querySelectorAll('.cr-highlight').forEach(e => e.remove());
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const hl = document.createElement('div');
    hl.className = 'cr-highlight';
    Object.assign(hl.style, { left: `${r.left-8}px`, top: `${r.top-8}px`, width: `${r.width+16}px`, height: `${r.height+16}px` });
    document.body.appendChild(hl);
  }, selector);
}

async function showPointer(page, selector) {
  await page.evaluate((sel) => {
    document.querySelectorAll('.cr-pointer').forEach(e => e.remove());
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ptr = document.createElement('div');
    ptr.className = 'cr-pointer';
    Object.assign(ptr.style, { left: `${r.left + r.width/2}px`, top: `${r.top + r.height/2}px` });
    document.body.appendChild(ptr);
  }, selector);
}

// ── SRT generation ───────────────────────────────────────────
function toSRT(entries) {
  return entries.map((e, i) => {
    const fmt = ms => {
      const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
      return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
    };
    return `${i+1}\n${fmt(e.start)} --> ${fmt(e.end)}\n${e.text}\n`;
  }).join('\n');
}

// ── Main ─────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  const subs = [];
  let timeMs = 0;

  for (let i = 0; i < FLOW.length; i++) {
    const step = FLOW[i];
    const num = String(i + 1).padStart(2, '0');
    const label = `${i + 1} / ${FLOW.length}  ${step.step}`;

    console.log(`${num}. ${step.narrate}`);

    if (step.type === 'goto') {
      await page.goto(step.url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    if (step.type === 'scroll' && step.target) {
      await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), step.target);
      await page.waitForTimeout(800);
    }

    await injectOverlays(page);
    await showCaption(page, step.narrate, step.sub, label, step.final);
    if (step.highlight) await showHighlight(page, step.highlight);
    if (step.pointer) await showPointer(page, step.pointer);

    await page.waitForTimeout(600);
    const slug = step.narrate.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    await page.screenshot({ path: path.join(OUT, `${num}-${slug}.png`) });

    subs.push({ text: `${step.narrate} — ${step.sub}`, start: timeMs, end: timeMs + step.wait });
    timeMs += step.wait;

    await page.waitForTimeout(step.wait - 600);
  }

  await page.close();
  await ctx.close();
  await browser.close();

  const videos = fs.readdirSync(OUT).filter(f => f.endsWith('.webm'));
  if (videos.length) fs.renameSync(path.join(OUT, videos[0]), path.join(OUT, 'lunaos-demo.webm'));

  fs.writeFileSync(path.join(OUT, 'lunaos-demo.srt'), toSRT(subs));
  fs.writeFileSync(path.join(OUT, 'flow.json'), JSON.stringify(FLOW, null, 2));

  console.log(`\nDone! ${OUT}/`);
  console.log(`  Video:       lunaos-demo.webm`);
  console.log(`  Subtitles:   lunaos-demo.srt (${subs.length} entries)`);
  console.log(`  Screenshots: ${FLOW.length} annotated frames`);
  console.log(`  Flow:        flow.json (CodeRailFlow-compatible)`);
})();
