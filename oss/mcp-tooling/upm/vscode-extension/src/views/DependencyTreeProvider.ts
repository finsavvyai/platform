import * as vscode from 'vscode';
import { EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Disposable } from '../utils/Disposable';
import { Logger } from '../utils/Logger';
import { UPMService } from '../services/UPMService';
import {
    Dependency,
    Ecosystem,
    VulnerabilitySeverity,
    DependencyScope,
    Project
} from '../types';

const log = Logger.createLogger('DependencyTreeProvider');

export class DependencyItem extends TreeItem {
    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly itemData: Dependency | Ecosystem | Project | any,
        public readonly itemType: 'project' | 'ecosystem' | 'dependency' | 'group'
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.contextValue = this.getContextValue();
        this.iconPath = this.getIconPath();
    }

    private getTooltip(): string {
        switch (this.itemType) {
            case 'project':
                return `Project: ${this.itemData.name} (${this.itemData.ecosystems?.join(', ') || 'Unknown'})`;
            case 'ecosystem':
                return `Ecosystem: ${this.label}`;
            case 'dependency':
                const dep = this.itemData as Dependency;
                let tooltip = `${dep.name}@${dep.version}\n`;
                tooltip += `Ecosystem: ${dep.ecosystem}\n`;
                tooltip += `Scope: ${dep.scope}\n`;
                tooltip += `Type: ${dep.isDirect ? 'Direct' : 'Transitive'}\n`;

                if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
                    tooltip += `\nVulnerabilities: ${dep.vulnerabilities.length}\n`;
                    const critical = dep.vulnerabilities.filter(v => v.severity === VulnerabilitySeverity.CRITICAL).length;
                    const high = dep.vulnerabilities.filter(v => v.severity === VulnerabilitySeverity.HIGH).length;
                    const medium = dep.vulnerabilities.filter(v => v.severity === VulnerabilitySeverity.MEDIUM).length;
                    const low = dep.vulnerabilities.filter(v => v.severity === VulnerabilitySeverity.LOW).length;

                    if (critical > 0) tooltip += `  Critical: ${critical}\n`;
                    if (high > 0) tooltip += `  High: ${high}\n`;
                    if (medium > 0) tooltip += `  Medium: ${medium}\n`;
                    if (low > 0) tooltip += `  Low: ${low}\n`;
                }

                if (dep.description) {
                    tooltip += `\n${dep.description}`;
                }

                return tooltip;
            default:
                return this.label;
        }
    }

    private getDescription(): string | undefined {
        switch (this.itemType) {
            case 'project':
                const project = this.itemData as Project;
                return `${project.dependencyCount} deps, ${project.vulnerabilityCount} vulns`;
            case 'ecosystem':
                return '';
            case 'dependency':
                const dep = this.itemData as Dependency;
                let description = dep.version;

                if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
                    const criticalCount = dep.vulnerabilities.filter(v => v.severity === VulnerabilitySeverity.CRITICAL).length;
                    const highCount = dep.vulnerabilities.filter(v => v.severity === VulnerabilitySeverity.HIGH).length;

                    if (criticalCount > 0) {
                        description += ` 🔴${criticalCount}`;
                    }
                    if (highCount > 0) {
                        description += ` 🟠${highCount}`;
                    }
                }

                if (!dep.isDirect) {
                    description = `⚡ ${description}`;
                }

                return description;
            default:
                return undefined;
        }
    }

    private getContextValue(): string {
        switch (this.itemType) {
            case 'project':
                return 'project';
            case 'ecosystem':
                return 'ecosystem';
            case 'dependency':
                return 'dependency';
            case 'group':
                return 'group';
            default:
                return 'unknown';
        }
    }

    private getIconPath(): vscode.ThemeIcon | vscode.Uri | undefined {
        switch (this.itemType) {
            case 'project':
                return new vscode.ThemeIcon('folder');
            case 'ecosystem':
                return new vscode.ThemeIcon('package');
            case 'dependency':
                const dep = this.itemData as Dependency;

                // Show vulnerability icon if vulnerable
                if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
                    const hasCritical = dep.vulnerabilities.some(v => v.severity === VulnerabilitySeverity.CRITICAL);
                    const hasHigh = dep.vulnerabilities.some(v => v.severity === VulnerabilitySeverity.HIGH);

                    if (hasCritical) {
                        return new vscode.ThemeIcon('warning');
                    } else if (hasHigh) {
                        return new vscode.ThemeIcon('info');
                    }
                }

                // Show different icons based on ecosystem
                switch (dep.ecosystem) {
                    case Ecosystem.MAVEN:
                    case Ecosystem.GRADLE:
                        return new vscode.ThemeIcon('symbol-class');
                    case Ecosystem.NPM:
                    case Ecosystem.YARN:
                    case Ecosystem.PNPM:
                        return new vscode.ThemeIcon('symbol-misc');
                    case Ecosystem.PYPI:
                    case Ecosystem.POETRY:
                        return new vscode.ThemeIcon('symbol-snippet');
                    case Ecosystem.CARGO:
                        return new vscode.ThemeIcon('symbol-ruler');
                    case Ecosystem.GO:
                        return new vscode.ThemeIcon('symbol-struct');
                    case Ecosystem.COMPOSER:
                        return new vscode.ThemeIcon('symbol-variable');
                    case Ecosystem.NUGET:
                        return new vscode.ThemeIcon('symbol-interface');
                    default:
                        return new vscode.ThemeIcon('symbol-library');
                }
            default:
                return undefined;
        }
    }

    public command?: vscode.Command = {
        command: 'upm.showDependencyDetails',
        title: 'Show Details',
        arguments: [this]
    };
}

