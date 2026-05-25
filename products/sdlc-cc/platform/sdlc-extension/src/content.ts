/**
 * Content script — runs in the page context of chatgpt.com / claude.ai /
 * gemini / copilot. Listens for the message-send keystroke (Enter without
 * Shift), runs local PII scan, swaps the editor contents with a redacted
 * version, then lets the original send proceed.
 *
 * Each chat surface uses a different editor element (textarea, contenteditable
 * div, ProseMirror) so we resolve the active editor by walking from the focused
 * element rather than maintaining a brittle per-site selector list.
 */

import { scan, redact, type Match } from './pii-scan';
import { countByEntity, detectSource, postAudit } from './audit-client';
import { DEFAULT_SETTINGS, bumpCounter, loadSettings, type Settings } from './storage';

// Hot-path settings: seeded synchronously with defaults so the very first
// keystroke after page load still gets scanned. Real settings overwrite this
// once the chrome.storage round-trip resolves.
let currentSettings: Settings = DEFAULT_SETTINGS;

void (async () => {
  currentSettings = await loadSettings();
})();

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener(async () => {
    currentSettings = await loadSettings();
  });
}

document.addEventListener('keydown', onKeydown, /* useCapture */ true);

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;

  const settings = currentSettings;
  if (!settings.enabled) return;

  const editor = ev.target as HTMLElement | null;
  if (!editor) return;

  const text = readEditor(editor);
  if (!text) return;

  const matches = scan(text);
  if (matches.length === 0) return;

  if (settings.policy === 'permissive') {
    // Permissive only audits, doesn't redact.
    fireAndForgetAudit(matches);
    return;
  }

  ev.preventDefault();
  ev.stopPropagation();

  const cleaned = redact(text, matches);
  writeEditor(editor, cleaned);
  showInlineWarning(editor, matches.length);
  fireAndForgetAudit(matches);
}

function fireAndForgetAudit(matches: Match[]): void {
  void bumpCounter(matches.length);
  void postAudit(currentSettings.apiKey, currentSettings.endpoint, {
    source: detectSource(window.location.hostname),
    url: window.location.href,
    entityCounts: countByEntity(matches),
    occurredAt: new Date().toISOString(),
  });
}

function readEditor(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  if (el.isContentEditable) return el.innerText;
  return '';
}

function writeEditor(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (el.isContentEditable) {
    el.innerText = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
}

function showInlineWarning(_anchor: HTMLElement, count: number): void {
  const id = '__sdlc_guard_toast__';
  document.getElementById(id)?.remove();
  const toast = document.createElement('div');
  toast.id = id;
  toast.textContent = `SDLC Guard: redacted ${count} PII match${count === 1 ? '' : 'es'}`;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    background: '#0f172a',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '8px',
    font: '13px/1.4 system-ui, sans-serif',
    zIndex: '2147483647',
    boxShadow: '0 6px 18px rgba(0,0,0,.25)',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

