import * as vscode from "vscode";
import { UPMExtension } from "./UPMExtension";
import { Logger } from "./utils/Logger";

let extension: UPMExtension | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    Logger.info("Activating Universal Dependency Platform extension...");

    // Create and initialize extension
    extension = new UPMExtension(context);
    await extension.initialize();

    // Store extension instance
    context.subscriptions.push(extension);

    Logger.info("UPM extension activated successfully");

    // Show welcome message on first activation
    const isFirstActivation = !context.globalState.get<boolean>(
      "upm.activated",
      false,
    );
    if (isFirstActivation) {
      await context.globalState.update("upm.activated", true);
      vscode.window
        .showInformationMessage(
          "Universal Dependency Platform is now active! Configure your UPM server in settings.",
          "Open Settings",
        )
        .then((selection) => {
          if (selection === "Open Settings") {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "upm.serverUrl",
            );
          }
        });
    }
  } catch (error) {
    Logger.error("Failed to activate UPM extension", error);
    vscode.window.showErrorMessage(
      `Failed to activate UPM extension: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error;
  }
}

export async function deactivate(): Promise<void> {
  try {
    if (extension) {
      Logger.info("Deactivating UPM extension...");
      await extension.dispose();
      extension = undefined;
      Logger.info("UPM extension deactivated successfully");
    }
  } catch (error) {
    Logger.error("Error during extension deactivation", error);
  }
}

// Export extension instance for testing
export function getExtensionInstance(): UPMExtension | undefined {
  return extension;
}
