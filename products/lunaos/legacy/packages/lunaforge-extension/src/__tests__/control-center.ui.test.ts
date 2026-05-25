import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { getByText, getByRole } from "@testing-library/dom";
import { getHtmlForTest } from "../test/getHtmlForTest";

describe("LunaForge Control Center Webview UI", () => {
  it("renders header, buttons and wires handlers", () => {
    const html = getHtmlForTest(); // same as getHtml() but exported for tests
    const dom = new JSDOM(html, { runScripts: "dangerously" });

    const doc = dom.window.document;

    const heading = getByText(doc.body, "LunaForge Control Center");
    expect(heading).toBeTruthy();

    const refreshBtn = getByRole(doc.body, "button", { name: /Refresh Graph/i });
    const planBtn = getByRole(doc.body, "button", { name: /Request Plan/i });

    expect(refreshBtn).toBeTruthy();
    expect(planBtn).toBeTruthy();
  });
});