import type { KVNamespace, KVNamespaceOptions } from '../bindings';

export async function kvGet<T = unknown>(
  kv: KVNamespace,
  key: string,
): Promise<T | null> {
  const value = await kv.get(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export async function kvSet<T = unknown>(
  kv: KVNamespace,
  key: string,
  value: T,
  ttl?: number,
): Promise<void> {
  const serialized = typeof value === 'string' ?
    value :
    JSON.stringify(value);

  const options: KVNamespaceOptions = {};
  if (ttl) {
    options.expirationTtl = ttl;
  }

  await kv.put(key, serialized, options);
}

export async function kvDelete(
  kv: KVNamespace,
  key: string,
): Promise<void> {
  await kv.delete(key);
}

export async function kvList(
  kv: KVNamespace,
  prefix: string,
): Promise<string[]> {
  const result = await kv.list({ prefix });
  return result.keys.map((k) => k.name);
}
