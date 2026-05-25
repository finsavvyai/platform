import { describe, it, expect, vi } from "vitest";
import { createTimeTravelMode } from "../index";
import type { ModeContext } from "lunaforge-core";

describe("TimeTravel Mode", () => {
    const mockProvider = {
        getRecentCommits: vi.fn().mockResolvedValue([
            { id: "c1", hash: "abc", message: "Initial commit", author: "Luna", timestamp: 1000 }
        ]),
        getFileHistory: vi.fn().mockResolvedValue([])
    };

    it("should activate and emit ready", async () => {
        const timetravel = createTimeTravelMode({ provider: mockProvider });
        const mockCtx = {
            emit: vi.fn(),
            license: {
                features: ["timetravel"]
            }
        } as unknown as ModeContext;

        await timetravel.activate(mockCtx);
        expect(mockCtx.emit).toHaveBeenCalledWith("timetravel:ready", expect.anything());
    });

    it("should list commits using provider", async () => {
        const timetravel = createTimeTravelMode({ provider: mockProvider });
        const mockCtx = {
            emit: vi.fn(),
            license: { features: ["timetravel"] }
        } as unknown as ModeContext;

        await timetravel.activate(mockCtx);
        await timetravel.listCommits();

        expect(mockProvider.getRecentCommits).toHaveBeenCalled();
        expect(mockCtx.emit).toHaveBeenCalledWith("timetravel:commits", expect.objectContaining({
            commits: expect.arrayContaining([
                expect.objectContaining({ id: "c1" })
            ])
        }));
    });
});
