/**
 * Test Recorder Types
 * Defines all types for browser session recording and code generation
 */

export type ActionType =
  | 'click'
  | 'type'
  | 'navigate'
  | 'scroll'
  | 'hover'
  | 'select'
  | 'assert'
  | 'screenshot'
  | 'wait'
  | 'fill'
  | 'focus'
  | 'blur'
  | 'check'
  | 'uncheck';

export type AssertionType = 'visible' | 'text' | 'value' | 'exists' | 'url' | 'count';

export interface Selector {
  type: 'css' | 'xpath' | 'role' | 'testid' | 'text' | 'label';
  value: string;
}

export interface RecordedAction {
  id: string;
  timestamp: number;
  type: ActionType;
  selector?: Selector;
  text?: string;
  value?: string;
  url?: string;
  scrollX?: number;
  scrollY?: number;
  key?: string;
  index?: number;
  x?: number;
  y?: number;
  metadata?: Record<string, unknown>;
}

export interface RecordedStep {
  id: string;
  actionType: ActionType;
  description: string;
  selector?: Selector;
  text?: string;
  value?: string;
  url?: string;
  scrollX?: number;
  scrollY?: number;
  assertion?: {
    type: AssertionType;
    value: string;
  };
  waitMs?: number;
  screenshot?: string;
  groupedActions?: RecordedAction[];
}

export interface RecordingOptions {
  captureScreenshots: boolean;
  recordNetwork: boolean;
  recordConsole: boolean;
  smartWaits: boolean;
  preferredSelectors: Selector['type'][];
}

export interface RecordingSession {
  id: string;
  projectId: string;
  url: string;
  status: 'active' | 'paused' | 'completed';
  actions: RecordedAction[];
  startTime: number;
  endTime?: number;
  duration?: number;
  options: RecordingOptions;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export interface CodegenOptions {
  language?: 'playwright' | 'cypress' | 'webdriver';
  includeScreenshots?: boolean;
  includeNetworkAssertions?: boolean;
  includeWaits?: boolean;
  testName?: string;
  indent?: number;
}

export interface CodegenResult {
  code: string;
  steps: RecordedStep[];
  language: string;
  assertions: number;
  estimatedRunTime?: number;
}

export interface SessionMetadata {
  screenSize: { width: number; height: number };
  userAgent: string;
  platform: string;
  timestamp: number;
}
