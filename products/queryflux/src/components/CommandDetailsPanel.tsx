/**
 * Command Details Panel
 *
 * Expandable details section used inside CommandConfirmationDialog
 */

import { useTheme } from '../contexts/ThemeContext';
import type { ProcessedCommand } from '../hooks/useCommandProcessor';

interface CommandDetailsPanelProps {
  processed: ProcessedCommand;
}

export function CommandDetailsPanel({ processed }: CommandDetailsPanelProps) {
  const { theme } = useTheme();

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {Object.keys(processed.intent.entities).length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold" style={{ color: theme.colors.textSecondary }}>
            Entities:
          </p>
          <div className="space-y-1">
            {Object.entries(processed.intent.entities).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  {key}:
                </span>
                <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {processed.context && (
        <div>
          <p className="mb-1 text-xs font-semibold" style={{ color: theme.colors.textSecondary }}>
            Context:
          </p>
          <div className="space-y-1">
            {processed.context.currentConnection && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  Connection:
                </span>
                <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                  {processed.context.currentConnection}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Session:
              </span>
              <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                {processed.context.sessionId.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
