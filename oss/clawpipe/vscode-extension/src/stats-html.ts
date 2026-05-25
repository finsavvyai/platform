/**
 * HTML builder for the stats webview panel.
 */

import type { PipelineContext } from './context.js';

export function buildStatsHtml(ctx: PipelineContext): string {
  const stats = ctx.telemetry.snapshot();

  const topModelsRows = stats.topModels.length > 0
    ? stats.topModels
        .map(
          (m) =>
            `<tr><td>${esc(m.model)}</td><td>${m.calls}</td><td>$${m.cost.toFixed(6)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3">No requests yet</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClawPipe Stats</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    background: var(--vscode-editor-background); padding: 16px; }
  h1 { font-size: 1.4em; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .card { background: var(--vscode-editorWidget-background); border-radius: 6px;
    padding: 12px; border: 1px solid var(--vscode-editorWidget-border); }
  .card .label { font-size: 0.85em; opacity: 0.7; margin-bottom: 4px; }
  .card .value { font-size: 1.3em; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 10px;
    border-bottom: 1px solid var(--vscode-editorWidget-border); }
  th { opacity: 0.7; font-size: 0.85em; }
</style>
</head>
<body>
<h1>ClawPipe Session Stats</h1>
<div class="grid">
  <div class="card"><div class="label">Total Cost</div>
    <div class="value">$${stats.totalCostUsd.toFixed(4)}</div></div>
  <div class="card"><div class="label">Requests</div>
    <div class="value">${stats.totalRequests}</div></div>
  <div class="card"><div class="label">Cache Hit Rate</div>
    <div class="value">${esc(stats.cacheHitRate)}</div></div>
  <div class="card"><div class="label">Avg Latency</div>
    <div class="value">${stats.avgLatencyMs}ms</div></div>
  <div class="card"><div class="label">Saved by Cache</div>
    <div class="value">${stats.totalSavedByCache}</div></div>
  <div class="card"><div class="label">Saved by Booster</div>
    <div class="value">${stats.totalSavedByBooster}</div></div>
  <div class="card"><div class="label">Tokens In</div>
    <div class="value">${stats.totalTokensIn.toLocaleString()}</div></div>
  <div class="card"><div class="label">Tokens Out</div>
    <div class="value">${stats.totalTokensOut.toLocaleString()}</div></div>
</div>
<h2>Top Models</h2>
<table>
  <thead><tr><th>Model</th><th>Calls</th><th>Cost</th></tr></thead>
  <tbody>${topModelsRows}</tbody>
</table>
</body>
</html>`;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
