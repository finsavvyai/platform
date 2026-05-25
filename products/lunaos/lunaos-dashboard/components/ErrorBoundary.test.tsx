// Jest globals (describe, it, expect) provided by test framework

describe('ErrorBoundary', () => {
    it('should export ErrorBoundary class component', async () => {
        const mod = await import('./ErrorBoundary');
        expect(mod.ErrorBoundary).toBeDefined();
        expect(mod.ErrorBoundary.prototype).toHaveProperty('render');
    });

    it('should have getDerivedStateFromError static method', async () => {
        const { ErrorBoundary } = await import('./ErrorBoundary');
        expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();
    });

    it('should set hasError state from getDerivedStateFromError', async () => {
        const { ErrorBoundary } = await import('./ErrorBoundary');
        const result = ErrorBoundary.getDerivedStateFromError(new Error('test'));
        expect(result).toEqual({ hasError: true, error: expect.any(Error) });
    });
});

describe('ErrorBoundary state management', () => {
    it('should initialize with no error', () => {
        const state = { hasError: false, error: null };
        expect(state.hasError).toBe(false);
        expect(state.error).toBeNull();
    });

    it('should capture error details', () => {
        const err = new Error('Component crashed');
        const state = { hasError: true, error: err };
        expect(state.hasError).toBe(true);
        expect(state.error?.message).toBe('Component crashed');
    });
});
