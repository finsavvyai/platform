interface CoverageThreshold {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface VitestConfigOptions {
  coverageThreshold?: Partial<CoverageThreshold>;
  globals?: boolean;
  environment?: 'node' | 'jsdom' | 'happy-dom';
}

interface VitestConfig {
  test: {
    environment: string;
    globals: boolean;
    coverage: {
      provider: string;
      reporter: string[];
      include: string[];
      exclude: string[];
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  };
}

const DEFAULT_COVERAGE: CoverageThreshold = {
  lines: 95,
  functions: 95,
  branches: 95,
  statements: 95,
};

export function createVitestConfig(
  opts?: VitestConfigOptions
): VitestConfig {
  const coverage = {
    ...DEFAULT_COVERAGE,
    ...opts?.coverageThreshold,
  };

  return {
    test: {
      environment: opts?.environment ?? 'node',
      globals: opts?.globals ?? true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src'],
        exclude: ['node_modules', 'dist'],
        lines: coverage.lines,
        functions: coverage.functions,
        branches: coverage.branches,
        statements: coverage.statements,
      },
    },
  };
}
