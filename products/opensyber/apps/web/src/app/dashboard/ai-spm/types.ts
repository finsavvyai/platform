export type AIModelType = 'llm' | 'agent' | 'embedding' | 'fine-tuned';
export type AIModelStatus = 'active' | 'inactive' | 'monitoring';

export interface AIModel {
  id: string;
  name: string;
  type: AIModelType;
  provider: string;
  version: string;
  status: AIModelStatus;
  riskScore: number;
  dataAccess: string[];
  permissions: string[];
  lastActivity: string;
  promptInjectionTests: { passed: number; failed: number };
  sensitiveDataExposure: boolean;
  complianceFlags: string[];
}
