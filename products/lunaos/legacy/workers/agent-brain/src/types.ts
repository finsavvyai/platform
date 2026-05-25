export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
}

export interface AgentPlan {
  id: string;
  createdAt: string;
  summary: string;
  target: string;
  steps: PlanStep[];
}

export interface MythicStory {
  title: string;
  text: string;
}

export interface MythicModelOutputFile {
  path: string;
  content: string;
}

export interface MythicModelOutput {
  architecture: string;
  diagram: string;
  files: MythicModelOutputFile[];
}

export interface AnalysisRequest {
  target: string;
  context?: string;
  history?: string[];
}

export interface LLMResponse {
  analysis: string;
  recommendations: string[];
  diagram?: string;
  files?: MythicModelOutputFile[];
  prediction?: string; // For Prophecy
  simulations?: any[]; // For Parallel Universe
}

export interface MemoryRequest {
  key: string;
  value?: any;
  scope?: string;
}

export interface LicenseRequest {
  key: string;
}

