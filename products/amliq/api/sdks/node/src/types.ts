/** Screen request input. */
export interface ScreenRequest {
  name: string;
  entity_type?: string;
  country?: string;
  dob?: string;
  identifiers?: Record<string, string>;
}

/** Evidence from a single matching layer. */
export interface Evidence {
  layer: string;
  algorithm: string;
  score: number;
}

/** A single screening match result. */
export interface ScreenResult {
  entity_id: string;
  matched_name: string;
  confidence: number;
  list_id: string;
  evidence: Evidence[];
}

/** Screening API response. */
export interface ScreenResponse {
  results: ScreenResult[];
  total: number;
}

/** Fast screening result for payment flows. */
export interface FastScreenResult {
  match: boolean;
  confidence: number;
  matched_name?: string;
  list_id?: string;
}

/** An alert from the screening system. */
export interface Alert {
  id: string;
  entity_name: string;
  matched_name: string;
  confidence: number;
  status: string;
  list_id: string;
}

/** Alerts list response. */
export interface AlertsResponse {
  alerts: Alert[];
  total: number;
}

/** Resolve alert request. */
export interface ResolveAlertRequest {
  resolution: string;
  justification?: string;
}

/** AMLIQ client configuration. */
export interface AMLIQConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/** API error response. */
export interface APIError {
  code: string;
  message: string;
}
