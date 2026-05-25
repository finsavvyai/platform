import * as vscode from 'vscode';
import { LunaSidebarProvider } from './sidebar';
import { createStatusBar, disposeStatusBar } from './status-bar';
import { registerOpenPlayground } from './playground';
import {
  registerRunAgent,
  registerRunPipe,
  registerViewRunLogs,
  registerOpenDashboard,
  registerConfigureApiKey,
  registerAnalyzeSelection,
  registerRefreshSidebar,
} from './commands';

/** Extension entry point */
export function activate(context: vscode.ExtensionContext): void {
  const sidebar = new LunaSidebarProvider();

  // Register sidebar tree view
  vscode.window.registerTreeDataProvider('lunaos-sidebar', sidebar);

  // Register all commands
  registerRunAgent(context, sidebar);
  registerRunPipe(context);
  registerViewRunLogs(context);
  registerOpenDashboard(context);
  registerConfigureApiKey(context);
  registerAnalyzeSelection(context);
  registerRefreshSidebar(context, sidebar);
  registerOpenPlayground(context);

  // Create status bar
  createStatusBar(context);

  // Listen for config changes to restart auto-refresh
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('lunaos')) {
        sidebar.refresh();
      }
    })
  );
}

/** Extension deactivation */
export function deactivate(): void {
  disposeStatusBar();
}
