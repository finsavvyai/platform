/**
 * Webview HTML template — generates the HTML for the agent output panel
 */

export function getWebviewHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LunaOS Agent Output</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
            font-size: 14px;
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid var(--vscode-widget-border);
        }
        code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textPreformat-foreground);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 4px;
        }
        pre code { padding: 0; background-color: transparent; }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px; margin-bottom: 16px;
            font-weight: 600; line-height: 1.25;
            color: var(--vscode-editor-foreground);
        }
        h1 { font-size: 2em; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: .3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: .3em; }
        a { color: var(--vscode-textLink-foreground); text-decoration: none; }
        a:hover { text-decoration: underline; }
        blockquote {
            margin: 0; padding: 0 1em;
            color: var(--vscode-textBlockQuote-foreground);
            border-left: .25em solid var(--vscode-textBlockQuote-background);
        }
        .header {
            display: flex; align-items: center;
            margin-bottom: 20px; padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .header h2 { margin: 0; border: none; }
        .spinner {
            display: inline-block; width: 20px; height: 20px;
            border: 3px solid rgba(195, 195, 195, 0.6);
            border-radius: 50%;
            border-top-color: var(--vscode-button-background);
            animation: spin 1s ease-in-out infinite;
            margin-right: 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-msg { color: var(--vscode-errorForeground); font-weight: bold; margin-top: 10px; }
        .success-msg { color: var(--vscode-testing-iconPassed); font-weight: bold; margin-top: 10px; }
    </style>
</head>
<body>
    <div id="content" role="log" aria-live="polite" aria-label="Agent output"></div>
    <script>
        const contentDiv = document.getElementById('content');
        const rawContent = ${JSON.stringify(content)};
        if (window.marked) {
            marked.setOptions({ gfm: true, breaks: true });
            contentDiv.innerHTML = marked.parse(rawContent || "Waiting for agent output...");
        } else {
            contentDiv.textContent = rawContent;
        }
        window.scrollTo(0, document.body.scrollHeight);
    </script>
</body>
</html>`;
}
