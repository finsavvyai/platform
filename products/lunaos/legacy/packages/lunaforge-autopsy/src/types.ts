export interface AutopsyInput {
  errorMessage?: string;
  stackTrace?: string;
  file?: string;
  line?: number;
  logs?: string[];
}

export interface AutopsyFinding {
  id: string;
  category: "root-cause" | "suspicious" | "context";
  message: string;
  file?: string;
  line?: number;
}

export interface AutopsyReport {
  summary: string;
  timeline?: string;
  findings: AutopsyFinding[];
}
 