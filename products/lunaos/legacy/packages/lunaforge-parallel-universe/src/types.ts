export interface UniverseRequest {
  code: string;
  languages: string[];
}

export interface UniverseVariant {
  language: string;
  code: string;
}

export interface UniverseResponse {
  variants: UniverseVariant[];
}
