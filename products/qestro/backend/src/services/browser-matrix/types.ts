export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface DeviceConfig {
  name: string;
  userAgent?: string;
  viewport?: ViewportSize;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

export interface BrowserConfig {
  type: BrowserType;
  version?: string;
  viewport?: ViewportSize;
  deviceEmulation?: DeviceConfig;
}

export interface MatrixEntry {
  id: string;
  testId: string;
  browser: BrowserConfig;
  devicePreset?: string;
  tags?: string[];
}

export interface MatrixResult {
  entryId: string;
  testId: string;
  browser: BrowserType;
  deviceName?: string;
  viewport?: ViewportSize;
  startTime: number;
  endTime: number;
  durationMs: number;
  passed: boolean;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  screenshotPath?: string;
  errorMessage?: string;
  logs?: string[];
  assertions?: AssertionResult[];
}

export interface AssertionResult {
  name: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  message?: string;
}

export interface MatrixSummary {
  totalEntries: number;
  passedEntries: number;
  failedEntries: number;
  skippedEntries: number;
  passRate: number;
  totalDurationMs: number;
  startTime: number;
  endTime: number;
  results: MatrixResult[];
  failureDetails: { browser: BrowserType; error: string }[];
}

export interface MatrixRequest {
  testId: string;
  projectId: string;
  userId: string;
  browsers: BrowserConfig[];
  devicePresets?: string[];
  parallel?: boolean;
  maxConcurrency?: number;
  timeoutMs?: number;
}
