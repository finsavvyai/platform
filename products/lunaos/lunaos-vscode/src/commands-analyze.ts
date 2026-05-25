import * as vscode from 'vscode';
import { analyzeCode, hasApiKey } from './api-client';

let outputChannel: vscode.OutputChannel | undefined;

/** Get or create the shared output channel */
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('LunaOS');
  }
  return outputChannel;
}

/** Register: Analyze Selection (editor context menu) */
export function registerAnalyzeSelection(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'lunaos.analyzeSelection',
      async () => {
        if (!hasApiKey()) {
          void vscode.window
            .showWarningMessage(
              'LunaOS API key not configured.',
              'Configure Now'
            )
            .then((choice) => {
              if (choice === 'Configure Now') {
                void vscode.commands.executeCommand('lunaos.configureApiKey');
              }
            });
          return;
        }
        await analyzeSelectedCode();
      }
    )
  );
}

/** Analyze the current editor selection with an agent */
async function analyzeSelectedCode(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  const text = editor.document.getText(selection);
  if (!text) {
    vscode.window.showWarningMessage('No text selected.');
    return;
  }

  const config = vscode.workspace.getConfiguration('lunaos');
  const defaultAgent = config.get<string>('defaultAgent');

  try {
    const result = await analyzeCode(
      text,
      editor.document.languageId,
      defaultAgent || undefined
    );
    const ch = getOutputChannel();
    ch.appendLine('--- Analysis Result ---');
    ch.appendLine(result.analysis);
    if (result.suggestions.length > 0) {
      ch.appendLine('\nSuggestions:');
      result.suggestions.forEach((s, i) =>
        ch.appendLine(`  ${i + 1}. ${s}`)
      );
    }
    ch.show();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Analysis failed: ${msg}`);
  }
}
