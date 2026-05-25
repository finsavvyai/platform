/**
 * Status bar item showing session cost: "ClawPipe: $0.42"
 */

import * as vscode from 'vscode';
import type { PipelineContext } from './context.js';

export function createStatusBar(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  item.command = 'clawpipe.showStats';
  item.tooltip = 'Click to view ClawPipe session stats';
  item.text = 'ClawPipe: $0.00';
  item.show();
  return item;
}

export function updateStatusBar(
  item: vscode.StatusBarItem,
  ctx: PipelineContext,
): void {
  const stats = ctx.telemetry.snapshot();
  const cost = stats.totalCostUsd.toFixed(2);
  const requests = stats.totalRequests;
  item.text = `ClawPipe: $${cost}`;
  item.tooltip = [
    `Session cost: $${cost}`,
    `Requests: ${requests}`,
    `Cache hit rate: ${stats.cacheHitRate}`,
    `Boosted: ${stats.totalSavedByBooster}`,
    'Click to view full stats',
  ].join('\n');
}
