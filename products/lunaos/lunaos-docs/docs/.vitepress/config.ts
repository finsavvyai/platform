import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'LunaOS',
    description: 'AI-Native Backend Platform — 28 agents, API reference, guides, and examples',
    appearance: 'force-dark',
    ignoreDeadLinks: true,
    head: [
        ['link', { rel: 'icon', type: 'image/png', href: '/luna-icon.png' }],
        ['link', { rel: 'apple-touch-icon', href: '/luna-icon.png' }],
        ['meta', { name: 'theme-color', content: '#8b5cf6' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'LunaOS Docs — AI Agent Platform' }],
        ['meta', { property: 'og:description', content: '28 AI agents for the full dev lifecycle. Build, deploy, test — all from your terminal.' }],
        ['meta', { property: 'og:url', content: 'https://docs.lunaos.ai' }],
        ['meta', { property: 'og:image', content: 'https://lunaos.ai/assets/og-image.png' }],
    ],

    themeConfig: {
        logo: '/luna-icon.png',
        siteTitle: 'LunaOS',

        nav: [
            { text: 'Guide', link: '/getting-started/' },
            { text: 'Agents', link: '/agents/' },
            { text: 'API Reference', link: '/api/' },
            { text: 'Studio', link: 'https://studio.lunaos.ai' },
            { text: "What's New", link: '/whats-new' },
            { text: 'Pricing', link: 'https://lunaos.ai/pricing.html' },
            { text: 'Dashboard', link: 'https://agents.lunaos.ai/dashboard' },
        ],

        sidebar: {
            '/getting-started/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Introduction', link: '/getting-started/' },
                        { text: 'Quickstart', link: '/getting-started/quickstart' },
                        { text: 'Configuration', link: '/getting-started/configuration' },
                    ],
                },
                {
                    text: 'Guides',
                    items: [
                        { text: 'CLI Reference', link: '/guides/cli-reference' },
                        { text: 'Studio Workflows', link: '/guides/studio' },
                        { text: 'API Keys', link: '/guides/api-keys' },
                        { text: 'Deployment', link: '/guides/deployment' },
                        { text: 'Testing', link: '/guides/testing' },
                        { text: 'IntelliJ Plugin', link: '/guides/intellij-plugin' },
                    ],
                },
                {
                    text: 'Integrations',
                    items: [
                        { text: 'IntelliJ Plugin', link: '/guides/intellij-plugin' },
                        { text: 'VS Code Extension', link: '/guides/vscode-extension' },
                    ],
                },
                {
                    text: 'Security',
                    items: [
                        { text: 'Security Overview', link: '/security' },
                    ],
                },
            ],
            '/agents/': [
                {
                    text: 'Agent Catalog',
                    items: [
                        { text: 'Overview', link: '/agents/' },
                    ],
                },
                {
                    text: 'Free Agents',
                    items: [
                        { text: 'Code Review', link: '/agents/code-review' },
                        { text: 'Testing & Validation', link: '/agents/testing-validation' },
                        { text: 'Documentation', link: '/agents/documentation' },
                        { text: 'Deployment', link: '/agents/deployment' },
                        { text: 'Requirements Analyzer', link: '/agents/requirements-analyzer' },
                        { text: 'Design Architect', link: '/agents/design-architect' },
                    ],
                },
                {
                    text: 'Pro Agents',
                    items: [
                        { text: 'Authentication', link: '/agents/auth' },
                        { text: 'Database', link: '/agents/database' },
                        { text: 'REST API Generator', link: '/agents/api-generator' },
                        { text: 'Cloudflare', link: '/agents/cloudflare' },
                        { text: 'Docker', link: '/agents/docker' },
                        { text: 'SEO', link: '/agents/seo' },
                        { text: 'Analytics', link: '/agents/analytics' },
                        { text: '365 Security', link: '/agents/365-security' },
                        { text: 'Monitoring', link: '/agents/monitoring-observability' },
                        { text: 'RAG Enhanced', link: '/agents/rag-enhanced' },
                        { text: 'GLM Vision', link: '/agents/glm-vision' },
                        { text: 'HIG (Human Interface)', link: '/agents/hig' },
                        { text: 'LemonSqueezy', link: '/agents/lemonsqueezy' },
                        { text: 'User Guide', link: '/agents/user-guide' },
                        { text: 'Task Planner', link: '/agents/task-planner' },
                        { text: 'Task Executor', link: '/agents/task-executor' },
                        { text: 'OpenAI App', link: '/agents/openai-app' },
                        { text: 'RAG', link: '/agents/rag' },
                        { text: 'Run', link: '/agents/run' },
                        { text: 'UI Fix', link: '/agents/ui-fix' },
                        { text: 'UI Test', link: '/agents/ui-test' },
                        { text: 'Post-Launch Review', link: '/agents/post-launch-review' },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Overview', link: '/api/' },
                        { text: 'Authentication', link: '/api/authentication' },
                        { text: 'Agents', link: '/api/agents' },
                        { text: 'Chains', link: '/api/chains' },
                        { text: 'RAG', link: '/api/rag' },
                        { text: 'Billing', link: '/api/billing' },
                        { text: 'API Keys', link: '/api/api-keys' },
                        { text: 'GitHub', link: '/api/github' },
                        { text: 'Teams', link: '/api/teams' },
                        { text: 'Pipes', link: '/api/pipes' },
                    ],
                },
            ],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/lunaos-ai' },
        ],

        footer: {
            message: 'Built with \u2764\ufe0f for developers',
            copyright: '© 2026 LunaOS — <a href="https://lunaos.ai/privacy.html">Privacy</a> · <a href="https://lunaos.ai/terms.html">Terms</a> · <a href="https://lunaos.ai/contact.html">Contact</a>',
        },

        search: {
            provider: 'local',
        },

        editLink: {
            pattern: 'https://github.com/lunaos-ai/lunaos-docs/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },
    },
})
