import * as vscode from "vscode";
import { RunsProvider } from "./provider";
import { PushCIWatcher } from "./watcher";

let statusBarItem: vscode.StatusBarItem;
let watcher: PushCIWatcher;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "pushci.status";
  updateStatusBar("unknown");
  statusBarItem.show();

  const runsProvider = new RunsProvider();
  vscode.window.registerTreeDataProvider("pushci.runs", runsProvider);

  watcher = new PushCIWatcher(
    () => runsProvider.refresh(),
    (status) => updateStatusBar(status)
  );
  watcher.start(context);

  context.subscriptions.push(
    statusBarItem,
    registerRunCommand(),
    registerInitCommand(),
    registerStatusCommand(runsProvider),
    registerLogsCommand(context)
  );
}

function updateStatusBar(status: string): void {
  if (status === "pass") {
    statusBarItem.text = "$(check) PushCI: ✓";
    statusBarItem.backgroundColor = undefined;
  } else if (status === "fail") {
    statusBarItem.text = "$(error) PushCI: ✗";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
  } else {
    statusBarItem.text = "$(sync~spin) PushCI: —";
    statusBarItem.backgroundColor = undefined;
  }
}

function registerRunCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("pushci.run", () => {
    const terminal = vscode.window.createTerminal("PushCI");
    terminal.show();
    terminal.sendText("pushci run");
  });
}

function registerInitCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("pushci.init", () => {
    const terminal = vscode.window.createTerminal("PushCI");
    terminal.show();
    terminal.sendText("pushci init");
  });
}

function registerStatusCommand(provider: RunsProvider): vscode.Disposable {
  return vscode.commands.registerCommand("pushci.status", () => {
    provider.refresh();
    vscode.window.showInformationMessage("PushCI status refreshed.");
  });
}

function registerLogsCommand(ctx: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand("pushci.logs", () => {
    const panel = vscode.window.createWebviewPanel(
      "pushciLogs",
      "PushCI Logs",
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );
    const logsPath = vscode.Uri.joinPath(
      ctx.globalStorageUri,
      "last-run.log"
    );
    vscode.workspace.fs.readFile(logsPath).then(
      (data) => {
        panel.webview.html = `<pre>${Buffer.from(data).toString()}</pre>`;
      },
      () => {
        panel.webview.html = "<p>No logs found. Run a pipeline first.</p>";
      }
    );
  });
}

export function deactivate(): void {
  watcher?.dispose();
}
