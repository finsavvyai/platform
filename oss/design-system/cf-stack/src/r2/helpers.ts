import type { R2Bucket, R2Object } from '../bindings';

export async function r2Put(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array> | string,
  contentType?: string,
): Promise<R2Object> {
  const result = await bucket.put(key, body);
  if (contentType && result.httpMetadata) {
    result.httpMetadata.contentType = contentType;
  }
  return result;
}

export async function r2Get(
  bucket: R2Bucket,
  key: string,
): Promise<R2Object | null> {
  return bucket.get(key);
}

export async function r2Delete(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}

export async function r2List(
  bucket: R2Bucket,
  prefix: string,
): Promise<R2Object[]> {
  const result = await bucket.list({ prefix });
  return result.objects;
}
