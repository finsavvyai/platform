import { describe, it, expect, vi } from "vitest";
import { LunaForgeCore } from "..";
import type { WorkspaceInfo } from "../types";

describe("LunaForgeCore graph building", () => {
  const workspace: WorkspaceInfo = {
    rootPath: "/repo",
    name: "test",
    folders: ["/repo"]
  };

  it("builds graph once and caches it", async () => {
    const fsListProvider = vi.fn().mockResolvedValue([
      "/repo/src/a.ts",
      "/repo/src/b.ts"
    ]);

    const core = new LunaForgeCore({
      workspace,
      fsListProvider
    });

    const g1 = await core.ensureGraph();
    const g2 = await core.ensureGraph();

    expect(fsListProvider).toHaveBeenCalledTimes(1);
    expect(g1).toBe(g2);
    expect(g1.files.length).toBeGreaterThan(0);
  });

  it("refresh() invalidates cache and rebuilds", async () => {
    const fsListProvider = vi
      .fn()
      .mockResolvedValueOnce(["/repo/src/a.ts"])
      .mockResolvedValueOnce(["/repo/src/a.ts", "/repo/src/b.ts"]);

    const core = new LunaForgeCore({
      workspace,
      fsListProvider
    });

    const g1 = await core.ensureGraph();
    expect(g1.files.length).toBe(1);

    await core.refresh();
    const g2 = await core.ensureGraph();
    expect(g2.files.length).toBe(2);
  });
});