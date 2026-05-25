/**
 * Onboarding Checklist Manager
 * Tracks user progress through onboarding tasks
 */

import * as vscode from 'vscode';

export interface OnboardingTask {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    command?: string;
    icon?: string;
    category: 'getting-started' | 'core-features' | 'advanced';
}

export interface OnboardingProgress {
    // Getting Started
    openedControlCenter: boolean;
    completedTour: boolean;
    readDocumentation: boolean;

    // Core Features
    builtFirstGraph: boolean;
    exploredMode: boolean;
    viewedMetrics: boolean;
    analyzedFile: boolean;

    // Advanced
    exportedGraph: boolean;
    customizedSettings: boolean;
    requestedPlan: boolean;
    upgradedLicense: boolean;
}

export class OnboardingChecklistManager {
    private progress: OnboardingProgress;

    constructor(private context: vscode.ExtensionContext) {
        this.progress = this.loadProgress();
    }

    /**
     * Load progress from storage
     */
    private loadProgress(): OnboardingProgress {
        const stored = this.context.globalState.get<OnboardingProgress>('onboarding:progress');
        return stored || {
            openedControlCenter: false,
            completedTour: false,
            readDocumentation: false,
            builtFirstGraph: false,
            exploredMode: false,
            viewedMetrics: false,
            analyzedFile: false,
            exportedGraph: false,
            customizedSettings: false,
            requestedPlan: false,
            upgradedLicense: false
        };
    }

    /**
     * Save progress to storage
     */
    private async saveProgress(): Promise<void> {
        await this.context.globalState.update('onboarding:progress', this.progress);
    }

    /**
     * Mark a task as complete
     */
    async markComplete(taskId: keyof OnboardingProgress): Promise<void> {
        if (this.progress[taskId]) {
            return; // Already completed
        }

        this.progress[taskId] = true;
        await this.saveProgress();

        // Show celebration for important milestones
        if (this.shouldCelebrate(taskId)) {
            this.showCelebration(taskId);
        }

        // Check if all tasks are complete
        if (this.isFullyComplete()) {
            this.showCompletionCelebration();
        }
    }

    /**
     * Check if task should trigger celebration
     */
    private shouldCelebrate(taskId: keyof OnboardingProgress): boolean {
        const celebrateFor: (keyof OnboardingProgress)[] = [
            'completedTour',
            'builtFirstGraph',
            'exploredMode'
        ];
        return celebrateFor.includes(taskId);
    }

    /**
     * Show celebration for task completion
     */
    private showCelebration(taskId: keyof OnboardingProgress): void {
        const messages: Record<string, string> = {
            completedTour: '🎉 Great job! You\'ve completed the tour.',
            builtFirstGraph: '🚀 Awesome! Your first graph is ready.',
            exploredMode: '🌟 Nice! You\'re exploring LunaForge modes.'
        };

        const message = messages[taskId] || '✅ Task completed!';
        vscode.window.showInformationMessage(message);
    }

