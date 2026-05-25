// @sdlc/agent-code — REAL code-action agent.
//
// Wires three tools through a dispatcher:
//   - apply_patch: docker-sandboxed `git apply`
//   - run_tests:   docker-sandboxed test command
//   - open_pr:     GitHub App JWT -> installation token -> POST /pulls
//
// Each tool accepts an injectable seam (exec or fetch) for tests, so
// the test suite runs without Docker or network access.
//
// Plan() is intentionally a fixed 3-step example; a planner driven by
// the LLM gateway is tracked in STATUS.md.

const apply_patch = require('./tools/apply_patch');
const run_tests = require('./tools/run_tests');
const open_pr = require('./tools/open_pr');

const TOOLS = {
  apply_patch,
  run_tests,
  open_pr,
};

class CodeAgent {
  constructor({ workdir, github = {}, exec, fetch } = {}) {
    this.workdir = workdir;
    this.github = github; // { appId, privateKeyPath, installationId, owner, repo }
    this.exec = exec;
    this.fetch = fetch;
  }

  /**
   * plan(goal) — placeholder planner. Returns a fixed 3-step plan so
   * callers can exercise dispatch deterministically.
   */
  plan(goal) {
    return [
      { tool: 'apply_patch', args: { goal, patch: '' } },
      { tool: 'run_tests', args: {} },
      { tool: 'open_pr', args: { title: goal } },
    ];
  }

  /**
   * execute(step) — invokes the named tool with merged args, threading
   * the agent-level workdir + GitHub config through to the tool.
   */
  async execute(step) {
    const tool = TOOLS[step.tool];
    if (!tool) throw new Error(`unknown tool: ${step.tool}`);
    const merged = {
      workdir: this.workdir,
      exec: this.exec,
      fetch: this.fetch,
      ...this.github,
      ...step.args,
    };
    return tool(merged);
  }
}

module.exports = { CodeAgent, TOOLS };
