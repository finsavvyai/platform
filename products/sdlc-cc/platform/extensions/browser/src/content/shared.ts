// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  RedactResponse,
  RuntimeMessage,
  RuntimeResponse,
} from "../lib/types";

const ATTR = "data-pgw-bound";

export interface BindOptions {
  selector: string;
  submitSelectors: string[];
  submitKeys?: ReadonlyArray<{ key: string; ctrl?: boolean; meta?: boolean }>;
  surface: string;
}

export function bindEditor(opts: BindOptions): void {
  const observer = new MutationObserver(() => attachAll(opts));
  observer.observe(document.body, { childList: true, subtree: true });
  attachAll(opts);
}

function attachAll(opts: BindOptions): void {
  const nodes = document.querySelectorAll<HTMLElement>(opts.selector);
  nodes.forEach((node) => {
    if (node.getAttribute(ATTR) === "1") return;
    node.setAttribute(ATTR, "1");
    attach(node, opts);
  });
}

function attach(editor: HTMLElement, opts: BindOptions): void {
  editor.addEventListener(
    "keydown",
    (ev: KeyboardEvent) => {
      const trigger = (opts.submitKeys ?? [{ key: "Enter" }]).some(
        (k) =>
          ev.key === k.key &&
          (k.ctrl ?? false) === ev.ctrlKey &&
          (k.meta ?? false) === ev.metaKey &&
          !ev.shiftKey,
      );
      if (!trigger) return;
      const text = readText(editor);
      if (!text.trim()) return;
      ev.preventDefault();
      ev.stopPropagation();
      void scrubAndSubmit(editor, text, opts);
    },
    true,
  );
}

async function scrubAndSubmit(
  editor: HTMLElement,
  text: string,
  opts: BindOptions,
): Promise<void> {
  const res = await sendRedact(text);
  if (!res.ok) {
    notify(`Privacy Gateway error: ${res.error}. Sent unchanged.`, opts.surface);
    pressSubmit(opts);
    return;
  }
  const data = res.data;
  if (data.blocked) {
    notify(
      `Blocked: ${data.block_reason ?? "policy violation"}. Edit the prompt.`,
      opts.surface,
    );
    return;
  }
  if (data.detections.length === 0) {
    pressSubmit(opts);
    return;
  }
  const ok = await confirmRedaction(data);
  if (!ok) return;
  writeText(editor, data.redacted);
  pressSubmit(opts);
}

async function sendRedact(
  text: string,
): Promise<Extract<RuntimeResponse, { ok: true; data: RedactResponse }> | { ok: false; error: string }> {
  const msg: RuntimeMessage = { kind: "redact", payload: { text } };
  const reply = (await chrome.runtime.sendMessage(msg)) as RuntimeResponse;
  if (!reply.ok) return reply;
  if (!("redacted" in (reply.data as object))) {
    return { ok: false, error: "unexpected response shape" };
  }
  return reply as Extract<RuntimeResponse, { ok: true; data: RedactResponse }>;
}

function readText(node: HTMLElement): string {
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    return node.value;
  }
  return node.textContent ?? "";
}

function writeText(node: HTMLElement, text: string): void {
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(
      node.constructor.prototype,
      "value",
    )?.set;
    setter?.call(node, text);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  node.textContent = text;
  node.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function pressSubmit(opts: BindOptions): void {
  for (const sel of opts.submitSelectors) {
    const btn = document.querySelector<HTMLButtonElement>(sel);
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
  }
}

function notify(message: string, surface: string): void {
  console.warn(`[privacy-gateway:${surface}]`, message);
}

async function confirmRedaction(data: RedactResponse): Promise<boolean> {
  const summary = data.detections
    .map((d) => `${d.preset}/${d.pattern} → ${d.action}`)
    .join("\n");
  return window.confirm(
    `Privacy Gateway scrubbed ${data.detections.length} item(s):\n\n${summary}\n\nSend redacted prompt?`,
  );
}
