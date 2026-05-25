/**
 * LunaOS VS Code Extension — entry point
 *
 * Commands:
 *   luna.runAgent       — pick an agent from QuickPick, run it
 *   luna.runCodeReview  — shortcut for code-review agent
 */

import * as vscode from 'vscode';
import { AgentRunner } from './agent-runner';
import { loadAgents } from './agent-loader';

export function activate(context: vscode.ExtensionContext) {
    const runner = new AgentRunner(context.extensionUri);

    // Status bar item
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusItem.text = '$(luna) LunaOS';
    statusItem.tooltip = 'LunaOS Agents — click to run an agent';
    statusItem.command = 'luna.runAgent';
    statusItem.show();
    context.subscriptions.push(statusItem);

    // Run Agent command
    const runAgentCmd = vscode.commands.registerCommand('luna.runAgent', async () => {
        const cliPath = vscode.workspace.getConfiguration('lunaos').get<string>('cliPath', 'luna');
        const agents = await loadAgents(cliPath);
        const items = agents.map(a => ({
            label: a.name,
            description: a.description,
            detail: a.category,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an AI agent to run',
            title: 'LunaOS: Run Agent',
            matchOnDescription: true,
        });

        if (selected) {
            const editor = vscode.window.activeTextEditor;
            runner.runAgent(selected.label, editor?.document.fileName);
        }
    });

    // Code Review shortcut
    const codeReviewCmd = vscode.commands.registerCommand('luna.runCodeReview', () => {
        const editor = vscode.window.activeTextEditor;
        runner.runAgent('code-review', editor?.document.fileName);
    });

    context.subscriptions.push(runAgentCmd, codeReviewCmd);
}

export function deactivate() { }
