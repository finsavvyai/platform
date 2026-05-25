import * as vscode from "vscode";

/**
 * Builds a file list for LunaForge core using VS Code's workspace APIs.
 * We deliberately avoid node fs so this works in the extension host.
 */
export async function buildFsList(maxFiles = 5000): Promise<string[]> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return [];
  }
  const files: string[] = [];
  const uris = await vscode.workspace.findFiles("**/*", "**/node_modules/**", maxFiles);
  for (const uri of uris) {
    const rel = vscode.workspace.asRelativePath(uri);
    files.push(rel);
  }
  return files;
}
