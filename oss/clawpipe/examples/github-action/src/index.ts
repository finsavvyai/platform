import * as core from '@actions/core';
import * as github from '@actions/github';
import { ClawPipe } from 'clawpipe-ai';

const SYSTEM_PROMPT = `You are a senior code reviewer. Review the PR diff and provide:
1. A brief summary of what changed
2. Potential bugs or issues (with file:line references)
3. Security concerns if any
4. Suggestions for improvement

Be concise. Focus on what matters. Skip style nits.`;

async function run(): Promise<void> {
  const apiKey = core.getInput('clawpipe-api-key', { required: true });
  const maxFiles = parseInt(core.getInput('max-files') || '20', 10);
  const commentMode = core.getInput('comment-mode') || 'summary';

  const pipe = new ClawPipe({
    apiKey,
    projectId: 'github-pr-review',
    enableBooster: true,
    enablePacker: true,
    enableCache: true,
  });

  const token = process.env.GITHUB_TOKEN!;
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const prNumber = github.context.payload.pull_request?.number;

  if (!prNumber) {
    core.setFailed('This action only works on pull_request events.');
    return;
  }

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: maxFiles,
  });

  const diff = files
    .filter((f) => f.patch && f.status !== 'removed')
    .map((f) => `### ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``)
    .join('\n\n');

  if (!diff) {
    core.info('No reviewable changes found.');
    return;
  }

  const prompt = `Review this pull request diff:\n\n${diff}`;
  const result = await pipe.prompt(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 2048,
  });

  const meta = result.meta;
  const footer = [
    '---',
    `*Reviewed by [ClawPipe](https://clawpipe.ai) | `,
    `Model: ${meta.model || 'booster'} | `,
    `Cost: $${meta.estimatedCostUsd.toFixed(4)} | `,
    `Latency: ${meta.latencyMs}ms`,
    meta.cached ? ' | Cached' : '',
    meta.contextSavings !== '0%' ? ` | Context savings: ${meta.contextSavings}` : '',
    '*',
  ].join('');

  const body = `## AI Code Review\n\n${result.text}\n\n${footer}`;

  if (commentMode === 'summary') {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }

  core.setOutput('review', result.text);
  core.setOutput('cost', meta.estimatedCostUsd.toFixed(4));
  core.setOutput('cached', String(meta.cached));

  core.info(`Review posted. Cost: $${meta.estimatedCostUsd.toFixed(4)}`);
}

run().catch((err) => core.setFailed(err.message));
