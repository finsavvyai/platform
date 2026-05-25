export interface CommitInfo {
  id: string;
  author: string;
  message: string;
  timestamp: string;
}

export interface FileHistoryRequest {
  filePath: string;
}

export interface FileHistoryEntry {
  commitId: string;
  author: string;
  message: string;
  timestamp: string;
  diffSummary?: string;
}
