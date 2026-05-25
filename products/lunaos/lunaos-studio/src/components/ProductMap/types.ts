/**
 * Shared types for the Product Map feature.
 * Defines data structures stored in localStorage under `luna_product_map`.
 */

export type CardStatus = 'planned' | 'building' | 'done';

/**
 * Approval state — separate from build status.
 * Every card starts as `pending_review`. A reviewer can approve or reject.
 * Rejected cards show reviewer feedback and return to pending on edit.
 */
export type ApprovalState = 'pending_review' | 'approved' | 'rejected';

export interface FeatureCardData {
  id: string;
  title: string;
  description: string;
  status: CardStatus;
  tags: string[];
  contextFiles: string[];
  approval?: ApprovalState;
  reviewNote?: string;
  reviewedAt?: string;
}

export interface WorkflowColumn {
  id: string;
  name: string;
  description: string;
  cards: FeatureCardData[];
}

export interface ProductMapData {
  product: {
    name: string;
    description: string;
  };
  workflows: WorkflowColumn[];
}

export const STORAGE_KEY = 'luna_product_map';

export const DEFAULT_MAP: ProductMapData = {
  product: { name: 'My App', description: 'Describe your product here' },
  workflows: [],
};

export function loadMapData(): ProductMapData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProductMapData;
  } catch { /* ignore corrupt data */ }
  return { ...DEFAULT_MAP, workflows: [] };
}

export function saveMapData(data: ProductMapData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
