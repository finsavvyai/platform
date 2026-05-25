/**
 * ClawPipe VS Code Extension — main entry point.
 *
 * Features:
 * - Status bar showing session cost
 * - Analyze Prompt Cost command
 * - Check Booster command
 * - Show Stats webview panel
 */

import * as vscode from 'vscode';
import { createStatusBar, updateStatusBar } from './status-bar.js';
import { registerAnalyzeCostCommand } from './cmd-analyze-cost.js';
import { registerCheckBoosterCommand } from './cmd-check-booster.js';
import { registerShowStatsCommand } from './cmd-show-stats.js';
import { PipelineContext, createContext } from './context.js';

let ctx: PipelineContext | undefined;

export function activate(extCtx: vscode.ExtensionContext): void {
  ctx = createContext();

  const statusBar = createStatusBar();
  extCtx.subscriptions.push(statusBar);

  const timer = setInterval(() => {
    if (ctx) updateStatusBar(statusBar, ctx);
  }, 5_000);
  extCtx.subscriptions.push({ dispose: () => clearInterval(timer) });

  extCtx.subscriptions.push(registerAnalyzeCostCommand(ctx));
  extCtx.subscriptions.push(registerCheckBoosterCommand(ctx));
  extCtx.subscriptions.push(registerShowStatsCommand(ctx, extCtx));

  updateStatusBar(statusBar, ctx);
}

export function deactivate(): void {
  ctx = undefined;
}
