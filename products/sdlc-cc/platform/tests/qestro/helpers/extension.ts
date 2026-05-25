// SPDX-License-Identifier: AGPL-3.0-or-later
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIR = path.resolve(__dirname, "../../../extensions/browser/dist");

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
        "--no-sandbox",
      ],
    });
    await use(ctx);
    await ctx.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const id = worker.url().split("/")[2];
    if (!id) throw new Error("could not derive extension id");
    await use(id);
  },
});

export const expect = test.expect;

export interface CapturedRedact {
  url: string;
  body: { text: string; presets?: string[]; tenant?: string };
}

/** Stub the gateway response so the test doesn't need a live backend. */
export async function stubGateway(
  ctx: BrowserContext,
  reply: { redacted: string; detections: unknown[]; blocked?: boolean; block_reason?: string },
  captures: CapturedRedact[],
): Promise<void> {
  await ctx.route("**/v1/redact", async (route) => {
    const req = route.request();
    captures.push({
      url: req.url(),
      body: JSON.parse(req.postData() ?? "{}"),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        blocked: false,
        ...reply,
      }),
    });
  });
}

/** Configure the extension via chrome.storage.sync from the options page. */
export async function configure(
  ctx: BrowserContext,
  extensionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await page.evaluate((p) => {
    type StoredSettings = Record<string, unknown>;
    interface ChromeStorageArea {
      get(key: string, cb: (items: Record<string, StoredSettings>) => void): void;
      set(items: Record<string, StoredSettings>, cb: () => void): void;
    }
    const c = (globalThis as unknown as { chrome: { storage: { sync: ChromeStorageArea } } }).chrome;
    return new Promise<void>((resolve) => {
      c.storage.sync.get("privacy_gateway_settings", (s) => {
        const cur = (s["privacy_gateway_settings"] ?? {}) as StoredSettings;
        c.storage.sync.set(
          { privacy_gateway_settings: { ...cur, ...p } },
          () => resolve(),
        );
      });
    });
  }, patch);
  await page.close();
}
