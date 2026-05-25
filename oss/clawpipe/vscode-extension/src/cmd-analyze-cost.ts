/**
 * Command: ClawPipe: Analyze Prompt Cost
 *
 * Select text in the editor, run this command to see estimated cost.
 */

import * as vscode from 'vscode';
import type { PipelineContext } from './context.js';

const COST_PER_1K: Record<string, number> = {
  'deepseek:deepseek-chat': 0.00014,
  'openai:gpt-4o-mini': 0.00015,
  'anthropic:claude-3-haiku': 0.00025,
  'openai:gpt-4o': 0.0025,
  'anthropic:claude-sonnet-4': 0.003,
  'anthropic:claude-opus-4': 0.015,
};

export function registerAnalyzeCostCommand(ctx: PipelineContext): vscode.Disposable {
  return vscode.commands.registerCommand('clawpipe.analyzeCost', async () => {
    const text = getSelectedText();
    if (!text) {
      vscode.window.showWarningMessage('Select text to analyze cost.');
      return;
    }

    const packResult = ctx.packer.pack(text);
    const boostable = ctx.booster.tryResolve(text) !== null;

    const estimates = Object.entries(COST_PER_1K)
      .map(([model, rate]) => {
        const cost = (packResult.packedTokens / 1000) * rate;
        return `${model}: $${cost.toFixed(6)}`;
      })
      .join('\n');

    const message = [
      `Tokens: ${packResult.originalTokens} (${packResult.packedTokens} after packing)`,
      `Packing savings: ${packResult.savings}`,
      `Boostable (free): ${boostable}`,
      '',
      'Cost estimates:',
      estimates,
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({
      content: message,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  });
}

function getSelectedText(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  const selection = editor.selection;
  if (selection.isEmpty) return null;
  return editor.document.getText(selection);
}
