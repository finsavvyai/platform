import { mkdir, appendFile as nodeAppendFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createBrainWorkerFetch,
  type BrainWorkerDeps,
  type BrainWorkerEnv,
} from "./worker.js";

export interface BrainNodeEnv extends Omit<BrainWorkerEnv, "AUDIT_LOG_BUCKET"> {
  readonly BRAIN_AUDIT_LOG_PATH?: string;
}

export type AuditLogWriter = (line: string) => void | Promise<void>;

export interface BrainNodeDeps extends BrainWorkerDeps {
  readonly auditLogWriter?: AuditLogWriter;
  readonly appendFile?: typeof nodeAppendFile;
  readonly ensureDir?: typeof mkdir;
  readonly stdoutWrite?: (line: string) => void;
}

const toJsonLine = (value: unknown): string => `${JSON.stringify(value)}\n`;

const createFileWriter = (
  path: string,
  deps: BrainNodeDeps,
): AuditLogWriter => async (line) => {
  const ensureDir = deps.ensureDir ?? mkdir;
  const appendFile = deps.appendFile ?? nodeAppendFile;
  await ensureDir(dirname(path), { recursive: true });
  await appendFile(path, line, "utf8");
};

const createStdoutWriter = (deps: BrainNodeDeps): AuditLogWriter => {
  const write = deps.stdoutWrite ?? ((line) => process.stdout.write(line));
  return (line) => write(line);
};

const auditWriter = (
  env: BrainNodeEnv,
  deps: BrainNodeDeps,
): AuditLogWriter => {
  if (deps.auditLogWriter !== undefined) return deps.auditLogWriter;
  if (env.BRAIN_AUDIT_LOG_PATH) return createFileWriter(env.BRAIN_AUDIT_LOG_PATH, deps);
  return createStdoutWriter(deps);
};

export const createBrainNodeAuditBucket = (
  env: BrainNodeEnv,
  deps: BrainNodeDeps = {},
): NonNullable<BrainWorkerEnv["AUDIT_LOG_BUCKET"]> => {
  const write = auditWriter(env, deps);
  return {
    put: async (key, value) => {
      await write(toJsonLine({ key, record: JSON.parse(value) }));
    },
  };
};

export const createBrainNodeFetch = (
  env: BrainNodeEnv,
  deps: BrainNodeDeps = {},
): ((request: Request) => Promise<Response>) => {
  const workerEnv: BrainWorkerEnv = {
    ...env,
    AUDIT_LOG_BUCKET: createBrainNodeAuditBucket(env, deps),
  };
  return createBrainWorkerFetch(workerEnv, deps);
};
