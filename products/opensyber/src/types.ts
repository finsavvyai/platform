/** Core security monitoring types for OpenSyber */

export interface AgentBehavior {
  agentId: string;
  timestamp: Date;
  actionType: string;
  resourcePath: string;
  status: string;
  metadata: Record<string, unknown>;
}

export interface AnomalyAlert {
  id: string;
  agentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface SecurityEvent {
  id: string;
  type: string;
  agentId: string;
  action: string;
  timestamp: Date;
  userId?: string;
  context?: Record<string, unknown>;
}
