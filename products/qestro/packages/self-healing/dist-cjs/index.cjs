"use strict";
/**
 * @qestro/self-healing — AI-powered self-healing selectors for Playwright tests.
 *
 * Auto-fix broken tests when your UI changes.
 *
 * Quick start:
 * ```ts
 * import { SelfHealingEngine } from '@qestro/self-healing';
 *
 * const engine = new SelfHealingEngine();
 * const result = await engine.analyzeAndHeal(testId, testResult);
 * if (result.healed) applyFix(result.appliedFix);
 * ```
 *
 * Made by Qestro — https://qestro.app
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIHealer = exports.AssertionHealer = exports.TimingHealer = exports.SelectorHealer = exports.SelfHealingEngine = void 0;
var engine_js_1 = require("./engine.cjs");
Object.defineProperty(exports, "SelfHealingEngine", { enumerable: true, get: function () { return engine_js_1.SelfHealingEngine; } });
var index_js_1 = require("./healers/index.cjs");
Object.defineProperty(exports, "SelectorHealer", { enumerable: true, get: function () { return index_js_1.SelectorHealer; } });
Object.defineProperty(exports, "TimingHealer", { enumerable: true, get: function () { return index_js_1.TimingHealer; } });
Object.defineProperty(exports, "AssertionHealer", { enumerable: true, get: function () { return index_js_1.AssertionHealer; } });
Object.defineProperty(exports, "APIHealer", { enumerable: true, get: function () { return index_js_1.APIHealer; } });
//# sourceMappingURL=index.js.map