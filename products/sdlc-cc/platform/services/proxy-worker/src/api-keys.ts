export interface ApiKeyRecord {
  id: string;
  user_id: string;
  status: string;
  plan?: string;
  expires_at?: string;
  project_id?: string;
  adapter?: string;
  allowed_models?: string[];
  tool_policy?: string;
}

export function isApiKeyRecord(value: unknown): value is ApiKeyRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiKeyRecord>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.user_id === 'string' &&
    typeof candidate.status === 'string' &&
    (candidate.plan === undefined || typeof candidate.plan === 'string') &&
    (candidate.expires_at === undefined || typeof candidate.expires_at === 'string') &&
    (candidate.project_id === undefined || typeof candidate.project_id === 'string') &&
    (candidate.adapter === undefined || typeof candidate.adapter === 'string') &&
    (candidate.tool_policy === undefined || typeof candidate.tool_policy === 'string') &&
    (candidate.allowed_models === undefined ||
      (Array.isArray(candidate.allowed_models) &&
        candidate.allowed_models.every((model) => typeof model === 'string')))
  );
}
