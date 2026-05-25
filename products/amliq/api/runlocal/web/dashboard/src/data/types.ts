export type RunStatus = 'passed' | 'failed' | 'running';

export interface Check {
  name: string;
  status: RunStatus;
  duration: string;
  output: string;
}

export interface CIRun {
  id: string;
  repo: string;
  branch: string;
  commitSha: string;
  commitMsg: string;
  status: RunStatus;
  duration: string;
  timestamp: string;
  checks: Check[];
}

export type Platform = 'github' | 'gitlab' | 'bitbucket';

export interface Project {
  id: string;
  repo: string;
  platform: Platform;
  lastRunStatus: RunStatus;
  connectedDate: string;
  url: string;
}

export interface EnvVar {
  key: string;
  value: string;
}
