import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import {
  createBrainNodeFetch,
  type BrainNodeDeps,
  type BrainNodeEnv,
} from "./node-host.js";

export interface BrainNodeServerOptions {
  readonly env?: BrainNodeEnv;
  readonly deps?: BrainNodeDeps;
  readonly host?: string;
  readonly port?: number;
}

const bodylessMethods = new Set(["GET", "HEAD"]);

const headerList = (headers: IncomingHttpHeaders): Headers => {
  const out = new Headers();
  for (const [key, raw] of Object.entries(headers)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) out.append(key, value);
    } else {
      out.set(key, raw);
    }
  }
  return out;
};

const readBody = async (req: IncomingMessage): Promise<Uint8Array | undefined> => {
  if (bodylessMethods.has(req.method ?? "GET")) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  if (chunks.length === 0) return undefined;
  return new Uint8Array(Buffer.concat(chunks));
};

const requestUrl = (req: IncomingMessage): string => {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = typeof protoHeader === "string" ? protoHeader : "http";
  const host = req.headers.host ?? "127.0.0.1";
  return new URL(req.url ?? "/", `${proto}://${host}`).toString();
};

const toFetchRequest = async (req: IncomingMessage): Promise<Request> => {
  const method = req.method ?? "GET";
  const body = await readBody(req);
  return new Request(requestUrl(req), {
    method,
    headers: headerList(req.headers),
    ...(body !== undefined ? { body } : {}),
  });
};

const writeFetchResponse = async (
  res: ServerResponse,
  fetchRes: Response,
): Promise<void> => {
  res.statusCode = fetchRes.status;
  res.statusMessage = fetchRes.statusText;
  fetchRes.headers.forEach((value, key) => res.setHeader(key, value));
  const body = Buffer.from(await fetchRes.arrayBuffer());
  res.end(body);
};

const writeError = (res: ServerResponse): void => {
  res.statusCode = 500;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: false, error: "brain_node_server_error" }));
};

export const createBrainNodeHttpServer = (
  options: BrainNodeServerOptions = {},
): Server => {
  const fetchBrain = createBrainNodeFetch(
    options.env ?? process.env,
    options.deps ?? {},
  );
  return createServer((req, res) => {
    void (async () => {
      try {
        const request = await toFetchRequest(req);
        const response = await fetchBrain(request);
        await writeFetchResponse(res, response);
      } catch {
        writeError(res);
      }
    })();
  });
};

export const resolveListenTarget = (
  options: BrainNodeServerOptions,
  env: NodeJS.ProcessEnv = process.env,
): { readonly host: string; readonly port: number } => ({
  host: options.host ?? env.HOST ?? "127.0.0.1",
  port: options.port ?? Number.parseInt(env.PORT ?? "8787", 10),
});

export const startBrainNodeServer = async (
  options: BrainNodeServerOptions = {},
): Promise<Server> => {
  const { host, port } = resolveListenTarget(options);
  const server = createBrainNodeHttpServer(options);
  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });
  return server;
};

export const renderListenAddress = (
  address: string | AddressInfo | null,
): string =>
  typeof address === "object" && address !== null
    ? `${address.address}:${address.port}`
    : String(address);

export interface BrainNodeCliIo {
  readonly start?: (options: BrainNodeServerOptions) => Promise<Server>;
  readonly log?: (line: string) => void;
  readonly error?: (line: string) => void;
}

export const runBrainNodeCli = async (
  options: BrainNodeServerOptions = {},
  io: BrainNodeCliIo = {},
): Promise<Server | undefined> => {
  // eslint-disable-next-line no-console
  const log = io.log ?? ((line: string) => console.log(line));
  // eslint-disable-next-line no-console
  const logError = io.error ?? ((line: string) => console.error(line));
  const start = io.start ?? startBrainNodeServer;
  try {
    const server = await start(options);
    log(JSON.stringify({
      event: "brain.node.started",
      address: renderListenAddress(server.address()),
    }));
    return server;
  } catch (err: unknown) {
    logError(JSON.stringify({
      event: "brain.node.start_failed",
      error: err instanceof Error ? err.message : "unknown",
    }));
    process.exitCode = 1;
    return undefined;
  }
};

const isEntrypoint = (): boolean =>
  process.argv[1] === fileURLToPath(import.meta.url);

if (isEntrypoint()) void runBrainNodeCli();
