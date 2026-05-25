export interface WranglerOptions {
  accountId: string;
  projectName: string;
  environment?: string;
  d1Databases?: D1Binding[];
  kvNamespaces?: KVBinding[];
  r2Buckets?: R2Binding[];
  vars?: Record<string, string>;
  routes?: RouteBinding[];
  queues?: QueueBinding[];
}

export interface D1Binding {
  name: string;
  databaseId: string;
}

export interface KVBinding {
  name: string;
  id: string;
  preview?: string;
}

export interface R2Binding {
  name: string;
  bucketName: string;
  preview?: string;
}

export interface RouteBinding {
  pattern: string;
  zone?: string;
}

export interface QueueBinding {
  name: string;
  queue: string;
}

export interface DeploymentResult {
  success: boolean;
  projectName: string;
  timestamp: string;
  environment?: string;
  error?: string;
}

export interface QueueMessage {
  body: unknown;
  timestamp?: number;
  id?: string;
}
