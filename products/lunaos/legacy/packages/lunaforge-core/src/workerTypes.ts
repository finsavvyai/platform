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
