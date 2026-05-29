import * as vscode from 'vscode';
import { ExtensionContext } from '../ultimateExtension';

export class UltimateQueryProvider implements vscode.TreeDataProvider<any> {
    private _onDidChangeTreeData: vscode.EventEmitter<any | undefined | null | void> = new vscode.EventEmitter<any | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<any | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: ExtensionContext) {}

    refresh(): void { this._onDidChangeTreeData.fire(null); }
    getTreeItem(element: any): vscode.TreeItem { return element; }
    getChildren(element?: any): Thenable<any[]> { return Promise.resolve([]); }
}
