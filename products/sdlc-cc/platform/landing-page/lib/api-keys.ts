import { getOptionalCloudflareRequestContext } from "./cloudflare-request-context";

const API_KEY_PREFIX = "api_keys:v1:";
const API_KEY_ID_PATTERN = /^key_[a-z0-9-]+$/i;

export type ApiKeySummary = {
  id: string;
  keyPreview: string;
  createdAt: string;
  status: "active";
};

export type CreatedApiKey = ApiKeySummary & {
  key: string;
};

type StoredApiKeyRecord = ApiKeySummary & {
  userId: string;
  keyHash: string;
};

export class ApiKeyStoreUnavailableError extends Error {
  constructor() {
    super("API key storage is not configured for this environment");
    this.name = "ApiKeyStoreUnavailableError";
  }
}

export class ApiKeyNotFoundError extends Error {
  constructor() {
    super("API key not found");
    this.name = "ApiKeyNotFoundError";
  }
}

export class ApiKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyValidationError";
  }
}

const getApiKeysNamespace = () => {
  const context = getOptionalCloudflareRequestContext();
  const namespace = context?.env.API_KEYS_KV ?? context?.env.CACHE_KV;

  if (!namespace) {
    throw new ApiKeyStoreUnavailableError();
  }

  return namespace;
};

const normalizeUserId = (userId: string) => {
  const value = userId.trim();

  if (!value) {
    throw new ApiKeyValidationError("A valid user id is required");
  }

  return value;
};

const normalizeKeyId = (keyId: string) => {
  const value = keyId.trim();

  if (!API_KEY_ID_PATTERN.test(value)) {
    throw new ApiKeyValidationError("Invalid API key id");
  }

  return value;
};

const getRecordKey = (userId: string, keyId: string) =>
  `${API_KEY_PREFIX}user:${userId}:${keyId}`;

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const generateApiKeyValue = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `sk-sdlc-live-${bytesToHex(bytes)}`;
};

const maskApiKey = (apiKey: string) =>
  `${apiKey.slice(0, 16)}...${apiKey.slice(-6)}`;

const hashApiKey = async (apiKey: string) => {
  const encoded = new TextEncoder().encode(apiKey);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
};

const isStoredApiKeyRecord = (value: unknown): value is StoredApiKeyRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredApiKeyRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.keyHash === "string" &&
    typeof candidate.keyPreview === "string" &&
    typeof candidate.createdAt === "string" &&
    candidate.status === "active"
  );
};

const toApiKeySummary = (record: StoredApiKeyRecord): ApiKeySummary => ({
  id: record.id,
  keyPreview: record.keyPreview,
  createdAt: record.createdAt,
  status: record.status,
});

export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const normalizedUserId = normalizeUserId(userId);
  const kv = getApiKeysNamespace();
  const prefix = `${API_KEY_PREFIX}user:${normalizedUserId}:`;
  const { keys } = await kv.list({ prefix });

  if (keys.length === 0) {
    return [];
  }

  const records = await Promise.all(
    keys.map(({ name }) => kv.get(name, "json")),
  );

  return records
    .filter(isStoredApiKeyRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(toApiKeySummary);
}

export async function createApiKey(userId: string): Promise<CreatedApiKey> {
  const normalizedUserId = normalizeUserId(userId);
  const kv = getApiKeysNamespace();
  const key = generateApiKeyValue();
  const id = `key_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const storedRecord: StoredApiKeyRecord = {
    id,
    userId: normalizedUserId,
    keyHash: await hashApiKey(key),
    keyPreview: maskApiKey(key),
    createdAt,
    status: "active",
  };

  await kv.put(getRecordKey(normalizedUserId, id), JSON.stringify(storedRecord));

  return {
    ...toApiKeySummary(storedRecord),
    key,
  };
}

export async function deleteApiKey(userId: string, keyId: string) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedKeyId = normalizeKeyId(keyId);
  const kv = getApiKeysNamespace();
  const recordKey = getRecordKey(normalizedUserId, normalizedKeyId);
  const existingRecord = await kv.get(recordKey, "json");

  if (!isStoredApiKeyRecord(existingRecord) || existingRecord.userId !== normalizedUserId) {
    throw new ApiKeyNotFoundError();
  }

  await kv.delete(recordKey);
}
