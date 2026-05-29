/**
 * Voice Command Utility Functions
 */

import type { ProcessedCommand, VoiceIntent } from './commandProcessorTypes';

export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return '';
  return errors.map((error, index) => {
    const [severity, ...messageParts] = error.split(']');
    const message = messageParts.join(']').trim();
    return `${index + 1}. [${severity.toUpperCase()}] ${message}`;
  }).join('\n');
}

export function requiresConfirmation(processed: ProcessedCommand): boolean {
  return processed.requiresConfirmation || !processed.validated;
}

export function getCommandSummary(intent: VoiceIntent): string {
  const summaries: Record<string, string> = {
    'query_execute': `Execute query: ${intent.entities.query || ''}`,
    'query_save': 'Save query',
    'connection_test': `Test connection: ${intent.entities.connection || ''}`,
    'metrics_show': 'Show metrics',
    'alert_create': 'Create alert',
    'table_describe': `Describe table: ${intent.entities.table || ''}`,
    'backup_create': 'Create backup',
  };
  return summaries[intent.intent] || `Execute: ${intent.intent}`;
}

export function formatExecutionTime(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${(milliseconds / 60000).toFixed(1)}m`;
}

export function formatCommandCost(cost: number): string {
  if (cost === 0) return 'Free';
  return `$${cost.toFixed(4)}`;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'query': 'blue',
    'connection': 'green',
    'monitoring': 'purple',
    'schema': 'orange',
    'backup': 'red',
    'general': 'gray',
  };
  return colors[category] || 'gray';
}
