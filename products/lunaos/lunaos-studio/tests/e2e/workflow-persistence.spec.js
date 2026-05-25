import { test, expect } from './fixtures/test-fixtures.js';

test.describe('Workflow Save and Load', () => {
  const testWorkflowName = 'Persistence Test Workflow';

  test.beforeEach(async ({ workflowPage }) => {
    await workflowPage.goto();
  });

  test('should save a workflow', async ({ workflowPage, canvasPage, page }) => {
    await workflowPage.createNewWorkflow(testWorkflowName);
    
    // Add some nodes
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    await canvasPage.connectNodes('Trigger', 'Output');
    
    // Save workflow
    await workflowPage.saveWorkflow();
    
    // Verify save was successful (look for success message or indicator)
    await page.waitForTimeout(1000);
  });

  test('should load a saved workflow', async ({ workflowPage, canvasPage }) => {
    // First create and save a workflow
    await workflowPage.createNewWorkflow(testWorkflowName);
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    await workflowPage.saveWorkflow();
    
    // Clear canvas or navigate away
    await canvasPage.clearCanvas();
    
    // Load the workflow
    await workflowPage.loadWorkflow(testWorkflowName);
    
    // Verify nodes are loaded
    const nodeCount = await canvasPage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(2);
  });

  test('should preserve node connections after save and load', async ({ workflowPage, canvasPage }) => {
    await workflowPage.createNewWorkflow(testWorkflowName);
    
    // Create workflow with connections
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Transform', 350, 200);
    await canvasPage.addNodeToCanvas('Output', 500, 200);
    
    await canvasPage.connectNodes('Trigger', 'Transform');
    await canvasPage.connectNodes('Transform', 'Output');
    
    const originalConnections = await canvasPage.getConnectionCount();
    
    // Save and reload
    await workflowPage.saveWorkflow();
    await canvasPage.clearCanvas();
    await workflowPage.loadWorkflow(testWorkflowName);
    
    // Verify connections are preserved
    const loadedConnections = await canvasPage.getConnectionCount();
    expect(loadedConnections).toBe(originalConnections);
  });

  test('should list saved workflows', async ({ workflowPage, page }) => {
    // Create multiple workflows
    await workflowPage.createNewWorkflow('Workflow 1');
    await workflowPage.saveWorkflow();
    
    await page.goto('/');
    await workflowPage.createNewWorkflow('Workflow 2');
    await workflowPage.saveWorkflow();
    
    // Check workflow list
    await page.click(workflowPage.loadButton);
    
    // Verify workflows appear in list
    await expect(page.locator('text=Workflow 1')).toBeVisible();
    await expect(page.locator('text=Workflow 2')).toBeVisible();
  });
});
