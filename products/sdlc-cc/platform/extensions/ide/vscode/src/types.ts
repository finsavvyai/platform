// SPDX-License-Identifier: AGPL-3.0-or-later

export type DlpAction = "allow" | "mask" | "redact" | "block";

export interface DlpDetection {
  pattern: string;
  preset: string;
  action: DlpAction;
  start: number;
  end: number;
}

export interface RedactRequest {
  text: string;
  presets?: string[];
  tenant?: string;
}

export interface RedactResponse {
  redacted: string;
  detections: DlpDetection[];
  blocked: boolean;
  block_reason?: string;
}

export interface Config {
  gatewayUrl: string;
  apiKey: string;
  tenant: string;
  presets: string[];
  mode: "preview" | "auto";
  enabled: boolean;
}
