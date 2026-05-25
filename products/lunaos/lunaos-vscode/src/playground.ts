import * as vscode from 'vscode';
import * as path from 'path';
import { executePipe, hasApiKey } from './api-client';
import { buildPlaygroundHtml } from './playground-html';

let currentPanel: vscode.WebviewPanel | undefined;

/** Open or focus the playground webview */
export function registerOpenPlayground(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lunaos.openPlayground', () => {
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        return;
      }
      currentPanel = createPanel(context);
    })
  );
}

/** Create the webview panel */
function createPanel(
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'lunaosPlayground',
    'LunaOS Playground',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'webview')),
      ],
    }
  );

  panel.webview.html = buildPlaygroundHtml();
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });

  panel.webview.onDidReceiveMessage(
    (msg: { type: string; expression?: string }) => {
      if (msg.type === 'runPipe' && msg.expression) {
        void handleRunPipe(panel, msg.expression);
      }
    },
    undefined,
    context.subscriptions
  );

  return panel;
}

/** Handle a pipe execution request from the webview */
async function handleRunPipe(
  panel: vscode.WebviewPanel,
  expression: string
): Promise<void> {
  if (!hasApiKey()) {
    void panel.webview.postMessage({
      type: 'result',
      success: false,
      output: 'API key not configured. Use LunaOS: Configure API Key.',
    });
    return;
  }

  void panel.webview.postMessage({ type: 'loading' });

  try {
    const result = await executePipe(expression);
    void panel.webview.postMessage({
      type: 'result',
      success: result.success,
      output: result.output,
      durationMs: result.durationMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void panel.webview.postMessage({
      type: 'result',
      success: false,
      output: `Error: ${msg}`,
    });
  }
}
