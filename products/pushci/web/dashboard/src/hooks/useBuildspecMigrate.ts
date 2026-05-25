// Typed client for POST /api/migrate/buildspec.
// Converts an AWS CodeBuild buildspec.yml into a .pushci.yml draft and
// reports any warnings or environment variables the user still needs
// to provide as `pushci secret set` entries. The backend route is being
// built in parallel; when absent the caller can inject `migrateFn` for
// tests. No pasted YAML content is logged — avoid leaking user input.

import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../config';

export interface BuildspecEnvVar {
  readonly name: string;
  readonly suggestion: string;
}

export interface BuildspecMigrateResponse {
  readonly pushciYaml: string;
  readonly warnings: string[];
  readonly envVarsNeeded: BuildspecEnvVar[];
}

export type BuildspecMigrateFn = (
  yaml: string,
) => Promise<BuildspecMigrateResponse>;

async function defaultMigrate(
  yaml: string,
): Promise<BuildspecMigrateResponse> {
  const token = localStorage.getItem('pushci_token');
  const res = await fetch(`${API_BASE_URL}/api/migrate/buildspec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ yaml }),
  });
  if (!res.ok) {
    // Do not echo the pasted yaml back in the error — keep user content private.
    throw new Error(`buildspec migration failed (${res.status})`);
  }
  const json = (await res.json()) as Partial<BuildspecMigrateResponse>;
  return {
    pushciYaml: typeof json.pushciYaml === 'string' ? json.pushciYaml : '',
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
    envVarsNeeded: Array.isArray(json.envVarsNeeded) ? json.envVarsNeeded : [],
  };
}

export interface UseBuildspecMigrateResult {
  readonly result: BuildspecMigrateResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly migrate: (yaml: string) => Promise<void>;
  readonly reset: () => void;
}

export function useBuildspecMigrate(
  migrateFn: BuildspecMigrateFn = defaultMigrate,
): UseBuildspecMigrateResult {
  const [result, setResult] = useState<BuildspecMigrateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const migrate = useCallback(
    async (yaml: string) => {
      const trimmed = yaml.trim();
      if (!trimmed) {
        setError('Paste a buildspec.yml to convert.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setResult(await migrateFn(trimmed));
      } catch (e) {
        setResult(null);
        setError(e instanceof Error ? e.message : 'Migration failed');
      } finally {
        setLoading(false);
      }
    },
    [migrateFn],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { result, loading, error, migrate, reset };
}
