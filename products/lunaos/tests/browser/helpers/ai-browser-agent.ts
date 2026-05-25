/**
 * AI Browser Agent wrapper — Stagehand / Browser Use style agent built on
 * top of a Playwright Page. Wraps the LunaOS OpenHands browse primitive
 * so agents in LunaOS workflows can navigate, extract, and act on web pages.
 *
 * Exposes: goto, extract, click, fill, screenshot, think
 */

import type { Page, Locator } from '@playwright/test';

export interface AgentAction {
    kind: 'goto' | 'extract' | 'click' | 'fill' | 'screenshot' | 'think';
    target?: string;
    value?: string;
    observation?: string;
}

export interface AgentConfig {
    maxSteps?: number;
    llmCall?: (prompt: string) => Promise<string>;
    onStep?: (action: AgentAction) => void;
}

export class AIBrowserAgent {
    private history: AgentAction[] = [];

    constructor(private page: Page, private cfg: AgentConfig = {}) {}

    async goto(url: string): Promise<AgentAction> {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        return this.record({ kind: 'goto', target: url });
    }

    async extract(selector: string, options: { all?: boolean } = {}): Promise<string | string[]> {
        const loc = this.page.locator(selector);
        if (options.all) {
            const texts = await loc.allInnerTexts();
            this.record({ kind: 'extract', target: selector, observation: `${texts.length} items` });
            return texts;
        }
        const text = (await loc.first().innerText()).trim();
        this.record({ kind: 'extract', target: selector, observation: text.slice(0, 100) });
        return text;
    }

    async click(selector: string): Promise<AgentAction> {
        await this.resolveAndAct(selector, (l) => l.click());
        return this.record({ kind: 'click', target: selector });
    }

    async fill(selector: string, value: string): Promise<AgentAction> {
        await this.resolveAndAct(selector, (l) => l.fill(value));
        return this.record({ kind: 'fill', target: selector, value });
    }

    async screenshot(label: string): Promise<AgentAction> {
        await this.page.screenshot({ path: `test-results/screenshots/${label}.png`, fullPage: true });
        return this.record({ kind: 'screenshot', target: label });
    }

    async think(prompt: string): Promise<string> {
        if (!this.cfg.llmCall) {
            const stub = `[STUB] Decision for: ${prompt.slice(0, 60)}`;
            this.record({ kind: 'think', value: prompt, observation: stub });
            return stub;
        }
        const out = await this.cfg.llmCall(prompt);
        this.record({ kind: 'think', value: prompt, observation: out.slice(0, 100) });
        return out;
    }

    getHistory(): readonly AgentAction[] {
        return this.history;
    }

    stepCount(): number {
        return this.history.length;
    }

    private record(action: AgentAction): AgentAction {
        this.history.push(action);
        this.cfg.onStep?.(action);
        const max = this.cfg.maxSteps ?? 30;
        if (this.history.length > max) throw new Error(`agent exceeded ${max} steps`);
        return action;
    }

    private async resolveAndAct(selector: string, fn: (l: Locator) => Promise<unknown>): Promise<void> {
        const loc = this.page.locator(selector).first();
        await loc.waitFor({ state: 'visible', timeout: 5_000 });
        await fn(loc);
    }
}

export function makeAgent(page: Page, cfg: AgentConfig = {}): AIBrowserAgent {
    return new AIBrowserAgent(page, cfg);
}
