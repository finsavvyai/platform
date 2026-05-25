export const MOCK_THREATS = [
  { type: 'CREDENTIAL', severity: 'HIGH', region: 'EU-West', time: '12s ago', blocked: true },
  { type: 'SUPPLY_CHAIN', severity: 'CRITICAL', region: 'US-East', time: '34s ago', blocked: true },
  { type: 'EXFILTRATION', severity: 'HIGH', region: 'AP-Southeast', time: '1m ago', blocked: true },
  { type: 'PROMPT_INJECTION', severity: 'MEDIUM', region: 'EU-Central', time: '2m ago', blocked: false },
  { type: 'TYPOSQUAT_PKG', severity: 'HIGH', region: 'US-West', time: '3m ago', blocked: true },
  { type: 'UNAUTHORIZED_NETWORK', severity: 'MEDIUM', region: 'US-East', time: '5m ago', blocked: true },
  { type: 'SECRET_EXPOSURE', severity: 'CRITICAL', region: 'EU-West', time: '7m ago', blocked: true },
  { type: 'MALICIOUS_DEPENDENCY', severity: 'HIGH', region: 'AP-East', time: '9m ago', blocked: true },
];

export type MockThreat = (typeof MOCK_THREATS)[number];
