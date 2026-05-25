import * as vscode from 'vscode';
import {
  createRun,
  executePipe,
  fetchAgents,
  fetchRunLogs,
  hasApiKey,
} from './api-client';
import { refreshStatusBar } from './status-bar';
import type { LunaSidebarProvider } from './sidebar';
import { registerAnalyzeSelection } from './commands-analyze';

export { registerAnalyzeSelection };

let outputChannel: vscode.OutputChannel | undefined;

/** Get or create the shared output channel */
export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('LunaOS');
  }
  return outputChannel;
}

/** Ensure API key is configured before running a command */
export function ensureApiKey(): boolean {
  if (hasApiKey()) return true;
  void vscode.window
    .showWarningMessage('LunaOS API key not configured.', 'Configure Now')
    .then((choice) => {
      if (choice === 'Configure Now') {
        void vscode.commands.executeCommand('lunaos.configureApiKey');
      }
    });
  return false;
}

/** Show an error message from a caught exception */
export function showError(prefix: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  void vscode.window.showErrorMessage(`${prefix}: ${msg}`);
}

/** Register: Run Agent */
export function registerRunAgent(
  context: vscode.ExtensionContext,
  sidebar: LunaSidebarProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'lunaos.runAgent',
      async (agentId?: string) => {
        if (!ensureApiKey()) return;
        await runAgent(agentId, sidebar);
      }
    )
  );
}

/** Run agent logic -- pick agent then execute */
async function runAgent(
  agentId: string | undefined,
  sidebar: LunaSidebarProvider
): Promise<void> {
  if (!agentId) {
    agentId = await pickAgent();
    if (!agentId) return;
  }
  try {
    const run = await createRun(agentId);
    vscode.window.showInformationMessage(`Agent run started: ${run.id}`);
    sidebar.refresh();
    refreshStatusBar();
  } catch (err) {
    showError('Failed to run agent', err);
  }
}

/** Show a quick-pick of available agents */
async function pickAgent(): Promise<string | undefined> {
  try {
    const agents = await fetchAgents();
    const items = agents.map((a) => ({
      label: a.name,
      description: a.description,
      id: a.id,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an agent to run',
    });
    return picked?.id;
  } catch (err) {
    showError('Failed to load agents', err);
    return undefined;
  }
}

/** Register: Run Pipe Expression */
export function registerRunPipe(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lunaos.runPipe', async () => {
      if (!ensureApiKey()) return;
      const expression = await vscode.window.showInputBox({
        prompt: 'Enter a Luna pipe expression',
        placeHolder: 'req >> des >> plan >> go',
      });
      if (!expression) return;
      try {
        const result = await executePipe(expression);
        const ch = getOutputChannel();
        ch.appendLine(`--- Pipe Result (${result.durationMs}ms) ---`);
        ch.appendLine(result.output);
        ch.show();
      } catch (err) {
        showError('Pipe execution failed', err);
      }
    })
  );
}

/** Register: View Run Logs */
export function registerViewRunLogs(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'lunaos.viewRunLogs',
      async (runId?: string) => {
        if (!ensureApiKey()) return;
        if (!runId) {
          runId = await vscode.window.showInputBox({ prompt: 'Enter a Run ID' });
        }
        if (!runId) return;
        try {
          const logs = await fetchRunLogs(runId);
          const ch = getOutputChannel();
          ch.appendLine(`--- Logs for run ${runId} ---`);
          for (const log of logs) {
            ch.appendLine(
              `[${log.level.toUpperCase()}] ${log.timestamp} ${log.message}`
            );
          }
          ch.show();
        } catch (err) {
          showError('Failed to load run logs', err);
        }
      }
    )
  );
}

/** Register: Open Dashboard */
export function registerOpenDashboard(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lunaos.openDashboard', () => {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://agents.lunaos.ai')
      );
    })
  );
}

/** Register: Configure API Key */
export function registerConfigureApiKey(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lunaos.configureApiKey', () => {
      void vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'lunaos.apiKey'
      );
    })
  );
}

/** Register: Refresh Sidebar */
export function registerRefreshSidebar(
  context: vscode.ExtensionContext,
  sidebar: LunaSidebarProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lunaos.refreshSidebar', () => {
      sidebar.refresh();
    })
  );
}
