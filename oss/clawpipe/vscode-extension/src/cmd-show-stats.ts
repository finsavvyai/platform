/**
 * Command: ClawPipe: Show Stats — webview panel with telemetry.
 */

import * as vscode from 'vscode';
import type { PipelineContext } from './context.js';
import { buildStatsHtml } from './stats-html.js';

let currentPanel: vscode.WebviewPanel | undefined;

export function registerShowStatsCommand(
  ctx: PipelineContext,
  extCtx: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('clawpipe.showStats', () => {
    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.Beside);
      currentPanel.webview.html = buildStatsHtml(ctx);
      return;
    }

    currentPanel = vscode.window.createWebviewPanel(
      'clawpipeStats',
      'ClawPipe Stats',
      vscode.ViewColumn.Beside,
      { enableScripts: false },
    );

    currentPanel.webview.html = buildStatsHtml(ctx);

    const refreshTimer = setInterval(() => {
      if (currentPanel) {
        currentPanel.webview.html = buildStatsHtml(ctx);
      }
    }, 10_000);

    currentPanel.onDidDispose(() => {
      clearInterval(refreshTimer);
      currentPanel = undefined;
    });
  });
}