export class DependencyTreeProvider extends Disposable implements TreeDataProvider<DependencyItem> {
    private _onDidChangeTreeData: EventEmitter<DependencyItem | undefined | null | void> = new EventEmitter<DependencyItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private dependencies: Dependency[] = [];
    private groupedDependencies: Map<string, Dependency[]> = new Map();
    private isLoading = false;

    constructor(private upmService: UPMService) {
        super();
        log.info('DependencyTreeProvider initialized');
    }

    public refresh(): void {
        log.debug('Refreshing dependency tree...');
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: DependencyItem): TreeItem {
        return element;
    }

    public getChildren(element?: DependencyItem): Thenable<DependencyItem[]> {
        if (!element) {
            // Root level - show ecosystems as groups
            return Promise.resolve(this.getRootItems());
        }

        switch (element.itemType) {
            case 'ecosystem':
                return Promise.resolve(this.getDependencyItemsForEcosystem(element.id));
            case 'dependency':
                // Show transitive dependencies if any
                if (element.itemData.children && element.itemData.children.length > 0) {
                    return Promise.resolve(
                        element.itemData.children.map(dep =>
                            new DependencyItem(
                                `${element.id}-${dep.id}`,
                                `${dep.name}@${dep.version}`,
                                TreeItemCollapsibleState.None,
                                dep,
                                'dependency'
                            )
                        )
                    );
                }
                return Promise.resolve([]);
            default:
                return Promise.resolve([]);
        }
    }

    private async getRootItems(): Promise<DependencyItem[]> {
        if (this.isLoading) {
            return [new DependencyItem(
                'loading',
                'Loading dependencies...',
                TreeItemCollapsibleState.None,
                {},
                'group'
            )];
        }

        // Group dependencies by ecosystem
        const ecosystems = new Set<Ecosystem>();
        this.dependencies.forEach(dep => ecosystems.add(dep.ecosystem));

        const items: DependencyItem[] = [];

        // Add ecosystem groups
        for (const ecosystem of ecosystems) {
            const ecosystemDeps = this.dependencies.filter(d => d.ecosystem === ecosystem);
            const directDeps = ecosystemDeps.filter(d => d.isDirect);
            const transitiveDeps = ecosystemDeps.filter(d => !d.isDirect);
            const vulnerableCount = ecosystemDeps.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0).length;

            const label = `${this.getEcosystemDisplayName(ecosystem)} (${directDeps.length} direct, ${transitiveDeps.length} transitive)`;

            items.push(new DependencyItem(
                ecosystem,
                label,
                TreeItemCollapsibleState.Expanded,
                {
                    ecosystem,
                    count: ecosystemDeps.length,
                    vulnerableCount,
                    directCount: directDeps.length,
                    transitiveCount: transitiveDeps.length
                },
                'ecosystem'
            ));
        }

        // If no dependencies found, show empty state
        if (items.length === 0) {
            items.push(new DependencyItem(
                'empty',
                'No dependencies found',
                TreeItemCollapsibleState.None,
                {},
                'group'
            ));
        }

