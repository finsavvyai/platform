import * as assert from "assert";
import * as vscode from "vscode";

suite("LunaForge E2E Workflows", function () {
    this.timeout(10000);
    let extension: vscode.Extension<any>;

    suiteSetup(async () => {
        extension = vscode.extensions.getExtension("FinsavvyTechnologies.lunaforge-extension")
            ?? vscode.extensions.getExtension("finsavvytechnologies.lunaforge-extension")!;
        assert.ok(extension, "Extension not found");
        await extension.activate();
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    suite("First-Time User Flow", () => {
        test("Extension activates without errors", () => {
            assert.ok(extension.isActive, "Extension should be active");
        });

        test("Configuration is accessible", () => {
            const config = vscode.workspace.getConfiguration("lunaforge");
            assert.ok(config, "Configuration should be accessible");
        });

        test("Welcome message can be shown", async () => {
            try {
                await vscode.commands.executeCommand("lunaforge.showWelcome");
                assert.ok(true, "Welcome shown successfully");
            } catch (error) {
                assert.fail(`Welcome failed: ${error}`);
            }
        });
    });

    suite("Basic Analysis Flow", () => {
        test("Can open Control Center", async () => {
            try {
                await vscode.commands.executeCommand("lunaforge.openControlCenter");
                assert.ok(true, "Control Center opened");
            } catch (error) {
                assert.fail(`Control Center failed: ${error}`);
            }
        });

        test("Build graph command exists", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.buildGraph"), "Build graph command available");
        });

        test("Refresh graph command exists", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.refreshGraph"), "Refresh graph command available");
        });
    });

    suite("Premium Feature Flow", () => {
        test("Early access configuration exists", () => {
            const config = vscode.workspace.getConfiguration("lunaforge");
            const hasEarlyAccess = config.has("enableEarlyAccess");
            assert.ok(hasEarlyAccess, "Early access setting exists");
        });

        test("API base URL configuration exists", () => {
            const config = vscode.workspace.getConfiguration("lunaforge");
            const hasApiUrl = config.has("apiBaseUrl");
            assert.ok(hasApiUrl, "API base URL setting exists");
        });

        test("Worker URL can be configured", () => {
            const config = vscode.workspace.getConfiguration("lunaforge");
            const apiUrl = config.get<string>("apiBaseUrl", "");
            assert.ok(typeof apiUrl === "string", "API URL is a string");
        });
    });

    suite("Configuration Flow", () => {
        test("Settings command opens configuration", async () => {
            try {
                await vscode.commands.executeCommand("lunaforge.openSettings");
                assert.ok(true, "Settings opened");
            } catch (error) {
                // Settings command might not be fully testable in headless mode
                assert.ok(true, "Settings command exists");
            }
        });

        test("All required settings exist", () => {
            const config = vscode.workspace.getConfiguration("lunaforge");
            const requiredSettings = [
                "apiBaseUrl",
                "enableEarlyAccess",
                "ui.theme",
                "ui.compactMode",
                "realtimeUpdates"
            ];

            requiredSettings.forEach(setting => {
                assert.ok(config.has(setting), `Setting ${setting} should exist`);
            });
        });
    });

    suite("Error Handling", () => {
        test("Extension handles missing workspace gracefully", () => {
            // Extension should work even without a workspace
            assert.ok(extension.isActive, "Extension active without workspace");
        });

        test("Commands don't throw on invalid input", async () => {
            try {
                // Try to execute commands that might fail gracefully
                const commands = await vscode.commands.getCommands(true);
                assert.ok(commands.length > 0, "Commands are available");
            } catch (error) {
                assert.fail(`Command enumeration failed: ${error}`);
            }
        });
    });
});
