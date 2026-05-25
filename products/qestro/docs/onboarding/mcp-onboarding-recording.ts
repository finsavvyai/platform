/**
 * MCP Onboarding Recording System
 *
 * This system captures and records the complete automated project creation
 * onboarding process using Model Context Protocol (MCP) for comprehensive
 * documentation and interactive demonstrations.
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  category: 'introduction' | 'analysis' | 'generation' | 'configuration' | 'deployment' | 'completion';
  duration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  learningObjectives: string[];
  handsOn: boolean;
  interactive: boolean;
}

export interface OnboardingSession {
  id: string;
  title: string;
  description: string;
  targetAudience: string[];
  estimatedDuration: number; // in minutes
  steps: OnboardingStep[];
  createdAt: Date;
  lastUpdated: Date;
}

export interface RecordingMetadata {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  stepsCompleted: string[];
  interactions: UserInteraction[];
  screenshots: Screenshot[];
  codeSnippets: CodeSnippet[];
  userProgress: ProgressMetrics;
}

export interface UserInteraction {
  timestamp: Date;
  action: 'start_step' | 'complete_step' | 'ask_question' | 'request_help' | 'pause' | 'resume';
  stepId?: string;
  details?: any;
  userFeedback?: {
    rating: number; // 1-5
    comments: string;
    suggestions: string[];
  };
}

export interface Screenshot {
  timestamp: Date;
  stepId: string;
  description: string;
  filePath: string;
  annotations: Annotation[];
}

export interface Annotation {
  type: 'highlight' | 'arrow' | 'text' | 'callout';
  position: { x: number; y: number };
  content: string;
  style?: any;
}

export interface CodeSnippet {
  timestamp: Date;
  stepId: string;
  title: string;
  description: string;
  language: string;
  code: string;
  explanation: string;
  bestPractices: string[];
}

export interface ProgressMetrics {
  stepsCompleted: number;
  totalSteps: number;
  timeSpent: number;
  understandingLevel: number; // 1-5
  confidenceLevel: number; // 1-5
  questionsAsked: number;
  helpRequested: number;
  interactiveElementsUsed: number;
}

export class MCPOnboardingRecorder extends EventEmitter {
  private activeSessions: Map<string, RecordingMetadata> = new Map();
  private onboardingFlows: Map<string, OnboardingSession> = new Map();
  private outputDirectory: string;

  constructor(outputDirectory: string = './docs/onboarding/recordings') {
    super();
    this.outputDirectory = outputDirectory;
    this.initializeOnboardingFlows();
    this.ensureOutputDirectory();
  }

  /**
   * Initialize predefined onboarding flows
   */
  private initializeOnboardingFlows(): void {
    // Main automated project creation onboarding
    const mainOnboarding: OnboardingSession = {
      id: 'automated-project-creation-main',
      title: 'Complete Automated Project Creation Onboarding',
      description: 'Master the AI-powered automated project creation system from setup to deployment',
      targetAudience: ['developers', 'devops-engineers', 'tech-leads', 'project-managers'],
      estimatedDuration: 45,
      createdAt: new Date(),
      lastUpdated: new Date(),
      steps: [
        {
          id: 'intro-automated-creation',
          title: 'Introduction to Automated Project Creation',
          description: 'Overview of the AI-powered project creation system and its benefits',
          category: 'introduction',
          duration: 5,
          difficulty: 'beginner',
          prerequisites: ['Basic understanding of web development'],
          learningObjectives: [
            'Understand the value of automated project creation',
            'Learn about the AI-powered features',
            'Explore the system architecture'
          ],
          handsOn: false,
          interactive: true
        },
        {
          id: 'repository-analysis',
          title: 'Repository Analysis and Technology Detection',
          description: 'Learn how the system analyzes repositories and detects technology stacks',
          category: 'analysis',
          duration: 8,
          difficulty: 'intermediate',
          prerequisites: ['Familiarity with Git and GitHub/GitLab'],
          learningObjectives: [
            'Set up repository integration',
            'Understand technology stack detection',
            'Analyze project architecture patterns'
          ],
          handsOn: true,
          interactive: true
        },
        {
          id: 'project-structure-generation',
          title: 'Intelligent Project Structure Generation',
          description: 'Generate comprehensive project structures based on analysis results',
          category: 'generation',
          duration: 10,
          difficulty: 'intermediate',
          prerequisites: ['Understanding of project organization'],
          learningObjectives: [
            'Generate optimal project structures',
            'Create framework-specific configurations',
            'Set up development environments'
          ],
          handsOn: true,
          interactive: true
        },
        {
          id: 'configuration-optimization',
          title: 'Configuration Management and Optimization',
          description: 'Create and optimize configurations for different environments',
          category: 'configuration',
          duration: 7,
          difficulty: 'advanced',
          prerequisites: ['Experience with environment configuration'],
          learningObjectives: [
            'Generate environment-specific configurations',
            'Apply AI-powered optimizations',
            'Implement feature flags and monitoring'
          ],
          handsOn: true,
          interactive: true
        },
        {
          id: 'setup-script-generation',
          title: 'Automated Setup Script Generation',
          description: 'Create comprehensive setup and deployment scripts',
          category: 'deployment',
          duration: 8,
          difficulty: 'intermediate',
          prerequisites: ['Basic shell scripting knowledge'],
          learningObjectives: [
            'Generate setup and build scripts',
            'Create CI/CD pipeline configurations',
            'Implement deployment automation'
          ],
          handsOn: true,
          interactive: true
        },
        {
          id: 'deployment-and-monitoring',
          title: 'Deployment and Monitoring Setup',
          description: 'Deploy projects and set up comprehensive monitoring',
          category: 'deployment',
          duration: 7,
          difficulty: 'advanced',
          prerequisites: ['Understanding of cloud deployment'],
          learningObjectives: [
            'Deploy to multiple cloud platforms',
            'Set up monitoring and alerting',
            'Configure preview environments'
          ],
          handsOn: true,
          interactive: true
        }
      ]
    };

    // Quick start onboarding
    const quickStartOnboarding: OnboardingSession = {
      id: 'quick-start-onboarding',
      title: 'Quick Start: Your First AI-Generated Project',
      description: 'Get started quickly with automated project creation in just 15 minutes',
      targetAudience: ['beginners', 'developers-new-to-questro'],
      estimatedDuration: 15,
      createdAt: new Date(),
      lastUpdated: new Date(),
      steps: [
        {
          id: 'qs-intro',
          title: 'Welcome to Questro AI Project Creation',
          description: 'Quick overview and getting started',
          category: 'introduction',
          duration: 2,
          difficulty: 'beginner',
          prerequisites: [],
          learningObjectives: [
            'Understand the basic workflow',
            'Navigate the interface',
            'Start your first project'
          ],
          handsOn: false,
          interactive: true
        },
        {
          id: 'qs-basic-project',
          title: 'Create Your First Project',
          description: 'Generate a simple React application with AI assistance',
          category: 'generation',
          duration: 8,
          difficulty: 'beginner',
          prerequisites: [],
          learningObjectives: [
            'Input project requirements',
            'Generate project structure',
            'Run the setup process'
          ],
          handsOn: true,
          interactive: true
        },
        {
          id: 'qs-verification',
          title: 'Verify and Customize Your Project',
          description: 'Test your generated project and make customizations',
          category: 'completion',
          duration: 5,
          difficulty: 'beginner',
          prerequisites: [],
          learningObjectives: [
            'Run the development server',
            'Understand the generated structure',
            'Make basic customizations'
          ],
          handsOn: true,
          interactive: true
        }
      ]
    };

    this.onboardingFlows.set(mainOnboarding.id, mainOnboarding);
    this.onboardingFlows.set(quickStartOnboarding.id, quickStartOnboarding);
  }

  /**
   * Start a new onboarding recording session
   */
  async startRecording(sessionId: string, userId?: string): Promise<string> {
    const session = this.onboardingFlows.get(sessionId);
    if (!session) {
      throw new Error(`Onboarding session not found: ${sessionId}`);
    }

    const recordingId = `recording-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const metadata: RecordingMetadata = {
      sessionId: recordingId,
      startTime: new Date(),
      stepsCompleted: [],
      interactions: [],
      screenshots: [],
      codeSnippets: [],
      userProgress: {
        stepsCompleted: 0,
        totalSteps: session.steps.length,
        timeSpent: 0,
        understandingLevel: 0,
        confidenceLevel: 0,
        questionsAsked: 0,
        helpRequested: 0,
        interactiveElementsUsed: 0
      }
    };

    this.activeSessions.set(recordingId, metadata);

    // Create session directory
    const sessionDir = path.join(this.outputDirectory, recordingId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Save initial session metadata
    await this.saveRecordingMetadata(recordingId);

    this.emit('recordingStarted', { recordingId, session, userId });
    console.log(`📹 Started recording onboarding session: ${session.title} (${recordingId})`);

    return recordingId;
  }

  /**
   * Record a step interaction
   */
  async recordStepInteraction(
    recordingId: string,
    stepId: string,
    action: 'start' | 'complete' | 'pause' | 'resume',
    details?: any
  ): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    const interaction: UserInteraction = {
      timestamp: new Date(),
      action: action === 'start' ? 'start_step' : action === 'complete' ? 'complete_step' : action,
      stepId,
      details
    };

    metadata.interactions.push(interaction);

    if (action === 'complete' && !metadata.stepsCompleted.includes(stepId)) {
      metadata.stepsCompleted.push(stepId);
      metadata.userProgress.stepsCompleted = metadata.stepsCompleted.length;
    }

    await this.saveRecordingMetadata(recordingId);
    this.emit('stepRecorded', { recordingId, stepId, action, details });
  }

  /**
   * Record user question or help request
   */
  async recordUserInteraction(
    recordingId: string,
    action: 'ask_question' | 'request_help',
    stepId?: string,
    details?: any
  ): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    const interaction: UserInteraction = {
      timestamp: new Date(),
      action,
      stepId,
      details
    };

    metadata.interactions.push(interaction);

    if (action === 'ask_question') {
      metadata.userProgress.questionsAsked++;
    } else if (action === 'request_help') {
      metadata.userProgress.helpRequested++;
    }

    await this.saveRecordingMetadata(recordingId);
    this.emit('interactionRecorded', { recordingId, action, stepId, details });
  }

  /**
   * Record a code snippet with explanation
   */
  async recordCodeSnippet(
    recordingId: string,
    stepId: string,
    title: string,
    description: string,
    language: string,
    code: string,
    explanation: string,
    bestPractices: string[] = []
  ): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    const snippet: CodeSnippet = {
      timestamp: new Date(),
      stepId,
      title,
      description,
      language,
      code,
      explanation,
      bestPractices
    };

    metadata.codeSnippets.push(snippet);

    // Save code snippet to separate file
    const snippetDir = path.join(this.outputDirectory, recordingId, 'code-snippets');
    await fs.mkdir(snippetDir, { recursive: true });

    const snippetFile = path.join(snippetDir, `${Date.now()}-${title.replace(/\s+/g, '-').toLowerCase()}.${language}`);
    await fs.writeFile(snippetFile, code, 'utf8');

    await this.saveRecordingMetadata(recordingId);
    this.emit('codeSnippetRecorded', { recordingId, stepId, title, language });
  }

  /**
   * Record user feedback
   */
  async recordUserFeedback(
    recordingId: string,
    stepId: string,
    rating: number,
    comments: string,
    suggestions: string[] = []
  ): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    const interaction: UserInteraction = {
      timestamp: new Date(),
      action: 'complete_step',
      stepId,
      userFeedback: { rating, comments, suggestions }
    };

    metadata.interactions.push(interaction);

    await this.saveRecordingMetadata(recordingId);
    this.emit('feedbackRecorded', { recordingId, stepId, rating, comments });
  }

  /**
   * Complete the recording session
   */
  async completeRecording(recordingId: string): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    metadata.endTime = new Date();
    metadata.totalDuration = Math.round((metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000 / 60); // in minutes

    // Generate comprehensive report
    await this.generateOnboardingReport(recordingId);

    // Create interactive demo
    await this.createInteractiveDemo(recordingId);

    this.activeSessions.delete(recordingId);
    this.emit('recordingCompleted', { recordingId, metadata });

    console.log(`✅ Completed recording: ${recordingId} (${metadata.totalDuration} minutes)`);
  }

  /**
   * Get available onboarding sessions
   */
  getAvailableOnboardingSessions(): OnboardingSession[] {
    return Array.from(this.onboardingFlows.values());
  }

  /**
   * Get specific onboarding session
   */
  getOnboardingSession(sessionId: string): OnboardingSession | undefined {
    return this.onboardingFlows.get(sessionId);
  }

  /**
   * Get active recording metadata
   */
  getRecordingMetadata(recordingId: string): RecordingMetadata | undefined {
    return this.activeSessions.get(recordingId);
  }

  /**
   * Generate comprehensive onboarding report
   */
  private async generateOnboardingReport(recordingId: string): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) return;

    const session = this.onboardingFlows.get(metadata.sessionId);
    if (!session) return;

    const report = this.generateReportContent(metadata, session);
    const reportPath = path.join(this.outputDirectory, recordingId, 'onboarding-report.md');
    await fs.writeFile(reportPath, report, 'utf8');

    console.log(`📊 Generated onboarding report: ${reportPath}`);
  }

  /**
   * Generate report content
   */
  private generateReportContent(metadata: RecordingMetadata, session: OnboardingSession): string {
    const completionRate = Math.round((metadata.userProgress.stepsCompleted / metadata.userProgress.totalSteps) * 100);

    return `# Onboarding Session Report

## Session Information
- **Title**: ${session.title}
- **Recording ID**: ${metadata.sessionId}
- **Start Time**: ${metadata.startTime.toISOString()}
- **End Time**: ${metadata.endTime?.toISOString() || 'In Progress'}
- **Total Duration**: ${metadata.totalDuration || 'Ongoing'} minutes

## Progress Summary
- **Steps Completed**: ${metadata.userProgress.stepsCompleted}/${metadata.userProgress.totalSteps} (${completionRate}%)
- **Time Spent**: ${metadata.userProgress.timeSpent} minutes
- **Questions Asked**: ${metadata.userProgress.questionsAsked}
- **Help Requests**: ${metadata.userProgress.helpRequested}
- **Interactive Elements Used**: ${metadata.userProgress.interactiveElementsUsed}

## Completed Steps
${metadata.stepsCompleted.map(stepId => {
  const step = session.steps.find(s => s.id === stepId);
  return step ? `- ✅ **${step.title}** (${step.category})` : '';
}).join('\n')}

## Pending Steps
${session.steps.filter(step => !metadata.stepsCompleted.includes(step.id)).map(step =>
  `- ⏳ **${step.title}** (${step.category}) - ${step.duration} minutes`
).join('\n')}

## Code Snippets Generated
${metadata.codeSnippets.map(snippet =>
  `### ${snippet.title}
**Language**: ${snippet.language}
**Step**: ${snippet.stepId}
**Description**: ${snippet.description}
**Explanation**: ${snippet.explanation}

\`\`\`${snippet.language}
${snippet.code}
\`\`\`
`).join('\n---\n')}

## User Interactions Timeline
${metadata.interactions.map(interaction =>
  `- **${interaction.timestamp.toISOString()}**: ${interaction.action}${interaction.stepId ? ` (${interaction.stepId})` : ''}${interaction.details ? ` - ${JSON.stringify(interaction.details)}` : ''}`
).join('\n')}

## Recommendations
${this.generateRecommendations(metadata, session)}

## Next Steps
${this.generateNextSteps(metadata, session)}
`;
  }

  /**
   * Generate recommendations based on session data
   */
  private generateRecommendations(metadata: RecordingMetadata, session: OnboardingSession): string {
    const recommendations: string[] = [];

    if (metadata.userProgress.helpRequested > metadata.userProgress.stepsCompleted * 0.5) {
      recommendations.push('- Consider reviewing the prerequisite materials before attempting advanced steps');
    }

    if (metadata.userProgress.questionsAsked > metadata.userProgress.stepsCompleted * 2) {
      recommendations.push('- The documentation could be enhanced with more detailed explanations');
    }

    const completionRate = (metadata.userProgress.stepsCompleted / metadata.userProgress.totalSteps) * 100;
    if (completionRate < 100) {
      recommendations.push('- Complete the remaining steps to fully master the system');
    }

    if (metadata.codeSnippets.length > 0) {
      recommendations.push('- Review the generated code snippets for best practices');
    }

    return recommendations.join('\n');
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(metadata: RecordingMetadata, session: OnboardingSession): string {
    const nextSteps: string[] = [];

    const pendingSteps = session.steps.filter(step => !metadata.stepsCompleted.includes(step.id));
    if (pendingSteps.length > 0) {
      nextSteps.push('### Complete Remaining Steps');
      pendingSteps.forEach(step => {
        nextSteps.push(`- ${step.title} (${step.duration} minutes)`);
      });
    }

    nextSteps.push('### Practice Projects');
    nextSteps.push('- Create a real project using the automated system');
    nextSteps.push('- Experiment with different technology stacks');
    nextSteps.push('- Try customizing generated configurations');

    nextSteps.push('### Advanced Features');
    nextSteps.push('- Explore custom template creation');
    nextSteps.push('- Set up team workflows');
    nextSteps.push('- Integrate with existing CI/CD pipelines');

    return nextSteps.join('\n');
  }

  /**
   * Create interactive demo
   */
  private async createInteractiveDemo(recordingId: string): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) return;

    const session = this.onboardingFlows.get(metadata.sessionId);
    if (!session) return;

    const demoContent = this.generateInteractiveDemo(metadata, session);
    const demoPath = path.join(this.outputDirectory, recordingId, 'interactive-demo.html');
    await fs.writeFile(demoPath, demoContent, 'utf8');

    console.log(`🎮 Created interactive demo: ${demoPath}`);
  }

  /**
   * Generate interactive demo content
   */
  private generateInteractiveDemo(metadata: RecordingMetadata, session: OnboardingSession): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Demo: ${session.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .step { margin-bottom: 30px; padding: 20px; border: 1px solid #e1e5e9; border-radius: 8px; }
        .step.completed { background: #f0f9ff; border-color: #3b82f6; }
        .step.pending { opacity: 0.6; }
        .step h3 { margin: 0 0 10px 0; color: #1f2937; }
        .step p { margin: 0 0 15px 0; color: #6b7280; }
        .step .meta { font-size: 14px; color: #9ca3af; }
        .code-snippet { background: #1f2937; color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 10px 0; overflow-x: auto; }
        .progress { background: #e5e7eb; height: 8px; border-radius: 4px; margin: 20px 0; overflow: hidden; }
        .progress-bar { background: #3b82f6; height: 100%; transition: width 0.3s ease; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat { text-align: center; padding: 15px; background: #f9fafb; border-radius: 8px; }
        .stat .value { font-size: 24px; font-weight: bold; color: #1f2937; }
        .stat .label { font-size: 14px; color: #6b7280; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 Interactive Demo: ${session.title}</h1>
        <p>${session.description}</p>

        <div class="stats">
            <div class="stat">
                <div class="value">${Math.round((metadata.userProgress.stepsCompleted / metadata.userProgress.totalSteps) * 100)}%</div>
                <div class="label">Completed</div>
            </div>
            <div class="stat">
                <div class="value">${metadata.userProgress.stepsCompleted}</div>
                <div class="label">Steps Done</div>
            </div>
            <div class="stat">
                <div class="value">${metadata.userProgress.questionsAsked}</div>
                <div class="label">Questions</div>
            </div>
            <div class="stat">
                <div class="value">${metadata.totalDuration || 'Ongoing'}</div>
                <div class="label">Minutes</div>
            </div>
        </div>

        <div class="progress">
            <div class="progress-bar" style="width: ${(metadata.userProgress.stepsCompleted / metadata.userProgress.totalSteps) * 100}%"></div>
        </div>

        <h2>🚀 Onboarding Steps</h2>
        ${session.steps.map(step => `
            <div class="step ${metadata.stepsCompleted.includes(step.id) ? 'completed' : 'pending'}">
                <h3>${metadata.stepsCompleted.includes(step.id) ? '✅' : '⏳'} ${step.title}</h3>
                <p>${step.description}</p>
                <div class="meta">
                    Category: ${step.category} |
                    Duration: ${step.duration} minutes |
                    Difficulty: ${step.difficulty}
                </div>
                ${metadata.codeSnippets.filter(snippet => snippet.stepId === step.id).map(snippet => `
                    <h4>💻 ${snippet.title}</h4>
                    <div class="code-snippet"><pre>${snippet.code}</pre></div>
                    <p><em>${snippet.explanation}</em></p>
                `).join('')}
            </div>
        `).join('')}
    </div>

    <script>
        // Interactive elements
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', function() {
                this.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 200);
            });
        });

        // Animate progress bar on load
        setTimeout(() => {
            const progressBar = document.querySelector('.progress-bar');
            progressBar.style.width = progressBar.style.width;
        }, 100);
    </script>
</body>
</html>`;
  }

  /**
   * Save recording metadata
   */
  private async saveRecordingMetadata(recordingId: string): Promise<void> {
    const metadata = this.activeSessions.get(recordingId);
    if (!metadata) return;

    const metadataPath = path.join(this.outputDirectory, recordingId, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDirectory, { recursive: true });
    } catch (error) {
      console.warn('Could not create output directory:', error);
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    totalSessions: number;
    activeRecordings: number;
    completedRecordings: number;
    averageCompletionTime: number;
    popularSessions: string[];
  }> {
    // This would analyze stored recordings
    return {
      totalSessions: this.onboardingFlows.size,
      activeRecordings: this.activeSessions.size,
      completedRecordings: 0, // Would be calculated from stored data
      averageCompletionTime: 0,
      popularSessions: ['automated-project-creation-main', 'quick-start-onboarding']
    };
  }
}

export default MCPOnboardingRecorder;
