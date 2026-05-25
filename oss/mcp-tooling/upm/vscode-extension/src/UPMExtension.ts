import * as vscode from "vscode";
import { UPMService } from "./services/UPMService";
import { DependencyTreeProvider } from "./views/DependencyTreeProvider";
import { DiagnosticsManager } from "./services/DiagnosticsManager";
import { DecorationManager } from "./services/DecorationManager";
import { CommandManager } from "./services/CommandManager";
import { WebSocketManager } from "./services/WebSocketManager";
import { StatusBarManager } from "./services/StatusBarManager";
import { ConfigurationManager } from "./services/ConfigurationManager";
import { Logger } from "./utils/Logger";
import { Disposable } from "./utils/Disposable";

export class UPMExtension extends Disposable {
  private readonly context: vscode.ExtensionContext;
  private upmService: UPMService;
  private treeProvider: DependencyTreeProvider;
  private diagnosticsManager: DiagnosticsManager;
  private decorationManager: DecorationManager;
  private commandManager: CommandManager;
  private webSocketManager: WebSocketManager;
  private statusBarManager: StatusBarManager;
  private configurationManager: ConfigurationManager;
  private isInitialized = false;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;

    // Initialize managers
    this.configurationManager = new ConfigurationManager(context);
    this.upmService = new UPMService(this.configurationManager);
    this.diagnosticsManager = new DiagnosticsManager(context);
    this.decorationManager = new DecorationManager();
    this.treeProvider = new DependencyTreeProvider(this.upmService);
    this.commandManager = new CommandManager();
    this.webSocketManager = new WebSocketManager(
      this.upmService,
      this.configurationManager,
    );
    this.statusBarManager = new StatusBarManager();

