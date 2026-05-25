// AutoBoot Integration Hub - API key, copy button, and code block CSS styles

export const stylesCode = `
        /* API Key Section */
        .api-key-section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 2rem;
            margin-bottom: 2rem;
        }

        .section-title {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .key-display {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            padding: 1rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            color: var(--accent-green);
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .copy-btn {
            padding: 0.5rem 1rem;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 0.375rem;
            font-weight: 600;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .copy-btn:hover {
            background: #3451d1;
        }

        .copy-btn.copied {
            background: var(--accent-green);
        }

        /* Code Block */
        .code-section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 2rem;
            margin-bottom: 2rem;
        }

        .code-tabs {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border);
        }

        .code-tab {
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-weight: 600;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .code-tab.active {
            color: var(--accent);
            border-bottom-color: var(--accent);
        }

        .code-block {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            padding: 1.5rem;
            overflow-x: auto;
            position: relative;
        }

        .code-block pre {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            line-height: 1.6;
            color: #e5e7eb;
        }

        .code-comment { color: #6b7280; }
        .code-keyword { color: #8b5cf6; }
        .code-string { color: #10b981; }
        .code-function { color: #3b82f6; }
        .code-variable { color: #f59e0b; }`;
