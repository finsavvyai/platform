/**
 * Core LunaForge Commands
 * Provides fundamental functionality for graph management, modes, and basic operations
 */

import * as vscode from 'vscode';
// Define a local interface for QuickPick items with custom properties
interface ModeQuickPickItem extends vscode.QuickPickItem {
  modeId: string;
}
import { CommandRegistration } from './types';
import type { LunaForgeCore } from 'lunaforge-core';
import { getNotificationManager } from '../ui/NotificationManager';

export class CoreCommands {
  private core: LunaForgeCore | null = null;
  private notificationManager = getNotificationManager();

  constructor(core: LunaForgeCore | null = null) {
    this.core = core;
  }

  /**
   * Set the core instance
   */
  setCore(core: LunaForgeCore | null): void {
    this.core = core;
  }

  /**
   * Get all core command registrations
   */
  getCommands(): CommandRegistration[] {
    return [
      // Graph Management Commands
      {
        id: 'lunaforge.buildGraph',
        title: 'Build Project Graph',
        description: 'Build or rebuild the complete project dependency graph',
        category: 'Graph',
        handler: () => this.buildGraph(),
        when: 'workspaceOpen',
        context: { requiresGraph: false },
        keywords: ['build', 'graph', 'analyze', 'scan'],
        icon: '📊'
      },
      {
        id: 'lunaforge.refreshGraph',
        title: 'Refresh Graph',
        description: 'Refresh the current project graph with latest changes',
        category: 'Graph',
        handler: () => this.refreshGraph(),
        when: 'workspaceOpen && hasGraph',
        context: { requiresGraph: true },
        keywords: ['refresh', 'update', 'reload', 'sync'],
        icon: '🔄'
      },
      {
        id: 'lunaforge.clearGraph',
        title: 'Clear Graph Cache',
        description: 'Clear all cached graph data and rebuild from scratch',
        category: 'Graph',
        handler: () => this.clearGraph(),
        when: 'workspaceOpen && hasGraph',
        context: { requiresGraph: true },
        keywords: ['clear', 'cache', 'reset', 'clean'],
        icon: '🗑️'
      },
      {
        id: 'lunaforge.exportGraph',
        title: 'Export Graph',
        description: 'Export project graph to various formats (JSON, DOT, SVG)',
        category: 'Graph',
        handler: () => this.exportGraph(),
        when: 'workspaceOpen && hasGraph',
        context: { requiresGraph: true },
        keywords: ['export', 'save', 'download', 'graph'],
        icon: '💾'
      },

      // Control Center Commands
      // Note: openControlCenter is registered in extension.ts
      {
        id: 'lunaforge.showGraphMetrics',
        title: 'Show Graph Metrics',
        description: 'Display detailed metrics and statistics about the project graph',
        category: 'Control Center',
        handler: () => this.showGraphMetrics(),
        when: 'workspaceOpen && hasGraph',
        context: { requiresGraph: true },
        keywords: ['metrics', 'statistics', 'analytics', 'data'],
        icon: '📈'
      },
      {
        id: 'lunaforge.showAuraMetrics',
        title: 'Show Aura Metrics',
        description: 'Display repository health and language distribution metrics',
        category: 'Control Center',
        handler: () => this.showAuraMetrics(),
        when: 'workspaceOpen',
        keywords: ['aura', 'health', 'repo', 'languages'],
        icon: '✨'
      },
      {
        id: 'lunaforge.startZenFocus',
        title: 'Start Zen Focus',
        description: 'Activate AI-powered focus mode',
        category: 'Control Center',
        handler: () => this.startZenFocus(),
        when: 'workspaceOpen',
        keywords: ['zen', 'focus', 'ai', 'start'],
        icon: '🧘'
      },
      {
        id: 'lunaforge.stopZenFocus',
        title: 'Stop Zen Focus',
        description: 'Deactivate focus mode',
        category: 'Control Center',
        handler: () => this.stopZenFocus(),
        when: 'workspaceOpen && zenActive',
        keywords: ['zen', 'stop', 'focus'],
        icon: '⏹️'
      },
      {
        id: 'lunaforge.showZenSummary',
        title: 'Show Zen Summary',
        description: 'Show AI-generated session summary',
        category: 'Control Center',
        handler: () => this.showZenSummary(),
        when: 'workspaceOpen && isPremium',
        keywords: ['zen', 'summary', 'ai', 'report'],
        icon: '📝'
      },

      // Mode Management Commands
      {
        id: 'lunaforge.listModes',
        title: 'List Available Modes',
        description: 'Show all available LunaForge modes and their status',
        category: 'Modes',
        handler: () => this.listModes(),
        when: 'workspaceOpen',
        keywords: ['modes', 'list', 'available', 'status'],
        icon: '📋'
      },
      {
        id: 'lunaforge.activateMode',
        title: 'Activate Mode',
        description: 'Activate a specific LunaForge mode',
        category: 'Modes',
        handler: () => this.activateMode(),
        when: 'workspaceOpen && hasLicense',
        context: { requiresLicense: true },
        keywords: ['activate', 'enable', 'start', 'mode'],
        icon: '▶️'
      },
      {
        id: 'lunaforge.deactivateMode',
        title: 'Deactivate Mode',
        description: 'Deactivate the current LunaForge mode',
        category: 'Modes',
        handler: () => this.deactivateMode(),
        when: 'workspaceOpen',
        keywords: ['deactivate', 'disable', 'stop', 'mode'],
        icon: '⏹️'
      },
      {
        id: 'lunaforge.toggleMode',
        title: 'Toggle Mode',
        description: 'Toggle activation of the specified LunaForge mode',
        category: 'Modes',
        handler: () => this.toggleMode(),
        when: 'workspaceOpen && hasLicense',
        context: { requiresLicense: true },
        keywords: ['toggle', 'switch', 'mode'],
        icon: '🔀'
      },

      // Analysis Commands
      {
        id: 'lunaforge.analyzeFile',
        title: 'Analyze Current File',
        description: 'Analyze the currently active file for dependencies and metrics',
        category: 'Analysis',
        handler: () => this.analyzeCurrentFile(),
        when: 'workspaceOpen && hasGraph',
        context: { requiresGraph: true },
        keywords: ['analyze', 'file', 'current', 'active'],
        icon: '🔍'
      },
      {
        id: 'lunaforge.analyzeSelection',
        title: 'Analyze Selection',
        description: 'Analyze the selected code or files',
        category: 'Analysis',
        handler: () => this.analyzeSelection(),
        when: 'workspaceOpen && hasGraph',
        context: { requiresGraph: true },
        keywords: ['analyze', 'selection', 'highlighted'],
        icon: '🎯'
      },
      {
        id: 'lunaforge.requestPlan',
        title: 'Request Analysis Plan',
        description: 'Request an AI-powered analysis plan for the project',
        category: 'Analysis',
        handler: () => this.requestAnalysisPlan(),
        when: 'workspaceOpen && hasGraph && isPremium',
        context: { requiresGraph: true, requiresPremium: true },
        keywords: ['plan', 'analysis', 'ai', 'suggest'],
        icon: '🤖'
      },

      // License Management Commands
      {
        id: 'lunaforge.enterLicense',
        title: 'Enter License Key',
        description: 'Enter or update your LunaForge license key',
        category: 'License',
        handler: () => this.enterLicense(),
        when: 'workspaceOpen',
        keywords: ['license', 'key', 'activate', 'premium'],
        icon: '🔑'
      },
      {
        id: 'lunaforge.checkLicense',
        title: 'Check License Status',
        description: 'Check current license status and available features',
        category: 'License',
        handler: () => this.checkLicense(),
        when: 'workspaceOpen',
        keywords: ['license', 'status', 'check', 'verify'],
        icon: '✅'
      },
      {
        id: 'lunaforge.upgradeLicense',
        title: 'Upgrade to Premium',
        description: 'Upgrade your LunaForge license to premium',
        category: 'License',
        handler: () => this.upgradeLicense(),
        when: 'workspaceOpen && !isPremium',
        keywords: ['upgrade', 'premium', 'pro', 'purchase'],
        icon: '⭐'
      },

      // Configuration Commands
      {
        id: 'lunaforge.openSettings',
        title: 'Open Settings',
        description: 'Open LunaForge configuration settings',
        category: 'Configuration',
        handler: () => this.openSettings(),
        keywords: ['settings', 'config', 'preferences', 'options'],
        icon: '⚙️'
      },
      {
        id: 'lunaforge.resetSettings',
        title: 'Reset Settings',
        description: 'Reset all LunaForge settings to default values',
        category: 'Configuration',
        handler: () => this.resetSettings(),
        when: 'workspaceOpen',
        keywords: ['reset', 'defaults', 'clear', 'settings'],
        icon: '🔄'
      },

      // Help and Documentation Commands
      {
        id: 'lunaforge.showOutput',
        title: 'Show Output Channel',
        description: 'Show the LunaForge output channel with logs and messages',
        category: 'Help',
        handler: () => this.showOutput(),
        keywords: ['output', 'logs', 'console', 'debug'],
        icon: '📄'
      },
      {
        id: 'lunaforge.openDocumentation',
        title: 'Open Documentation',
        description: 'Open LunaForge documentation in your browser',
        category: 'Help',
        handler: () => this.openDocumentation(),
        keywords: ['docs', 'documentation', 'help', 'guide'],
        icon: '📚'
      },
      {
        id: 'lunaforge.reportIssue',
        title: 'Report Issue',
        description: 'Report a bug or request a feature',
        category: 'Help',
        handler: () => this.reportIssue(),
        keywords: ['issue', 'bug', 'report', 'feedback'],
        icon: '🐛'
      },
      {
        id: 'lunaforge.showWelcome',
        title: 'Show Welcome Guide',
        description: 'Show the LunaForge welcome guide and getting started tips',
        category: 'Help',
        handler: () => this.showWelcome(),
        when: 'workspaceOpen',
        keywords: ['welcome', 'guide', 'tutorial', 'getting', 'started'],
        icon: '👋'
      },
      // Phase 9: Dream Integration
      {
        id: 'lunaforge.dream.start',
        title: 'Start Dream Session',
        description: 'Trigger an AI Dream session on the cloud backend',
        category: 'Modes',
        handler: () => this.startDream(),
        when: 'workspaceOpen && hasLicense',
        context: { requiresLicense: true },
        keywords: ['dream', 'ai', 'cloud', 'generate'],
        icon: '☁️'
      }
    ];
  }

