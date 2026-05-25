/**
 * Command: ClawPipe: Check Booster
 *
 * Select text, check if the Booster can resolve it without an LLM call.
 */

import * as vscode from 'vscode';
import type { PipelineContext } from './context.js';

export function registerCheckBoosterCommand(ctx: PipelineContext): vscode.Disposable {
  return vscode.commands.registerCommand('clawpipe.checkBooster', async () => {
    const text = getSelectedText();
    if (!text) {
      vscode.window.showWarningMessage('Select text to check with Booster.');
      return;
    }

    const result = ctx.booster.tryResolve(text);
    const resolvable = result !== null;

    if (resolvable) {
      const action = await vscode.window.showInformationMessage(
        `Booster can resolve this! Result: ${truncate(result, 100)}`,
        'Copy Result',
      );
      if (action === 'Copy Result') {
        await vscode.env.clipboard.writeText(result);
        vscode.window.showInformationMessage('Result copied to clipboard.');
      }
    } else {
      vscode.window.showInformationMessage(
        `Booster cannot resolve this prompt. An LLM call is needed. (${ctx.booster.ruleCount} rules checked)`,
      );
    }
  });
}

function getSelectedText(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  const selection = editor.selection;
  if (selection.isEmpty) return null;
  return editor.document.getText(selection);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
