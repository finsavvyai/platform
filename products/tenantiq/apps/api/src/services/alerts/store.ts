import type { Alert, AlertRule } from './types.js';

export const alerts = new Map<string, Alert[]>();
export const alertRules = new Map<string, AlertRule[]>();
export const alertHistory = new Map<string, Alert[]>();
