export interface ContentSignal {
  name: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'warn' | 'fail';
  recommendation: string;
}

export interface AnalysisResult {
  url: string;
  overallScore: number;
  timestamp: string;
  signals: {
    structure: ContentSignal[];
    authority: ContentSignal[];
    aiReadiness: ContentSignal[];
    technical: ContentSignal[];
  };
  agentScores: AgentScore[];
  summary: string;
}

export interface AgentScore {
  agent: string;
  score: number;
  citationLikelihood: 'high' | 'medium' | 'low';
}

export interface LlmsTxtConfig {
  title: string;
  description: string;
  sections: LlmsTxtSection[];
}

export interface LlmsTxtSection {
  heading: string;
  links: LlmsTxtLink[];
}

export interface LlmsTxtLink {
  title: string;
  url: string;
  description: string;
}
