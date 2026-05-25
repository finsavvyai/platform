import type { EnhancedMode, ModeContext, ProjectGraph } from "lunaforge-core";
import { ensureLicense } from "lunaforge-core";

import type {
  CommitInfo,
  FileHistoryRequest,
  FileHistoryEntry
} from "./types";

export interface GitProvider {
  getRecentCommits(): Promise<CommitInfo[]>;
  getFileHistory(filePath: string): Promise<FileHistoryEntry[]>;
}

export interface TimeTravelConfig {
  provider: GitProvider;
}

export interface TimeTravelAPI {
  listCommits(): Promise<void>;
  fileHistory(req: FileHistoryRequest): Promise<void>;
}

export function createTimeTravelMode(config: TimeTravelConfig): EnhancedMode & TimeTravelAPI {
  let ctxRef: ModeContext | null = null;

  async function listCommits(): Promise<void> {
    if (!ctxRef) return;

    try {
      const commits = await config.provider.getRecentCommits();
      ctxRef.emit("timetravel:commits", {
        type: "timetravel:commits",
        commits
      });
    } catch (error) {
      ctxRef.emit("timetravel:error", { error: "Failed to list commits" });
    }
  }

  async function fileHistory(req: FileHistoryRequest): Promise<void> {
    if (!ctxRef) return;

    try {
      const history = await config.provider.getFileHistory(req.filePath);
      ctxRef.emit("timetravel:fileHistory", {
        type: "timetravel:fileHistory",
        request: req,
        history
      });
    } catch (error) {
      ctxRef.emit("timetravel:error", { error: `Failed to get history for ${req.filePath}` });
    }
  }

  return {
    id: "timetravel",
    title: "TimeTravel",
    description: "Surfaces commit timelines and per-file history.",
    version: "0.2.0",
    author: "LunaForge",
    tags: ["git", "history", "timeline"],
    priority: 8,
    requiredFeature: "timetravel",

    async activate(ctx: ModeContext) {
      if (!ensureLicense(ctx, "timetravel")) return;

      ctxRef = ctx;
      ctx.emit("timetravel:ready", {
        type: "timetravel:ready"
      });
      listCommits();
    },

    async deactivate() {
      ctxRef = null;
    },

    async onGraphUpdate(ctx: ModeContext, graph: ProjectGraph) {
      ctxRef = ctx;
      // Optionally refresh commits here if git changed
    },

    listCommits,
    fileHistory
  };
}

export * from "./types";