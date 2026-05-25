/**
 * Tests for webview HTML template generation
 */

import * as assert from 'assert';
import { getWebviewHtml } from '../webview-template';

suite('Webview Template', () => {
    test('generates valid HTML document', () => {
        const html = getWebviewHtml('Hello world');
        assert.ok(html.includes('<!DOCTYPE html>'));
        assert.ok(html.includes('</html>'));
        assert.ok(html.includes('<meta charset="UTF-8">'));
    });

    test('includes content in JSON-safe format', () => {
        const html = getWebviewHtml('Test content');
        assert.ok(html.includes('"Test content"'));
    });

    test('includes marked.js for markdown rendering', () => {
        const html = getWebviewHtml('');
        assert.ok(html.includes('marked'));
    });

    test('uses VS Code theme CSS variables', () => {
        const html = getWebviewHtml('');
        assert.ok(html.includes('--vscode-editor-foreground'));
        assert.ok(html.includes('--vscode-editor-background'));
        assert.ok(html.includes('--vscode-font-family'));
    });

    test('includes spinner animation styles', () => {
        const html = getWebviewHtml('');
        assert.ok(html.includes('.spinner'));
        assert.ok(html.includes('@keyframes spin'));
    });

    test('includes success and error message styles', () => {
        const html = getWebviewHtml('');
        assert.ok(html.includes('.success-msg'));
        assert.ok(html.includes('.error-msg'));
    });

    test('includes ARIA attributes for accessibility', () => {
        const html = getWebviewHtml('');
        assert.ok(html.includes('role="log"'));
        assert.ok(html.includes('aria-live="polite"'));
        assert.ok(html.includes('aria-label'));
    });

    test('escapes double quotes in content via JSON.stringify', () => {
        const html = getWebviewHtml('Line with "quotes"');
        assert.ok(html.includes('\\"quotes\\"'));
    });

    test('handles empty content with fallback message', () => {
        const html = getWebviewHtml('');
        assert.ok(html.includes('Waiting for agent output'));
    });
});
