export class CanvasPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.canvas = '#workflow-canvas';
    this.nodePanel = '.node-panel';
    this.nodeType = '.node-type';
    this.node = '.workflow-node';
    this.connection = '.connection-line';
    this.propertiesPanel = '.properties-panel';
  }

  async addNodeToCanvas(nodeType, x, y) {
    // Find the node type in the panel
    const nodeTypeElement = await this.page.locator(`${this.nodeType}:has-text("${nodeType}")`).first();
    
    // Get the bounding box of the node type
    const nodeBox = await nodeTypeElement.boundingBox();
    
    // Get the canvas element
    const canvas = await this.page.locator(this.canvas);
    const canvasBox = await canvas.boundingBox();
    
    if (nodeBox && canvasBox) {
      // Drag from node panel to canvas
      await this.page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(canvasBox.x + x, canvasBox.y + y);
      await this.page.mouse.up();
      await this.page.waitForTimeout(500);
    }
  }

  async connectNodes(fromNodeText, toNodeText) {
    // Find the nodes by their text content
    const fromNode = await this.page.locator(`${this.node}:has-text("${fromNodeText}")`).first();
    const toNode = await this.page.locator(`${this.node}:has-text("${toNodeText}")`).first();
    
    // Get output port of from node
    const outputPort = await fromNode.locator('.output-port').first();
    const outputBox = await outputPort.boundingBox();
    
    // Get input port of to node
    const inputPort = await toNode.locator('.input-port').first();
    const inputBox = await inputPort.boundingBox();
    
    if (outputBox && inputBox) {
      // Click output port
      await this.page.mouse.click(outputBox.x + outputBox.width / 2, outputBox.y + outputBox.height / 2);
      await this.page.waitForTimeout(200);
      
      // Click input port
      await this.page.mouse.click(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2);
      await this.page.waitForTimeout(500);
    }
  }

  async selectNode(nodeText) {
    await this.page.click(`${this.node}:has-text("${nodeText}")`);
    await this.page.waitForTimeout(300);
  }

  async configureNode(config) {
    // Wait for properties panel to be visible
    await this.page.waitForSelector(this.propertiesPanel);
    
    // Fill in configuration fields
    for (const [key, value] of Object.entries(config)) {
      const input = await this.page.locator(`${this.propertiesPanel} input[name="${key}"], ${this.propertiesPanel} textarea[name="${key}"], ${this.propertiesPanel} select[name="${key}"]`);
      
      if (await input.count() > 0) {
        await input.fill(String(value));
      }
    }
    
    await this.page.waitForTimeout(300);
  }

  async getNodeCount() {
    return await this.page.locator(this.node).count();
  }

  async getConnectionCount() {
    return await this.page.locator(this.connection).count();
  }

  async clearCanvas() {
    // Select all nodes and delete them
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
    await this.page.waitForTimeout(500);
  }
}
