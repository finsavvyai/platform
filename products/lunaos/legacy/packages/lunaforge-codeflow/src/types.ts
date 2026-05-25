export interface CodeFlowRequest {
  entryFile: string;
  symbol?: string;
}

export interface CodeFlowStep {
  from: string;
  to: string;
  kind: "call" | "import" | "event" | "io";
}

export interface CodeFlowPath {
  steps: CodeFlowStep[];
}
