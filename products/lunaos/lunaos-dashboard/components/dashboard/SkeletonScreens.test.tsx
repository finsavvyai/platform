// Jest globals (describe, it, expect) provided by test framework

describe('SkeletonScreens', () => {
    it('should export DashboardSkeleton', async () => {
        const mod = await import('./SkeletonScreens');
        expect(mod.DashboardSkeleton).toBeDefined();
        expect(typeof mod.DashboardSkeleton).toBe('function');
    });

    it('should export AgentGridSkeleton', async () => {
        const mod = await import('./SkeletonScreens');
        expect(mod.AgentGridSkeleton).toBeDefined();
    });

    it('should export HistorySkeleton', async () => {
        const mod = await import('./SkeletonScreens');
        expect(mod.HistorySkeleton).toBeDefined();
    });

    it('should export FormSkeleton', async () => {
        const mod = await import('./SkeletonScreens');
        expect(mod.FormSkeleton).toBeDefined();
    });
});

describe('Skeleton structure', () => {
    it('should have 4 skeleton screen variants', async () => {
        const mod = await import('./SkeletonScreens');
        const exports = Object.keys(mod).filter(k => k.endsWith('Skeleton'));
        expect(exports.length).toBe(4);
    });
});
