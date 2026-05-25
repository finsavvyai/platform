import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import { AgentWebviewPanel } from './webview';

export class AgentRunner {
    private extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    public async runAgent(agentName: string, filePath?: string) {
        // Create or show the webview panel
        AgentWebviewPanel.createOrShow(this.extensionUri, `LunaOS: ${agentName}`);
        AgentWebviewPanel.clearContent();

        // 1. Loading state UI
        AgentWebviewPanel.appendContent(`<div class="header">
            <div class="spinner"></div>
            <h2>Running ${agentName}...</h2>
        </div>\n\n`);

        if (filePath) {
            AgentWebviewPanel.appendContent(`> **Context File:** \`${filePath}\`\n\n`);
        }

        AgentWebviewPanel.appendContent(`---\n\n`);

        // Check if luna CLI is installed
        try {
            await this.checkCliInstalled();
        } catch (error) {
            AgentWebviewPanel.appendContent(`\n\n<div class="error-msg">❌ Error: LunaOS CLI is not installed or not in PATH.</div>\n\nRun \`npm i -g @luna-agents/cli\` to install it.`);
            vscode.window.showErrorMessage('LunaOS CLI is not installed or not in PATH.');
            return;
        }

        const config = vscode.workspace.getConfiguration('lunaos');
        const cliPath = config.get<string>('cliPath', 'luna');
        const provider = config.get<string>('defaultProvider', '');
        const model = config.get<string>('defaultModel', '');

        const args = ['run', agentName];
        if (filePath) {
            args.push('--files', filePath);
            const fileName = path.basename(filePath);
            AgentWebviewPanel.appendContent(`> **Context:** \`${fileName}\`\n\n`);
        }
        if (provider) args.push('--provider', provider);
        if (model) args.push('--model', model);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : process.cwd();

        const child = spawn(cliPath, args, {
            cwd,
            shell: process.platform === 'win32',
            env: process.env,
        });

        // Ensure we strip ANSI color codes from terminal output before sending to Webview Markdown parsing
        const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

        child.stdout.on('data', (data) => {
            const cleanStr = stripAnsi(data.toString());
            AgentWebviewPanel.appendContent(cleanStr);
        });

        child.stderr.on('data', (data) => {
            // Some tools output progress to stderr, keep it clean
            const cleanStr = stripAnsi(data.toString());
            // Optionally, we could format stderr differently, but we'll append for now
            AgentWebviewPanel.appendContent(cleanStr);
        });

        child.on('error', (error) => {
            AgentWebviewPanel.appendContent(`\n\n<div class="error-msg">❌ Execution error: ${error.message}</div>`);
            vscode.window.showErrorMessage(`Failed to run agent: ${error.message}`);
        });

        child.on('close', (code) => {
            // Replace the spinner with a success or failure indicator
            AgentWebviewPanel.appendContent(`\n\n---`);
            if (code === 0) {
                AgentWebviewPanel.appendContent(`\n\n<div class="success-msg">✅ Agent execution completed successfully.</div>`);
                vscode.window.showInformationMessage(`LunaOS: ${agentName} run completed.`);
            } else {
                AgentWebviewPanel.appendContent(`\n\n<div class="error-msg">❌ Agent execution failed with code ${code}.</div>`);
                vscode.window.showErrorMessage(`LunaOS: ${agentName} run failed.`);
            }
        });
    }

    private checkCliInstalled(): Promise<void> {
        const cliPath = vscode.workspace.getConfiguration('lunaos').get<string>('cliPath', 'luna');
        return new Promise((resolve, reject) => {
            const check = spawn(cliPath, ['--version'], {
                shell: process.platform === 'win32',
                env: process.env,
            });

            check.on('error', (err) => {
                reject(err);
            });

            check.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Exit code ${code}`));
            });
        });
    }
}
