/**
 * Tour Manager - Interactive onboarding tour system
 */

import * as vscode from 'vscode';

export interface TourStep {
    id: string;
    target: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    action?: {
        label: string;
        command: string;
    };
}

export interface Tour {
    id: string;
    name: string;
    description: string;
    steps: TourStep[];
}

export class TourManager {
    private currentTour: Tour | null = null;
    private currentStep = 0;
    private onStepChange?: (step: TourStep, index: number, total: number) => void;

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Start a tour
     */
    async startTour(tourId: string, onStepChange?: (step: TourStep, index: number, total: number) => void): Promise<void> {
        this.currentTour = this.getTour(tourId);
        if (!this.currentTour) {
            vscode.window.showErrorMessage(`Tour "${tourId}" not found`);
            return;
        }

        this.currentStep = 0;
        this.onStepChange = onStepChange;

        // Mark tour as started
        await this.context.globalState.update(`tour:${tourId}:started`, true);

        this.showCurrentStep();
    }

    /**
     * Show current step
     */
    private showCurrentStep(): void {
        if (!this.currentTour) return;

        const step = this.currentTour.steps[this.currentStep];
        const total = this.currentTour.steps.length;

        // Notify listeners
        if (this.onStepChange) {
            this.onStepChange(step, this.currentStep, total);
        }
    }

    /**
     * Move to next step
     */
    async next(): Promise<void> {
        if (!this.currentTour) return;

        if (this.currentStep < this.currentTour.steps.length - 1) {
            this.currentStep++;
            this.showCurrentStep();
        } else {
            await this.complete();
        }
    }

    async initialize(): Promise<void> {
        // Migration: Check if user already installed (v2.4.x upgrade)
        const legacyWelcome = this.context.globalState.get<boolean>('welcome.shown');
        if (legacyWelcome) {
            await this.context.globalState.update('lunaforge.tours.onboarding.completed', true);
        }

        // Always show welcome tour for new users
        if (!this.hasCompletedTour('onboarding')) {
            // Delay slightly to allow extension to fully activate
            setTimeout(() => {
                this.startTour('onboarding');
            }, 2000);
        }
    }

