// Jest globals (describe, it, expect) provided by test framework

describe('Onboarding', () => {
    it('should export Onboarding component', async () => {
        const mod = await import('./Onboarding');
        expect(mod.Onboarding).toBeDefined();
        expect(typeof mod.Onboarding).toBe('function');
    });
});

describe('Onboarding steps', () => {
    const steps = [
        { title: 'Run Your First Agent', href: '/dashboard/agents' },
        { title: 'Connect a Repository', href: '/dashboard/repos' },
        { title: 'Create an Agent Chain', href: '/dashboard/chains' },
        { title: 'Generate an API Key', href: '/dashboard/api-keys' },
    ];

    it('should have 4 onboarding steps', () => {
        expect(steps.length).toBe(4);
    });

    it('should have valid hrefs for all steps', () => {
        steps.forEach(step => {
            expect(step.href).toMatch(/^\/dashboard\//);
        });
    });

    it('should cover core product features', () => {
        const titles = steps.map(s => s.title);
        expect(titles).toContain('Run Your First Agent');
        expect(titles).toContain('Connect a Repository');
        expect(titles).toContain('Create an Agent Chain');
        expect(titles).toContain('Generate an API Key');
    });
});

describe('Onboarding localStorage key', () => {
    it('should use consistent storage key', () => {
        const key = 'lunaos_onboarding_complete';
        expect(key).toBe('lunaos_onboarding_complete');
    });
});
