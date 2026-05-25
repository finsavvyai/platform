export type DreamStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface DreamIntent {
  prompt: string;
  context?: string;
  files?: string[];
}

export interface DreamRunSummary {
  jobId?: string; // from schedule
  id?: string; // from status
  status: DreamStatus;
  intent?: DreamIntent;
  result?: {
    summary: string;
    files: Array<{ path: string; content: string }>;
  };
  createdAt?: number;
}