    /**
     * Move to previous step
     */
    previous(): void {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showCurrentStep();
        }
    }

    /**
     * Skip tour
     */
    async skip(): Promise<void> {
        if (!this.currentTour) return;

        const result = await vscode.window.showWarningMessage(
            'Are you sure you want to skip the tour?',
            'Skip',
            'Continue Tour'
        );

        if (result === 'Skip') {
            await this.context.globalState.update(`tour:${this.currentTour.id}:skipped`, true);
            this.currentTour = null;
            this.currentStep = 0;
        }
    }

    /**
     * Complete tour
     */
    private async complete(): Promise<void> {
        if (!this.currentTour) return;

        await this.context.globalState.update(`tour:${this.currentTour.id}:completed`, true);

        vscode.window.showInformationMessage(
            `🎉 Tour completed! You've learned the basics of ${this.currentTour.name}.`,
            'Awesome!'
        );

        this.currentTour = null;
        this.currentStep = 0;
    }

    /**
     * Check if tour is completed
     */
    isTourCompleted(tourId: string): boolean {
        return this.context.globalState.get(`tour:${tourId}:completed`, false);
    }

    /**
     * Check if tour is already completed
     */
    private hasCompletedTour(tourId: string): boolean {
        return this.context.globalState.get(`tour:${tourId}:completed`, false);
    }

    /**
     * Get tour by ID
     */
    private getTour(tourId: string): Tour | null {
        const tours = this.getAllTours();
        return tours.find(t => t.id === tourId) || null;
    }

    /**
     * Get all available tours
     */
    getAllTours(): Tour[] {
        return [
            {
                id: 'control-center',
                name: 'Control Center',
                description: 'Learn how to use the LunaForge Control Center',
                steps: [
                    {
                        id: 'welcome',
                        target: '#control-center-root',
                        title: 'Welcome to LunaForge! 🌙',
                        content: 'This tour will guide you through the main features of the Control Center. Let\'s get started!',
                        position: 'bottom'
                    },
                    {
                        id: 'status',
                        target: '#status-section',
                        title: 'Extension Status',
                        content: 'Monitor your extension health, performance, and active modes here. The status indicators show real-time information.',
                        position: 'bottom'
                    },
                    {
                        id: 'graph-metrics',
                        target: '#graph-metrics',
                        title: 'Project Graph Metrics',
                        content: 'View detailed analytics about your codebase including file count, dependencies, and build time.',
                        position: 'bottom'
                    },
                    {
                        id: 'deep-analysis',
                        target: '#active-file-section',
                        title: 'Deep File Analysis 🔍',
                        content: ' instantly analyze your current file for complexity, dependencies, and potential issues. Try it now!',
                        position: 'left',
                        action: {
                            label: 'Analyze Current File',
                            command: 'lunaforge.analyzeFile'
                        }
                    },
                    {
                        id: 'ai-planning',
                        target: '#ai-planning-section',
                        title: 'AI Analysis Plan 🤖',
                        content: 'Need direction? Request an AI-generated refactoring or implementation plan for your codebase.',
                        position: 'left',
                        action: {
                            label: 'Request Plan',
                            command: 'lunaforge.requestPlan'
                        }
                    },
                    {
                        id: 'modes',
                        target: '#mode-management',
                        title: 'Analysis Modes',
                        content: 'LunaForge offers multiple analysis modes like Galaxy, CodeFlow, and TimeTravel. Each provides unique insights into your code.',
                        position: 'top'
                    },
                    {
                        id: 'license',
                        target: '#license-section',
                        title: 'License & Features',
                        content: 'Manage your subscription and view available features. Upgrade to unlock premium analysis modes and advanced capabilities.',
                        position: 'top'
                    },
                    {
                        id: 'notifications',
                        target: '#notifications-panel',
                        title: 'Notifications',
                        content: 'Stay updated with important messages, warnings, and tips. You can filter and manage notifications here.',
                        position: 'left'
                    },
                    {
                        id: 'complete',
                        target: '#control-center-root',
                        title: 'You\'re All Set! 🚀',
                        content: 'You now know the basics of LunaForge Control Center. Start by building your project graph to see it in action!',
                        position: 'bottom',
                        action: {
                            label: 'Build Graph Now',
                            command: 'lunaforge.buildGraph'
                        }
                    }
                ]
            },
            {
                id: 'first-graph',
                name: 'Building Your First Graph',
                description: 'Learn how to build and analyze your project graph',
                steps: [
                    {
                        id: 'intro',
                        target: '#graph-section',
                        title: 'Project Graph',
                        content: 'The project graph is the foundation of LunaForge. It analyzes your codebase to understand dependencies and relationships.',
                        position: 'bottom'
                    },
                    {
                        id: 'build',
                        target: '#build-graph-button',
                        title: 'Build Your Graph',
                        content: 'Click here to build your first project graph. This will scan your workspace and create a dependency map.',
                        position: 'bottom',
                        action: {
                            label: 'Build Graph',
                            command: 'lunaforge.buildGraph'
                        }
                    },
                    {
                        id: 'metrics',
                        target: '#graph-metrics',
                        title: 'Understanding Metrics',
                        content: 'After building, you\'ll see metrics like file count, dependency count, and build time. These help you understand your project\'s complexity.',
                        position: 'top'
                    },
                    {
                        id: 'export',
                        target: '#export-graph-button',
                        title: 'Export Your Graph',
                        content: 'You can export your graph in various formats (JSON, DOT, SVG) for documentation or external analysis.',
                        position: 'left'
                    }
                ]
            },
            {
                id: 'modes-overview',
                name: 'Analysis Modes',
                description: 'Explore different analysis modes and their capabilities',
                steps: [
                    {
                        id: 'intro',
                        target: '#mode-management',
                        title: 'Analysis Modes',
                        content: 'LunaForge offers multiple specialized analysis modes. Each mode provides unique insights into your codebase.',
                        position: 'bottom'
                    },
                    {
                        id: 'galaxy',
                        target: '#mode-galaxy',
                        title: 'Galaxy Mode 🌌',
                        content: 'Visualize your entire project as an interactive 3D galaxy. Great for understanding overall architecture.',
                        position: 'right'
                    },
                    {
                        id: 'codeflow',
                        target: '#mode-codeflow',
                        title: 'CodeFlow Mode 🌊',
                        content: 'Track data flow and execution paths through your code. Perfect for debugging and optimization.',
                        position: 'right'
                    },
                    {
                        id: 'timetravel',
                        target: '#mode-timetravel',
                        title: 'TimeTravel Mode ⏰',
                        content: 'Explore your codebase history and evolution over time. See how your project has grown.',
                        position: 'right'
                    },
                    {
                        id: 'activation',
                        target: '#activate-mode-button',
                        title: 'Activating Modes',
                        content: 'Click on any mode to activate it. Some advanced modes require a premium subscription.',
                        position: 'top'
                    }
                ]
            },
            {
                id: 'power-user',
                name: 'Power User Features',
                description: 'Master the advanced capabilities of LunaForge',
                steps: [
                    {
                        id: 'zen-focus',
                        target: '#zen-mode-toggle',
                        title: 'Zen Focus Mode 🧘',
                        content: 'Eliminate distractions and focus on your code. Zen Mode analyzes your working set and hides irrelevant files.',
                        position: 'bottom'
                    },
                    {
                        id: 'smart-refactor',
                        target: '#refactor-tools',
                        title: 'Smart Refactoring',
                        content: 'Use AI-driven suggestions to refactor complex functions and improve code quality automatically.',
                        position: 'right'
                    },
                    {
                        id: 'dependency-investigation',
                        target: '#dependency-graph',
                        title: 'Dependency Investigation',
                        content: 'Right-click any node in the graph to deep-dive into its dependencies and usages across the project.',
                        position: 'left'
                    }
                ]
            }
        ];
    }

    /**
     * Get tour progress
     */
    getTourProgress(tourId: string): {
        started: boolean;
        completed: boolean;
        skipped: boolean;
    } {
        return {
            started: this.context.globalState.get(`tour:${tourId}:started`, false),
            completed: this.context.globalState.get(`tour:${tourId}:completed`, false),
            skipped: this.context.globalState.get(`tour:${tourId}:skipped`, false)
        };
    }

    /**
     * Reset tour progress
     */
    async resetTour(tourId: string): Promise<void> {
        await this.context.globalState.update(`tour:${tourId}:started`, undefined);
        await this.context.globalState.update(`tour:${tourId}:completed`, undefined);
        await this.context.globalState.update(`tour:${tourId}:skipped`, undefined);
    }
}
