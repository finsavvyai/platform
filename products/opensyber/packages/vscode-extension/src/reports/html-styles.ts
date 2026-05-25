export function buildReportStyles(scoreColor: string): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#09090b;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    .container{max-width:960px;margin:0 auto;padding:40px 24px}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:16px}
    .logo{font-size:22px;font-weight:700;color:#3b82f6}
    .logo span{color:#6b7280;font-weight:400;font-size:14px;margin-left:8px}
    .generated{font-size:12px;color:#525252}
    .score-card{background:#111;border:1px solid #1c1c1c;border-radius:16px;padding:32px;margin-bottom:32px;display:flex;align-items:center;gap:32px;flex-wrap:wrap}
    .score-ring{width:100px;height:100px;border-radius:50%;border:6px solid ${scoreColor};display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .score-num{font-size:32px;font-weight:800;color:${scoreColor}}
    .score-label{font-size:12px;color:#6b7280;margin-top:2px;text-align:center}
    .score-body h2{font-size:20px;font-weight:700;margin-bottom:8px}
    .score-body p{font-size:14px;color:#a3a3a3;max-width:480px}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:32px}
    .stat-card{background:#111;border:1px solid #1c1c1c;border-radius:12px;padding:20px}
    .stat-val{font-size:32px;font-weight:800}
    .stat-label{font-size:12px;color:#6b7280;margin-top:4px}
    .section{background:#111;border:1px solid #1c1c1c;border-radius:12px;padding:24px;margin-bottom:24px}
    .section h3{font-size:14px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px}
    .agent-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1a1a1a}
    .agent-row:last-child{border-bottom:none}
    .agent-name{font-size:14px;font-weight:600}
    .agent-stats{display:flex;gap:16px}
    .agent-stat{font-size:12px;color:#6b7280}
    .agent-stat b{color:#e5e5e5}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font-size:11px;font-weight:600;color:#525252;text-transform:uppercase;letter-spacing:.06em;padding:8px 12px;border-bottom:1px solid #1c1c1c}
    td{padding:8px 12px;border-bottom:1px solid #141414;vertical-align:top}
    tr:hover td{background:#0f0f0f}
    .share-block{background:#111;border:1px solid #1c1c1c;border-radius:12px;padding:24px;margin-bottom:24px}
    .share-block h3{font-size:14px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px}
    .share-card-img{width:100%;border-radius:8px;border:1px solid #1c1c1c;display:block;margin-bottom:16px}
    .share-steps{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .step{background:#0a0a0a;border:1px solid #1c1c2e;border-radius:8px;padding:12px 16px;flex:1;min-width:160px}
    .step-num{font-size:11px;color:#3b82f6;font-weight:700;margin-bottom:4px}
    .step-desc{font-size:12px;color:#a3a3a3}
    .share-text-box{background:#0a0a0a;border:1px solid #1c1c2e;border-radius:8px;padding:14px;font-size:13px;color:#d4d4d4;line-height:1.7;white-space:pre-line;margin-bottom:12px;font-family:inherit}
    .share-actions{display:flex;gap:10px;flex-wrap:wrap}
    .btn{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;border:none;display:inline-block;transition:opacity .15s}
    .btn:hover{opacity:.85}
    .btn-copy{background:#1e3a8a;color:#fff}
    .btn-copy.copied{background:#166534;color:#fff}
    .btn-download{background:#1c1c2e;color:#93c5fd;border:1px solid #2d3282}
    .btn-linkedin{background:#0a66c2;color:#fff}
    .btn-twitter{background:#000;color:#fff;border:1px solid #333}
    .btn-facebook{background:#1877f2;color:#fff}
    .btn-reddit{background:#ff4500;color:#fff}
    .platform-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px}
    .btn-share-now{font-size:15px;padding:12px 28px;letter-spacing:.01em}
    .cta-block{background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%);border-radius:16px;padding:32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
    .cta-text h3{font-size:18px;font-weight:700;margin-bottom:6px}
    .cta-text p{font-size:13px;color:#93c5fd}
    .cta-actions{display:flex;gap:12px;flex-wrap:wrap}
    .btn-white{background:#fff;color:#1e3a8a}
    .btn-outline{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3)}
    .footer{text-align:center;font-size:11px;color:#2e2e2e;padding:24px 0}
  `;
}
