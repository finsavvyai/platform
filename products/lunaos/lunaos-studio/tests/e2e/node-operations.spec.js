import { test, expect } from './fixtures/test-fixtures.js';

test.describe('Node Addition and Connection', () => {
  test.beforeEach(async ({ workflowPage }) => {
    await workflowPage.goto();
    await workflowPage.createNewWorkflow('Node Test Workflow');
  });

  test('should add a trigger node to canvas', async ({ canvasPage }) => {
    const initialCount = await canvasPage.getNodeCount();
    
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    
    const finalCount = await canvasPage.getNodeCount();
    expect(finalCount).toBe(initialCount + 1);
  });

  test('should add multiple nodes to canvas', async ({ canvasPage }) => {
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    
    const nodeCount = await canvasPage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(2);
  });

  test('should connect two nodes', async ({ canvasPage }) => {
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    
    const initialConnections = await canvasPage.getConnectionCount();
    
    await canvasPage.connectNodes('Trigger', 'Output');
    
    const finalConnections = await canvasPage.getConnectionCount();
    expect(finalConnections).toBe(initialConnections + 1);
  });

  test('should select and configure a node', async ({ canvasPage, page }) => {
    await canvasPage.addNodeToCanvas('Chat Agent', 200, 200);
    await canvasPage.selectNode('Chat Agent');
    
    // Verify properties panel is visible
    await expect(page.locator(canvasPage.propertiesPanel)).toBeVisible();
  });

  test('should create a simple workflow with three nodes', async ({ canvasPage }) => {
    await canvasPage.addNodeToCanvas('Trigger', 150, 200);
    await canvasPage.addNodeToCanvas('Transform', 300, 200);
    await canvasPage.addNodeToCanvas('Output', 450, 200);
    
    await canvasPage.connectNodes('Trigger', 'Transform');
    await canvasPage.connectNodes('Transform', 'Output');
    
    const nodeCount = await canvasPage.getNodeCount();
    const connectionCount = await canvasPage.getConnectionCount();
    
    expect(nodeCount).toBeGreaterThanOrEqual(3);
    expect(connectionCount).toBeGreaterThanOrEqual(2);
  });
});
