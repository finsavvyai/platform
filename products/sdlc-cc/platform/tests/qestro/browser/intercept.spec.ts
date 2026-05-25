// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Verifies the privacy-gateway browser extension intercepts the
// submit gesture on each supported chat surface and posts the
// prompt to /v1/redact before the host page sees it.
//
// We intercept the real chat-site URLs via Playwright's request
// router and return a fixture HTML body — that keeps the page URL
// on (e.g.) https://chatgpt.com/ so the content_script's URL match
// fires. /v1/redact responses are stubbed so no live gateway is
// required.
//
// Usage:
//   cd extensions/browser && npm run build       # produces dist/
//   cd ../../tests/qestro
//   npx playwright test browser --headed

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  test,
  expect,
  stubGateway,
  configure,
  type CapturedRedact,
} from "../helpers/extension";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(__dirname, "../fixtures");

interface Surface {
  name: string;
  url: string;
  fixture: string;
  selector: string;
  setText: string;
}

const surfaces: Surface[] = [
  {
    name: "chatgpt",
    url: "https://chatgpt.com/",
    fixture: "chatgpt.html",
    selector: "#prompt-textarea",
    setText: "alice@example.com please summarise this",
  },
  {
    name: "claude",
    url: "https://claude.ai/new",
    fixture: "claude.html",
    selector: ".ProseMirror",
    setText: "client SSN 123-45-6789",
  },
  {
    name: "gemini",
    url: "https://gemini.google.com/app",
    fixture: "gemini.html",
    selector: "rich-textarea div[contenteditable='true']",
    setText: "card 4111-1111-1111-1111",
  },
  {
    name: "copilot",
    url: "https://copilot.microsoft.com/",
    fixture: "copilot.html",
    selector: "#userInput",
    setText: "secret sk_live_abcdef0123456789",
  },
];

for (const s of surfaces) {
  test(`${s.name}: extension intercepts submit and POSTs to /v1/redact`, async ({
    context,
    extensionId,
    page,
  }) => {
    const fixtureBody = readFileSync(path.join(FIX, s.fixture), "utf8");
    const captured: CapturedRedact[] = [];

    await context.route(s.url, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: fixtureBody,
      }),
    );
    await stubGateway(
      context,
      {
        redacted: "[REDACTED]",
        detections: [
          { pattern: "email", preset: "pii_default", action: "redact", start: 0, end: 0 },
        ],
      },
      captured,
    );
    await configure(context, extensionId, {
      gatewayUrl: "http://localhost:8080",
      enabled: true,
      mode: "auto",
      presets: ["pii_default", "secrets"],
    });

    page.on("dialog", (d) => d.accept());
    await page.goto(s.url);

    const el = page.locator(s.selector).first();
    await el.waitFor();
    await el.click();
    await page.keyboard.type(s.setText);
    await page.keyboard.press("Enter");

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(captured[0]!.body.text).toContain(s.setText);
  });
}
