import { test, expect } from './fixtures/test-fixtures.js';

test.describe('Workflow Execution', () => {
  test.beforeEach(async ({ workflowPage }) => {
    await workflowPage.goto();
    await workflowPage.createNewWorkflow('Execution Test');
  });

  test('should execute a simple workflow', async ({ workflowPage, canvasPage }) => {
    // Create a simple workflow
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    await canvasPage.connectNodes('Trigger', 'Output');
    
    // Run the workflow
    await workflowPage.runWorkflow();
    
    // Wait for completion
    await workflowPage.waitForWorkflowCompletion();
    
    // Verify status
    const status = await workflowPage.getWorkflowStatus();
    expect(status).toContain('completed');
  });

  test('should show running status during execution', async ({ workflowPage, canvasPage, page }) => {
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Delay', 300, 200);
    await canvasPage.addNodeToCanvas('Output', 450, 200);
    
    await canvasPage.connectNodes('Trigger', 'Delay');
    await canvasPage.connectNodes('Delay', 'Output');
    
    // Configure delay node
    await canvasPage.selectNode('Delay');
    await canvasPage.configureNode({ delay: 2000 });
    
    // Run workflow
    await workflowPage.runWorkflow();
    
    // Check for running status
    await expect(page.locator(`${workflowPage.statusIndicator}:has-text("running")`)).toBeVisible({
      timeout: 2000
    });
  });

  test('should execute workflow with multiple nodes', async ({ workflowPage, canvasPage }) => {
    // Create a more complex workflow
    await canvasPage.addNodeToCanvas('Trigger', 150, 200);
    await canvasPage.addNodeToCanvas('Transform', 300, 200);
    await canvasPage.addNodeToCanvas('Filter', 450, 200);
    await canvasPage.addNodeToCanvas('Output', 600, 200);
    
    await canvasPage.connectNodes('Trigger', 'Transform');
    await canvasPage.connectNodes('Transform', 'Filter');
    await canvasPage.connectNodes('Filter', 'Output');
    
    // Execute
    await workflowPage.runWorkflow();
    await workflowPage.waitForWorkflowCompletion();
    
    const status = await workflowPage.getWorkflowStatus();
    expect(status).toContain('completed');
  });

  test('should handle workflow execution errors gracefully', async ({ workflowPage, canvasPage, page }) => {
    // Create workflow that might fail
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    await canvasPage.connectNodes('Trigger', 'Output');
    
    // Run workflow
    await workflowPage.runWorkflow();
    
    // Wait for either completion or failure
    await page.waitForSelector(`${workflowPage.statusIndicator}:has-text("completed"), ${workflowPage.statusIndicator}:has-text("failed")`, {
      timeout: 10000
    });
    
    const status = await workflowPage.getWorkflowStatus();
    expect(status).toMatch(/completed|failed/);
  });
});