    /**
     * Show completion celebration
     */
    private async showCompletionCelebration(): Promise<void> {
        const result = await vscode.window.showInformationMessage(
            '🎊 Congratulations! You\'ve completed the LunaForge onboarding! You\'re now ready to unlock the full power of code analysis.',
            'View Advanced Features',
            'Share Feedback',
            'Dismiss'
        );

        if (result === 'View Advanced Features') {
            vscode.commands.executeCommand('lunaforge.listModes');
        } else if (result === 'Share Feedback') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/lunaforge/lunaforge/issues'));
        }
    }

    /**
     * Get all tasks with completion status
     */
    getAllTasks(): OnboardingTask[] {
        return [
            // Getting Started
            {
                id: 'openedControlCenter',
                title: 'Open Control Center',
                description: 'Launch the LunaForge Control Center dashboard',
                completed: this.progress.openedControlCenter,
                command: 'lunaforge.openControlCenter',
                icon: '🎛️',
                category: 'getting-started'
            },
            {
                id: 'completedTour',
                title: 'Complete the Tour',
                description: 'Take the interactive tour to learn the basics',
                completed: this.progress.completedTour,
                icon: '🗺️',
                category: 'getting-started'
            },
            {
                id: 'readDocumentation',
                title: 'Read Documentation',
                description: 'Browse the LunaForge documentation',
                completed: this.progress.readDocumentation,
                command: 'lunaforge.openDocumentation',
                icon: '📚',
                category: 'getting-started'
            },

            // Core Features
            {
                id: 'builtFirstGraph',
                title: 'Build Your First Graph',
                description: 'Analyze your project and build a dependency graph',
                completed: this.progress.builtFirstGraph,
                command: 'lunaforge.buildGraph',
                icon: '📊',
                category: 'core-features'
            },
            {
                id: 'viewedMetrics',
                title: 'View Graph Metrics',
                description: 'Check out your project\'s analytics and metrics',
                completed: this.progress.viewedMetrics,
                command: 'lunaforge.showGraphMetrics',
                icon: '📈',
                category: 'core-features'
            },
            {
                id: 'exploredMode',
                title: 'Try an Analysis Mode',
                description: 'Activate and explore a LunaForge analysis mode',
                completed: this.progress.exploredMode,
                command: 'lunaforge.listModes',
                icon: '🌌',
                category: 'core-features'
            },
            {
                id: 'analyzedFile',
                title: 'Analyze a File',
                description: 'Run analysis on a specific file in your project',
                completed: this.progress.analyzedFile,
                command: 'lunaforge.analyzeFile',
                icon: '🔍',
                category: 'core-features'
            },

            // Advanced
            {
                id: 'exportedGraph',
                title: 'Export Your Graph',
                description: 'Export your project graph to JSON, DOT, or SVG',
                completed: this.progress.exportedGraph,
                command: 'lunaforge.exportGraph',
                icon: '💾',
                category: 'advanced'
            },
            {
                id: 'customizedSettings',
                title: 'Customize Settings',
                description: 'Adjust LunaForge settings to your preferences',
                completed: this.progress.customizedSettings,
                command: 'lunaforge.openSettings',
                icon: '⚙️',
                category: 'advanced'
            },
            {
                id: 'requestedPlan',
                title: 'Request an Analysis Plan',
                description: 'Get AI-powered suggestions for your project',
                completed: this.progress.requestedPlan,
                command: 'lunaforge.requestPlan',
                icon: '🤖',
                category: 'advanced'
            }
        ];
    }

    /**
     * Get tasks by category
     */
    getTasksByCategory(category: OnboardingTask['category']): OnboardingTask[] {
        return this.getAllTasks().filter(task => task.category === category);
    }

    /**
     * Get completion percentage
     */
    getCompletionPercentage(): number {
        const tasks = this.getAllTasks();
        const completed = tasks.filter(t => t.completed).length;
        return Math.round((completed / tasks.length) * 100);
    }

    /**
     * Get category completion
     */
    getCategoryCompletion(category: OnboardingTask['category']): {
        completed: number;
        total: number;
        percentage: number;
    } {
        const tasks = this.getTasksByCategory(category);
        const completed = tasks.filter(t => t.completed).length;
        return {
            completed,
            total: tasks.length,
            percentage: Math.round((completed / tasks.length) * 100)
        };
    }

    /**
     * Check if all tasks are complete
     */
    isFullyComplete(): boolean {
        return this.getCompletionPercentage() === 100;
    }

    /**
     * Check if category is complete
     */
    isCategoryComplete(category: OnboardingTask['category']): boolean {
        return this.getCategoryCompletion(category).percentage === 100;
    }

    /**
     * Get next recommended task
     */
    getNextTask(): OnboardingTask | null {
        const tasks = this.getAllTasks();
        return tasks.find(t => !t.completed) || null;
    }

    /**
     * Reset all progress
     */
    async reset(): Promise<void> {
        this.progress = {
            openedControlCenter: false,
            completedTour: false,
            readDocumentation: false,
            builtFirstGraph: false,
            exploredMode: false,
            viewedMetrics: false,
            analyzedFile: false,
            exportedGraph: false,
            customizedSettings: false,
            requestedPlan: false,
            upgradedLicense: false
        };
        await this.saveProgress();
    }

    /**
     * Get progress summary for display
     */
    getProgressSummary(): {
        overall: number;
        gettingStarted: number;
        coreFeatures: number;
        advanced: number;
        nextTask: OnboardingTask | null;
    } {
        return {
            overall: this.getCompletionPercentage(),
            gettingStarted: this.getCategoryCompletion('getting-started').percentage,
            coreFeatures: this.getCategoryCompletion('core-features').percentage,
            advanced: this.getCategoryCompletion('advanced').percentage,
            nextTask: this.getNextTask()
        };
    }
}
