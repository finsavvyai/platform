// VitePress configuration

import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'SDLC.ai JavaScript SDK',
  description: 'TypeScript/JavaScript SDK for SDLC.ai Secure Data Learning Platform v3',
  lang: 'en-US',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Changelog', link: '/changelog' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is SDLC.ai?', link: '/intro/' },
          { text: 'Why use the SDK?', link: '/intro/why-sdk' }
        ]
      },
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Authentication', link: '/guide/authentication' },
          { text: 'First Steps', link: '/guide/first-steps' }
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Client Architecture', link: '/guide/client-architecture' },
          { text: 'Error Handling', link: '/guide/error-handling' },
          { text: 'Security', link: '/guide/security' },
          { text: 'Performance', link: '/guide/performance' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Client', link: '/api/client' },
          { text: 'Authentication', link: '/api/auth' },
          { text: 'Users', link: '/api/users' },
          { text: 'Tenants', link: '/api/tenants' },
          { text: 'Documents', link: '/api/documents' },
          { text: 'RAG', link: '/api/rag' },
          { text: 'Vector Search', link: '/api/vector' },
          { text: 'Policies', link: '/api/policies' },
          { text: 'LLM Gateway', link: '/api/llm' },
          { text: 'Monitoring', link: '/api/monitoring' },
          { text: 'WebSocket', link: '/api/websocket' }
        ]
      },
      {
        text: 'React Integration',
        items: [
          { text: 'Provider Setup', link: '/react/provider' },
          { text: 'Hooks', link: '/react/hooks' },
          { text: 'Components', link: '/react/components' },
          { text: 'Examples', link: '/react/examples' }
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'Node.js', link: '/examples/node' },
          { text: 'Browser', link: '/examples/browser' },
          { text: 'React', link: '/examples/react' },
          { text: 'Next.js', link: '/examples/nextjs' },
          { text: 'TypeScript', link: '/examples/typescript' }
        ]
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Custom Interceptors', link: '/advanced/interceptors' },
          { text: 'Middleware', link: '/advanced/middleware' },
          { text: 'Caching', link: '/advanced/caching' },
          { text: 'Web Workers', link: '/advanced/web-workers' },
          { text: 'Streaming', link: '/advanced/streaming' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Migration Guide', link: '/migration' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Contributing', link: '/contributing' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sdlc-ai/sdlc-platform' },
      { icon: 'twitter', link: 'https://twitter.com/sdlc_ai' },
      { icon: 'discord', link: 'https://discord.gg/sdlc' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 SDLC.ai'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/sdlc-ai/sdlc-platform/edit/main/packages/sdk-ts/docs/:path',
      text: 'Edit this page on GitHub'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true,
    config: (md) => {
      // You can use markdown-it plugins
    }
  },

  vite: {
    define: {
      __VUE_OPTIONS_API__: false
    },
    optimizeDeps: {
      exclude: ['@sdlc/sdln-js']
    }
  }
});
