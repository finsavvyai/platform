const { test } = require('node:test');
const assert = require('node:assert/strict');

const run_tests = require('./run_tests');
const { RunTestsTool } = run_tests;

test('run_tests requires workdir', async () => {
  await assert.rejects(() => run_tests({}), /workdir is required/);
});

test('run_tests defaults to npm test inside docker', async () => {
  let captured;
  const fakeExec = (file, args) => {
    captured = { file, args };
    return Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '' });
  };
  const out = await run_tests({ workdir: '/w', exec: fakeExec });
  assert.equal(out.exitCode, 0);
  assert.equal(captured.file, 'docker');
  assert.ok(captured.args.includes('node:22-alpine'));
  // The shell command is the last arg.
  assert.equal(captured.args[captured.args.length - 1], 'npm test');
  assert.ok(typeof out.durationMs === 'number');
});

test('run_tests uses configured testCommand override', async () => {
  let captured;
  const tool = new RunTestsTool({
    exec: (file, args) => { captured = args; return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' }); },
    testCommand: 'pytest -q',
  });
  await tool.run({ workdir: '/w' });
  assert.equal(captured[captured.length - 1], 'pytest -q');
});

test('run_tests propagates non-zero exit code + stderr', async () => {
  const fakeExec = () => Promise.resolve({
    exitCode: 2, stdout: '', stderr: 'Test suite failed\n',
  });
  const out = await run_tests({ workdir: '/w', exec: fakeExec });
  assert.equal(out.exitCode, 2);
  assert.match(out.stderr, /failed/);
});

test('run_tests passes per-call testCommand override', async () => {
  let captured;
  const fakeExec = (file, args) => {
    captured = args;
    return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
  };
  await run_tests({ workdir: '/w', exec: fakeExec, defaultCommand: 'go test ./...' });
  assert.equal(captured[captured.length - 1], 'go test ./...');
});