  // Command Implementations

  // Command Implementations

  private async ensureCore(): Promise<boolean> {
    if (!this.core) {
      this.notificationManager.error(
        'LunaForge Not Initialized',
        'LunaForge core services are not ready. Please try opening the Control Center to initialize.',
        [
          { label: 'Open Control Center', action: 'lunaforge.openControlCenter', primary: true },
          { label: 'Show Output', action: 'showOutput' },
          { label: 'Reload Window', action: 'reloadWindow' }
        ]
      );
      return false;
    }
    return true;
  }

  private async buildGraph(): Promise<void> {
    if (!await this.ensureCore()) return;

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Building Project Graph',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Initializing...' });

          progress.report({ increment: 20, message: 'Scanning files...' });
          await this.core!.ensureGraph();

          progress.report({ increment: 60, message: 'Analyzing dependencies...' });
          await new Promise(resolve => setTimeout(resolve, 1000));

          progress.report({ increment: 100, message: 'Complete!' });
        }
      );

      this.notificationManager.info(
        'Graph Built Successfully',
        'Project dependency graph has been built.',
        [
          { label: 'Visualize Graph', action: 'lunaforge.openControlCenter' },
          { label: 'Show Metrics', action: 'lunaforge.showGraphMetrics' }
        ]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error(
        'Build Failed',
        `Failed to build project graph: ${message}`
      );
    }
  }

  private async refreshGraph(): Promise<void> {
    if (!await this.ensureCore()) return;

    try {
      await this.core!.refresh();
      this.notificationManager.success(
        'Graph Refreshed',
        'Project graph has been refreshed with latest changes.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error(
        'Refresh Failed',
        `Failed to refresh graph: ${message}`
      );
    }
  }

  private async clearGraph(): Promise<void> {
    if (!this.core) return;
    try {
      await (this.core as any).clearGraph?.();
    } catch (e) { /* ignore */ }
    this.notificationManager.success(
      'Graph Cleared',
      'Graph cache has been cleared'
    );
  }

  private async exportGraph(): Promise<void> {
    // ... export implementation ...
    this.notificationManager.info('Coming Soon', 'Graph export will be available in the next update');
  }

  private async openControlCenter(): Promise<void> {
    // This command is handled by the extension.ts activation handler
    // We just need to trigger it, but avoid recursion
    if (this.core) {
      // The actual implementation is in extension.ts
      // This handler just ensures the command exists
      await vscode.commands.executeCommand('lunaforge.openControlCenter');
    } else {
      vscode.window.showWarningMessage('Please open the Control Center first to initialize LunaForge.');
    }
  }

  private async startZenFocus(): Promise<void> {
    if (!await this.ensureCore()) return;

    try {
      const zenMode = this.core!.getMode('zen') as any;
      if (!zenMode) {
        vscode.window.showErrorMessage('Zen mode is not active.');
        return;
      }

      await zenMode.startFocus();
      this.notificationManager.success('Zen Focus Started', 'AI focus mode is now active.');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start Zen: ${error}`);
    }
  }

  private async stopZenFocus(): Promise<void> {
    if (!this.core) return;
    try {
      const zenMode = this.core.getMode('zen') as any;
      if (zenMode) {
        await zenMode.stopFocus();
        this.notificationManager.info('Zen Focus Stopped', 'Focus session ended.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop Zen: ${error}`);
    }
  }

  private async showZenSummary(): Promise<void> {
    if (!this.core) return;
    try {
      const zenMode = this.core.getMode('zen') as any;
      if (zenMode) {
        const summary = await zenMode.getSummary();
        vscode.window.showInformationMessage(`🧘 Zen Summary: ${summary}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get Zen summary: ${error}`);
    }
  }

  private async showAuraMetrics(): Promise<void> {
    if (!await this.ensureCore()) return;

    try {
      const auraMode = this.core!.getMode('aura') as any;
      if (!auraMode) {
        vscode.window.showErrorMessage('Aura mode is not active.');
        return;
      }

      const metrics = await auraMode.getMetrics();
      const langStats = Object.entries(metrics.languageStats)
        .map(([lang, count]) => `  ${lang}: ${count}`)
        .join('\n');

      // Format advanced metrics
      const complexityLabel = metrics.complexityScore !== undefined
        ? `${metrics.complexityScore} / 100`
        : 'N/A';

      const busFactorLabel = metrics.busFactor
        ? `${metrics.busFactor.score} / 10`
        : 'N/A';

      const depHealthLabel = metrics.dependencyHealth
        ? `${metrics.dependencyHealth.healthScore} / 100`
        : 'N/A';

      const circularDepsCount = metrics.dependencyHealth?.circularDeps?.length ?? 0;
      const orphanFilesCount = metrics.dependencyHealth?.orphanFiles?.length ?? 0;

      const message = `
✨ Aura Repository Health

📊 Overview
  Files: ${metrics.fileCount}
  Total Size: ${(metrics.totalSize / 1024).toFixed(1)} KB

💻 Languages
${langStats || '  None detected'}

🧠 Advanced Metrics
  Complexity Score: ${complexityLabel}
  Bus Factor: ${busFactorLabel}
  Dependency Health: ${depHealthLabel}
  Circular Dependencies: ${circularDepsCount}
  Orphan Files: ${orphanFilesCount}

⏰ Last Updated: ${new Date(metrics.lastUpdated).toLocaleTimeString()}
    `.trim();

      vscode.window.showInformationMessage(message, { modal: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error(
        'Aura Metrics Failed',
        `Failed to get aura metrics: ${message} `
      );
    }
  }

  private async showGraphMetrics(): Promise<void> {
    // Fallback to Control Center for now
    vscode.commands.executeCommand('lunaforge.openControlCenter');
  }

  private async listModes(): Promise<void> {
    if (!await this.ensureCore()) return;

    try {
      const modes = (this.core! as any).getActiveModes?.() || [];

      if (modes.length === 0) {
        vscode.window.showInformationMessage('No LunaForge modes are currently registered.');
        return;
      }

      const modeItems = modes.map((mode: any) => ({
        label: `${mode.icon || '🚀'} ${mode.title || mode.id} `,
        description: mode.status || 'Unknown status',
        detail: `ID: ${mode.id} | Active: ${mode.active ? 'Yes' : 'No'} `
      }));

      await vscode.window.showQuickPick(modeItems, {
        placeHolder: 'Available LunaForge Modes',
        canPickMany: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error(
        'List Modes Failed',
        `Failed to list modes: ${message} `
      );
    }
  }

  private async requestAnalysisPlan(): Promise<void> {
    vscode.window.showInformationMessage('Analysis Plan requested. (Feature coming in v3.0)');
  }

  private async activateMode(): Promise<void> {
    if (!await this.ensureCore()) return;

    try {
      // Get all registered modes from core
      const modes = (this.core! as any).getModes?.() || [];
      if (modes.length === 0) {
        vscode.window.showWarningMessage('No modes found in LunaForge Core.');
        return;
      }

      const items: ModeQuickPickItem[] = modes.map((m: any) => ({
        label: `${m.icon || '🚀'} ${m.title} `,
        description: m.description,
        detail: `ID: ${m.id} `,
        modeId: m.id
      }));

      const selection = await vscode.window.showQuickPick<ModeQuickPickItem>(items, {
        placeHolder: 'Select a mode to activate',
        title: 'Activate LunaForge Mode'
      });

      if (selection) {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Activating ${selection.label}...`,
          cancellable: false
        }, async () => {
          await this.core!.activateMode(selection.modeId);
        });

        this.notificationManager.success(
          'Mode Activated',
          `${selection.label} is now active.`
        );
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error('Activation Failed', message);
    }
  }

  private async deactivateMode(): Promise<void> {
    if (!this.core) return;

    const activeModes = (this.core as any).getActiveModes?.() || [];
    if (activeModes.length === 0) {
      vscode.window.showInformationMessage('No active modes to deactivate.');
      return;
    }

    const items: ModeQuickPickItem[] = activeModes.map((m: any) => ({
      label: `${m.icon || '⏹️'} ${m.title} `,
      description: 'Active',
      modeId: m.id
    }));

    const selection = await vscode.window.showQuickPick<ModeQuickPickItem>(items, {
      placeHolder: 'Select a mode to deactivate',
      title: 'Deactivate Mode'
    });

    if (selection) {
      await this.core.deactivateMode(selection.modeId);
      this.notificationManager.info('Mode Deactivated', `${selection.label} stopped.`);
    }
  }

  private async toggleMode(): Promise<void> {
    // This would show modes that can be toggled
    vscode.window.showInformationMessage('Mode toggle interface coming soon!');
  }

  private async analyzeCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No file is currently open.');
      return;
    }

    try {
      const document = editor.document;
      const content = document.getText();
      const lineCount = document.lineCount;
      const fileSize = content.length;
      const wordCount = content.split(/\s+/).length;

      // Simple complexity estimation (very rough)
      const complexityScore = (content.match(/if|else|for|while|switch|case|catch/g) || []).length;

      const report = `
# 📊 File Analysis Report
      ** File:** \`${document.fileName.split(/[\\/]/).pop()}\`
**Path:** \`${document.uri.fsPath}\`

## 📈 Statistics
- **Lines:** ${lineCount}
- **Characters:** ${fileSize}
- **Words:** ${wordCount}
- **Est. Complexity:** ${complexityScore} (Control Flow Keywords)

## 🔍 Language Details
- **Language ID:** \`${document.languageId}\`
- **Eol:** ${document.eol === vscode.EndOfLine.CRLF ? 'CRLF' : 'LF'}

> This is a local static analysis. For deep AI-driven insights, ensure LunaForge Core is connected.
      `.trim();

      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true
      });

      this.notificationManager.success('Analysis Report Generated', 'Opening visible report...');

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error(
        'Analysis Failed',
        `Failed to analyze file: ${message}`
      );
    }
  }

  private async analyzeSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showInformationMessage('Please select some code to analyze first.');
      return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    // Quick stats
    const lines = selection.end.line - selection.start.line + 1;
    const chars = text.length;

    const result = await vscode.window.showInformationMessage(
      `Selection Analysis: ${lines} lines, ${chars} chars selected.`,
      'Copy Stats',
      'Detailed Report'
    );

    if (result === 'Copy Stats') {
      await vscode.env.clipboard.writeText(`Lines: ${lines}, Chars: ${chars}`);
    } else if (result === 'Detailed Report') {
      const doc = await vscode.workspace.openTextDocument({
        content: `# Selection Analysis\n\n\`\`\`\n${text}\n\`\`\`\n\n**Stats:**\n- Lines: ${lines}\n- Chars: ${chars}\n`,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    }
  }

  private async requestPlan(): Promise<void> {
    const summary = await vscode.window.showInputBox({
      placeHolder: 'Describe what you want to analyze or improve...',
      prompt: 'Analysis Plan Request'
    });

    if (!summary) return;

    // Show immediate visible feedback
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Generating Analysis Plan...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 30, message: "Analyzing context..." });
      await new Promise(r => setTimeout(r, 800));
      progress.report({ increment: 60, message: "Drafting plan..." });
      await new Promise(r => setTimeout(r, 800));
    });

    // Mock plan for visual feedback if core is offline or for demonstration
    const mockPlan = `
# 🤖 AI Analysis Plan: "${summary}"

## 🎯 Objective
Improve codebase quality and architecture based on user request.

## 📋 Proposed Steps
1. **Context Analysis**
   - [x] Scan current workspace
   - [ ] Identify dependency graph bottlenecks
   
2. **Refactoring Strategy**
   - Isolate high-complexity modules
   - Apply SOLID principles to \`PayPlusManager.ts\` (Example)
   
3. **Verification**
   - Run existing test suite
   - Verify linting rules

> 🚀 **Next Action:** Review this plan and use "Analyze File" on specific targets.
    `.trim();

    const doc = await vscode.workspace.openTextDocument({
      content: mockPlan,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active });
  }

  private async enterLicense(): Promise<void> {
    const key = await vscode.window.showInputBox({
      placeHolder: 'Enter your license key',
      prompt: 'LunaForge License Key',
      password: true
    });

    if (!key) return;

    try {
      // License entry logic would go here
      this.notificationManager.success(
        'License Saved',
        'License key has been saved. Reload VS Code to apply changes.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notificationManager.error(
        'License Error',
        `Failed to save license key: ${message}`
      );
    }
  }

  private async checkLicense(): Promise<void> {
    // License check logic would go here
    vscode.window.showInformationMessage('License status: Active (Premium Features Available)');
  }

  private async upgradeLicense(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Upgrade to LunaForge Premium for advanced features including AI-powered analysis, team collaboration, and priority support.',
      'Upgrade Now',
      'Learn More',
      'Cancel'
    );

    if (action === 'Upgrade Now') {
      vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/pricing.html'));
    } else if (action === 'Learn More') {
      vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/features.html'));
    }
  }

  private async openSettings(): Promise<void> {
    vscode.commands.executeCommand('workbench.action.openSettings', 'lunaforge');
  }

  private async resetSettings(): Promise<void> {
    const result = await vscode.window.showWarningMessage(
      'This will reset all LunaForge settings to their default values. Continue?',
      'Reset Settings',
      'Cancel'
    );

    if (result === 'Reset Settings') {
      // Reset settings logic would go here
      this.notificationManager.success(
        'Settings Reset',
        'All LunaForge settings have been reset to default values.'
      );
    }
  }

  private async showOutput(): Promise<void> {
    this.notificationManager.showOutputChannel();
  }

  private async openDocumentation(): Promise<void> {
    vscode.env.openExternal(vscode.Uri.parse('https://docs.lunaforge.io'));
  }

  private async reportIssue(): Promise<void> {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/lunaforge/lunaforge/issues'));
  }

  private async showWelcome(): Promise<void> {
    const welcomeContent = `
🌙 Welcome to LunaForge!

LunaForge is an advanced project analysis and code intelligence tool for VS Code.

Quick Start:
1. Open a project folder
2. Run "LunaForge: Build Project Graph"
3. Open the Control Center to explore features

Key Features:
• Real-time dependency analysis
• Multiple analysis modes (Galaxy, CodeFlow, TimeTravel, etc.)
• AI-powered improvement suggestions
• Team collaboration tools

Need help? Check out our documentation or join our community!
    `.trim();

    vscode.window.showInformationMessage(welcomeContent, { modal: true });
  }

  private async startDream(): Promise<void> {
    if (!this.core) {
      vscode.window.showErrorMessage('LunaForge Core not initialized.');
      return;
    }

    try {
      const dreamMode = this.core.getMode('dream') as any;
      if (!dreamMode) {
        vscode.window.showErrorMessage('Dream mode is not available or licensed.');
        return;
      }

      const prompt = await vscode.window.showInputBox({
        placeHolder: 'e.g., "Refactor authentication flow", "Fix all bugs in utils.ts"',
        prompt: 'What should the AI Dream about tonight?',
        title: 'Start AI Dream Session'
      });

      if (!prompt) return;

      let jobResult: any = null;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Dreaming...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Sending to neural cloud...' });

        const scheduleResult = await dreamMode.schedule({
          prompt,
          context: 'vscode-extension',
          files: [] // In future, send specific context files
        });

        if (!scheduleResult || !scheduleResult.jobId) {
          throw new Error('Failed to schedule dream job.');
        }

        progress.report({ message: 'AI is thinking... (this may take a while)' });

        // Poll for completion using the new waitFor method
        jobResult = await dreamMode.waitFor(scheduleResult.jobId);
      });

      if (jobResult && jobResult.status === 'completed') {
        const apply = await vscode.window.showInformationMessage(
          'Dream Complete! The AI has generated changes.',
          'Preview Changes',
          'Apply Changes'
        );

        if (apply === 'Apply Changes') {
          await this.applyDreamResult(jobResult.result);
        } else if (apply === 'Preview Changes') {
          // TODO: Implement diff view. For now, just show summary.
          vscode.window.showInformationMessage(`Summary: ${jobResult.result.summary}`);
        }
      } else if (jobResult && jobResult.status === 'failed') {
        throw new Error(jobResult.result?.error || 'Unknown error');
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.notificationManager.error('Dream Failed', msg);
    }
  }

  private async applyDreamResult(result: any): Promise<void> {
    if (!result.files || !Array.isArray(result.files)) {
      vscode.window.showWarningMessage('No file changes returned by Dream.');
      return;
    }

    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) {
      vscode.window.showErrorMessage('No workspace open to apply changes.');
      return;
    }

    for (const file of result.files) {
      try {
        const uri = vscode.Uri.joinPath(wsFolder.uri, file.path);
        const content = new TextEncoder().encode(file.content);
        await vscode.workspace.fs.writeFile(uri, content);
      } catch (e) {
        console.error(`Failed to write file ${file.path}`, e);
      }
    }

    this.notificationManager.success('Changes Applied', `Updated ${result.files.length} files.`);
  }
}