export class WorkflowPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.newWorkflowButton = 'button:has-text("New Workflow")';
    this.workflowNameInput = 'input[placeholder*="workflow name"]';
    this.createButton = 'button:has-text("Create")';
    this.saveButton = 'button:has-text("Save")';
    this.loadButton = 'button:has-text("Load")';
    this.runButton = 'button:has-text("Run")';
    this.statusIndicator = '.status-item';
    this.workflowList = '.workflow-list';
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async createNewWorkflow(name) {
    await this.page.click(this.newWorkflowButton);
    await this.page.fill(this.workflowNameInput, name);
    await this.page.click(this.createButton);
    await this.page.waitForTimeout(500);
  }

  async saveWorkflow() {
    await this.page.click(this.saveButton);
    await this.page.waitForTimeout(500);
  }

  async loadWorkflow(name) {
    await this.page.click(this.loadButton);
    await this.page.click(`text=${name}`);
    await this.page.waitForTimeout(500);
  }

  async runWorkflow() {
    await this.page.click(this.runButton);
    await this.page.waitForTimeout(1000);
  }

  async getWorkflowStatus() {
    return await this.page.textContent(this.statusIndicator);
  }

  async waitForWorkflowCompletion(timeout = 10000) {
    await this.page.waitForSelector(`${this.statusIndicator}:has-text("completed")`, {
      timeout
    });
  }

  async getWorkflowList() {
    const items = await this.page.locator(`${this.workflowList} .workflow-item`).all();
    return Promise.all(items.map(item => item.textContent()));
  }
}
