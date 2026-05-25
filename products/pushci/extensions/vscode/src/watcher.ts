import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

type RefreshFn = () => void;
type StatusFn = (status: string) => void;

export class PushCIWatcher {
  private disposables: vscode.Disposable[] = [];
  private onRefresh: RefreshFn;
  private onStatus: StatusFn;

  constructor(onRefresh: RefreshFn, onStatus: StatusFn) {
    this.onRefresh = onRefresh;
    this.onStatus = onStatus;
  }

  start(context: vscode.ExtensionContext): void {
    this.watchConfig();
    this.watchCache();
    this.watchSourceSaves(context);
    this.readInitialStatus();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private watchConfig(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/pushci.yml"
    );
    watcher.onDidChange(() => this.onRefresh());
    watcher.onDidCreate(() => this.onRefresh());
    watcher.onDidDelete(() => this.onStatus("unknown"));
    this.disposables.push(watcher);
  }

  private watchCache(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/.pushci/cache.json"
    );
    const update = () => {
      this.onRefresh();
      this.readCacheStatus();
    };
    watcher.onDidChange(update);
    watcher.onDidCreate(update);
    this.disposables.push(watcher);
  }

  private watchSourceSaves(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration("pushci");
    const autoCheck = config.get<boolean>("autoCheckOnSave", false);
    if (!autoCheck) return;

    const sub = vscode.workspace.onDidSaveTextDocument((doc) => {
      const ignored = [".pushci", "node_modules", ".git"];
      const rel = vscode.workspace.asRelativePath(doc.uri);
      if (ignored.some((i) => rel.startsWith(i))) return;
      vscode.commands.executeCommand("pushci.run");
    });
    this.disposables.push(sub);
  }

  private readInitialStatus(): void {
    this.readCacheStatus();
  }

  private readCacheStatus(): void {
    const cachePath = this.getCachePath();
    if (!cachePath || !fs.existsSync(cachePath)) {
      this.onStatus("unknown");
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      const runs = data.runs ?? [];
      if (runs.length === 0) {
        this.onStatus("unknown");
        return;
      }
      this.onStatus(runs[0].status === "pass" ? "pass" : "fail");
    } catch {
      this.onStatus("unknown");
    }
  }

  private getCachePath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.[0]) return undefined;
    return path.join(folders[0].uri.fsPath, ".pushci", "cache.json");
  }
}
