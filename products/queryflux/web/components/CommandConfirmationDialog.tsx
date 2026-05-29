/**
 * Command Confirmation Dialog
 *
 * Shows confirmation dialog for voice commands requiring approval
 */

import { useState } from 'react';
import { AlertTriangle, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { ProcessedCommand } from '../hooks/useCommandProcessor';
import { formatValidationErrors, getCommandSummary, formatExecutionTime, formatCommandCost, requiresConfirmation } from '../hooks/useCommandProcessor';
import { CommandDetailsPanel } from './CommandDetailsPanel';

// ============================================================================
// Types
// ============================================================================

interface CommandConfirmationDialogProps {
  processed: ProcessedCommand;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

// ============================================================================
// Component Implementation
// ============================================================================

export function CommandConfirmationDialog({
  processed,
  onConfirm,
  onCancel,
  isOpen,
}: CommandConfirmationDialogProps) {
  const { theme } = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen) return null;

  const needsConfirmation = requiresConfirmation(processed);
  const hasErrors = !processed.validated && processed.validationErrors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className="w-full max-w-lg rounded-lg shadow-xl"
        style={{
          backgroundColor: theme.colors.sidebar,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Header */}
        <div className="border-b p-4" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            {hasErrors ? (
              <XCircle size={24} className="text-red-500" />
            ) : needsConfirmation ? (
              <AlertTriangle size={24} className="text-yellow-500" />
            ) : (
              <CheckCircle size={24} className="text-green-500" />
            )}
            <div>
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                {hasErrors ? 'Command Validation Failed' : needsConfirmation ? 'Confirm Command' : 'Command Ready'}
              </h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {getCommandSummary(processed.intent)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Validation Errors */}
          {hasErrors && (
            <div
              className="mb-4 rounded-lg p-3"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
              }}
            >
              <p className="mb-2 text-sm font-semibold text-red-500">Validation Errors:</p>
              <pre className="whitespace-pre-wrap text-xs text-red-400">
                {formatValidationErrors(processed.validationErrors)}
              </pre>
            </div>
          )}

          {/* Command Details */}
          <div className="space-y-3">
            {/* Intent */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Intent:
              </span>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                {processed.intent.intent}
              </span>
            </div>

            {/* Confidence */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Confidence:
              </span>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                {Math.round(processed.intent.confidence * 100)}%
              </span>
            </div>

            {/* Estimated Cost */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={16} style={{ color: theme.colors.textSecondary }} />
                <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Estimated Cost:
                </span>
              </div>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                {formatCommandCost(processed.estimatedCost)}
              </span>
            </div>

            {/* Estimated Time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: theme.colors.textSecondary }} />
                <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Estimated Time:
                </span>
              </div>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                {formatExecutionTime(processed.estimatedTime)}
              </span>
            </div>

            {/* Expandable Details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full text-left text-sm font-medium hover:underline"
              style={{ color: theme.colors.accent }}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>

            {showDetails && <CommandDetailsPanel processed={processed} />}
          </div>

          {/* Warning for dangerous operations */}
          {needsConfirmation && !hasErrors && (
            <div
              className="mt-4 rounded-lg p-3"
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid #fbbf24',
              }}
            >
              <p className="text-sm text-yellow-600">
                This operation requires confirmation. Please review the details above before proceeding.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t p-4" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 font-medium transition-all hover:opacity-80"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
            }}
          >
            Cancel
          </button>
          {!hasErrors && (
            <button
              onClick={onConfirm}
              className="rounded-lg px-4 py-2 font-medium text-white transition-all hover:opacity-80"
              style={{
                backgroundColor: needsConfirmation ? '#fbbf24' : theme.colors.accent,
              }}
            >
              {needsConfirmation ? 'Confirm & Execute' : 'Execute'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
