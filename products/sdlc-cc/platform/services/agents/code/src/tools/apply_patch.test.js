const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const apply_patch = require('./apply_patch');
const { ApplyPatchTool } = apply_patch;

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-code-'));
}

test('apply_patch validates patch type', async () => {
  await assert.rejects(
    () => apply_patch({ patch: 123, workdir: '/tmp' }),
    /must be a string/,
  );
});

test('apply_patch validates workdir', async () => {
  await assert.rejects(
    () => apply_patch({ patch: '' }),
    /workdir is required/,
  );
});

test('apply_patch shells out to docker with mount + workdir', async () => {
  const dir = tmpdir();
  let captured;
  const fakeExec = (file, args) => {
    captured = { file, args };
    return Promise.resolve({ exitCode: 0, stdout: 'Applied patch /work/.patch cleanly.\n', stderr: '' });
  };
  const out = await apply_patch({ patch: 'hello', workdir: dir, exec: fakeExec });
  assert.equal(out.exitCode, 0);
  assert.equal(captured.file, 'docker');
  // Check key docker args present.
  assert.ok(captured.args.includes('run'));
  assert.ok(captured.args.includes('--rm'));
  assert.ok(captured.args.includes('-v'));
  assert.ok(captured.args.includes(`${dir}:/work`));
  assert.ok(captured.args.includes('alpine:3'));
  // Patch was written to disk.
  const written = fs.readFileSync(path.join(dir, '.patch'), 'utf8');
  assert.equal(written, 'hello');
});

test('apply_patch counts files changed from stdout', async () => {
  const dir = tmpdir();
  const fakeExec = () => Promise.resolve({
    exitCode: 0,
    stdout: 'Applied patch /work/.patch cleanly.\nApplied patch a.txt\npatching file b.txt\n',
    stderr: '',
  });
  const out = await apply_patch({ patch: 'p', workdir: dir, exec: fakeExec });
  assert.equal(out.filesChanged, 3);
});

test('apply_patch propagates non-zero exit code', async () => {
  const dir = tmpdir();
  const fakeExec = () => Promise.resolve({
    exitCode: 1, stdout: '', stderr: 'error: patch failed\n',
  });
  const out = await apply_patch({ patch: 'p', workdir: dir, exec: fakeExec });
  assert.equal(out.exitCode, 1);
  assert.match(out.stderr, /patch failed/);
});

test('ApplyPatchTool honours custom dockerImage', async () => {
  const dir = tmpdir();
  let captured;
  const tool = new ApplyPatchTool({
    exec: (file, args) => {
      captured = args;
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    },
    dockerImage: 'busybox:latest',
  });
  await tool.run({ patch: 'p', workdir: dir });
  assert.ok(captured.includes('busybox:latest'));
});