        return items;
    }

    private getDependencyItemsForEcosystem(ecosystem: string): DependencyItem[] {
        const deps = this.dependencies.filter(d => d.ecosystem === ecosystem);

        // Sort dependencies: direct first, then by name
        deps.sort((a, b) => {
            if (a.isDirect !== b.isDirect) {
                return a.isDirect ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return deps.map(dep =>
            new DependencyItem(
                `${ecosystem}-${dep.id}`,
                `${dep.name}`,
                TreeItemCollapsibleState.Collapsed,
                dep,
                'dependency'
            )
        );
    }

    private getEcosystemDisplayName(ecosystem: Ecosystem): string {
        const displayNames: Record<Ecosystem, string> = {
            [Ecosystem.MAVEN]: 'Maven',
            [Ecosystem.GRADLE]: 'Gradle',
            [Ecosystem.SBT]: 'SBT',
            [Ecosystem.NPM]: 'npm',
            [Ecosystem.YARN]: 'Yarn',
            [Ecosystem.PNPM]: 'pnpm',
            [Ecosystem.PYPI]: 'PyPI',
            [Ecosystem.PIPENV]: 'Pipenv',
            [Ecosystem.POETRY]: 'Poetry',
            [Ecosystem.CARGO]: 'Cargo',
            [Ecosystem.COMPOSER]: 'Composer',
            [Ecosystem.NUGET]: 'NuGet',
            [Ecosystem.GO]: 'Go',
            [Ecosystem.RUBY_GEMS]: 'RubyGems',
            [Ecosystem.HEX]: 'Hex',
            [Ecosystem.CLOJARS]: 'Clojars',
            [Ecosystem.CRATES]: 'Crates'
        };

        return displayNames[ecosystem] || ecosystem;
    }

    public setDependencies(dependencies: Dependency[]): void {
        log.info(`Setting ${dependencies.length} dependencies in tree provider`);
        this.dependencies = dependencies;
        this.groupDependencies();
        this.refresh();
    }

    private groupDependencies(): void {
        this.groupedDependencies.clear();

        for (const dep of this.dependencies) {
            const ecosystem = dep.ecosystem;
            if (!this.groupedDependencies.has(ecosystem)) {
                this.groupedDependencies.set(ecosystem, []);
            }
            this.groupedDependencies.get(ecosystem)!.push(dep);
        }
    }

    public getDependencies(): Dependency[] {
        return [...this.dependencies];
    }

    public getDependencyById(id: string): Dependency | undefined {
        return this.dependencies.find(d => d.id === id);
    }

    public getDependenciesByEcosystem(ecosystem: Ecosystem): Dependency[] {
        return this.dependencies.filter(d => d.ecosystem === ecosystem);
    }

    public getVulnerableDependencies(): Dependency[] {
        return this.dependencies.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0);
    }

    public getDirectDependencies(): Dependency[] {
        return this.dependencies.filter(d => d.isDirect);
    }

    public getTransitiveDependencies(): Dependency[] {
        return this.dependencies.filter(d => !d.isDirect);
    }

    public setLoading(loading: boolean): void {
        this.isLoading = loading;
        this.refresh();
    }

    public filterDependencies(filter: {
        ecosystem?: Ecosystem[];
        scope?: DependencyScope[];
        hasVulnerabilities?: boolean;
        severity?: VulnerabilitySeverity[];
        query?: string;
    }): Dependency[] {
        let filtered = [...this.dependencies];

        if (filter.ecosystem && filter.ecosystem.length > 0) {
            filtered = filtered.filter(d => filter.ecosystem!.includes(d.ecosystem));
        }

        if (filter.scope && filter.scope.length > 0) {
            filtered = filtered.filter(d => filter.scope!.includes(d.scope));
        }

        if (filter.hasVulnerabilities) {
            filtered = filtered.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0);
        }

        if (filter.severity && filter.severity.length > 0) {
            filtered = filtered.filter(d =>
                d.vulnerabilities &&
                d.vulnerabilities.some(v => filter.severity!.includes(v.severity))
            );
        }

        if (filter.query) {
            const query = filter.query.toLowerCase();
            filtered = filtered.filter(d =>
                d.name.toLowerCase().includes(query) ||
                d.description?.toLowerCase().includes(query) ||
                d.version.toLowerCase().includes(query)
            );
        }

        return filtered;
    }

    public async dispose(): Promise<void> {
        log.info('Disposing DependencyTreeProvider...');
        this._onDidChangeTreeData.dispose();
        await super.dispose();
    }
}
