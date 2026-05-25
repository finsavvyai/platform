import * as vscode from 'vscode';
import { fetchRecentRuns } from './api-client';

let statusItem: vscode.StatusBarItem | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

/** Create and show the status bar item */
export function createStatusBar(context: vscode.ExtensionContext): void {
  statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );
  statusItem.command = 'lunaos-sidebar.focus';
  statusItem.tooltip = 'Click to open LunaOS sidebar';
  updateStatusBar(0);
  statusItem.show();
  context.subscriptions.push(statusItem);

  startAutoRefresh();
}

/** Update displayed text */
function updateStatusBar(runningCount: number): void {
  if (!statusItem) return;
  if (runningCount > 0) {
    statusItem.text = `$(zap) LunaOS: ${runningCount} running`;
  } else {
    statusItem.text = '$(circle-outline) LunaOS: idle';
  }
}

/** Poll the API for running count */
async function pollRunningCount(): Promise<void> {
  try {
    const runs = await fetchRecentRuns(50);
    const running = runs.filter((r) => r.status === 'running').length;
    updateStatusBar(running);
  } catch {
    updateStatusBar(0);
  }
}

/** Start periodic refresh if autoRefresh is enabled */
function startAutoRefresh(): void {
  stopAutoRefresh();
  const config = vscode.workspace.getConfiguration('lunaos');
  const enabled = config.get<boolean>('autoRefresh', true);
  if (enabled) {
    refreshTimer = setInterval(() => void pollRunningCount(), 15_000);
  }
}

/** Stop the refresh timer */
function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

/** Trigger a manual refresh of the status bar */
export function refreshStatusBar(): void {
  void pollRunningCount();
}

/** Dispose resources */
export function disposeStatusBar(): void {
  stopAutoRefresh();
}
