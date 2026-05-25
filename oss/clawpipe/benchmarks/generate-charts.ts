/**
 * generate-charts.ts
 * Reads benchmarks/results/summary.json and writes 4 SVG chart files to
 * benchmarks/results/charts/. No external dependencies — pure SVG strings.
 *
 * Run: cd benchmarks && npx tsx generate-charts.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryEntry {
  category: string;
  count: number;
  boosterHits: number;
  cacheHits: number;
  avgPackerSavings: number;
  avgTotalMs: number;
  totalDirectCost: number;
  totalClawPipeCost: number;
}

interface Summary {
  totalPrompts: number;
  boosterHitRate: number;
  cacheHitRate: number;
  avgPackerSavings: number;
  costSavingsPercent: number;
  totalDirectCostUsd: number;
  totalClawPipeCostUsd: number;
  pipelineOverheadMs: number;
  avgLatency: {
    boosterMs: number;
    packerMs: number;
    cacheMs: number;
    routerMs: number;
    gatewayMs: number;
    totalMs: number;
  };
  categoryBreakdown: CategoryEntry[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const W = 640;
const H = 360;
const FONT = 'system-ui, -apple-system, sans-serif';
const C = {
  primary: '#6366f1',   // indigo / ClawPipe
  grey: '#e5e7eb',      // baseline / Direct API
  green: '#22c55e',     // savings
  blue: '#3b82f6',      // cache
  orange: '#f97316',    // packer / router
  bg: '#0f0f10',
  bgCard: '#1c1c1e',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  border: 'rgba(84,84,88,0.65)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svgOpen(title: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
    `viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">\n` +
    `<title>${title}</title>\n` +
    `<rect width="${W}" height="${H}" fill="${C.bg}" rx="12"/>\n`
  );
}

function svgClose(): string {
  return '</svg>';
}

function text(
  x: number,
  y: number,
  content: string,
  opts: {
    size?: number;
    fill?: string;
    weight?: string;
    anchor?: string;
  } = {}
): string {
  const size = opts.size ?? 13;
  const fill = opts.fill ?? C.text;
  const weight = opts.weight ?? 'normal';
  const anchor = opts.anchor ?? 'start';
  return (
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${content}</text>\n`
  );
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  rx = 4
): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${rx}"/>\n`;
}

// ---------------------------------------------------------------------------
// Chart 1 — Cost comparison bar chart
// ---------------------------------------------------------------------------

export function buildCostChart(d: Summary): string {
  const title = 'Cost Comparison — Direct API vs ClawPipe';
  const padL = 130;
  const padR = 80;
  const padT = 64;
  const padB = 48;
  const barH = 44;
  const gap = 28;
  const trackW = W - padL - padR;

  const direct = d.totalDirectCostUsd;
  const clawpipe = d.totalClawPipeCostUsd;
  const maxVal = direct;

  const directW = trackW;
  const clawW = maxVal > 0 ? Math.round((clawpipe / maxVal) * trackW) : 0;
  const saved = (direct - clawpipe).toFixed(3);

  let svg = svgOpen(title);
  svg += text(W / 2, 36, title, { size: 16, weight: '700', anchor: 'middle' });
  svg += text(W / 2, 54, `${d.totalPrompts} prompts · saved $${saved} (${d.costSavingsPercent}%)`, {
    size: 12, fill: C.green, anchor: 'middle',
  });

  // Direct API bar
  const y1 = padT + 16;
  svg += text(padL - 8, y1 + barH / 2 + 5, 'Direct API', { size: 12, fill: C.textMuted, anchor: 'end' });
  svg += rect(padL, y1, trackW, barH, 'rgba(229,231,235,0.12)');
  svg += rect(padL, y1, directW, barH, C.grey);
  svg += text(padL + directW - 6, y1 + barH / 2 + 5, `$${direct}`, {
    size: 13, weight: '700', fill: C.bg, anchor: 'end',
  });

  // ClawPipe bar
  const y2 = y1 + barH + gap;
  svg += text(padL - 8, y2 + barH / 2 + 5, 'ClawPipe', { size: 12, fill: C.textMuted, anchor: 'end' });
  svg += rect(padL, y2, trackW, barH, 'rgba(229,231,235,0.12)');
  svg += rect(padL, y2, clawW, barH, C.primary);
  svg += text(padL + clawW + 6, y2 + barH / 2 + 5, `$${clawpipe}`, {
    size: 13, weight: '700', fill: C.primary,
  });

  // Savings annotation
  const midX = padL + clawW + (trackW - clawW) / 2;
  const arrowY = y2 - 10;
  svg += `<line x1="${padL + clawW}" y1="${arrowY}" x2="${padL + directW}" y2="${arrowY}" stroke="${C.green}" stroke-width="1.5" stroke-dasharray="4 2"/>\n`;
  svg += text(midX, arrowY - 5, `↑ ${d.costSavingsPercent}% savings`, { size: 11, fill: C.green, anchor: 'middle' });

  // X-axis label
  svg += text(W / 2, H - 14, 'USD cost (400 prompts)', { size: 11, fill: C.textMuted, anchor: 'middle' });

  svg += svgClose();
  return svg;
}

// ---------------------------------------------------------------------------
// Chart 2 — Stage latency bar chart (horizontal)
// ---------------------------------------------------------------------------

export function buildLatencyChart(d: Summary): string {
  const title = 'Pipeline Stage Latency';
  const padL = 90;
  const padR = 110;
  const padT = 56;
  const trackW = W - padL - padR;

  const stages: [string, number, string][] = [
    ['Booster', d.avgLatency.boosterMs, C.primary],
    ['Packer', d.avgLatency.packerMs, C.blue],
    ['Cache', d.avgLatency.cacheMs, C.green],
    ['Router', d.avgLatency.routerMs, C.orange],
  ];

  const maxMs = Math.max(...stages.map(s => s[1]), 0.001);
  const barH = 36;
  const gap = 20;
  const totalH = stages.length * (barH + gap) - gap;
  const startY = padT + (H - padT - 48 - totalH) / 2;

  let svg = svgOpen(title);
  svg += text(W / 2, 36, title, { size: 16, weight: '700', anchor: 'middle' });
  svg += text(W / 2, 52, 'Average milliseconds per stage (pipeline only, excl. gateway)', {
    size: 11, fill: C.textMuted, anchor: 'middle',
  });

  stages.forEach(([label, ms, color], i) => {
    const y = startY + i * (barH + gap);
    const barW = Math.max(Math.round((ms / maxMs) * trackW), 2);

    // Track background
    svg += rect(padL, y, trackW, barH, 'rgba(255,255,255,0.04)');
    // Filled bar
    svg += rect(padL, y, barW, barH, color);
    // Label (left)
    svg += text(padL - 8, y + barH / 2 + 5, label, { size: 12, fill: C.textMuted, anchor: 'end' });
    // Value (right of bar)
    svg += text(padL + barW + 8, y + barH / 2 + 5, `${ms}ms`, { size: 12, weight: '600', fill: color });
  });

  svg += text(W / 2, H - 14, `Total pipeline overhead: ${d.pipelineOverheadMs}ms`, {
    size: 11, fill: C.textMuted, anchor: 'middle',
  });

  svg += svgClose();
  return svg;
}

// ---------------------------------------------------------------------------
// Chart 3 — Booster hit rate donut (pie segments as SVG path arcs)
// ---------------------------------------------------------------------------

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSlice(
  cx: number,
  cy: number,
  r: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
  fill: string
): string {
  const [x1, y1] = polarToXY(cx, cy, r, startDeg);
  const [x2, y2] = polarToXY(cx, cy, r, endDeg);
  const [ix1, iy1] = polarToXY(cx, cy, innerR, endDeg);
  const [ix2, iy2] = polarToXY(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return (
    `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} ` +
    `L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z" ` +
    `fill="${fill}"/>\n`
  );
}

export function buildHitRateChart(d: Summary): string {
  const title = 'Request Resolution — Booster / Cache / API';
  const cx = 200;
  const cy = H / 2 + 16;
  const r = 110;
  const inner = 68;

  const boost = d.boosterHitRate;
  const cache = d.cacheHitRate;
  const api = Math.max(0, 100 - boost - cache);

  const slices: [number, string, string][] = [
    [boost, C.primary, `Booster ${boost}%`],
    [cache, C.blue, `Cache ${cache}%`],
    [api, C.grey, `API ${api.toFixed(1)}%`],
  ];

  let svg = svgOpen(title);
  svg += text(W / 2, 34, title, { size: 16, weight: '700', anchor: 'middle' });

  // Draw slices
  let angle = 0;
  slices.forEach(([pct, color]) => {
    const sweep = (pct / 100) * 360;
    if (sweep > 0) {
      svg += donutSlice(cx, cy, r, inner, angle, angle + sweep, color);
    }
    angle += sweep;
  });

  // Center text
  svg += text(cx, cy - 10, `${d.costSavingsPercent}%`, { size: 22, weight: '800', fill: C.green, anchor: 'middle' });
  svg += text(cx, cy + 12, 'saved', { size: 12, fill: C.textMuted, anchor: 'middle' });

  // Legend (right side)
  const legendX = 356;
  const legendColors = [C.primary, C.blue, C.grey];
  const legendLabels = [
    [`Booster (no AI)`, `${boost}% of requests`],
    [`Cache hit`, `${cache}% of requests`],
    [`API call`, `${api.toFixed(1)}% of requests`],
  ];
  legendLabels.forEach(([label, sub], i) => {
    const ly = cy - 44 + i * 52;
    svg += rect(legendX, ly, 14, 14, legendColors[i], 3);
    svg += text(legendX + 22, ly + 11, label, { size: 13, weight: '600' });
    svg += text(legendX + 22, ly + 26, sub, { size: 11, fill: C.textMuted });
  });

  svg += svgClose();
  return svg;
}

// ---------------------------------------------------------------------------
// Chart 4 — Category breakdown table-chart (cost bars per category)
// ---------------------------------------------------------------------------

export function buildBreakdownChart(d: Summary): string {
  const title = 'Category Breakdown — Cost by Prompt Type';
  const cats = d.categoryBreakdown;
  const padL = 96;
  const padR = 40;
  const padT = 68;
  const barH = 22;
  const rowH = 54;
  const trackW = W - padL - padR - 100;

  const maxCost = Math.max(...cats.map(c => c.totalDirectCost), 0.001);

  let svg = svgOpen(title);
  svg += text(W / 2, 34, title, { size: 16, weight: '700', anchor: 'middle' });

  // Column headers
  svg += text(padL - 8, padT - 8, 'Category', { size: 10, fill: C.textMuted, anchor: 'end' });
  svg += text(padL, padT - 8, 'Cost savings (Direct vs ClawPipe)', { size: 10, fill: C.textMuted });
  svg += text(W - padR - 4, padT - 8, 'Count', { size: 10, fill: C.textMuted, anchor: 'end' });

  cats.forEach((cat, i) => {
    const baseY = padT + i * rowH;

    // Category label
    svg += text(padL - 8, baseY + barH / 2 + 5, cat.category, {
      size: 12, weight: '600', fill: C.text, anchor: 'end',
    });

    // Direct cost bar (grey)
    const dW = maxCost > 0 ? Math.round((cat.totalDirectCost / maxCost) * trackW) : 0;
    const cW = maxCost > 0 ? Math.round((cat.totalClawPipeCost / maxCost) * trackW) : 0;

    // Track
    svg += rect(padL, baseY, trackW, barH, 'rgba(255,255,255,0.04)');

    if (dW > 0) {
      svg += rect(padL, baseY, dW, barH, C.grey, 3);
    }
    if (cW > 0) {
      svg += rect(padL, baseY + barH, cW, barH - 4, C.primary, 3);
    } else if (cat.totalClawPipeCost === 0 && cat.boosterHits > 0) {
      // Boosted — show zero-cost label
      svg += text(padL + 6, baseY + barH + barH - 8, '$0 (boosted)', { size: 10, fill: C.green });
    }

    // Value labels
    if (dW > 0) {
      svg += text(padL + dW + 4, baseY + barH / 2 + 5, `$${cat.totalDirectCost}`, {
        size: 10, fill: C.textMuted,
      });
    } else if (cat.totalDirectCost === 0) {
      svg += text(padL + 4, baseY + barH / 2 + 5, '$0', { size: 10, fill: C.textMuted });
    }

    // Count (far right)
    svg += text(W - padR - 4, baseY + barH / 2 + 5, `${cat.count}`, {
      size: 11, fill: C.textMuted, anchor: 'end',
    });
  });

  // Legend
  const ly = H - 28;
  svg += rect(padL, ly - 10, 12, 12, C.grey, 2);
  svg += text(padL + 16, ly, 'Direct API', { size: 10, fill: C.textMuted });
  svg += rect(padL + 90, ly - 10, 12, 12, C.primary, 2);
  svg += text(padL + 106, ly, 'ClawPipe', { size: 10, fill: C.textMuted });

  svg += svgClose();
  return svg;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const resultsDir = join(__dirname, 'results');
  const chartsDir = join(resultsDir, 'charts');
  mkdirSync(chartsDir, { recursive: true });

  const summary: Summary = JSON.parse(
    readFileSync(join(resultsDir, 'summary.json'), 'utf8')
  );

  const charts: [string, string][] = [
    ['cost.svg', buildCostChart(summary)],
    ['latency.svg', buildLatencyChart(summary)],
    ['hitrate.svg', buildHitRateChart(summary)],
    ['breakdown.svg', buildBreakdownChart(summary)],
  ];

  for (const [filename, svg] of charts) {
    const outPath = join(chartsDir, filename);
    writeFileSync(outPath, svg, 'utf8');
    console.log(`Written: ${outPath}`);
  }

  console.log('Done. 4 SVG charts generated in results/charts/');
}

main();
