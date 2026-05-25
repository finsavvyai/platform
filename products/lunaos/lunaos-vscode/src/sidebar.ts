import * as vscode from 'vscode';
import { fetchAgents, fetchRecentRuns } from './api-client';
import type { Agent, QuickAction, Run } from './types';

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Run Agent', command: 'lunaos.runAgent', icon: 'play' },
  { label: 'Browse Docs', command: 'lunaos.openDashboard', icon: 'book' },
  { label: 'Open Dashboard', command: 'lunaos.openDashboard', icon: 'dashboard' },
];

/** Tree item wrapping agents, runs, or quick actions */
class LunaTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsible: vscode.TreeItemCollapsibleState,
    public readonly section?: string,
    public readonly meta?: Agent | Run | QuickAction
  ) {
    super(label, collapsible);
  }
}

/** TreeDataProvider powering the LunaOS sidebar */
export class LunaSidebarProvider
  implements vscode.TreeDataProvider<LunaTreeItem>
{
  private readonly emitter = new vscode.EventEmitter<
    LunaTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this.emitter.event;

  private agents: Agent[] = [];
  private runs: Run[] = [];

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(element: LunaTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: LunaTreeItem
  ): Promise<LunaTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return this.getSectionChildren(element);
  }

  /** Top-level sections */
  private getRootItems(): LunaTreeItem[] {
    return [
      new LunaTreeItem(
        'Agents',
        vscode.TreeItemCollapsibleState.Expanded,
        'agents'
      ),
      new LunaTreeItem(
        'Recent Runs',
        vscode.TreeItemCollapsibleState.Expanded,
        'recentRuns'
      ),
      new LunaTreeItem(
        'Quick Actions',
        vscode.TreeItemCollapsibleState.Expanded,
        'quickActions'
      ),
    ];
  }

  /** Children for each section */
  private async getSectionChildren(
    parent: LunaTreeItem
  ): Promise<LunaTreeItem[]> {
    switch (parent.section) {
      case 'agents':
        return this.getAgentItems();
      case 'recentRuns':
        return this.getRunItems();
      case 'quickActions':
        return this.getQuickActionItems();
      default:
        return [];
    }
  }

  /** Fetch and render agent items */
  private async getAgentItems(): Promise<LunaTreeItem[]> {
    try {
      this.agents = await fetchAgents();
    } catch {
      this.agents = [];
    }
    if (this.agents.length === 0) {
      return [
        new LunaTreeItem(
          'No agents found',
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }
    return this.agents.map((a) => {
      const item = new LunaTreeItem(
        a.name,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        a
      );
      item.description = a.status;
      item.tooltip = a.description;
      item.iconPath = new vscode.ThemeIcon(
        a.status === 'active' ? 'circle-filled' : 'circle-outline'
      );
      item.command = {
        command: 'lunaos.runAgent',
        title: 'Run Agent',
        arguments: [a.id],
      };
      return item;
    });
  }

  /** Fetch and render recent runs */
  private async getRunItems(): Promise<LunaTreeItem[]> {
    try {
      this.runs = await fetchRecentRuns(10);
    } catch {
      this.runs = [];
    }
    if (this.runs.length === 0) {
      return [
        new LunaTreeItem(
          'No recent runs',
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }
    return this.runs.map((r) => {
      const icon = this.runStatusIcon(r.status);
      const duration = r.durationMs
        ? `${(r.durationMs / 1000).toFixed(1)}s`
        : 'in progress';
      const item = new LunaTreeItem(
        r.agentName,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        r
      );
      item.description = `${r.status} - ${duration}`;
      item.iconPath = new vscode.ThemeIcon(icon);
      item.command = {
        command: 'lunaos.viewRunLogs',
        title: 'View Logs',
        arguments: [r.id],
      };
      return item;
    });
  }

  /** Render quick action items */
  private getQuickActionItems(): LunaTreeItem[] {
    return QUICK_ACTIONS.map((qa) => {
      const item = new LunaTreeItem(
        qa.label,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        qa
      );
      item.iconPath = new vscode.ThemeIcon(qa.icon);
      item.command = { command: qa.command, title: qa.label };
      return item;
    });
  }

  /** Map run status to a codicon name */
  private runStatusIcon(
    status: Run['status']
  ): string {
    const map: Record<Run['status'], string> = {
      pending: 'clock',
      running: 'sync~spin',
      completed: 'check',
      failed: 'error',
    };
    return map[status];
  }
}
