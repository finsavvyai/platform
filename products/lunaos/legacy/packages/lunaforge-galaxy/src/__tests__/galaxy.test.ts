import { describe, it, expect, vi } from "vitest";
import { createGalaxyMode } from "..";
import type { ModeContext, ProjectGraph } from "lunaforge-core";

function mockCtx(graph?: ProjectGraph): ModeContext {
  return {
    workspace: {
      rootPath: "/repo",
      name: "test",
      folders: ["/repo"]
    },
    graph: graph ?? null,
    license: { valid: true, plan: "pro", features: ["galaxy"] },
    emit: vi.fn()
  };
}

describe("GalaxyMode", () => {
  it("emits galaxy:data with nodes and edges", async () => {
    const mode = createGalaxyMode();

    const graph: ProjectGraph = {
      files: [
        { path: "src/a.ts", size: 10, kind: "file" },
        { path: "src/b.ts", size: 20, kind: "file" }
      ],
      dependencies: [{ from: "src/a.ts", to: "src/b.ts", kind: "import" }]
    };

    const ctx = mockCtx(graph);
    mode.activate(ctx);

    // open triggers emit
    await mode.open();

    const emit = ctx.emit as any;
    const calls = emit.mock.calls.filter(
      (c: any[]) => c[0] === "galaxy:data"
    );
    expect(calls.length).toBe(1);

    const payload = calls[0][1];
    expect(payload.nodes).toHaveLength(2);
    expect(payload.edges).toHaveLength(1);
  });

  it("does not activate if license missing", async () => {
    const mode = createGalaxyMode();
    const ctx: ModeContext = {
      workspace: {
        rootPath: "/repo",
        name: "test",
        folders: ["/repo"]
      },
      graph: null,
      license: { valid: true, plan: "free", features: [] },
      emit: vi.fn()
    };

    mode.activate(ctx);
    await mode.open();

    const emit = ctx.emit as any;
    const calls = emit.mock.calls.filter(
      (c: any[]) => c[0] === "galaxy:data"
    );

    expect(calls.length).toBe(0);
  });
});