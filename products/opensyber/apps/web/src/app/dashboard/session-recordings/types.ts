export interface SessionCommand {
  timestamp: string;
  command: string;
  output?: string;
  dangerous?: boolean;
}

export interface SessionRecording {
  id: string;
  user: string;
  userEmail: string;
  sessionType: 'SSH' | 'Web' | 'API';
  target: string;
  duration: number;
  riskScore: number;
  status: 'active' | 'completed' | 'flagged';
  startedAt: string;
  commands: SessionCommand[];
}

export interface SessionStats {
  totalSessions: number;
  activeNow: number;
  flagged: number;
  avgDuration: number;
  byType: { ssh: number; web: number; api: number };
}
