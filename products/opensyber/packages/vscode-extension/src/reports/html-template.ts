import type { ActivityEvent, ActivitySummary } from '../logger/activity-logger'
import { escapeHtml, scoreToLabel } from './html-helpers'
import { buildReportStyles } from './html-styles'

export interface PageParams {
  generatedAt: string
  score: number
  scoreColor: string
  summary: ActivitySummary
  timelineRows: string
  agentBreakdown: string
  shareText: string
  liUrl: string
  twitterUrl: string
  fbUrl: string
  redditUrl: string
  svgDataUrl: string
  events: ActivityEvent[]
}

// eslint-disable-next-line max-lines-per-function
export function buildHtmlPage(p: PageParams): string {
  const { generatedAt, score, scoreColor, summary, timelineRows, agentBreakdown,
          shareText, liUrl, twitterUrl, fbUrl, redditUrl, svgDataUrl, events } = p
  const styles = buildReportStyles(scoreColor)
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OpenAgent Security Report</title>
  <style>${styles}</style>
</head>
<body>
<div class="container">

  <div class="header">
    <div class="logo">⬡ OpenAgent <span>Security Report</span></div>
    <div class="generated">Generated ${generatedAt}</div>
  </div>

  <div class="score-card">
    <div class="score-ring">
      <div>
        <div class="score-num">${score}</div>
        <div class="score-label">/ 100</div>
      </div>
    </div>
    <div class="score-body">
      <h2>Risk Score: ${scoreToLabel(score)}</h2>
      <p>${summary.critical > 0
        ? `Your AI agent accessed ${summary.critical} critical resource${summary.critical > 1 ? 's' : ''} (secrets, credentials, SSH keys).${summary.secretsDetected > 0 ? ` ${summary.secretsDetected} secret pattern${summary.secretsDetected > 1 ? 's' : ''} detected.` : ''}`
        : summary.high > 0
          ? `Your AI agent executed ${summary.high} high-risk operation${summary.high > 1 ? 's' : ''} (sudo, SSH, IAM commands).`
          : 'No critical or high risk events detected in this session. Good baseline.'
      }</p>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="stat-val" style="color:#ef4444">${summary.critical}</div><div class="stat-label">Critical events</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#f97316">${summary.high}</div><div class="stat-label">High risk events</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#eab308">${summary.medium}</div><div class="stat-label">Medium events</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#ef4444">${summary.secretsDetected}</div><div class="stat-label">Secrets detected</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#3b82f6">${summary.total}</div><div class="stat-label">Total events</div></div>
  </div>

  <div class="section">
    <h3>Active Agents</h3>
    ${agentBreakdown}
  </div>

  ${summary.critical + summary.high + summary.secretsDetected > 0 ? `
  <div class="share-block">
    <h3>Share your audit</h3>
    <img class="share-card-img" src="${svgDataUrl}" alt="Security Scorecard" id="scorecard-img"/>
    <div id="share-text" style="display:none">${escapeHtml(shareText)}</div>
    <div class="platform-grid">
      <button class="btn btn-linkedin" id="li-btn" onclick="shareWithCopy('${escapeHtml(liUrl)}','li-btn')">LinkedIn</button>
      <button class="btn btn-twitter" onclick="shareTwitter('${escapeHtml(twitterUrl)}')">X / Twitter</button>
      <button class="btn btn-facebook" onclick="window.open('${escapeHtml(fbUrl)}','_blank')">Facebook</button>
      <button class="btn btn-reddit" onclick="shareWithCopy('${escapeHtml(redditUrl)}','reddit-btn')" id="reddit-btn">Reddit</button>
    </div>
    <button class="btn btn-download" onclick="downloadCard()" style="font-size:12px;background:#1c1c2e;color:#93c5fd;border:1px solid #2d3282">⬇ Save scorecard image</button>
    <div id="toast" style="display:none;margin-top:14px;background:#166534;border:1px solid #166534;border-radius:8px;padding:12px 16px;font-size:13px;color:#bbf7d0;line-height:1.5">
      ✓ <strong>Text copied &amp; image saved.</strong> Paste the text in the post, then attach the image from Downloads.
    </div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-text">
      <h3>Get team-wide visibility</h3>
      <p>See every agent across your entire team. Set policies. Get Slack alerts. Export for compliance.</p>
    </div>
    <div class="cta-actions">
      <a class="btn btn-white" href="https://opensyber.cloud?ref=report" target="_blank">Start Free Trial</a>
      <a class="btn btn-outline" href="https://opensyber.cloud/demo?ref=report" target="_blank">Book Demo</a>
    </div>
  </div>

  <div class="section">
    <h3>Activity Timeline (last ${Math.min(events.length, 200)} events)</h3>
    ${events.length > 0 ? `
    <table>
      <thead><tr><th>Risk</th><th>Type</th><th>Event</th><th>Agent</th><th>Time</th></tr></thead>
      <tbody>${timelineRows}</tbody>
    </table>` : '<p style="color:#525252;font-size:13px;padding:8px 0">No events recorded yet.</p>'}
  </div>

  <div class="footer">Generated by OpenAgent · opensyber.cloud · Data stored locally in ~/.opensyber/activity.jsonl</div>

</div>
<script>
async function shareWithCopy(url, btnId) {
  const btn   = document.getElementById(btnId)
  const toast = document.getElementById('toast')
  downloadCard()
  const text = document.getElementById('share-text').innerText
  try { await navigator.clipboard.writeText(text) } catch (_) {}
  setTimeout(() => window.open(url, '_blank'), 300)
  toast.style.display = 'block'
  if (btn) { btn.disabled = true; const orig = btn.innerHTML; btn.innerHTML = '✓ Done! Paste in post'; setTimeout(() => { btn.disabled = false; btn.innerHTML = orig }, 3000) }
}
function shareTwitter(url) {
  downloadCard()
  setTimeout(() => window.open(url, '_blank'), 150)
}
function downloadCard() {
  const img = document.getElementById('scorecard-img')
  const a   = document.createElement('a')
  a.href     = img.src
  a.download = 'openagent-security-report.svg'
  a.click()
}
</script>
</body>
</html>`
}
