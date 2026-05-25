import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { KeyboardShortcut, getShortcutDisplay } from '../utils/keyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsModal({ isOpen, onClose, shortcuts }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const categories = {
    'Query Execution': shortcuts.filter(s =>
      ['Enter', 'e'].includes(s.key) && (s.ctrl || s.meta)
    ),
    'Navigation': shortcuts.filter(s =>
      ['k', 'b', 'h', 'p', ','].includes(s.key) && (s.ctrl || s.meta)
    ),
    'Editor Actions': shortcuts.filter(s =>
      ['/', 'd', 'f'].includes(s.key) && (s.ctrl || s.meta)
    ),
    'Tab Management': shortcuts.filter(s =>
      ['t', 'w', 'Tab'].includes(s.key) && (s.ctrl || s.meta)
    ),
    'General': shortcuts.filter(s =>
      ['s', 'z', 'y', 'a', 'r'].includes(s.key) && (s.ctrl || s.meta)
    ),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Keyboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Speed up your workflow with these keyboard shortcuts
          </p>

          <div className="space-y-6">
            {Object.entries(categories).map(([category, categoryShortcuts]) => (
              categoryShortcuts.length > 0 && (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <kbd className="px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm">
                          {getShortcutDisplay(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Press <kbd className="px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded">?</kbd> anytime to view this dialog
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
