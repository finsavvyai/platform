export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

export class KeyboardShortcutManager {
  private shortcuts: KeyboardShortcut[] = [];
  private isEnabled: boolean = true;

  register(shortcut: KeyboardShortcut) {
    this.shortcuts.push(shortcut);
  }

  unregister(key: string) {
    this.shortcuts = this.shortcuts.filter(s => s.key !== key);
  }

  clear() {
    this.shortcuts = [];
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.isEnabled) return false;

    // Don't trigger shortcuts when typing in inputs (except for specific shortcuts)
    const target = event.target as HTMLElement;
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const isContentEditable = target.isContentEditable;

    for (const shortcut of this.shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        // Allow certain shortcuts even in inputs (like Ctrl+Enter)
        if (isInput || isContentEditable) {
          if (!['Enter', 'k', 'l', '/'].includes(shortcut.key)) {
            continue;
          }
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }

        shortcut.action();
        return true;
      }
    }

    return false;
  }

  getShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }

  getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    return {
      'Query Execution': this.shortcuts.filter(s =>
        ['Enter', 'e'].includes(s.key) && s.ctrl
      ),
      'Navigation': this.shortcuts.filter(s =>
        ['k', 'b', 'h', 'p', 's'].includes(s.key) && s.ctrl
      ),
      'Editor': this.shortcuts.filter(s =>
        ['/', 'd', 'f'].includes(s.key) && s.ctrl
      ),
      'General': this.shortcuts.filter(s =>
        ['s', 'z', 'y'].includes(s.key) && s.ctrl && !['e', 'k', 'b', 'h', 'p', '/', 'd', 'f'].includes(s.key)
      ),
    };
  }
}

// Default shortcuts configuration
export const defaultShortcuts = {
  // Query Execution
  EXECUTE_QUERY: { key: 'Enter', ctrl: true, description: 'Execute current query' },
  EXECUTE_SELECTED: { key: 'Enter', ctrl: true, shift: true, description: 'Execute selected text' },
  EXPLAIN_QUERY: { key: 'e', ctrl: true, shift: true, description: 'Explain query plan' },

  // Navigation
  COMMAND_PALETTE: { key: 'k', ctrl: true, description: 'Open command palette' },
  TOGGLE_SIDEBAR: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
  QUERY_HISTORY: { key: 'h', ctrl: true, description: 'Open query history' },
  SAVED_QUERIES: { key: 'p', ctrl: true, shift: true, description: 'Open saved queries' },
  SETTINGS: { key: ',', ctrl: true, description: 'Open settings' },

  // Editor Actions
  COMMENT_LINE: { key: '/', ctrl: true, description: 'Toggle line comment' },
  DUPLICATE_LINE: { key: 'd', ctrl: true, description: 'Duplicate current line' },
  FORMAT_SQL: { key: 'f', ctrl: true, shift: true, description: 'Format SQL' },
  FIND: { key: 'f', ctrl: true, description: 'Find in editor' },
  REPLACE: { key: 'h', ctrl: true, shift: true, description: 'Find and replace' },

  // Tab Management
  NEW_TAB: { key: 't', ctrl: true, description: 'New query tab' },
  CLOSE_TAB: { key: 'w', ctrl: true, description: 'Close current tab' },
  NEXT_TAB: { key: 'Tab', ctrl: true, description: 'Next tab' },
  PREV_TAB: { key: 'Tab', ctrl: true, shift: true, description: 'Previous tab' },

  // General
  SAVE: { key: 's', ctrl: true, description: 'Save query' },
  UNDO: { key: 'z', ctrl: true, description: 'Undo' },
  REDO: { key: 'y', ctrl: true, description: 'Redo' },
  SELECT_ALL: { key: 'a', ctrl: true, description: 'Select all' },

  // Data Grid
  REFRESH_DATA: { key: 'r', ctrl: true, description: 'Refresh data' },
  EXPORT_DATA: { key: 'e', ctrl: true, shift: true, alt: true, description: 'Export data' },
};

export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
