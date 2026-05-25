import { test as base } from '@playwright/test';
import { WorkflowPage } from '../page-objects/WorkflowPage.js';
import { CanvasPage } from '../page-objects/CanvasPage.js';

// Extend base test with custom fixtures
export const test = base.extend({
  workflowPage: async ({ page }, use) => {
    const workflowPage = new WorkflowPage(page);
    await use(workflowPage);
  },
  
  canvasPage: async ({ page }, use) => {
    const canvasPage = new CanvasPage(page);
    await use(canvasPage);
  },
});

export { expect } from '@playwright/test';
