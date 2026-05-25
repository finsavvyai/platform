/**
 * AgentWebviewPanel — singleton webview panel for agent output
 */

import * as vscode from 'vscode';
import { getWebviewHtml } from './webview-template';

export class AgentWebviewPanel {
    public static currentPanel: AgentWebviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentContent: string = "";

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.onDidChangeViewState(
            () => { if (this._panel.visible) this._update(); },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, title: string = "LunaOS Agent") {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (AgentWebviewPanel.currentPanel) {
            AgentWebviewPanel.currentPanel._panel.reveal(column);
            AgentWebviewPanel.currentPanel._panel.title = title;
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'lunaosAgentView',
            title,
            column || vscode.ViewColumn.One,
            { enableScripts: true }
        );

        AgentWebviewPanel.currentPanel = new AgentWebviewPanel(panel, extensionUri);
    }

    public static appendContent(content: string) {
        if (AgentWebviewPanel.currentPanel) {
            AgentWebviewPanel.currentPanel._currentContent += content;
            AgentWebviewPanel.currentPanel._update();
        }
    }

    public static clearContent() {
        if (AgentWebviewPanel.currentPanel) {
            AgentWebviewPanel.currentPanel._currentContent = "";
            AgentWebviewPanel.currentPanel._update();
        }
    }

    public dispose() {
        AgentWebviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }

    private _update() {
        this._panel.webview.html = getWebviewHtml(this._currentContent);
    }
}
