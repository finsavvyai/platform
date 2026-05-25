interface Browser {
  name: 'chromium' | 'firefox' | 'webkit';
  use?: Record<string, unknown>;
}

interface PlaywrightCommonOptions {
  baseURL?: string;
  timeout?: number;
}

export interface PlaywrightConfigOptions {
  baseURL?: string;
  timeout?: number;
}

interface PlaywrightConfig {
  use: PlaywrightCommonOptions;
  webServer?: {
    command: string;
    url: string;
    reuseExistingServer: boolean;
  };
  projects: Array<{ name: string; use: { browserName: string } }>;
  testDir: string;
}

export function createPlaywrightConfig(
  opts?: PlaywrightConfigOptions
): PlaywrightConfig {
  const baseURL = opts?.baseURL ?? 'http://localhost:3000';
  const timeout = opts?.timeout ?? 30000;

  return {
    use: {
      baseURL,
      timeout,
    },
    testDir: 'tests',
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
      {
        name: 'firefox',
        use: { browserName: 'firefox' },
      },
      {
        name: 'webkit',
        use: { browserName: 'webkit' },
      },
    ],
  };
}
