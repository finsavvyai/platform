import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';
import { Logger } from '../utils/Logger';

const log = Logger.createLogger('StatusBarManager');

export class StatusBarManager extends Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private vulnerabilityBarItem: vscode.StatusBarItem;
    private connectionBarItem: vscode.StatusBarItem;

    public async initialize(): Promise<void> {
        // Main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.text = '$(package) UPM';
        this.statusBarItem.tooltip = 'Universal Dependency Platform';
        this.statusBarItem.command = 'upm.showDependencyTree';
        this.addDisposable(this.statusBarItem);

        // Vulnerability status item
        this.vulnerabilityBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            99
        );
        this.vulnerabilityBarItem.text = '$(shield) No vulnerabilities';
        this.vulnerabilityBarItem.tooltip = 'Security vulnerabilities';
        this.vulnerabilityBarItem.command = 'upm.checkVulnerabilities';
        this.addDisposable(this.vulnerabilityBarItem);

        // Connection status item
        this.connectionBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            98
        );
        this.connectionBarItem.text = '$(plug) Connected';
        this.connectionBarItem.tooltip = 'UPM Server connection status';
        this.addDisposable(this.connectionBarItem);

        this.statusBarItem.show();
        this.vulnerabilityBarItem.show();
        this.connectionBarItem.show();

        log.info('StatusBarManager initialized');
    }

    public updateVulnerabilityCount(count: number, criticalCount: number = 0): void {
        if (count === 0) {
            this.vulnerabilityBarItem.text = '$(shield) No vulnerabilities';
            this.vulnerabilityBarItem.color = undefined;
        } else {
            this.vulnerabilityBarItem.text = `$(shield) ${count} vulnerability${count > 1 ? 's' : ''}`;
            if (criticalCount > 0) {
                this.vulnerabilityBarItem.color = new vscode.ThemeColor('errorForeground');
                this.vulnerabilityBarItem.text += ` (${criticalCount} critical)`;
            } else {
                this.vulnerabilityBarItem.color = new vscode.ThemeColor('warningForeground');
            }
        }
    }

    public updateConnectionStatus(connected: boolean): void {
        if (connected) {
            this.connectionBarItem.text = '$(plug) Connected';
            this.connectionBarItem.color = undefined;
        } else {
            this.connectionBarItem.text = '$(plug-disconnected) Disconnected';
            this.connectionBarItem.color = new vscode.ThemeColor('errorForeground');
        }
    }

    public updateAnalysisStatus(analyzing: boolean): void {
        if (analyzing) {
            this.statusBarItem.text = '$(sync~spin) UPM Analyzing...';
        } else {
            this.statusBarItem.text = '$(package) UPM';
        }
    }

    public async dispose(): Promise<void> {
        log.info('Disposing StatusBarManager...');
        await super.dispose();
    }
}
