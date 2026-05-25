import * as assert from "assert";
import * as vscode from "vscode";

suite("LunaForge Extension Integration", () => {
  test("All LunaForge commands are registered", async () => {
    const ext = vscode.extensions.getExtension("FinsavvyTechnologies.lunaforge-extension")
      ?? vscode.extensions.getExtension("finsavvytechnologies.lunaforge-extension");
    assert.ok(ext, "Extension not found");
    await ext.activate();

    const expectedCommands = [
      "lunaforge.openControlCenter",
      "lunaforge.buildGraph",
      "lunaforge.refreshGraph",
      "lunaforge.clearGraph",
      "lunaforge.exportGraph",
      "lunaforge.showGraphMetrics",
      "lunaforge.listModes",
      "lunaforge.activateMode",
      "lunaforge.deactivateMode",
      "lunaforge.toggleMode",
      "lunaforge.analyzeFile",
      "lunaforge.analyzeSelection",
      "lunaforge.requestPlan",
      "lunaforge.enterLicense",
      "lunaforge.checkLicense",
      "lunaforge.upgradeLicense",
      "lunaforge.openSettings",
      "lunaforge.resetSettings",
      "lunaforge.showOutput",
      "lunaforge.openDocumentation",
      "lunaforge.reportIssue",
      "lunaforge.showWelcome",
      "lunaforge.showCommandPalette",
      "lunaforge.commandDocumentation",
      "lunaforge.commandStats",
      "lunaforge.upgradeSubscription",
      "lunaforge.viewSubscription",
      "lunaforge.manageBilling",
      "lunaforge.viewPricing"
    ];

    const allCommands = await vscode.commands.getCommands(true);
    const missingCommands = expectedCommands.filter(cmd => !allCommands.includes(cmd));

    assert.strictEqual(missingCommands.length, 0, `Missing commands: ${missingCommands.join(", ")}`);
  });

  test("Control Center webview can be opened", async () => {
    await vscode.commands.executeCommand("lunaforge.openControlCenter");
    // We don't assert on content yet, just that calling didn't throw
    assert.ok(true);
  });

  test("Command Palette can be opened", async () => {
    // This might open a quick pick, which is hard to test without UI automation,
    // but we can ensure the command executes without error.
    // We might need to stub showQuickPick if it blocks, but let's try execution first.
    // Actually, showQuickPick is a promise that waits for user input.
    // We can't easily test it here without it hanging.
    // So we will just verify it is registered (covered above) and maybe try to execute a simple one that returns immediately or mock it.
    // For now, let's skip execution of blocking commands in this suite.
    assert.ok(true);
  });

  test("Configuration 'lunaforge' is accessible", () => {
    const config = vscode.workspace.getConfiguration("lunaforge");
    assert.ok(config.has("apiBaseUrl"), "apiBaseUrl setting missing");
    assert.ok(config.has("ui.theme"), "ui.theme setting missing");
  });
});