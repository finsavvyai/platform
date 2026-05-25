export interface GerritProject {
  id: string;
  ownerSub: string;
  host: string;
  project: string;
  httpUser: string;
  httpPasswordSet: boolean;
  webhookSecret: string;
  createdAt: string;
  pollEnabled?: boolean;
  pollIntervalSec?: number;
}

export interface NewProjectForm {
  host: string;
  project: string;
  httpUser: string;
  httpPassword: string;
  webhookSecret: string;
  pollEnabled: boolean;
  pollIntervalSec: number;
}

export const EMPTY_GERRIT_FORM: NewProjectForm = {
  host: '',
  project: '',
  httpUser: '',
  httpPassword: '',
  webhookSecret: '',
  pollEnabled: false,
  pollIntervalSec: 300,
};
