import { describe, it, expect, vi } from "vitest";
import { createGalaxyMode } from "../index";
import type { ModeContext, ProjectGraph } from "lunaforge-core";

describe("Galaxy Reactivity", () => {
    it("should emit galaxy:data on graph update", async () => {
        const galaxy = createGalaxyMode();
        const mockCtx = {
            emit: vi.fn(),
            license: {
                features: ["galaxy"]
            },
            graph: {
                files: [{ path: "file1.ts", size: 100 }],
                dependencies: []
            } as unknown as ProjectGraph
        } as unknown as ModeContext;

        // Activate
        await galaxy.activate!(mockCtx);
        expect(mockCtx.emit).toHaveBeenCalledWith("galaxy:ready", {});

        // Trigger Update
        const newGraph = {
            files: [
                { path: "file1.ts", size: 100 },
                { path: "file2.ts", size: 200 }
            ],
            dependencies: [{ from: "file1.ts", to: "file2.ts" }]
        } as unknown as ProjectGraph;

        await (galaxy as any).onGraphUpdate(mockCtx, newGraph);

        // Verify emission
        expect(mockCtx.emit).toHaveBeenCalledWith("galaxy:data", expect.objectContaining({
            nodes: expect.arrayContaining([
                expect.objectContaining({ id: "file2.ts" })
            ])
        }));
    });
});
