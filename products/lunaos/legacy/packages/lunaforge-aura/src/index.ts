import {
    Mode,
    ModeContext,
    ensureLicense,
    createModeLifecycle,
    ProjectFile
} from "lunaforge-core";
import { AuraAPI, AuraMetrics, BusFactorInfo, DependencyHealth } from "./types";

export function createAuraMode(): Mode & AuraAPI {
    let metrics: AuraMetrics = {
        languageStats: {},
        fileCount: 0,
        totalSize: 0,
        lastUpdated: Date.now()
    };

    const lifecycle = createModeLifecycle({
        id: "aura",
        requiredFeature: "aura",

        onActivate(ctx: ModeContext) {
            ctx.emit("aura:ready", {});
            calculateMetrics(ctx);
        }
    });

    async function calculateMetrics(ctx: ModeContext) {
        ctx.emit("aura:status", { status: "calculating" });

        const files: ProjectFile[] = (ctx as any).projectFiles ?? [];
        const graph = (ctx as any).graph;

        // Basic stats
        const stats: Record<string, number> = {};
        let totalSize = 0;

        files.forEach(f => {
            const ext = f.path.split('.').pop() || 'unknown';
            stats[ext] = (stats[ext] || 0) + 1;
            totalSize += f.size || 0;
        });

        // Complexity score (based on nesting and file count)
        const complexityScore = calculateComplexityScore(files);

        // Bus factor (placeholder - would need Git integration)
        const busFactor = calculateBusFactor(files);

        // Dependency health
        const dependencyHealth = calculateDependencyHealth(files, graph);

        metrics = {
            languageStats: stats,
            fileCount: files.length,
            totalSize,
            lastUpdated: Date.now(),
            complexityScore,
            busFactor,
            dependencyHealth
        };

        ctx.emit("aura:metrics", metrics);
        ctx.emit("aura:status", { status: "ready" });
    }

    function calculateComplexityScore(files: ProjectFile[]): number {
        if (files.length === 0) return 0;

        // Estimate complexity based on:
        // - Deep nesting (many subdirectories)
        // - Large files
        // - Many small files (fragmentation)
        let nestingScore = 0;
        let sizeScore = 0;

        files.forEach(f => {
            const depth = f.path.split('/').length;
            nestingScore += Math.min(depth, 10);
            sizeScore += f.size && f.size > 5000 ? 1 : 0;
        });

        const avgNesting = nestingScore / files.length;
        const largeFilePct = (sizeScore / files.length) * 100;

        // Normalize to 0-100
        return Math.min(100, Math.round((avgNesting * 5) + (largeFilePct * 0.5)));
    }

    function calculateBusFactor(_files: ProjectFile[]): BusFactorInfo {
        // Placeholder - would need Git blame integration
        return {
            score: 5,
            singleOwnerFiles: [],
            topContributors: []
        };
    }

    function calculateDependencyHealth(files: ProjectFile[], graph: any): DependencyHealth {
        const circularDeps: string[][] = [];
        const orphanFiles: string[] = [];

        if (graph && graph.edges) {
            // Detect circular dependencies
            const adjacency = new Map<string, Set<string>>();
            graph.edges.forEach((e: { source: string; target: string }) => {
                if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
                adjacency.get(e.source)!.add(e.target);
            });

            // Simple circular detection (direct cycles only for now)
            adjacency.forEach((targets, source) => {
                targets.forEach(target => {
                    if (adjacency.get(target)?.has(source)) {
                        circularDeps.push([source, target]);
                    }
                });
            });

            // Find orphan files (no incoming edges)
            const hasIncoming = new Set<string>();
            graph.edges.forEach((e: { target: string }) => hasIncoming.add(e.target));
            files.forEach(f => {
                if (!hasIncoming.has(f.path) && !f.path.includes('index')) {
                    orphanFiles.push(f.path);
                }
            });
        }

        // Calculate health score
        const circularPenalty = Math.min(circularDeps.length * 10, 50);
        const orphanPenalty = Math.min(orphanFiles.length * 2, 30);
        const healthScore = Math.max(0, 100 - circularPenalty - orphanPenalty);

        return {
            circularDeps,
            orphanFiles: orphanFiles.slice(0, 10), // Limit for display
            healthScore
        };
    }

    return {
        id: "aura",
        title: "Aura",
        description: "Repository health, metrics, and language distribution.",
        requiredFeature: "aura",

        activate: lifecycle.activate,
        deactivate: lifecycle.deactivate,

        async getMetrics() {
            return metrics;
        },

        async refresh() {
            const ctx = lifecycle.getContext();
            if (ctx) {
                await calculateMetrics(ctx);
            }
        },

        onGraphUpdate(ctx: ModeContext) {
            calculateMetrics(ctx);
        }
    };
}
