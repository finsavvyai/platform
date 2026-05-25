import * as vscode from "vscode";
import { LunaForgeCore, WorkspaceInfo } from "lunaforge-core";
import { buildFsList } from "./vscodeFsProvider";
import { LicenseClient } from "./licensing";
import { ControlCenterWebview } from "./webview/ControlCenterWebview";
import { getNotificationManager } from "./ui/NotificationManager";
import { CommandManager } from "./commands/CommandManager";
import { createPayPlusManager, PayPlusConfig, PayPlusManager } from "./payment/PayPlusManager";
import { PaymentUI } from "./payment/PaymentUI";
import { TourManager } from "./onboarding/TourManager";
import { OnboardingChecklistManager } from "./onboarding/ChecklistManager";
import { SampleProjectManager } from "./onboarding/SampleProjectManager";
import { SecureCredentialStorage } from "./services/SecureCredentialStorage";

import { createGalaxyMode } from "lunaforge-galaxy";
import { createCodeFlowMode } from "lunaforge-codeflow";
import { createTimeTravelMode } from "lunaforge-timetravel";
import { createAutopsyMode } from "lunaforge-autopsy";
import { createComposerMode } from "lunaforge-composer";
import { createProphecyMode } from "lunaforge-prophecy";
import { createParallelUniverseMode } from "lunaforge-parallel-universe";
import { createGuardianMode } from "lunaforge-guardian";
import { createRitualMode } from "lunaforge-ritual";
import { createDreamMode } from "lunaforge-dream";
import { createMythicMode } from "lunaforge-mythic";
import { createAuraMode } from "lunaforge-aura";
import { createZenMode } from "lunaforge-zen";
import { GitService } from "./services/GitService";

