// Static configuration + shared API helper for MigrationWizardPage.
// Extracted to keep the page component within the 200-line cap.
import { API_BASE_URL } from '../config';

export type SourceId = 'jenkins' | 'gerrit' | 'aws-codepipeline' | 'pushci';

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

export interface SourceOption {
  id: SourceId;
  name: string;
  description: string;
  endpoint: string;
  credentialFields: CredentialField[];
}

export const sources: SourceOption[] = [
  {
    id: 'jenkins',
    name: 'Jenkins',
    endpoint: '/api/jenkins/import',
    description: 'Import a Jenkinsfile or job and convert it to a .pushci.yml draft.',
    credentialFields: [
      { key: 'url', label: 'Jenkins URL', placeholder: 'https://jenkins.acme.eu' },
      { key: 'username', label: 'Username', placeholder: 'ci-admin' },
      { key: 'apiToken', label: 'API token', placeholder: '11a...', type: 'password' },
      { key: 'job', label: 'Job name', placeholder: 'core-service/main' },
    ],
  },
  {
    id: 'gerrit',
    name: 'Gerrit',
    endpoint: '/api/gerrit/projects',
    description: 'Connect to a Gerrit instance and import project configuration.',
    credentialFields: [
      { key: 'url', label: 'Gerrit URL', placeholder: 'https://gerrit.acme.eu' },
      { key: 'username', label: 'HTTP username', placeholder: 'ci-bot' },
      { key: 'httpPassword', label: 'HTTP password', placeholder: '', type: 'password' },
      { key: 'project', label: 'Project name', placeholder: 'core/service' },
    ],
  },
  {
    id: 'aws-codepipeline',
    name: 'AWS CodePipeline',
    endpoint: '/api/aws/credentials',
    description: 'Assume an IAM role and import a CodePipeline definition.',
    credentialFields: [
      { key: 'roleArn', label: 'IAM role ARN', placeholder: 'arn:aws:iam::123:role/pushci' },
      { key: 'region', label: 'AWS region', placeholder: 'eu-west-1' },
      { key: 'pipelineName', label: 'Pipeline name', placeholder: 'core-service-prod' },
      { key: 'externalId', label: 'External ID (optional)', placeholder: 'pushci-norlys' },
    ],
  },
  {
    id: 'pushci',
    name: 'Existing PushCI project',
    endpoint: '/api/projects',
    description: 'Clone the .pushci.yml from an existing PushCI project as a starting point.',
    credentialFields: [
      { key: 'sourceProjectId', label: 'Source project ID', placeholder: 'prj_01H...' },
    ],
  },
];

export const STEPS = [
  { id: 1, label: 'Source' },
  { id: 2, label: 'Credentials' },
  { id: 3, label: 'Preview' },
  { id: 4, label: 'Create' },
];

export const SAMPLE_YAML = `# .pushci.yml generated from imported source
version: 1
stack: java-maven
cache:
  - ~/.m2/repository
steps:
  - name: build
    run: mvn -B -ntp clean verify
  - name: test
    run: mvn -B -ntp test
  - name: package
    run: mvn -B -ntp package -DskipTests
deploy:
  target: aws-codepipeline
  approvals:
    - environment: production
      required: 2
`;

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('pushci_token');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
