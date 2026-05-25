interface CompilerOptions {
  target: string;
  module: string;
  lib: string[];
  moduleResolution: string;
  declaration: boolean;
  declarationMap: boolean;
  sourceMap: boolean;
  outDir: string;
  rootDir: string;
  strict: boolean;
  esModuleInterop: boolean;
  skipLibCheck: boolean;
  forceConsistentCasingInFileNames: boolean;
  resolveJsonModule: boolean;
  isolatedModules: boolean;
  allowJs: boolean;
}

interface TsConfig {
  compilerOptions: CompilerOptions;
  include: string[];
  exclude: string[];
}

export function getTsConfigPreset(): TsConfig {
  return {
    compilerOptions: {
      target: 'ES2020',
      module: 'ES2020',
      lib: ['ES2020'],
      moduleResolution: 'node',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      allowJs: false,
    },
    include: ['src'],
    exclude: ['node_modules', 'dist', 'tests'],
  };
}
