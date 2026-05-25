// CodeAgent dispatcher tests. The tools themselves are exercised in
// their own *.test.js files; here we just check wiring.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CodeAgent, TOOLS } = require('./index');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-code-'));
}

test('TOOLS registry exposes the three tools', () => {
  assert.equal(typeof TOOLS.apply_patch, 'function');
  assert.equal(typeof TOOLS.run_tests, 'function');
  assert.equal(typeof TOOLS.open_pr, 'function');
});

test('CodeAgent.plan returns ordered tool steps', () => {
  const agent = new CodeAgent({ workdir: '/tmp' });
  const steps = agent.plan('fix CI');
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.map((s) => s.tool), ['apply_patch', 'run_tests', 'open_pr']);
});

test('CodeAgent.execute throws on unknown tool', async () => {
  const agent = new CodeAgent({ workdir: '/tmp' });
  await assert.rejects(
    agent.execute({ tool: 'nope', args: {} }),
    /unknown tool/,
  );
});

test('CodeAgent.execute dispatches apply_patch with merged args', async () => {
  const dir = tmpdir();
  const calls = [];
  const fakeExec = (file, args) => {
    calls.push({ file, args });
    return Promise.resolve({ exitCode: 0, stdout: 'patching file foo.txt\n', stderr: '' });
  };
  const agent = new CodeAgent({ workdir: dir, exec: fakeExec });
  const out = await agent.execute({ tool: 'apply_patch', args: { patch: 'diff --git a/foo b/foo\n' } });
  assert.equal(out.exitCode, 0);
  assert.equal(out.filesChanged, 1);
  assert.equal(calls[0].file, 'docker');
});

test('CodeAgent.execute dispatches run_tests with workdir', async () => {
  const fakeExec = () => Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '' });
  const agent = new CodeAgent({ workdir: '/w', exec: fakeExec });
  const out = await agent.execute({ tool: 'run_tests', args: {} });
  assert.equal(out.exitCode, 0);
  assert.equal(out.stdout, 'ok');
});
