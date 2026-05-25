import type { Context } from 'hono';

export interface Env {
  D1Database?: D1Database;
  [key: string]: D1Database | KVNamespace | R2Bucket | string | undefined;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

export interface D1Result<T = unknown> {
  success: boolean;
  results?: T[];
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVNamespaceOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult>;
}

export interface KVNamespaceOptions {
  expirationTtl?: number;
}

export interface KVNamespaceListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface KVNamespaceListResult {
  keys: KVNamespaceKey[];
  list_complete: boolean;
  cursor?: string;
}

export interface KVNamespaceKey {
  name: string;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, body: ReadableStream<Uint8Array> | string): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: R2HTTPMetadata;
}

export interface R2HTTPMetadata {
  contentType?: string;
}

export interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

export function getD1(c: Context, name: string): D1Database {
  const db = c.env?.[name] as D1Database | undefined;
  if (!db) {
    throw new Error(`D1 database "${name}" not found in Env`);
  }
  return db;
}

export function getKV(c: Context, name: string): KVNamespace {
  const kv = c.env?.[name] as KVNamespace | undefined;
  if (!kv) {
    throw new Error(`KV namespace "${name}" not found in Env`);
  }
  return kv;
}

export function getR2(c: Context, name: string): R2Bucket {
  const bucket = c.env?.[name] as R2Bucket | undefined;
  if (!bucket) {
    throw new Error(`R2 bucket "${name}" not found in Env`);
  }
  return bucket;
}
