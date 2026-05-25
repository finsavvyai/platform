// SPDX-License-Identifier: AGPL-3.0-or-later
import * as vscode from "vscode";
import { loadConfig, setEnabled, onConfigChanged } from "./config";
import { redact, GatewayError } from "./redact";
import type { Config, RedactResponse } from "./types";

let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBar.command = "privacyGateway.toggleEnabled";
  paintStatus(loadConfig());
  statusBar.show();

  context.subscriptions.push(
    statusBar,
    vscode.commands.registerCommand(
      "privacyGateway.scrubSelection",
      scrubSelection,
    ),
    vscode.commands.registerCommand(
      "privacyGateway.scrubClipboard",
      scrubClipboard,
    ),
    vscode.commands.registerCommand(
      "privacyGateway.toggleEnabled",
      toggleEnabled,
    ),
    vscode.commands.registerCommand("privacyGateway.openSettings", () =>
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "privacyGateway",
      ),
    ),
    onConfigChanged((cfg) => paintStatus(cfg)),
  );
}

export function deactivate(): void {
  statusBar?.dispose();
}

function paintStatus(cfg: Config): void {
  statusBar.text = cfg.enabled ? "$(shield) Privacy Gateway" : "$(shield) PG off";
  statusBar.tooltip = cfg.enabled
    ? `Privacy Gateway → ${cfg.gatewayUrl} (${cfg.presets.join(", ")})`
    : "Privacy Gateway is disabled";
  statusBar.backgroundColor = cfg.enabled
    ? undefined
    : new vscode.ThemeColor("statusBarItem.warningBackground");
}

async function toggleEnabled(): Promise<void> {
  const cfg = loadConfig();
  await setEnabled(!cfg.enabled);
}

async function scrubSelection(): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  if (!ed) {
    vscode.window.showInformationMessage("No active editor.");
    return;
  }
  const sel = ed.selection;
  if (sel.isEmpty) {
    vscode.window.showInformationMessage("Select text to scrub.");
    return;
  }
  const text = ed.document.getText(sel);
  const res = await runScan(text);
  if (!res) return;
  await ed.edit((b) => b.replace(sel, res.redacted));
  notifyResult(res);
}

async function scrubClipboard(): Promise<void> {
  const text = await vscode.env.clipboard.readText();
  if (!text.trim()) {
    vscode.window.showInformationMessage("Clipboard is empty.");
    return;
  }
  const res = await runScan(text);
  if (!res) return;
  await vscode.env.clipboard.writeText(res.redacted);
  notifyResult(res, "Clipboard updated.");
}

async function runScan(text: string): Promise<RedactResponse | undefined> {
  const cfg = loadConfig();
  if (!cfg.enabled) {
    vscode.window.showWarningMessage("Privacy Gateway is disabled.");
    return undefined;
  }
  try {
    const res = await redact(cfg, { text });
    if (res.blocked) {
      vscode.window.showErrorMessage(
        `Blocked: ${res.block_reason ?? "policy violation"}.`,
      );
      return undefined;
    }
    if (cfg.mode === "preview" && res.detections.length > 0) {
      const ok = await confirmPreview(res);
      if (!ok) return undefined;
    }
    return res;
  } catch (err) {
    const msg =
      err instanceof GatewayError ? `${err.status}: ${err.message}` : String(err);
    vscode.window.showErrorMessage(`Privacy Gateway error: ${msg}`);
    return undefined;
  }
}

async function confirmPreview(res: RedactResponse): Promise<boolean> {
  const summary = res.detections
    .map((d) => `${d.preset}/${d.pattern} → ${d.action}`)
    .join("\n");
  const pick = await vscode.window.showInformationMessage(
    `Scrubbed ${res.detections.length} item(s):\n${summary}`,
    { modal: true },
    "Replace",
  );
  return pick === "Replace";
}

function notifyResult(res: RedactResponse, prefix?: string): void {
  const head = prefix ? `${prefix} ` : "";
  if (res.detections.length === 0) {
    vscode.window.setStatusBarMessage(`${head}No detections.`, 3000);
    return;
  }
  vscode.window.setStatusBarMessage(
    `${head}Scrubbed ${res.detections.length} item(s).`,
    4000,
  );
}
