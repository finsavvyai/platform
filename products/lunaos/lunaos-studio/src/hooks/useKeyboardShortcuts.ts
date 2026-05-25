/**
 * Keyboard shortcuts hook for the workflow builder.
 * Supports Delete, Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+S (save/export).
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeData } from '../types';

interface HistoryEntry {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

interface ShortcutActions {
  onDelete: () => void;
  onExport: () => void;
  getSnapshot: () => HistoryEntry;
  restoreSnapshot: (entry: HistoryEntry) => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const lastSnapshot = useRef<HistoryEntry | null>(null);

  const pushUndo = useCallback(() => {
    const snap = actions.getSnapshot();
    undoStack.current.push(snap);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  }, [actions]);

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return false;
    const current = actions.getSnapshot();
    redoStack.current.push(current);
    actions.restoreSnapshot(entry);
    return true;
  }, [actions]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return false;
    const current = actions.getSnapshot();
    undoStack.current.push(current);
    actions.restoreSnapshot(entry);
    return true;
  }, [actions]);

  // Save snapshot before mutations (call this from store operations)
  const saveCheckpoint = useCallback(() => {
    pushUndo();
  }, [pushUndo]);

  useEffect(() => {
    // Capture initial state
    lastSnapshot.current = actions.getSnapshot();
  }, [actions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable;

      // Delete/Backspace — delete selected node (not in inputs)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        e.preventDefault();
        saveCheckpoint();
        actions.onDelete();
        return;
      }

      // Cmd+Z — undo
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd+Shift+Z — redo
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd+S — export/save
      if (meta && e.key === 's') {
        e.preventDefault();
        actions.onExport();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions, undo, redo, saveCheckpoint]);

  return { saveCheckpoint, undo, redo };
}
