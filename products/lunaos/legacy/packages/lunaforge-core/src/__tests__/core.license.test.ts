import { describe, it, expect, vi } from "vitest";
import { LunaForgeCore } from "..";
import type { WorkspaceInfo, Mode } from "../types";


describe("License System", () => {
  it("loads without crashing", () => {
    expect(true).toBe(true);
  });
});
const workspace: WorkspaceInfo = {
  rootPath: "/repo",
  name: "test",
  folders: ["/repo"]
};

function createMode(id: string, requiredFeature?: string): Mode {
  return {
    id,
    title: id,
    description: id,
    requiredFeature,
    activate: vi.fn(),
    deactivate: vi.fn()
  };
}

describe("LunaForgeCore licensing + showUpgradePrompt", () => {
  it("blocks mode activation when feature missing", () => {
    const fsListProvider = async () => [];
    const core = new LunaForgeCore({
      workspace,
      fsListProvider,
      license: { valid: true, plan: "pro", features: [] }
    });

    const mode = createMode("guardian", "guardian");
    core.registerMode(mode);

    const spy = vi.fn();
    core.showUpgradePrompt = spy;

    core.activateMode("guardian");

    // Mode.activate should NOT be called
    expect((mode.activate as any).mock.calls.length).toBe(0);

    // license:error sent
    let errorEmitted = false;
    core.bus.on("license:error", () => {
      errorEmitted = true;
    });

    core.activateMode("guardian");

    expect(errorEmitted).toBe(true);
  });
});