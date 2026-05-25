/**
 * Luna Plan Command Implementation (API Enhanced v2.0)
 *
 * Enhanced task planning with backend integration, RAG context, and real-time tracking
 */

const path = require('path');
const fs = require('fs');

class LunaPlanCommand {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.config = {
      useRAG: true,
      syncWithBackend: true,
      priority: 'normal',
      createTasks: true,
      enableWebSocket: true
    };
  }

  /**
   * Execute the luna-plan command
   */
  async execute(options = {}) {
    try {
      console.log('🌙 Luna Task Planning v2.0 (API Enhanced)');
      console.log('=====================================');

      // Parse options
      this.parseOptions(options);

      // Check prerequisites
      await this.checkPrerequisites();

      // Execute workflow
      const plan = await this.executeWorkflow();

      // Display results
      this.displayResults(plan);

      return plan;

    } catch (error) {
      console.error('❌ Planning failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse command options
   */
  parseOptions(options) {
    if (options.useRAG !== undefined) this.config.useRAG = options.useRAG;
    if (options.syncWithBackend !== undefined) this.config.syncWithBackend = options.syncWithBackend;
    if (options.priority) this.config.priority = options.priority;
    if (options.createTasks !== undefined) this.config.createTasks = options.createTasks;
    if (options.enableWebSocket !== undefined) this.config.enableWebSocket = options.enableWebSocket;

    console.log(`📋 Configuration:`);
    console.log(`   RAG Context: ${this.config.useRAG ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Backend Sync: ${this.config.syncWithBackend ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Priority: ${this.config.priority}`);
    console.log('');
  }

  /**
   * Check prerequisites
   */
  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');

    // Check API connection
    if (this.config.syncWithBackend || this.config.useRAG) {
      const status = await this.apiClient.getStatus();
      if (!status.connected) {
        throw new Error('API connection required. Run /luna-status to configure.');
      }
      console.log('   ✅ API connection established');
    }

    // Check required files
    const currentDir = process.cwd();
    const projectName = this.detectProjectName(currentDir);

    const designFile = path.join(currentDir, '.luna', projectName, 'design.md');
    const requirementsFile = path.join(currentDir, '.luna', projectName, 'requirements.md');

    if (!fs.existsSync(designFile)) {
      console.log(`   ⚠️ Design file not found: ${designFile}`);
      console.log('   💡 Run /luna-design first to create design document');
    }

    if (!fs.existsSync(requirementsFile)) {
      console.log(`   ⚠️ Requirements file not found: ${requirementsFile}`);
      console.log('   💡 Run /luna-requirements first to create requirements document');
    }

    console.log('   ✅ Prerequisites checked');
    console.log('');
  }

  /**
   * Execute the planning workflow
   */
  async executeWorkflow() {
    const currentDir = process.cwd();
    const projectName = this.detectProjectName(currentDir);

    console.log('📖 Analyzing project documents...');

    // Step 1: Read local documents
    const localData = await this.readLocalDocuments(projectName);

    // Step 2: Fetch RAG context if enabled
    let ragContext = null;
    if (this.config.useRAG) {
      console.log('🧠 Fetching RAG context...');
      ragContext = await this.fetchRAGContext(localData);
    }

    // Step 3: Generate AI-enhanced plan
    console.log('🤖 Generating AI-enhanced implementation plan...');
    const plan = await this.generateImplementationPlan(localData, ragContext);

    // Step 4: Sync with backend if enabled
    let backendTasks = [];
    if (this.config.syncWithBackend) {
      console.log('🔄 Syncing with backend platform...');
      backendTasks = await this.syncWithBackend(plan);
    }

    // Step 5: Save local plan
    await this.saveLocalPlan(plan, projectName, backendTasks);

    return {
      ...plan,
      ragContext,
      backendTasks,
      projectName,
      synced: this.config.syncWithBackend
    };
  }

  /**
   * Read local documents
   */
  async readLocalDocuments(projectName) {
    const currentDir = process.cwd();
    const designFile = path.join(currentDir, '.luna', projectName, 'design.md');
    const requirementsFile = path.join(currentDir, '.luna', projectName, 'requirements.md');

    const data = {
      design: null,
      requirements: null,
      projectName,
      projectPath: currentDir
    };

    if (fs.existsSync(designFile)) {
      data.design = fs.readFileSync(designFile, 'utf8');
      console.log('   ✅ Design document loaded');
    }

    if (fs.existsSync(requirementsFile)) {
      data.requirements = fs.readFileSync(requirementsFile, 'utf8');
      console.log('   ✅ Requirements document loaded');
    }

    return data;
  }

  /**
   * Fetch RAG context
   */
  async fetchRAGContext(localData) {
    try {
      // Create context query based on local documents
      const contextQuery = this.buildRAGQuery(localData);

      const ragResponse = await this.apiClient.queryRAG(contextQuery, {
        maxResults: 5,
        minScore: 0.7,
        includeMetadata: true
      });

      console.log(`   ✅ Found ${ragResponse.contexts.length} relevant context items`);

      return ragResponse;

    } catch (error) {
      console.log(`   ⚠️ RAG context fetch failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Build RAG query from local documents
   */
  buildRAGQuery(localData) {
    let query = "Current project implementation requirements and design patterns";

    if (localData.requirements) {
      const requirements = localData.requirements.substring(0, 500);
      query += `. Requirements: ${requirements}`;
    }

    if (localData.design) {
      const design = localData.design.substring(0, 500);
      query += `. Design: ${design}`;
    }

    return query;
  }

  /**
   * Generate implementation plan using AI
   */
  async generateImplementationPlan(localData, ragContext) {
    const prompt = this.buildPlanningPrompt(localData, ragContext);

    try {
      const aiResponse = await this.apiClient.generateText(prompt, {
        systemPrompt: this.getSystemPrompt(),
        maxTokens: 4000,
        temperature: 0.7,
        context: {
          taskType: 'planning',
          projectName: localData.projectName
        }
      });

      // Parse AI response into structured plan
      const plan = this.parseAIResponse(aiResponse.content);

      console.log('   ✅ Implementation plan generated');

      return plan;

    } catch (error) {
      console.log(`   ⚠️ AI generation failed: ${error.message}`);
      // Fallback to basic plan generation
      return this.generateBasicPlan(localData);
    }
  }

  /**
   * Build AI planning prompt
   */
  buildPlanningPrompt(localData, ragContext) {
    let prompt = `Generate a comprehensive implementation plan for the following project:\n\n`;

    prompt += `PROJECT: ${localData.projectName}\n\n`;

    if (localData.requirements) {
      prompt += `REQUIREMENTS:\n${localData.requirements.substring(0, 2000)}\n\n`;
    }

    if (localData.design) {
      prompt += `DESIGN:\n${localData.design.substring(0, 2000)}\n\n`;
    }

    if (ragContext && ragContext.contexts.length > 0) {
      prompt += `CONTEXT FROM CODEBASE:\n`;
      ragContext.contexts.forEach((ctx, i) => {
        prompt += `${i + 1}. ${ctx.content.substring(0, 300)}...\n`;
      });
      prompt += '\n';
    }

    prompt += `Generate a detailed implementation plan with:\n`;
    prompt += `1. Ordered tasks with dependencies\n`;
    prompt += `2. Each task with clear acceptance criteria\n`;
    prompt += `3. Estimated complexity (Low/Medium/High)\n`;
    prompt += `4. Recommended agent for each task\n`;
    prompt += `5. Checkboxes for tracking: [ ] incomplete, [x] complete\n\n`;
    prompt += `Format as markdown with proper task numbering.`;

    return prompt;
  }

  /**
   * Get system prompt for AI
   */
  getSystemPrompt() {
    return `You are an expert software architect and project manager. Create detailed, actionable implementation plans that break down complex projects into manageable tasks. Consider dependencies, priorities, and best practices. Always include clear acceptance criteria and checkboxes for progress tracking.`;
  }

  /**
   * Parse AI response into structured plan
   */
  parseAIResponse(aiContent) {
    // Parse the markdown response into structured data
    const tasks = [];
    const lines = aiContent.split('\n');

    let currentTask = null;
    let taskNumber = 1;

    for (const line of lines) {
      // Match task headers (##, ###, or numbered lists)
      const taskMatch = line.match(/^#{1,3}\s*\[([ x])\]\s*(.+)$/);
      if (taskMatch) {
        if (currentTask) {
          tasks.push(currentTask);
        }

        currentTask = {
          id: `task-${taskNumber}`,
          number: taskNumber++,
          completed: taskMatch[1] === 'x',
          title: taskMatch[2].trim(),
          description: '',
          acceptanceCriteria: [],
          complexity: 'Medium',
          agent: 'task-executor',
          dependencies: []
        };
      } else if (currentTask && line.trim()) {
        // Add to current task description or criteria
        if (line.includes('Acceptance Criteria:') || line.includes('Requirements:')) {
          currentTask.acceptanceCriteria = [];
        } else if (line.includes('Complexity:')) {
          const complexity = line.match(/Complexity:\s*(Low|Medium|High)/);
          if (complexity) currentTask.complexity = complexity[1];
        } else if (line.includes('Agent:')) {
          const agent = line.match(/Agent:\s*(.+)/);
          if (agent) currentTask.agent = agent[1].trim();
        } else if (line.includes('Depends on:')) {
          const deps = line.match(/Depends on:\s*(.+)/);
          if (deps) {
            currentTask.dependencies = deps[1].split(',').map(d => d.trim());
          }
        } else if (line.match(/^\s*-\s*\[([ x])\]\s*(.+)/)) {
          // Acceptance criteria item
          const criteriaMatch = line.match(/^\s*-\s*\[([ x])\]\s*(.+)/);
          if (criteriaMatch) {
            currentTask.acceptanceCriteria.push({
              completed: criteriaMatch[1] === 'x',
              text: criteriaMatch[2].trim()
            });
          }
        } else {
          // Regular description line
          currentTask.description += line + '\n';
        }
      }
    }

    if (currentTask) {
      tasks.push(currentTask);
    }

    return {
      title: `Implementation Plan for ${this.detectProjectName(process.cwd())}`,
      tasks,
      generatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length
    };
  }

  /**
   * Generate basic plan as fallback
   */
  generateBasicPlan(localData) {
    const tasks = [
      {
        id: 'task-1',
        number: 1,
        completed: false,
        title: 'Project Setup and Configuration',
        description: 'Initialize project structure and configure development environment.',
        acceptanceCriteria: [
          { completed: false, text: 'Project structure created' },
          { completed: false, text: 'Development environment configured' }
        ],
        complexity: 'Low',
        agent: 'task-executor',
        dependencies: []
      },
      {
        id: 'task-2',
        number: 2,
        completed: false,
        title: 'Core Implementation',
        description: 'Implement core functionality based on requirements.',
        acceptanceCriteria: [
          { completed: false, text: 'Core features implemented' },
          { completed: false, text: 'Basic testing completed' }
        ],
        complexity: 'High',
        agent: 'task-executor',
        dependencies: ['task-1']
      }
    ];

    return {
      title: `Implementation Plan for ${localData.projectName}`,
      tasks,
      generatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      completedTasks: 0,
      note: 'Basic plan generated due to AI service unavailability'
    };
  }

  /**
   * Sync plan with backend
   */
  async syncWithBackend(plan) {
    try {
      // Create tasks in backend
      const taskPayloads = plan.tasks.map(task => ({
        type: 'planning',
        priority: this.mapPriority(task.complexity),
        payload: {
          title: task.title,
          description: task.description,
          acceptanceCriteria: task.acceptanceCriteria,
          complexity: task.complexity
        },
        dependencies: task.dependencies,
        metadata: {
          source: 'luna-plan',
          generatedAt: plan.generatedAt,
          agentType: task.agent
        }
      }));

      const response = await this.apiClient.createTask(taskPayloads);

      console.log(`   ✅ Created ${response.tasks.length} tasks in backend`);

      return response.tasks;

    } catch (error) {
      console.log(`   ⚠️ Backend sync failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Map complexity to priority
   */
  mapPriority(complexity) {
    const mapping = {
      'Low': 'low',
      'Medium': 'normal',
      'High': 'high'
    };
    return mapping[complexity] || 'normal';
  }

  /**
   * Save local plan file
   */
  async saveLocalPlan(plan, projectName, backendTasks) {
    const currentDir = process.cwd();
    const planDir = path.join(currentDir, '.luna', projectName);

    // Ensure directory exists
    if (!fs.existsSync(planDir)) {
      fs.mkdirSync(planDir, { recursive: true });
    }

    const planFile = path.join(planDir, 'implementation-plan.md');

    let content = `# ${plan.title}\n\n`;
    content += `Generated: ${plan.generatedAt}\n`;
    content += `Total Tasks: ${plan.totalTasks}\n`;
    content += `Completed: ${plan.completedTasks}\n\n`;

    if (backendTasks.length > 0) {
      content += `## Backend Integration\n\n`;
      content += `✅ Synced ${backendTasks.length} tasks to backend platform\n`;
      content += `🔗 Task IDs available for tracking\n\n`;
    }

    content += `## Implementation Tasks\n\n`;

    plan.tasks.forEach(task => {
      const checkbox = task.completed ? '[x]' : '[ ]';
      content += `### ${checkbox} ${task.number}. ${task.title}\n\n`;

      if (task.description) {
        content += `${task.description}\n\n`;
      }

      if (task.acceptanceCriteria.length > 0) {
        content += `**Acceptance Criteria:**\n`;
        task.acceptanceCriteria.forEach(criteria => {
          const critCheckbox = criteria.completed ? '[x]' : '[ ]';
          content += `- ${critCheckbox} ${criteria.text}\n`;
        });
        content += '\n';
      }

      const meta = [];
      if (task.complexity !== 'Medium') meta.push(`Complexity: ${task.complexity}`);
      if (task.agent !== 'task-executor') meta.push(`Agent: ${task.agent}`);
      if (task.dependencies.length > 0) meta.push(`Dependencies: ${task.dependencies.join(', ')}`);

      if (meta.length > 0) {
        content += `**Meta:** ${meta.join(' | ')}\n\n`;
      }

      // Add backend task ID if available
      const backendTask = backendTasks.find(bt => bt.title === task.title);
      if (backendTask) {
        content += `**Backend Task ID:** \`${backendTask.id}\`\n\n`;
      }
    });

    content += `---\n`;
    content += `*Generated by Luna Task Planning v2.0 with API integration*\n`;

    fs.writeFileSync(planFile, content);
    console.log(`   ✅ Plan saved to: ${planFile}`);
  }

  /**
   * Display results
   */
  displayResults(plan) {
    console.log('📊 Planning Results:');
    console.log('==================');
    console.log(`📋 Total Tasks: ${plan.totalTasks}`);
    console.log(`✅ Completed: ${plan.completedTasks}`);
    console.log(`⏳ Remaining: ${plan.totalTasks - plan.completedTasks}`);

    if (plan.backendTasks && plan.backendTasks.length > 0) {
      console.log(`🔄 Backend Tasks: ${plan.backendTasks.length}`);
    }

    if (plan.ragContext) {
      console.log(`🧠 RAG Context: ${plan.ragContext.contexts.length} items`);
    }

    console.log('');
    console.log('📁 Local plan saved to .luna/{project}/implementation-plan.md');

    if (plan.synced) {
      console.log('🔄 Tasks synced to backend platform');
      console.log('💡 Track progress with: /luna-tasks');
    }

    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   Start execution: /luna-execute');
    console.log('   Track progress: /luna-tasks --status=running');
    console.log('   View analytics: /luna-analytics');
  }

  /**
   * Detect project name from current directory
   */
  detectProjectName(currentDir) {
    const baseName = path.basename(currentDir);

    // Common project name patterns
    if (baseName === 'src' || baseName === 'lib') {
      return path.basename(path.dirname(currentDir));
    }

    return baseName;
  }
}

module.exports = LunaPlanCommand;
