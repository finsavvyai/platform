import type { BrainApp } from "./server.js";
import { createBrainApp } from "./server.js";
import {
  createHttpSarDraftGenerator,
  type HttpSarDraftGeneratorOptions,
} from "./sar-draft/index.js";
import {
  createHttpSearchAdapter,
  type HttpSearchAdapterOptions,
} from "./search/index.js";
import type { BrainApiConfig } from "./types.js";

export interface BrainHostConfig extends Omit<BrainApiConfig, "sarDraft" | "search"> {
  readonly search?: BrainApiConfig["search"];
  readonly searchRuntime?: HttpSearchAdapterOptions & {
    readonly defaultTopK?: number;
    readonly maxTopK?: number;
  };
  readonly sarDraft?: BrainApiConfig["sarDraft"];
  readonly sarDraftRuntime?: HttpSarDraftGeneratorOptions;
}

const sarDraftConfig = (
  cfg: BrainHostConfig,
): BrainApiConfig["sarDraft"] | undefined => {
  if (cfg.sarDraft !== undefined && cfg.sarDraftRuntime !== undefined) {
    throw new Error("brain.host.sar_draft.ambiguous");
  }
  if (cfg.sarDraft !== undefined) return cfg.sarDraft;
  if (cfg.sarDraftRuntime !== undefined) {
    return { generator: createHttpSarDraftGenerator(cfg.sarDraftRuntime) };
  }
  return undefined;
};

const searchConfig = (
  cfg: BrainHostConfig,
): BrainApiConfig["search"] | undefined => {
  if (cfg.search !== undefined && cfg.searchRuntime !== undefined) {
    throw new Error("brain.host.search.ambiguous");
  }
  if (cfg.search !== undefined) return cfg.search;
  if (cfg.searchRuntime !== undefined) {
    return {
      adapter: createHttpSearchAdapter(cfg.searchRuntime),
      ...(cfg.searchRuntime.defaultTopK !== undefined
        ? { defaultTopK: cfg.searchRuntime.defaultTopK }
        : {}),
      ...(cfg.searchRuntime.maxTopK !== undefined
        ? { maxTopK: cfg.searchRuntime.maxTopK }
        : {}),
    };
  }
  return undefined;
};

export const createBrainHostApp = (cfg: BrainHostConfig): BrainApp => {
  const {
    sarDraftRuntime: _runtime,
    sarDraft: _draft,
    searchRuntime: _searchRuntime,
    search: _search,
    ...base
  } = cfg;
  const sarDraft = sarDraftConfig(cfg);
  const search = searchConfig(cfg);
  return createBrainApp({
    ...base,
    ...(search !== undefined ? { search } : {}),
    ...(sarDraft !== undefined ? { sarDraft } : {}),
  });
};
