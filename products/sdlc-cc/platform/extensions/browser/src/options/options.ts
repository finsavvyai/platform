// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadSettings, saveSettings } from "../lib/storage";
import { redact, GatewayError } from "../lib/api";
import type { ExtensionSettings } from "../lib/types";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const form = $<HTMLFormElement>("form");
const gatewayUrl = $<HTMLInputElement>("gatewayUrl");
const apiKey = $<HTMLInputElement>("apiKey");
const tenant = $<HTMLInputElement>("tenant");
const mode = $<HTMLSelectElement>("mode");
const enabled = $<HTMLInputElement>("enabled");
const status = $<HTMLDivElement>("status");
const testBtn = $<HTMLButtonElement>("test");
const presetBoxes = Array.from(
  document.querySelectorAll<HTMLInputElement>("#presets input[type=checkbox]"),
);

function paint(s: ExtensionSettings): void {
  gatewayUrl.value = s.gatewayUrl;
  apiKey.value = s.apiKey;
  tenant.value = s.tenant ?? "";
  mode.value = s.mode;
  enabled.checked = s.enabled;
  presetBoxes.forEach((cb) => (cb.checked = s.presets.includes(cb.value)));
}

function read(): Partial<ExtensionSettings> {
  const t = tenant.value.trim();
  const out: Partial<ExtensionSettings> = {
    gatewayUrl: gatewayUrl.value.trim(),
    apiKey: apiKey.value.trim(),
    mode: mode.value === "auto" ? "auto" : "preview",
    enabled: enabled.checked,
    presets: presetBoxes.filter((cb) => cb.checked).map((cb) => cb.value),
  };
  if (t) out.tenant = t;
  return out;
}

function flash(msg: string, isError = false): void {
  status.textContent = msg;
  status.classList.toggle("error", isError);
  window.setTimeout(() => (status.textContent = ""), 3000);
}

void loadSettings().then(paint);

form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void saveSettings(read()).then(() => flash("Saved."));
});

testBtn.addEventListener("click", async () => {
  try {
    const next = await saveSettings(read());
    await redact(next, { text: "Test prompt with email test@example.com" });
    flash("Connection OK.");
  } catch (err) {
    const msg = err instanceof GatewayError ? `${err.status}: ${err.message}` : String(err);
    flash(`Test failed: ${msg}`, true);
  }
});
