import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';
import { Logger } from '../utils/Logger';

const log = Logger.createLogger('ConfigurationManager');

export class ConfigurationManager extends Disposable {
    private config: vscode.WorkspaceConfiguration;

    constructor(private context: vscode.ExtensionContext) {
        super();
        this.config = vscode.workspace.getConfiguration('upm');

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('upm')) {
                this.config = vscode.workspace.getConfiguration('upm');
                log.info('Configuration updated');
            }
        });
    }

    public async initialize(): Promise<void> {
        // Perform any initialization tasks
        log.info('ConfigurationManager initialized');
    }

    public get<T>(key: string, defaultValue?: T): T {
        return this.config.get<T>(key, defaultValue!);
    }

    public async update(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
        await this.config.update(key, value, target || vscode.ConfigurationTarget.Global);
        log.info(`Configuration updated: ${key} = ${value}`);
    }

    public getServerUrl(): string {
        return this.get<string>('serverUrl', 'http://localhost:8040');
    }

    public getApiKey(): string | undefined {
        return this.get<string>('apiKey');
    }

    public isAutoAnalysisEnabled(): boolean {
        return this.get<boolean>('autoAnalysis', true);
    }

    public isRealTimeUpdatesEnabled(): boolean {
        return this.get<boolean>('realTimeUpdates', true);
    }

    public isHighlightingEnabled(): boolean {
        return this.get<boolean>('highlighting', true);
    }

    public getNotificationLevel(): string {
        return this.get<string>('notificationLevel', 'warning');
    }

    public getExcludeScopes(): string[] {
        return this.get<string[]>('excludeScopes', ['test', 'dev', 'provided']);
    }

    public getMaxDependencies(): number {
        return this.get<number>('maxDependencies', 1000);
    }

    public async dispose(): Promise<void> {
        log.info('Disposing ConfigurationManager...');
        await super.dispose();
    }
}
