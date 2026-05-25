import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    env: {
      // Environment variables for testing
      BACKEND_URL: 'http://localhost:8080',
      TEST_USER_EMAIL: 'test@example.com',
      TEST_USER_PASSWORD: 'testpassword123',
    },
  },
  component: {
    devServer: {
      bundler: 'vite',
      framework: 'react',
      port: 5173,
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
  },
  projectId: 'queryflux',
  retries: {
    runMode: 2,
    openMode: 0,
  },
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'cypress/results',
    overwrite: false,
    html: true,
    json: true,
    charts: true,
    reportPageTitle: 'QueryFlux Test Report',
    embeddedScreenshots: true,
    inlineAssets: true,
    saveAllAttempts: false,
  },
  videoCompression: 32,
});