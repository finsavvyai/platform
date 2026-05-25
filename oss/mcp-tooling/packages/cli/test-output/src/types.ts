/**
 * TypeScript types - Generated from OpenAPI schemas
 */

/** A pet in the store */
export interface Pet {
  /** Unique identifier */
  id: string;
  /** Pet name */
  name: string;
  /** Pet category tag */
  tag?: string;
  /** Pet status */
  status?: string;
}

// Utility types
export type ApiResponse<T> = {
  data: T;
  error?: string;
};
