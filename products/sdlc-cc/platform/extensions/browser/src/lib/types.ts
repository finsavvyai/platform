// SPDX-License-Identifier: AGPL-3.0-or-later

export type DlpAction = "allow" | "mask" | "redact" | "block";

export interface DlpDetection {
  pattern: string;
  preset: string;
  action: DlpAction;
  start: number;
  end: number;
  sample?: string;
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

export interface ExtensionSettings {
  gatewayUrl: string;
  apiKey: string;
  tenant?: string;
  presets: string[];
  mode: "preview" | "auto";
  enabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  gatewayUrl: "http://localhost:8080",
  apiKey: "",
  presets: ["pii_default", "secrets"],
  mode: "preview",
  enabled: true,
};

export type RuntimeMessage =
  | { kind: "redact"; payload: RedactRequest }
  | { kind: "getSettings" }
  | { kind: "setSettings"; payload: Partial<ExtensionSettings> };

export type RuntimeResponse =
  | { ok: true; data: RedactResponse }
  | { ok: true; data: ExtensionSettings }
  | { ok: false; error: string };
