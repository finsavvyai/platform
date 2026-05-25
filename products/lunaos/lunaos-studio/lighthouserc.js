export default {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: ['http://localhost:4173'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance budgets
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3000 }],
        'interactive': ['error', { maxNumericValue: 3500 }],
        
        // Accessibility
        'categories:accessibility': ['error', { minScore: 0.9 }],
        
        // Best Practices
        'categories:best-practices': ['error', { minScore: 0.9 }],
        
        // SEO
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // PWA (optional)
        'categories:pwa': ['warn', { minScore: 0.5 }],
        
        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }],
        'resource-summary:font:size': ['warn', { maxNumericValue: 200000 }],
        
        // Network requests
        'network-requests': ['warn', { maxNumericValue: 50 }],
        
        // JavaScript execution time
        'bootup-time': ['warn', { maxNumericValue: 3000 }],
        
        // Main thread work
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000 }],
        
        // Unused code
        'unused-javascript': ['warn', { maxNumericValue: 100000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
