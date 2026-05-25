// AWS CodePipeline client using SigV4 + JSON 1.1 protocol.
// No @aws-sdk — we POST raw JSON to codepipeline.${region}.amazonaws.com.

import { signRequest } from "./aws-sigv4";

export interface CodePipelineCreds {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

const TARGET_PREFIX = "CodePipeline_20150709";
const CONTENT_TYPE = "application/x-amz-json-1.1";

function endpoint(region: string): string {
  return `https://codepipeline.${region}.amazonaws.com/`;
}

async function call<T = unknown>(
  operation: string,
  payload: unknown,
  creds: CodePipelineCreds
): Promise<T> {
  const url = endpoint(creds.region);
  const body = JSON.stringify(payload ?? {});
  const headers: Record<string, string> = {
    "content-type": CONTENT_TYPE,
    "x-amz-target": `${TARGET_PREFIX}.${operation}`,
  };
  const signed = await signRequest("POST", url, headers, body, {
    region: creds.region,
    service: "codepipeline",
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  });

  const res = await fetch(url, { method: "POST", headers: signed, body });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CodePipeline ${operation} failed: ${res.status} ${text.slice(0, 400)}`);
  }
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export interface ListPipelinesResponse {
  pipelines?: Array<{
    name: string;
    version?: number;
    created?: number;
    updated?: number;
    pipelineType?: string;
  }>;
  nextToken?: string;
}

export async function listPipelines(
  creds: CodePipelineCreds
): Promise<ListPipelinesResponse> {
  return call<ListPipelinesResponse>("ListPipelines", {}, creds);
}

export interface StartPipelineExecutionResponse {
  pipelineExecutionId?: string;
}

export async function startPipelineExecution(
  name: string,
  creds: CodePipelineCreds,
  clientRequestToken?: string
): Promise<StartPipelineExecutionResponse> {
  const payload: Record<string, unknown> = { name };
  if (clientRequestToken) payload.clientRequestToken = clientRequestToken;
  return call<StartPipelineExecutionResponse>("StartPipelineExecution", payload, creds);
}

export interface GetPipelineExecutionResponse {
  pipelineExecution?: {
    pipelineName?: string;
    pipelineVersion?: number;
    pipelineExecutionId?: string;
    status?: string;
    statusSummary?: string;
    artifactRevisions?: unknown[];
  };
}

export async function getPipelineExecution(
  pipelineName: string,
  pipelineExecutionId: string,
  creds: CodePipelineCreds
): Promise<GetPipelineExecutionResponse> {
  return call<GetPipelineExecutionResponse>(
    "GetPipelineExecution",
    { pipelineName, pipelineExecutionId },
    creds
  );
}

export interface PipelineStageState {
  stageName?: string;
  inboundExecution?: { pipelineExecutionId?: string; status?: string };
  latestExecution?: { pipelineExecutionId?: string; status?: string };
  actionStates?: Array<{
    actionName?: string;
    latestExecution?: {
      status?: string;
      summary?: string;
      lastStatusChange?: number;
      externalExecutionId?: string;
    };
  }>;
}

export interface GetPipelineStateResponse {
  pipelineName?: string;
  pipelineVersion?: number;
  stageStates?: PipelineStageState[];
  created?: number;
  updated?: number;
}

export async function getPipelineState(
  name: string,
  creds: CodePipelineCreds
): Promise<GetPipelineStateResponse> {
  return call<GetPipelineStateResponse>("GetPipelineState", { name }, creds);
}

export interface ListPipelineExecutionsResponse {
  pipelineExecutionSummaries?: Array<{
    pipelineExecutionId?: string;
    status?: string;
    startTime?: number;
    lastUpdateTime?: number;
  }>;
  nextToken?: string;
}

export async function listPipelineExecutions(
  pipelineName: string,
  creds: CodePipelineCreds,
  maxResults = 10
): Promise<ListPipelineExecutionsResponse> {
  return call<ListPipelineExecutionsResponse>(
    "ListPipelineExecutions",
    { pipelineName, maxResults },
    creds
  );
}

export interface GetPipelineResponse {
  pipeline?: {
    name?: string;
    roleArn?: string;
    version?: number;
    stages?: Array<{ name?: string; actions?: unknown[] }>;
  };
  metadata?: unknown;
}

export async function getPipeline(
  name: string,
  creds: CodePipelineCreds
): Promise<GetPipelineResponse> {
  return call<GetPipelineResponse>("GetPipeline", { name }, creds);
}
