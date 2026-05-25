/** Build the complete HTML for the playground webview */
export function buildPlaygroundHtml(): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LunaOS Playground</title>
  <style nonce="${nonce}">${getStyles()}</style>
</head>
<body>
  <div class="container">
    <h1>LunaOS Pipe Playground</h1>
    <div class="templates">
      <button class="tpl" data-expr="req >> des >> plan >> go">Full Pipeline</button>
      <button class="tpl" data-expr="test >> rev >> fix">Test + Review</button>
      <button class="tpl" data-expr="perf >> a11y >> sec">Quality Audit</button>
      <button class="tpl" data-expr="feature >> test >> ship">Feature Ship</button>
    </div>
    <textarea id="editor" rows="6" placeholder="req >> des >> plan >> go"></textarea>
    <button id="run-btn">Run</button>
    <div id="output" class="output"></div>
  </div>
  <script nonce="${nonce}">${getScript()}</script>
</body>
</html>`;
}

/** Playground CSS matching VS Code dark theme */
function getStyles(): string {
  return `
body { font-family: var(--vscode-font-family);
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground); padding: 16px; margin: 0; }
.container { max-width: 700px; margin: 0 auto; }
h1 { font-size: 18px; margin-bottom: 12px; color: #8b5cf6; }
.templates { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.tpl { background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.tpl:hover { background: var(--vscode-button-secondaryHoverBackground); }
textarea { width: 100%; box-sizing: border-box;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px; padding: 8px;
  font-family: var(--vscode-editor-font-family);
  font-size: 13px; resize: vertical; }
#run-btn { margin-top: 8px; background: #8b5cf6; color: #fff;
  border: none; border-radius: 4px; padding: 8px 20px;
  cursor: pointer; font-size: 13px; }
#run-btn:hover { background: #7c3aed; }
#run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.output { margin-top: 12px; background: var(--vscode-terminal-background);
  color: var(--vscode-terminal-foreground); border-radius: 4px;
  padding: 12px; font-family: var(--vscode-editor-font-family);
  font-size: 12px; white-space: pre-wrap; min-height: 60px; }`;
}

/** Playground client-side JS */
function getScript(): string {
  return `
const vscode = acquireVsCodeApi();
const editor = document.getElementById('editor');
const runBtn = document.getElementById('run-btn');
const output = document.getElementById('output');
document.querySelectorAll('.tpl').forEach(btn => {
  btn.addEventListener('click', () => { editor.value = btn.dataset.expr; });
});
runBtn.addEventListener('click', () => {
  const expr = editor.value.trim();
  if (!expr) return;
  vscode.postMessage({ type: 'runPipe', expression: expr });
});
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'loading') {
    output.textContent = 'Running...';
    runBtn.disabled = true;
  } else if (msg.type === 'result') {
    runBtn.disabled = false;
    const prefix = msg.durationMs ? '(' + msg.durationMs + 'ms) ' : '';
    output.textContent = prefix + msg.output;
  }
});`;
}

/** Generate a random nonce for CSP */
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
