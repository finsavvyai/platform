"use strict";
/**
 * TimingHealer — fixes for timeout and wait failures.
 *
 * Covers: larger timeouts, waitForSelector, waitForLoadState, retry logic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimingHealer = void 0;
class TimingHealer {
    heal(_testResult, _testCode) {
        return [
            {
                id: 'timing_increase_timeout',
                type: 'wait_timeout',
                originalValue: '5000',
                suggestedValue: '15000',
                confidence: 0.8,
                rationale: 'Increase timeout for slow-loading or heavy pages',
                beforeAfterDiff: `- await page.click(selector, { timeout: 5000 })\n+ await page.click(selector, { timeout: 15000 })`,
            },
            {
                id: 'timing_add_waitfor_selector',
                type: 'wait_for_selector',
                originalValue: 'page.click(selector)',
                suggestedValue: 'await page.waitForSelector(selector); await page.click(selector)',
                confidence: 0.87,
                rationale: 'Wait for element visibility before interaction. Ensures DOM is ready.',
                beforeAfterDiff: `- await page.click(selector)\n+ await page.waitForSelector(selector, { visible: true });\n+ await page.click(selector)`,
            },
            {
                id: 'timing_add_loadstate',
                type: 'wait_load_state',
                originalValue: 'page.goto(url)',
                suggestedValue: 'await page.goto(url); await page.waitForLoadState("networkidle")',
                confidence: 0.83,
                rationale: 'Wait for network to settle. Prevents assertions during loading.',
                beforeAfterDiff: `- await page.goto(url)\n+ await page.goto(url);\n+ await page.waitForLoadState('networkidle');`,
            },
            {
                id: 'timing_retry_logic',
                type: 'retry_logic',
                originalValue: 'await action()',
                suggestedValue: 'await retry(() => action(), { maxAttempts: 3, delayMs: 1000 })',
                confidence: 0.76,
                rationale: 'Add retry logic for flaky operations. Handles intermittent failures.',
                beforeAfterDiff: `- await page.click(selector)\n+ await retry(() => page.click(selector), { maxAttempts: 3 })`,
            },
        ];
    }
}
exports.TimingHealer = TimingHealer;
//# sourceMappingURL=TimingHealer.js.map