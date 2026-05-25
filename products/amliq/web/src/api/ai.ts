import { api } from './client';
import type { Alert } from '../types';

export interface AISummaryResult {
  summary: string;
  model: string;
}

function sanitize(value: string): string {
  // Strip characters that could act as prompt delimiters or inject instructions
  return value.replace(/[<>{}[\]\\]/g, '').trim().slice(0, 200);
}

function alertToText(alert: Alert): string {
  const name = sanitize(
    alert.entity.name?.fullName ??
    [alert.entity.name?.firstName, alert.entity.name?.lastName].filter(Boolean).join(' ')
  );
  // Only send fields needed for a 2-3 sentence summary — no aiDraftReason (injection risk)
  return [
    `Entity: ${name}`,
    `Type: ${sanitize(alert.entity.type ?? 'unknown')}`,
    `Nationality: ${sanitize(alert.entity.nationality ?? 'unknown')}`,
    `Risk level: ${alert.riskLevel}`,
    `Matched sanctions/PEP records: ${alert.matchedCount}`,
  ].join('\n');
}

export function fetchAlertSummary(alert: Alert): Promise<AISummaryResult> {
  return api.post<AISummaryResult>('/ai/summarize', {
    text: alertToText(alert),
    type: 'alert',
  });
}
