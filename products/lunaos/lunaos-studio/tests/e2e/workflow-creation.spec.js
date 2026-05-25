import { test, expect } from './fixtures/test-fixtures.js';

test.describe('Workflow Creation', () => {
  test.beforeEach(async ({ workflowPage }) => {
    await workflowPage.goto();
  });

  test('should load the application successfully', async ({ page }) => {
    await expect(page.locator('.logo-text')).toContainText('LunaOS');
  });

  test('should create a new workflow', async ({ workflowPage, page }) => {
    await workflowPage.createNewWorkflow('Test Workflow');
    
    // Verify workflow was created
    await expect(page.locator('text=Test Workflow')).toBeVisible();
  });

  test('should display workflow canvas after creation', async ({ workflowPage, canvasPage }) => {
    await workflowPage.createNewWorkflow('Canvas Test');
    
    // Verify canvas is visible
    const canvas = await canvasPage.page.locator(canvasPage.canvas);
    await expect(canvas).toBeVisible();
  });

  test('should save workflow name correctly', async ({ workflowPage, page }) => {
    const workflowName = 'My Custom Workflow';
    await workflowPage.createNewWorkflow(workflowName);
    
    // Verify the name appears in the UI
    await expect(page.locator(`text=${workflowName}`)).toBeVisible();
  });
});