let core: LunaForgeCore | null = null;
let controlCenterWebview: ControlCenterWebview | null = null;
let commandManager: CommandManager | null = null;
let notificationManager = getNotificationManager();
let payPlusManager: PayPlusManager | null = null;
let paymentUI: PaymentUI | null = null;
let tourManager: TourManager | null = null;
let checklistManager: OnboardingChecklistManager | null = null;
let sampleProjectManager: SampleProjectManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration("lunaforge");
  const workerUrl =
    cfg.get<string>("apiBaseUrl") || "https://lunaforge-mcp.broad-dew-49ad.workers.dev";

  if (!workerUrl) {
    vscode.window.showErrorMessage(
      "LunaForge: Missing API Base URL. Set it under Settings → Extensions → LunaForge."
    );
    return;
  }

  const licenseClient = new LicenseClient(workerUrl);

  async function loadLicense() {
    const savedKey = context.globalState.get<string>("lf:license-key");
    if (!savedKey) {
      return { valid: false, plan: "free", features: [] };
    }
    return await licenseClient.validateOrFallback(savedKey, context);
  }

  // Initialize command manager first (even without core) so commands are available
  if (!commandManager) {
    commandManager = new CommandManager(context.extensionUri);
    try {
      await commandManager.initialize(context, null);
    } catch (err) {
      console.error('Error initializing command manager:', err);
    }
  }

  const license = await loadLicense();

  // Initialize PayPlus payment system (always initialize for demo/production)
  try {
    // Use secure credential storage instead of configuration
    const secureStorage = SecureCredentialStorage.getInstance(context);
    const storedCredentials = await secureStorage.getCredentials();

    // Check for environment variables as fallback (for CI/CD)
    const envApiKey = process.env.PAYPLUS_API_KEY;
    const envMerchantId = process.env.PAYPLUS_MERCHANT_ID;
    const envSecretKey = process.env.PAYPLUS_SECRET_KEY;

    let payPlusConfig: PayPlusConfig;

    if (storedCredentials) {
      // Use securely stored credentials
      payPlusConfig = {
        apiKey: storedCredentials.apiKey,
        environment: storedCredentials.environment,
        merchantId: storedCredentials.merchantId,
        secretKey: storedCredentials.secretKey,
        lemonSqueezyStoreId: process.env.LEMONSQUEEZY_STORE_ID || '214097',
        workerUrl: workerUrl
      };
      console.log('LunaForge PayPlus payment system initialized with secure credentials');
    } else if (envApiKey && envMerchantId && envSecretKey) {
      // Use environment variables (for CI/CD or development)
      payPlusConfig = {
        apiKey: envApiKey,
        environment: (process.env.PAYPLUS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
        merchantId: envMerchantId,
        secretKey: envSecretKey,
        lemonSqueezyStoreId: process.env.LEMONSQUEEZY_STORE_ID || '214097',
        workerUrl: workerUrl
      };
      console.log('LunaForge PayPlus payment system initialized with environment variables');
    } else {
      // Use demo mode
      payPlusConfig = {
        apiKey: 'demo-key',
        environment: 'sandbox',
        merchantId: 'demo-merchant',
        secretKey: 'demo-secret',
        lemonSqueezyStoreId: '214097',
        workerUrl: workerUrl
      };
      console.log('LunaForge PayPlus payment system initialized in demo mode');
    }

    // Always initialize PayPlus manager so commands work
    payPlusManager = createPayPlusManager(payPlusConfig, context);
    paymentUI = new PaymentUI(payPlusManager);
    await paymentUI.initialize();

    // Add payment UI to context subscriptions
    context.subscriptions.push(paymentUI);
  } catch (error) {
    console.error('Failed to initialize PayPlus payment system:', error);
  }

  // Initialize core and command manager early
  async function initializeCore() {
    const workspace = buildWorkspaceInfo();
    if (!workspace) {
      return; // No workspace, commands will show appropriate messages
    }

    if (!core) {
      try {
        core = new LunaForgeCore({
          workspace,
          fsListProvider: () => buildFsList(),
          worker: { baseUrl: workerUrl },
          license
        });

        core.showUpgradePrompt = async (feature: string) => {
          if (paymentUI && payPlusManager) {
            await payPlusManager.showUpgradePrompt(feature);
          } else {
            notificationManager.warning(
              'Premium Feature',
              `"${feature}" is part of a premium LunaForge plan.`,
              [
                { label: 'Learn More', action: 'openDocs', primary: true },
                { label: 'Dismiss', action: 'dismiss' }
              ]
            );
          }
        };

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || "";
        const gitService = new GitService(workspaceRoot);

        // Local Core Modes (Always Active)
        core.registerMode(createGalaxyMode());
        core.registerMode(createCodeFlowMode());
        core.registerMode(createTimeTravelMode({ provider: gitService }));
        core.registerMode(createComposerMode());

        const guardianRules = cfg.get<any[]>("guardian.rules", []);
        const guardianMode = createGuardianMode({ rules: guardianRules });
        core.registerMode(guardianMode);

        core.registerMode(createRitualMode());
        core.registerMode(createAuraMode());
        core.registerMode(createZenMode());

        // Cloud / Premium Modes (Gated)
        const enableEarlyAccess = cfg.get<boolean>("enableEarlyAccess", false);
        if (enableEarlyAccess) {
          vscode.window.showInformationMessage("LunaForge: Early Access Features Enabled");
          core.registerMode(createAutopsyMode({ baseUrl: workerUrl }));
          core.registerMode(createProphecyMode({ baseUrl: workerUrl }));
          core.registerMode(createParallelUniverseMode({ baseUrl: workerUrl }));
          core.registerMode(createDreamMode({ baseUrl: workerUrl }));
          core.registerMode(createMythicMode({ baseUrl: workerUrl }));
        }

        // Watch for Guardian rule changes
        context.subscriptions.push(
          vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("lunaforge.guardian.rules")) {
              const updatedRules = vscode.workspace.getConfiguration("lunaforge").get<any[]>("guardian.rules", []);
              guardianMode.setConfig({ rules: updatedRules });
            }
          })
        );

        // Initialize onboarding managers
        tourManager = new TourManager(context);
        checklistManager = new OnboardingChecklistManager(context);
        sampleProjectManager = new SampleProjectManager(context);

        // Register onboarding commands
        context.subscriptions.push(
          vscode.commands.registerCommand('lunaforge.startTour', async (tourId: string = 'control-center') => {
            await tourManager?.startTour(tourId);
            checklistManager?.markComplete('completedTour');
          }),
          vscode.commands.registerCommand('lunaforge.openSampleProject', async () => {
            await sampleProjectManager?.createSampleWorkspace();
          }),
          vscode.commands.registerCommand('lunaforge.resetOnboarding', async () => {
            await tourManager?.resetTour('control-center');
            await checklistManager?.reset();
            vscode.window.showInformationMessage('Onboarding progress reset.');
          })
        );

        // Initialize command manager early so all commands are available
        if (!commandManager) {
          commandManager = new CommandManager(context.extensionUri);
          await commandManager.initialize(context, core);
        } else {
          // Update core if command manager already exists
          commandManager.updateCore(core);
        }

        // Initialize core graph in background
        core.ensureGraph().catch(err => {
          console.error('Failed to build initial graph:', err);
        });
      } catch (error: any) {
        console.error('Failed to initialize LunaForge core:', error);
        notificationManager.error(
          'Initialization Failed',
          `Failed to initialize LunaForge: ${error.message}`,
          [
            { label: 'Retry', action: 'retryInit', primary: true },
            { label: 'Show Output', action: 'showOutput' },
            { label: 'Get Support', action: 'openSupport' }
          ]
        );
      }
    }
  }

  // Initialize command manager first (even without core) so commands are available
  if (!commandManager) {
    commandManager = new CommandManager(context.extensionUri);
    try {
      await commandManager.initialize(context, null);
    } catch (err) {
      console.error('Error initializing command manager:', err);
    }
  }

  // Initialize core early (but don't block activation)
  initializeCore().catch(err => {
    console.error('Error during early initialization:', err);
  });

  // Register the openControlCenter command
  const disposable = vscode.commands.registerCommand(
    "lunaforge.openControlCenter",
    async () => {
      const workspace = buildWorkspaceInfo();
      if (!workspace) {
        vscode.window.showErrorMessage(
          "LunaForge: No workspace is open. Please open a folder first."
        );
        return;
      }

      // Ensure core is initialized
      if (!core) {
        await initializeCore();
        if (!core) {
          vscode.window.showErrorMessage(
            "LunaForge: Failed to initialize. Please check the output for errors."
          );
          return;
        }
      }

      // Create or show the new webview
      if (!controlCenterWebview) {
        controlCenterWebview = new ControlCenterWebview(
          context.extensionUri,
          core,
          {
            enableRealtimeUpdates: true,
            updateInterval: 1000,
            theme: 'auto',
            compactMode: false
          }
        );

        // Setup event listeners
        controlCenterWebview.setupCoreEventListeners();

        // Handle disposal
        context.subscriptions.push(controlCenterWebview);
      }

      controlCenterWebview.show();

      // Show welcome notification for first-time users
      const isFirstTime = !context.globalState.get('lf:controlCenterOpened', false);
      if (isFirstTime) {
        context.globalState.update('lf:controlCenterOpened', true);

        setTimeout(() => {
          notificationManager.info(
            'Welcome to LunaForge Control Center',
            'Explore the enhanced UI with real-time updates, modern design, and improved accessibility.',
            [
              { label: 'Take a Tour', action: 'startTour', primary: true },
              { label: 'Open Sample Project', action: 'openSampleProject' },
              { label: 'Learn More', action: 'openDocs' },
              { label: 'Dismiss', action: 'dismiss' }
            ]
          );

          // Mark control center opened
          checklistManager?.markComplete('openedControlCenter');
        }, 1000);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  if (commandManager) {
    commandManager.dispose();
    commandManager = null;
  }

  if (controlCenterWebview) {
    controlCenterWebview.dispose();
    controlCenterWebview = null;
  }

  if (core) {
    (core as any).dispose?.();
    core = null;
  }

  if (notificationManager) {
    notificationManager.dispose();
  }
}

function buildWorkspaceInfo(): WorkspaceInfo | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  const root = folders[0];
  return {
    rootPath: root.uri.fsPath,
    name: root.name,
    folders: folders.map((f) => f.uri.fsPath)
  };
}