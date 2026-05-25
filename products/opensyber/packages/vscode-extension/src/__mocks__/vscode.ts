// Minimal vscode API mock for unit tests
// The real vscode module is only available inside the VS Code Extension Host

export const window = {
  showWarningMessage: () => Promise.resolve(undefined),
  showInformationMessage: () => Promise.resolve(undefined),
  setStatusBarMessage: () => ({ dispose: () => {} }),
  registerWebviewViewProvider: () => ({ dispose: () => {} }),
  onDidStartTerminalShellExecution: () => ({ dispose: () => {} }),
  onDidOpenTerminal: () => ({ dispose: () => {} }),
}

export const workspace = {
  onDidOpenTextDocument: () => ({ dispose: () => {} }),
  getConfiguration: () => ({ get: (_key: string, defaultVal: unknown) => defaultVal }),
}

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(),
}

export const env = {
  appName: 'Code',
  appHost: 'desktop',
  openExternal: () => Promise.resolve(true),
}

export const extensions = {
  getExtension: () => undefined,
}

export const Uri = {
  file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }),
  parse: (s: string) => ({ toString: () => s }),
}
