import { test, expect } from '@playwright/test';
import { makeAgent, type AgentAction } from '../helpers/ai-browser-agent';

test.describe('AI browser agent', () => {
    test('goto + extract captures page title', async ({ page }) => {
        const agent = makeAgent(page);
        await agent.goto('data:text/html,<html><head><title>hello</title></head><body><h1>Hi LunaOS</h1></body></html>');
        const heading = await agent.extract('h1');
        expect(heading).toBe('Hi LunaOS');
        expect(agent.stepCount()).toBe(2);
    });

    test('extract all returns array of texts', async ({ page }) => {
        const agent = makeAgent(page);
        await agent.goto('data:text/html,<ul><li>a</li><li>b</li><li>c</li></ul>');
        const items = (await agent.extract('li', { all: true })) as string[];
        expect(items).toEqual(['a', 'b', 'c']);
    });

    test('click + fill drive a form', async ({ page }) => {
        const agent = makeAgent(page);
        await agent.goto(
            'data:text/html,<form><input name="q" /><button id="go">Go</button></form><script>document.getElementById("go").addEventListener("click",e=>{e.preventDefault();document.title=document.querySelector("input").value})</script>',
        );
        await agent.fill('input[name="q"]', 'cepien');
        await agent.click('#go');
        await expect(page).toHaveTitle('cepien');
    });

    test('think uses injected LLM call when provided', async ({ page }) => {
        const calls: string[] = [];
        const agent = makeAgent(page, {
            llmCall: async (p) => {
                calls.push(p);
                return 'click selector .primary';
            },
        });
        const decision = await agent.think('What should I do on this page?');
        expect(decision).toContain('selector');
        expect(calls).toHaveLength(1);
    });

    test('think falls back to stub when no LLM configured', async ({ page }) => {
        const agent = makeAgent(page);
        const out = await agent.think('Pick the best CTA');
        expect(out).toMatch(/^\[STUB\]/);
    });

    test('maxSteps enforces agent budget', async ({ page }) => {
        const agent = makeAgent(page, { maxSteps: 2 });
        await agent.goto('data:text/html,<p>one</p>');
        await agent.extract('p');
        await expect(agent.extract('p')).rejects.toThrow(/exceeded 2 steps/);
    });

    test('onStep callback fires for every action', async ({ page }) => {
        const log: AgentAction[] = [];
        const agent = makeAgent(page, { onStep: (a) => log.push(a) });
        await agent.goto('data:text/html,<h1>x</h1>');
        await agent.extract('h1');
        expect(log.map((a) => a.kind)).toEqual(['goto', 'extract']);
    });
});
