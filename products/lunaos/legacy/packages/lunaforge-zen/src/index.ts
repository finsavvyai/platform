import {
    EnhancedMode,
    ModeContext,
    ensureLicense,
    createModeLifecycle,
    ProjectGraph
} from "lunaforge-core";
import { ZenAPI, ZenState } from "./types";

export function createZenMode(): EnhancedMode & ZenAPI {
    let state: ZenState = {
        isFocusing: false
    };

    const lifecycle = createModeLifecycle({
        id: "zen",
        requiredFeature: "zen",

        async onActivate(ctx: ModeContext) {
            if (!ensureLicense(ctx, "zen")) return;
            ctx.emit("zen:ready", { state });
        }
    });

    async function generateZenSummary(ctx: ModeContext) {
        if (!state.isFocusing) return;

        ctx.emit("zen:status", { status: "generating" });

        try {
            // In a real implementation, this would call the worker /v1/zen
            // For now we'll simulate a call to the worker through the core core.workerClient
            // or emit an event that the extension handles by calling the worker.

            const core = (ctx as any).core; // Assuming core is available in context or similar
            let summary = "Develop project architecture and implement core components.";
            let nextAction = "Review dependency graph and implement Guardian rules.";

            if (core && core.workerClient) {
                // Real worker call would go here
                // const result = await core.workerClient.zen(ctx.workspace.name);
                // summary = result.summary;
                // nextAction = result.nextStep;
            }

            state.lastSummary = summary;
            state.nextStep = nextAction;

            ctx.emit("zen:update", { state });
        } catch (error) {
            console.error("Zen: Failed to generate summary", error);
        } finally {
            ctx.emit("zen:status", { status: "idle" });
        }
    }

    return {
        id: "zen",
        title: "Zen",
        description: "AI-powered focus mode and next-step recommendations.",
        version: "0.1.0",
        author: "LunaForge",
        tags: ["ai", "focus", "zen"],
        priority: 10,
        requiredFeature: "zen",

        activate: lifecycle.activate,
        deactivate: lifecycle.deactivate,

        async startFocus() {
            const ctx = lifecycle.getContext();
            if (!ctx) return;

            state.isFocusing = true;
            state.startTime = Date.now();
            ctx.emit("zen:start", { state });
            await generateZenSummary(ctx);
        },

        async stopFocus() {
            const ctx = lifecycle.getContext();
            if (!ctx) return;

            state.isFocusing = false;
            ctx.emit("zen:stop", { state });
        },

        async getSummary() {
            return state.lastSummary || "No summary available.";
        },

        async onGraphUpdate(ctx: ModeContext, graph?: ProjectGraph) {
            if (state.isFocusing) {
                await generateZenSummary(ctx);
            }
        }
    };
}
