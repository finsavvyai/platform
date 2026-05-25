// Email notifications via Resend API.

import type { Env } from "./types";

const FROM = "PushCI <notifications@pushci.dev>";
const RESEND_URL = "https://api.resend.com/emails";

interface SendOpts {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function send(env: Env, opts: SendOpts): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
    });
    if (!res.ok) {
      console.error(`Resend error ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#18181b;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
<div style="margin-bottom:32px;font-size:20px;font-weight:700;color:#10b981;">PushCI</div>
${body}
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #27272a;font-size:12px;color:#71717a;">
You received this because you have an account on <a href="https://pushci.dev" style="color:#10b981;text-decoration:none;">pushci.dev</a>.
</div>
</div></body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#10b981;color:#18181b;font-weight:600;border-radius:6px;text-decoration:none;">${label}</a>`;
}

export async function sendRunFailedEmail(
  env: Env,
  to: string,
  run: { id: string; repo: string; branch: string; sha: string },
): Promise<boolean> {
  const shortSha = run.sha.slice(0, 7);
  const url = `https://app.pushci.dev/runs/${run.id}`;
  return send(env, {
    to,
    subject: `CI failed: ${run.repo} (${run.branch})`,
    html: wrap(`
<h2 style="margin:0 0 8px;color:#e4e4e7;font-size:18px;">Run failed</h2>
<p style="margin:0 0 16px;color:#a1a1aa;">A CI run on <strong>${run.repo}</strong> did not pass.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
<tr><td style="padding:8px 12px;color:#a1a1aa;border-bottom:1px solid #27272a;">Repo</td><td style="padding:8px 12px;color:#e4e4e7;border-bottom:1px solid #27272a;">${run.repo}</td></tr>
<tr><td style="padding:8px 12px;color:#a1a1aa;border-bottom:1px solid #27272a;">Branch</td><td style="padding:8px 12px;color:#e4e4e7;border-bottom:1px solid #27272a;">${run.branch}</td></tr>
<tr><td style="padding:8px 12px;color:#a1a1aa;">Commit</td><td style="padding:8px 12px;color:#e4e4e7;font-family:monospace;">${shortSha}</td></tr>
</table>
${btn(url, "View Run")}`),
    text: `CI run failed for ${run.repo} on branch ${run.branch} (${shortSha}).\nView: ${url}`,
  });
}

export async function sendDeployApprovalEmail(
  env: Env,
  to: string,
  request: { id: string; repo: string; environment: string; requestedBy: string },
): Promise<boolean> {
  const url = `https://app.pushci.dev/deploys/${request.id}`;
  return send(env, {
    to,
    subject: `Deploy approval needed: ${request.repo} -> ${request.environment}`,
    html: wrap(`
<h2 style="margin:0 0 8px;color:#e4e4e7;font-size:18px;">Deploy approval requested</h2>
<p style="margin:0 0 16px;color:#a1a1aa;"><strong>${request.requestedBy}</strong> wants to deploy to <strong>${request.environment}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
<tr><td style="padding:8px 12px;color:#a1a1aa;border-bottom:1px solid #27272a;">Repo</td><td style="padding:8px 12px;color:#e4e4e7;border-bottom:1px solid #27272a;">${request.repo}</td></tr>
<tr><td style="padding:8px 12px;color:#a1a1aa;border-bottom:1px solid #27272a;">Environment</td><td style="padding:8px 12px;color:#e4e4e7;border-bottom:1px solid #27272a;">${request.environment}</td></tr>
<tr><td style="padding:8px 12px;color:#a1a1aa;">Requested by</td><td style="padding:8px 12px;color:#e4e4e7;">${request.requestedBy}</td></tr>
</table>
${btn(url, "Review Deploy")}`),
    text: `Deploy approval needed: ${request.requestedBy} wants to deploy ${request.repo} to ${request.environment}.\nReview: ${url}`,
  });
}

export async function sendWelcomeEmail(
  env: Env,
  to: string,
  login: string,
): Promise<boolean> {
  const url = "https://app.pushci.dev";
  return send(env, {
    to,
    subject: "Welcome to PushCI",
    html: wrap(`
<h2 style="margin:0 0 8px;color:#e4e4e7;font-size:18px;">Welcome, ${login}!</h2>
<p style="margin:0 0 16px;color:#a1a1aa;">Your account is ready. PushCI runs your CI on your own machine — no YAML, no per-minute billing.</p>
<p style="margin:0 0 8px;color:#a1a1aa;">Get started:</p>
<ol style="margin:0 0 16px;padding-left:20px;color:#a1a1aa;">
<li style="margin-bottom:4px;">Run <code style="background:#27272a;padding:2px 6px;border-radius:4px;color:#10b981;">npx pushci init</code> in your repo</li>
<li style="margin-bottom:4px;">Push a commit — tests run automatically</li>
<li style="margin-bottom:4px;">Check results in the dashboard</li>
</ol>
${btn(url, "Open Dashboard")}`),
    text: `Welcome to PushCI, ${login}!\n\nGet started:\n1. Run "npx pushci init" in your repo\n2. Push a commit — tests run automatically\n3. Check results in the dashboard\n\n${url}`,
  });
}
