// apply_patch — REAL Docker-backed sandbox.
//
// Spawns `docker run --rm -v <workdir>:/work -w /work alpine:3 sh -c
// "git apply /work/.patch"` so the patch is applied inside an
// ephemeral container with the working copy mounted read-write. The
// caller writes the diff to <workdir>/.patch before invoking us.
//
// Returns { exitCode, filesChanged, stdout, stderr }.
// The default exec is child_process.execFile; tests inject a fake.
//
// Docker MUST be installed on the host at runtime. Tests don't need it
// because they pass a stub exec.

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function defaultExec(file, args, opts) {
  return new Promise((resolve) => {
    childProcess.execFile(file, args, opts, (err, stdout, stderr) => {
      const exitCode = err && typeof err.code === 'number' ? err.code : (err ? 1 : 0);
      resolve({ exitCode, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function countFilesChanged(stdout) {
  // `git apply --numstat` would be nicer, but for the simple flow we
  // count "patching file" / "Applied patch to" lines from `git apply
  // -v` or POSIX `patch` fallback.
  const lines = String(stdout).split('\n');
  let n = 0;
  for (const l of lines) {
    if (/^Applied patch /.test(l) || /patching file /.test(l)) n++;
  }
  return n;
}

class ApplyPatchTool {
  constructor({ exec = defaultExec, dockerImage = 'alpine:3' } = {}) {
    this.exec = exec;
    this.dockerImage = dockerImage;
  }

  async run({ patch, workdir }) {
    if (typeof patch !== 'string') {
      throw new TypeError('apply_patch: patch must be a string');
    }
    if (!workdir) {
      throw new TypeError('apply_patch: workdir is required');
    }
    const patchPath = path.join(workdir, '.patch');
    fs.writeFileSync(patchPath, patch);
    const args = [
      'run', '--rm',
      '-v', `${workdir}:/work`,
      '-w', '/work',
      '--security-opt', 'no-new-privileges',
      this.dockerImage,
      'sh', '-c',
      'git init -q 2>/dev/null; git apply -v /work/.patch',
    ];
    const { exitCode, stdout, stderr } = await this.exec('docker', args, { cwd: workdir });
    return {
      exitCode,
      filesChanged: countFilesChanged(stdout + stderr),
      stdout,
      stderr,
    };
  }
}

// Functional facade so the dispatcher in index.js can call it directly.
function apply_patch(opts = {}) {
  const tool = new ApplyPatchTool({ exec: opts.exec, dockerImage: opts.dockerImage });
  return tool.run(opts);
}

module.exports = apply_patch;
module.exports.ApplyPatchTool = ApplyPatchTool;