    Logger.info("UPMExtension instance created");
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      Logger.warn("Extension already initialized");
      return;
    }

    try {
      Logger.info("Initializing UPM extension components...");

      // Initialize configuration manager
      await this.configurationManager.initialize();
      this.addDisposable(this.configurationManager);

      // Initialize UPM service
      await this.upmService.initialize();
      this.addDisposable(this.upmService);

      // Initialize diagnostics manager
      await this.diagnosticsManager.initialize();
      this.addDisposable(this.diagnosticsManager);

      // Initialize decoration manager
      await this.decorationManager.initialize();
      this.addDisposable(this.decorationManager);

      // Register tree view
      await this.registerTreeView();

      // Register commands
      await this.registerCommands();

      // Initialize WebSocket manager if real-time updates are enabled
      if (this.configurationManager.get<boolean>("realTimeUpdates", true)) {
        await this.initializeWebSocket();
      }

      // Initialize status bar
      await this.statusBarManager.initialize();
      this.addDisposable(this.statusBarManager);

      // Register workspace event listeners
      this.registerWorkspaceEventListeners();

      // Set context key for workspace detection
      await this.updateWorkspaceContext();

      this.isInitialized = true;
      Logger.info("UPM extension initialized successfully");

      // Trigger initial analysis if configured
      if (this.configurationManager.get<boolean>("autoAnalysis", true)) {
        await this.performInitialAnalysis();
      }
    } catch (error) {
      Logger.error("Failed to initialize UPM extension", error);
      throw error;
    }
  }

  private async registerTreeView(): Promise<void> {
    const treeView = vscode.window.createTreeView("upm-dependency-tree", {
      treeDataProvider: this.treeProvider,
      showCollapseAll: true,
    });

    this.addDisposable(treeView);

    // Register tree view event handlers
    this.addDisposable(
      treeView.onDidChangeSelection((e) => {
        if (e.selection.length > 0) {
          Logger.debug(
            `Tree selection changed: ${e.selection.length} items selected`,
          );
        }
      }),
    );

    Logger.info("Dependency tree view registered");
  }

  private async registerCommands(): Promise<void> {
    const commands = [
      vscode.commands.registerCommand("upm.refreshDependencies", () =>
        this.refreshDependencies(),
      ),
      vscode.commands.registerCommand("upm.analyzeProject", () =>
        this.analyzeProject(),
      ),
      vscode.commands.registerCommand("upm.showDependencyTree", () =>
        this.showDependencyTree(),
      ),
      vscode.commands.registerCommand("upm.checkVulnerabilities", () =>
        this.checkVulnerabilities(),
      ),
      vscode.commands.registerCommand("upm.openDashboard", () =>
        this.openDashboard(),
      ),
      vscode.commands.registerCommand("upm.configureServer", () =>
        this.configureServer(),
      ),
      vscode.commands.registerCommand("upm.updateDependency", (item) =>
        this.updateDependency(item),
      ),
      vscode.commands.registerCommand("upm.showDependencyDetails", (item) =>
        this.showDependencyDetails(item),
      ),
      vscode.commands.registerCommand("upm.excludeDependency", (item) =>
        this.excludeDependency(item),
      ),
      vscode.commands.registerCommand("upm.approveDependency", (item) =>
        this.approveDependency(item),
      ),
      vscode.commands.registerCommand("upm.generateSBOM", () =>
        this.generateSBOM(),
      ),
      vscode.commands.registerCommand("upm.exportReport", () =>
        this.exportReport(),
      ),
    ];

    for (const command of commands) {
      this.commandManager.register(command);
      this.addDisposable(command);
    }

    Logger.info("Commands registered successfully");
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      await this.webSocketManager.initialize();
      this.addDisposable(this.webSocketManager);

      // Register WebSocket event handlers
      this.webSocketManager.on("vulnerabilityUpdate", (data) => {
        this.handleVulnerabilityUpdate(data);
      });

      this.webSocketManager.on("dependencyUpdate", (data) => {
        this.handleDependencyUpdate(data);
      });

      Logger.info("WebSocket manager initialized");
    } catch (error) {
      Logger.warn("Failed to initialize WebSocket manager", error);
      // Continue without WebSocket connection
    }
  }

  private registerWorkspaceEventListeners(): void {
    // Watch for configuration file changes
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{pom.xml,package.json,requirements.txt,pyproject.toml,Cargo.toml,build.gradle,build.gradle.kts,composer.json,go.mod,*.csproj}",
    );

    this.addDisposable(
      fileWatcher.onDidCreate((uri) =>
        this.handleConfigFileChange(uri, "create"),
      ),
    );
    this.addDisposable(
      fileWatcher.onDidChange((uri) =>
        this.handleConfigFileChange(uri, "change"),
      ),
    );
    this.addDisposable(
      fileWatcher.onDidDelete((uri) =>
        this.handleConfigFileChange(uri, "delete"),
      ),
    );
    this.addDisposable(fileWatcher);

    // Watch for workspace folder changes
    this.addDisposable(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.updateWorkspaceContext();
      }),
    );

    // Watch for configuration changes
    this.addDisposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("upm")) {
          this.handleConfigurationChange();
        }
      }),
    );

    Logger.info("Workspace event listeners registered");
  }

  private async updateWorkspaceContext(): Promise<void> {
    const hasUPMProject = await this.detectUPMProject();
    vscode.commands.executeCommand(
      "setContext",
      "workspaceHasUPMProject",
      hasUPMProject,
    );
    Logger.info(`Workspace context updated: hasUPMProject=${hasUPMProject}`);
  }

  private async detectUPMProject(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    for (const folder of workspaceFolders) {
      const configFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(
          folder,
          "**/{pom.xml,package.json,requirements.txt,pyproject.toml,Cargo.toml,build.gradle,build.gradle.kts,composer.json,go.mod,*.csproj}",
        ),
        "**/node_modules/**",
      );

      if (configFiles.length > 0) {
        return true;
      }
    }

    return false;
  }

  private async handleConfigFileChange(
    uri: vscode.Uri,
    type: "create" | "change" | "delete",
  ): Promise<void> {
    const fileName = uri.path.split("/").pop() || "";
    Logger.debug(`Config file ${type}: ${fileName}`);

    if (this.configurationManager.get<boolean>("autoAnalysis", true)) {
      // Debounce rapid changes
      await this.debounceAnalysis(uri.fsPath);
    }
  }

  private analysisDebouncers = new Map<string, NodeJS.Timeout>();

  private async debounceAnalysis(filePath: string): Promise<void> {
    // Clear existing timeout for this file
    const existingTimeout = this.analysisDebouncers.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await this.analyzeProject();
        this.analysisDebouncers.delete(filePath);
      } catch (error) {
        Logger.error(
          `Failed to analyze project after file change: ${filePath}`,
          error,
        );
      }
    }, 2000); // 2 second debounce

    this.analysisDebouncers.set(filePath, timeout);
  }

  private async handleConfigurationChange(): Promise<void> {
    Logger.info("Configuration changed, reinitializing...");

    // Reinitialize WebSocket if settings changed
    if (this.configurationManager.get<boolean>("realTimeUpdates", true)) {
      if (!this.webSocketManager.isInitialized()) {
        await this.initializeWebSocket();
      }
    } else {
      if (this.webSocketManager.isInitialized()) {
        this.webSocketManager.dispose();
      }
    }
  }

  private async handleVulnerabilityUpdate(data: any): Promise<void> {
    Logger.info("Received vulnerability update", data);
    await this.diagnosticsManager.updateVulnerabilities(data.vulnerabilities);
    await this.treeProvider.refresh();
  }

  private async handleDependencyUpdate(data: any): Promise<void> {
    Logger.info("Received dependency update", data);
    await this.treeProvider.refresh();
  }

  // Command implementations
  private async refreshDependencies(): Promise<void> {
    try {
      Logger.info("Refreshing dependencies...");
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Refreshing Dependencies",
          cancellable: true,
        },
        async (progress, token) => {
          await this.upmService.refreshDependencies(progress, token);
          await this.treeProvider.refresh();
        },
      );
    } catch (error) {
      Logger.error("Failed to refresh dependencies", error);
      vscode.window.showErrorMessage(
        `Failed to refresh dependencies: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async analyzeProject(): Promise<void> {
    try {
      Logger.info("Analyzing project...");
      const analysis = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Analyzing Project Dependencies",
          cancellable: true,
        },
        async (progress, token) => {
          return await this.upmService.analyzeProject(progress, token);
        },
      );

      if (analysis) {
        await this.diagnosticsManager.updateDiagnostics(analysis);
        await this.treeProvider.refresh();
        vscode.window.showInformationMessage(
          `Analysis complete: Found ${analysis.dependencies?.length || 0} dependencies`,
        );
      }
    } catch (error) {
      Logger.error("Failed to analyze project", error);
      vscode.window.showErrorMessage(
        `Failed to analyze project: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async showDependencyTree(): Promise<void> {
    try {
      await vscode.commands.executeCommand("workbench.view.explorer");
      await vscode.commands.executeCommand("upm-dependency-tree.focus");
    } catch (error) {
      Logger.error("Failed to show dependency tree", error);
    }
  }

  private async checkVulnerabilities(): Promise<void> {
    try {
      Logger.info("Checking for vulnerabilities...");
      const vulnerabilities = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Checking for Vulnerabilities",
          cancellable: true,
        },
        async (progress, token) => {
          return await this.upmService.checkVulnerabilities(progress, token);
        },
      );

      if (vulnerabilities && vulnerabilities.length > 0) {
        await this.diagnosticsManager.updateVulnerabilities(vulnerabilities);
        vscode.window.showWarningMessage(
          `Found ${vulnerabilities.length} vulnerabilities`,
        );
      } else {
        vscode.window.showInformationMessage("No vulnerabilities found");
      }
    } catch (error) {
      Logger.error("Failed to check vulnerabilities", error);
      vscode.window.showErrorMessage(
        `Failed to check vulnerabilities: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async openDashboard(): Promise<void> {
    const serverUrl = this.configurationManager.get<string>(
      "serverUrl",
      "http://localhost:8040",
    );
    const dashboardUrl = `${serverUrl}/dashboard`;

    vscode.env
      .openExternal(vscode.Uri.parse(dashboardUrl))
      .then(() => Logger.info(`Opened dashboard: ${dashboardUrl}`))
      .catch((error) => Logger.error("Failed to open dashboard", error));
  }

  private async configureServer(): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "upm",
    );
  }

  private async updateDependency(item: any): Promise<void> {
    // Implementation for updating a dependency
    Logger.info("Updating dependency", item);
    vscode.window.showInformationMessage(
      "Dependency update functionality will be implemented",
    );
  }

  private async showDependencyDetails(item: any): Promise<void> {
    // Implementation for showing dependency details
    Logger.info("Showing dependency details", item);
    vscode.window.showInformationMessage(
      "Dependency details view will be implemented",
    );
  }

  private async excludeDependency(item: any): Promise<void> {
    // Implementation for excluding a dependency
    Logger.info("Excluding dependency", item);
    vscode.window.showInformationMessage(
      "Dependency exclusion functionality will be implemented",
    );
  }

  private async approveDependency(item: any): Promise<void> {
    // Implementation for approving a dependency
    Logger.info("Approving dependency", item);
    vscode.window.showInformationMessage(
      "Dependency approval functionality will be implemented",
    );
  }

  private async generateSBOM(): Promise<void> {
    try {
      Logger.info("Generating SBOM...");
      const sbom = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating SBOM",
          cancellable: false,
        },
        async (progress) => {
          return await this.upmService.generateSBOM(progress);
        },
      );

      if (sbom) {
        // Show SBOM in new editor
        const document = await vscode.workspace.openTextDocument({
          content: JSON.stringify(sbom, null, 2),
          language: "json",
        });
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage("SBOM generated successfully");
      }
    } catch (error) {
      Logger.error("Failed to generate SBOM", error);
      vscode.window.showErrorMessage(
        `Failed to generate SBOM: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async exportReport(): Promise<void> {
    try {
      Logger.info("Exporting report...");
      const report = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Exporting Report",
          cancellable: false,
        },
        async (progress) => {
          return await this.upmService.exportReport(progress);
        },
      );

      if (report) {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file("upm-report.json"),
          filters: {
            JSON: ["json"],
          },
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(JSON.stringify(report, null, 2)),
          );
          vscode.window.showInformationMessage(
            `Report exported to ${uri.fsPath}`,
          );
        }
      }
    } catch (error) {
      Logger.error("Failed to export report", error);
      vscode.window.showErrorMessage(
        `Failed to export report: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async performInitialAnalysis(): Promise<void> {
    // Debounce initial analysis to avoid blocking extension activation
    setTimeout(async () => {
      try {
        await this.analyzeProject();
      } catch (error) {
        Logger.warn("Initial analysis failed", error);
      }
    }, 3000);
  }

  public async dispose(): Promise<void> {
    Logger.info("Disposing UPM extension...");

    // Clear all analysis debouncers
    for (const timeout of this.analysisDebouncers.values()) {
      clearTimeout(timeout);
    }
    this.analysisDebouncers.clear();

    await super.dispose();
    Logger.info("UPM extension disposed");
  }
}
