// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Runs inside a real (headless) VS Code instance via
// @vscode/test-electron. Stubs global fetch so the extension's
// /v1/redact call is captured and asserted without needing a live
// gateway.

import * as assert from "node:assert";
import * as vscode from "vscode";

interface CapturedCall {
  url: string;
  body: { text: string; presets?: string[]; tenant?: string };
  headers: Record<string, string>;
}

const captured: CapturedCall[] = [];
const originalFetch: typeof fetch = globalThis.fetch.bind(globalThis);

function installFetchStub(reply: object): void {
  globalThis.fetch = (async (url: URL | string | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    const init_headers = (init?.headers ?? {}) as Record<string, string>;
    for (const k of Object.keys(init_headers)) headers[k.toLowerCase()] = init_headers[k]!;
    captured.push({
      url: url.toString(),
      body: JSON.parse((init?.body as string | undefined) ?? "{}"),
      headers,
    });
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

async function setConfig(patch: Record<string, unknown>): Promise<void> {
  const c = vscode.workspace.getConfiguration("privacyGateway");
  for (const [k, v] of Object.entries(patch)) {
    await c.update(k, v, vscode.ConfigurationTarget.Global);
  }
}

suite("Privacy Gateway extension", () => {
  setup(() => {
    captured.length = 0;
  });

  teardown(() => {
    restoreFetch();
  });

  test("registers the four commands", async () => {
    const cmds = await vscode.commands.getCommands(true);
    const wanted = [
      "privacyGateway.scrubSelection",
      "privacyGateway.scrubClipboard",
      "privacyGateway.toggleEnabled",
      "privacyGateway.openSettings",
    ];
    for (const w of wanted) assert.ok(cmds.includes(w), `missing ${w}`);
  });

  test("scrubSelection POSTs the selected text to /v1/redact and replaces", async () => {
    installFetchStub({
      redacted: "ping [EMAIL] please",
      detections: [
        { pattern: "email", preset: "pii_default", action: "redact", start: 5, end: 22 },
      ],
      blocked: false,
    });
    await setConfig({
      gatewayUrl: "http://gw.test",
      apiKey: "tok",
      mode: "auto",
      enabled: true,
    });

    const doc = await vscode.workspace.openTextDocument({
      content: "ping alice@example.com please",
    });
    const ed = await vscode.window.showTextDocument(doc);
    ed.selection = new vscode.Selection(
      new vscode.Position(0, 0),
      new vscode.Position(0, doc.lineAt(0).text.length),
    );

    await vscode.commands.executeCommand("privacyGateway.scrubSelection");

    const gw = captured.filter((c) => c.url.endsWith("/v1/redact"));
    assert.strictEqual(gw.length, 1, `expected 1 /v1/redact call, got ${gw.length}`);
    assert.strictEqual(gw[0]!.url, "http://gw.test/v1/redact");
    assert.strictEqual(gw[0]!.body.text, "ping alice@example.com please");
    assert.strictEqual(gw[0]!.headers.authorization, "Bearer tok");
    assert.strictEqual(
      ed.document.getText(),
      "ping [EMAIL] please",
      "editor not replaced",
    );
  });

  test("scrubClipboard rewrites clipboard contents", async () => {
    installFetchStub({
      redacted: "ssn [SSN]",
      detections: [
        { pattern: "ssn", preset: "pii_default", action: "redact", start: 4, end: 15 },
      ],
      blocked: false,
    });
    await setConfig({ gatewayUrl: "http://gw.test", mode: "auto", enabled: true });
    await vscode.env.clipboard.writeText("ssn 123-45-6789");

    await vscode.commands.executeCommand("privacyGateway.scrubClipboard");

    const got = await vscode.env.clipboard.readText();
    assert.strictEqual(got, "ssn [SSN]");
    const gw = captured.filter((c) => c.url.endsWith("/v1/redact"));
    assert.strictEqual(gw.length, 1);
    assert.strictEqual(gw[0]!.body.text, "ssn 123-45-6789");
  });

  test("toggleEnabled flips the setting", async () => {
    await setConfig({ enabled: true });
    await vscode.commands.executeCommand("privacyGateway.toggleEnabled");
    const after = vscode.workspace
      .getConfiguration("privacyGateway")
      .get<boolean>("enabled");
    assert.strictEqual(after, false);
  });
});
