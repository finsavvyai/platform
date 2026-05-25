/**
 * Type definitions for the ClawPipe Vercel AI SDK provider.
 */

/** Configuration for creating a ClawPipe provider instance. */
export interface ClawPipeProviderConfig {
  /** ClawPipe API key (e.g. 'cp_xxx'). */
  apiKey: string;
  /** ClawPipe project ID. Defaults to 'default'. */
  projectId?: string;
  /** Custom gateway URL. Defaults to ClawPipe cloud gateway. */
  gatewayUrl?: string;
  /** Enable ClawPipe booster stage. Default: true. */
  enableBooster?: boolean;
  /** Enable ClawPipe packer stage. Default: true. */
  enablePacker?: boolean;
  /** Enable ClawPipe cache stage. Default: true. */
  enableCache?: boolean;
}

/** Internal settings passed to the language model. */
export interface ClawPipeModelSettings {
  /** The model ID. 'auto' lets ClawPipe route automatically. */
  modelId: string;
  /** ClawPipe SDK instance config. */
  providerConfig: ClawPipeProviderConfig;
}

/** Metadata attached to ClawPipe responses. */
export interface ClawPipeResponseMeta {
  boosted: boolean;
  cached: boolean;
  packed: boolean;
  contextSavings: string;
  route: string;
  model: string;
  latencyMs: number;
  estimatedCostUsd: number;
}
