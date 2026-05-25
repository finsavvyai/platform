import { test, expect } from './fixtures/test-fixtures.js';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ workflowPage }) => {
    await workflowPage.goto();
  });

  test('should match homepage screenshot', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should match workflow canvas screenshot', async ({ workflowPage, page }) => {
    await workflowPage.createNewWorkflow('Visual Test');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('workflow-canvas.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should match node panel screenshot', async ({ workflowPage, page }) => {
    await workflowPage.createNewWorkflow('Node Panel Test');
    
    const nodePanel = page.locator('.node-panel');
    await expect(nodePanel).toHaveScreenshot('node-panel.png', {
      maxDiffPixels: 50
    });
  });

  test('should match workflow with nodes screenshot', async ({ workflowPage, canvasPage, page }) => {
    await workflowPage.createNewWorkflow('Nodes Visual Test');
    
    // Add nodes to canvas
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Transform', 350, 200);
    await canvasPage.addNodeToCanvas('Output', 500, 200);
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('workflow-with-nodes.png', {
      fullPage: true,
      maxDiffPixels: 150
    });
  });

  test('should match workflow with connections screenshot', async ({ workflowPage, canvasPage, page }) => {
    await workflowPage.createNewWorkflow('Connections Visual Test');
    
    // Create workflow with connections
    await canvasPage.addNodeToCanvas('Trigger', 200, 200);
    await canvasPage.addNodeToCanvas('Output', 400, 200);
    await canvasPage.connectNodes('Trigger', 'Output');
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('workflow-with-connections.png', {
      fullPage: true,
      maxDiffPixels: 150
    });
  });

  test('should match properties panel screenshot', async ({ workflowPage, canvasPage, page }) => {
    await workflowPage.createNewWorkflow('Properties Test');
    
    await canvasPage.addNodeToCanvas('Chat Agent', 200, 200);
    await canvasPage.selectNode('Chat Agent');
    
    await page.waitForTimeout(500);
    
    const propertiesPanel = page.locator('.properties-panel');
    if (await propertiesPanel.isVisible()) {
      await expect(propertiesPanel).toHaveScreenshot('properties-panel.png', {
        maxDiffPixels: 50
      });
    }
  });

  test('should match toolbar screenshot', async ({ workflowPage, page }) => {
    await workflowPage.createNewWorkflow('Toolbar Test');
    
    const toolbar = page.locator('.toolbar');
    if (await toolbar.isVisible()) {
      await expect(toolbar).toHaveScreenshot('toolbar.png', {
        maxDiffPixels: 50
      });
    }
  });

  test('should match different node types', async ({ workflowPage, canvasPage, page }) => {
    await workflowPage.createNewWorkflow('Node Types Test');
    
    const nodeTypes = ['Trigger', 'Chat Agent', 'Data Processor', 'Transform', 'Output'];
    
    for (let i = 0; i < nodeTypes.length; i++) {
      await canvasPage.addNodeToCanvas(nodeTypes[i], 200 + (i * 150), 200);
    }
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('different-node-types.png', {
      fullPage: true,
      maxDiffPixels: 200
    });
  });
});
