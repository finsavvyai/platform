// SPDX-License-Identifier: AGPL-3.0-or-later
import * as vscode from "vscode";
import type { Config } from "./types";

const SECTION = "privacyGateway";

export function loadConfig(): Config {
  const c = vscode.workspace.getConfiguration(SECTION);
  return {
    gatewayUrl: c.get<string>("gatewayUrl") ?? "http://localhost:8080",
    apiKey: c.get<string>("apiKey") ?? "",
    tenant: c.get<string>("tenant") ?? "",
    presets: c.get<string[]>("presets") ?? ["pii_default", "secrets"],
    mode: (c.get<string>("mode") as Config["mode"]) ?? "preview",
    enabled: c.get<boolean>("enabled") ?? true,
  };
}

export async function setEnabled(value: boolean): Promise<void> {
  await vscode.workspace
    .getConfiguration(SECTION)
    .update("enabled", value, vscode.ConfigurationTarget.Global);
}

export function onConfigChanged(fn: (cfg: Config) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((ev) => {
    if (ev.affectsConfiguration(SECTION)) fn(loadConfig());
  });
}
