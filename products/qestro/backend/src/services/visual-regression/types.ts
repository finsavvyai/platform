/**
 * Visual Regression Testing Types
 */

export interface CaptureOptions {
  url: string;
  viewport?: { width: number; height: number };
  deviceEmulation?: string;
  waitSelector?: string;
  waitTime?: number;
  fullPage?: boolean;
  selector?: string;
  timeout?: number;
}

export interface ScreenshotCapture {
  id: string;
  projectId: string;
  name: string;
  screenshot: Buffer;
  metadata: {
    width: number;
    height: number;
    capturedAt: Date;
    url?: string;
    viewport?: { width: number; height: number };
  };
}

export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  mismatchCount: number;
  mismatchPercentage: number;
}

export interface ComparisonResult {
  mismatchCount: number;
  mismatchPercentage: number;
  diffImage: Buffer;
  regions: DiffRegion[];
  passed: boolean;
  threshold: number;
}

export interface ComparisonOptions {
  threshold?: number; // 0-100, mismatch percentage
  ignoreRegions?: { x: number; y: number; width: number; height: number }[];
  antiAlias?: boolean;
  scale?: number;
}

export interface VisualBaseline {
  id: string;
  projectId: string;
  name: string;
  screenshot: Buffer;
  metadata: {
    width: number;
    height: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}

export interface VisualTestOptions {
  projectId: string;
  url: string;
  baselineName: string;
  captureOptions?: Partial<CaptureOptions>;
  comparisonOptions?: ComparisonOptions;
  createIfMissing?: boolean; // auto-create baseline if missing
}

export interface VisualTestResult {
  id: string;
  projectId: string;
  testName: string;
  status: 'passed' | 'failed' | 'baseline-created';
  comparison?: ComparisonResult;
  currentScreenshot: Buffer;
  baselineScreenshot?: Buffer;
  diffImage?: Buffer;
  executedAt: Date;
  duration: number;
  error?: string;
  approvalPending?: boolean;
}
