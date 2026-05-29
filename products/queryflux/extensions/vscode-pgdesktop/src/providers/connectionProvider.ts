import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext, DatabaseConnection } from '../ultimateExtension';

class ConnectionItem extends vscode.TreeItem {
    constructor(public readonly connection: DatabaseConnection, private extensionPath: string) {
        const displayName = connection.status === 'connected' ? `⭐ ${connection.name}` : connection.name;
        super(displayName, vscode.TreeItemCollapsibleState.None);

        // Apple-inspired clean description with status indicators
        const statusEmoji = this.getStatusEmoji(connection.status);
        const typeEmoji = this.getDatabaseTypeEmoji(connection.type);
        const activeIndicator = connection.status === 'connected' ? ' 🟢 ACTIVE' : '';

        this.description = `${statusEmoji} ${typeEmoji} ${connection.host}:${connection.port}${activeIndicator}`;
        this.contextValue = 'dbConnection';

        // Rich tooltip with connection details
        this.tooltip = new vscode.MarkdownString(this.createTooltipContent(connection));

        // Custom themed icons based on status and database type
        this.iconPath = this.getCustomIcon(connection);

        // Add visual emphasis for connected state
        if (connection.status === 'connected') {
            this.resourceUri = vscode.Uri.parse(`ultimatedb://connected/${connection.id}`);
        }
    }

    private getStatusEmoji(status?: string): string {
        switch (status) {
            case 'connected': return '🟢';
            case 'testing': return '🟡';
            case 'error': return '🔴';
            default: return '⚪';
        }
    }

    private getDatabaseTypeEmoji(type: string): string {
        switch (type) {
            case 'PostgreSQL': return '🐘';
            case 'MongoDB': return '🍃';
            case 'Redis': return '🔴';
            case 'Oracle': return '🏛️';
            case 'Elasticsearch': return '🔍';
            case 'Cassandra': return '📊';
            default: return '💾';
        }
    }

    private createTooltipContent(connection: DatabaseConnection): string {
        const statusText = connection.status === 'connected' ? '✅ Connected' :
                          connection.status === 'testing' ? '⏳ Testing...' :
                          connection.status === 'error' ? '❌ Error' : '⚫ Disconnected';

        return `### ${connection.name}

**Status:** ${statusText}
**Type:** ${connection.type}
**Host:** ${connection.host}:${connection.port}
**Database:** ${connection.database || 'Default'}
**User:** ${connection.username || 'Not specified'}
**SSL:** ${connection.ssl ? '🔒 Enabled' : '🔓 Disabled'}

${connection.lastUsed ? `*Last used: ${new Date(connection.lastUsed).toLocaleString()}*` : ''}`;
    }

    private getCustomIcon(connection: DatabaseConnection): vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri } {
        const iconName = this.getIconName(connection);
        const iconPath = path.join(this.extensionPath, 'resources', 'icons');

        // Try to use custom icons if they exist, otherwise fall back to theme icons
        try {
            const lightPath = path.join(iconPath, 'light', `${iconName}.svg`);
            const darkPath = path.join(iconPath, 'dark', `${iconName}.svg`);

            return {
                light: vscode.Uri.file(lightPath),
                dark: vscode.Uri.file(darkPath)
            };
        } catch {
            // Fallback to VS Code theme icons with modern styling
            return new vscode.ThemeIcon(this.getThemeIconName(connection), this.getIconColor(connection));
        }
    }

    private getIconName(connection: DatabaseConnection): string {
        const typeIcon = connection.type.toLowerCase();
        const statusSuffix = connection.status === 'connected' ? '-connected' :
                           connection.status === 'testing' ? '-testing' :
                           connection.status === 'error' ? '-error' : '';
        return `${typeIcon}${statusSuffix}`;
    }

    private getThemeIconName(connection: DatabaseConnection): string {
        if (connection.status === 'connected') {return 'database';}
        if (connection.status === 'testing') {return 'sync~spin';}
        if (connection.status === 'error') {return 'error';}

        switch (connection.type) {
            case 'PostgreSQL': return 'database';
            case 'MongoDB': return 'json';
            case 'Redis': return 'symbol-key';
            case 'Oracle': return 'library';
            default: return 'database';
        }
    }

    private getIconColor(connection: DatabaseConnection): vscode.ThemeColor {
        switch (connection.status) {
            case 'connected': return new vscode.ThemeColor('charts.green');
            case 'testing': return new vscode.ThemeColor('charts.yellow');
            case 'error': return new vscode.ThemeColor('charts.red');
            default: return new vscode.ThemeColor('icon.foreground');
        }
    }
}

class ConnectionGroupItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly connections: DatabaseConnection[],
        private extensionPath: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'connectionGroup';
        this.description = `${connections.length} connection${connections.length !== 1 ? 's' : ''}`;

        const connectedCount = connections.filter(c => c.status === 'connected').length;
        if (connectedCount > 0) {
            this.description += ` • ${connectedCount} active`;
            this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('charts.green'));
        } else {
            this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('icon.foreground'));
        }

        this.tooltip = new vscode.MarkdownString(`### ${label}\n\n**Total:** ${connections.length} connections\n**Active:** ${connectedCount} connected`);
    }
}

export class UltimateDBConnectionProvider implements vscode.TreeDataProvider<ConnectionItem | ConnectionGroupItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionItem | ConnectionGroupItem | undefined | null | void> =
        new vscode.EventEmitter<ConnectionItem | ConnectionGroupItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionItem | ConnectionGroupItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private ext: ExtensionContext) {}

    refresh(): void { this._onDidChangeTreeData.fire(null); }

    getTreeItem(element: ConnectionItem | ConnectionGroupItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConnectionItem | ConnectionGroupItem): Promise<(ConnectionItem | ConnectionGroupItem)[]> {
        if (!element) {
            // Root level - show grouped connections Apple-style
            const allConnections = this.ext.connectionManager.getAllConnections();

            if (allConnections.length === 0) {
                return [];
            }

            // Group by connection status for Apple-inspired organization
            const connected = allConnections.filter(c => c.status === 'connected');
            const disconnected = allConnections.filter(c => c.status !== 'connected');

            const groups: ConnectionGroupItem[] = [];

            if (connected.length > 0) {
                groups.push(new ConnectionGroupItem('🟢 Active Connections', connected, this.ext.extensionPath));
            }

            if (disconnected.length > 0) {
                groups.push(new ConnectionGroupItem('⚪ Available Connections', disconnected, this.ext.extensionPath));
            }

            // If only a few connections, show them directly without grouping
            if (allConnections.length <= 3) {
                return allConnections
                    .sort((a, b) => {
                        // Connected connections first
                        if (a.status === 'connected' && b.status !== 'connected') {return -1;}
                        if (b.status === 'connected' && a.status !== 'connected') {return 1;}
                        return a.name.localeCompare(b.name);
                    })
                    .map(c => new ConnectionItem(c, this.ext.extensionPath));
            }

            return groups;
        } else if (element instanceof ConnectionGroupItem) {
            // Show connections in the group
            return element.connections
                .sort((a, b) => {
                    // Sort by status first (connected, testing, error, disconnected), then by name
                    const statusOrder = { 'connected': 0, 'testing': 1, 'error': 2, 'disconnected': 3 };
                    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 4;
                    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 4;

                    if (aOrder !== bOrder) {return aOrder - bOrder;}
                    return a.name.localeCompare(b.name);
                })
                .map(c => new ConnectionItem(c, this.ext.extensionPath));
        }

        return [];
    }
}
