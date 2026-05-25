import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface RunRecord {
  id: string;
  status: "pass" | "fail" | "running";
  timestamp: string;
  checks?: CheckRecord[];
}

interface CheckRecord {
  name: string;
  status: "pass" | "fail" | "skipped";
  output?: string;
}

export class RunsProvider implements vscode.TreeDataProvider<RunItem> {
  private _onDidChange = new vscode.EventEmitter<RunItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void { this._onDidChange.fire(undefined); }

  getTreeItem(el: RunItem): vscode.TreeItem { return el; }

  getChildren(el?: RunItem): RunItem[] {
    if (el?.checks) {
      return el.checks.map((c) => new RunItem(
        c.name, c.status, vscode.TreeItemCollapsibleState.None, undefined, c.output
      ));
    }
    return this.loadRuns();
  }

  private loadRuns(): RunItem[] {
    const cp = this.getCachePath();
    if (!cp || !fs.existsSync(cp)) {
      return [new RunItem("No runs yet", "unknown", vscode.TreeItemCollapsibleState.None)];
    }
    try {
      const data = JSON.parse(fs.readFileSync(cp, "utf-8"));
      const runs: RunRecord[] = data.runs ?? [];
      return runs.slice(0, 20).map((r) => new RunItem(
        `#${r.id} — ${r.timestamp}`, r.status,
        r.checks?.length ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        r.checks
      ));
    } catch {
      return [new RunItem("Error reading cache", "fail", vscode.TreeItemCollapsibleState.None)];
    }
  }

  private getCachePath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.[0]) return undefined;
    return path.join(folders[0].uri.fsPath, ".pushci", "cache.json");
  }
}

const ICONS: Record<string, string> = {
  pass: "pass", fail: "error", running: "sync~spin",
};

class RunItem extends vscode.TreeItem {
  checks?: CheckRecord[];

  constructor(
    label: string, status: string,
    collapsible: vscode.TreeItemCollapsibleState,
    checks?: CheckRecord[], output?: string,
  ) {
    super(label, collapsible);
    this.checks = checks;
    this.iconPath = new vscode.ThemeIcon(ICONS[status] ?? "circle-outline");
    if (output) this.tooltip = output;
  }
}
