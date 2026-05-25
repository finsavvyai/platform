import * as assert from "assert";
import * as vscode from "vscode";

suite("LunaForge Commands - Full Coverage", function () {
    this.timeout(10000);
    let extension: vscode.Extension<any>;

    suiteSetup(async () => {
        extension = vscode.extensions.getExtension("FinsavvyTechnologies.lunaforge-extension")
            ?? vscode.extensions.getExtension("finsavvytechnologies.lunaforge-extension")!;
        assert.ok(extension, "Extension not found");
        await extension.activate();
        // Give extension time to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    suite("Graph Management Commands", () => {
        test("buildGraph command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.buildGraph"));
        });

        test("refreshGraph command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.refreshGraph"));
        });

        test("clearGraph command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.clearGraph"));
        });

        test("exportGraph command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.exportGraph"));
        });

        test("showGraphMetrics command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.showGraphMetrics"));
        });

        test("showAuraMetrics command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.showAuraMetrics"));
        });
    });

    suite("Mode Management Commands", () => {
        test("listModes command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.listModes"));
        });

        test("activateMode command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.activateMode"));
        });

        test("deactivateMode command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.deactivateMode"));
        });

        test("toggleMode command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.toggleMode"));
        });
    });

    suite("Analysis Commands", () => {
        test("analyzeFile command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.analyzeFile"));
        });

        test("analyzeSelection command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.analyzeSelection"));
        });

        test("requestPlan command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.requestPlan"));
        });
    });

    suite("License Commands", () => {
        test("enterLicense command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.enterLicense"));
        });

        test("checkLicense command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.checkLicense"));
        });

        test("upgradeLicense command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.upgradeLicense"));
        });
    });

    suite("UI Commands", () => {
        test("openControlCenter command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.openControlCenter"));
        });

        test("showCommandPalette command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.showCommandPalette"));
        });

        test("openSettings command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.openSettings"));
        });

        test("startZenFocus command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.startZenFocus"));
        });

        test("stopZenFocus command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.stopZenFocus"));
        });

        test("showZenSummary command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.showZenSummary"));
        });
    });

    suite("Help Commands", () => {
        test("openDocumentation command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.openDocumentation"));
        });

        test("reportIssue command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.reportIssue"));
        });

        test("showWelcome command is registered", async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes("lunaforge.showWelcome"));
        });
    });

    suite("Command Execution - Non-blocking", () => {
        test("Can execute openControlCenter", async () => {
            try {
                await vscode.commands.executeCommand("lunaforge.openControlCenter");
                assert.ok(true, "Command executed successfully");
            } catch (error) {
                assert.fail(`Command failed: ${error}`);
            }
        });

        test("Can execute showWelcome", async () => {
            try {
                await vscode.commands.executeCommand("lunaforge.showWelcome");
                assert.ok(true, "Command executed successfully");
            } catch (error) {
                assert.fail(`Command failed: ${error}`);
            }
        });
    });
});
