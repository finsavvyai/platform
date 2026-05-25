import { describe, it, expect, vi } from "vitest";
import { createGuardianMode } from "../index";
import type { ModeContext, ProjectGraph } from "lunaforge-core";

describe("Guardian Reactivity", () => {
    it("should detect violations on graph update", async () => {
        const rules = [
            {
                id: "rule1",
                name: "No Deps",
                description: "Test rule",
                fromPattern: "src/ui/**",
                toPattern: "src/core/**",
                effect: "deny" as const
            }
        ];
        const guardian = createGuardianMode({ rules });
        const mockCtx = {
            emit: vi.fn(),
            license: {
                features: ["guardian"]
            },
            graph: {
                dependencies: [
                    { from: "src/ui/Button.ts", to: "src/core/Bus.ts" }
                ]
            } as unknown as ProjectGraph
        } as unknown as ModeContext;

        // Activate
        await guardian.activate!(mockCtx);
        expect(mockCtx.emit).toHaveBeenCalledWith("guardian:violations", expect.objectContaining({
            violations: expect.arrayContaining([
                expect.objectContaining({ ruleId: "rule1" })
            ])
        }));

        // Trigger Update with NO violations
        const cleanGraph = {
            dependencies: [
                { from: "src/ui/Button.ts", to: "src/ui/Theme.ts" }
            ]
        } as unknown as ProjectGraph;

        (mockCtx.emit as any).mockClear();
        await (guardian as any).onGraphUpdate(mockCtx, cleanGraph);

        // Verify emission shows 0 violations
        expect(mockCtx.emit).toHaveBeenCalledWith("guardian:summary", { violationCount: 0 });
        expect(mockCtx.emit).not.toHaveBeenCalledWith("guardian:violations", expect.anything());
    });

    it("should update rules dynamically via setConfig", async () => {
        const guardian = createGuardianMode({ rules: [] });
        const mockCtx = {
            emit: vi.fn(),
            license: {
                features: ["guardian"]
            },
            graph: {
                dependencies: [
                    { from: "src/ui/Button.ts", to: "src/core/Bus.ts" }
                ]
            } as unknown as ProjectGraph
        } as unknown as ModeContext;

        await guardian.activate!(mockCtx);
        expect(mockCtx.emit).toHaveBeenCalledWith("guardian:summary", { violationCount: 0 });

        // Update config
        (mockCtx.emit as any).mockClear();
        guardian.setConfig({
            rules: [
                {
                    id: "rule1",
                    name: "No Deps",
                    description: "Test rule",
                    fromPattern: "src/ui/**",
                    toPattern: "src/core/**",
                    effect: "deny" as const
                }
            ]
        });

        // Verify detection
        expect(mockCtx.emit).toHaveBeenCalledWith("guardian:violations", expect.anything());
    });
});
