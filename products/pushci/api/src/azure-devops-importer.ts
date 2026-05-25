// azure-pipelines.yml → .pushci.yml translator.
//
// Handles the common subset (stages → jobs → steps / steps-only). This is a
// deliberately small YAML reader — we don't bring in js-yaml to keep the
// Worker bundle tight. Unsupported constructs (templates, strategies,
// conditions, marketplace task@N) become warning comments in the output.
//
// Tokenizer helpers live in azure-devops-yaml.ts to keep each file ≤200
// lines (portfolio CLAUDE.md rule).
//
// License: Apache-2.0

import {
  tokenize,
  unquote,
  splitByListItems,
  topSections,
  yamlQuote,
  type Line,
} from "./azure-devops-yaml";

export interface AzureStep {
  /** Shell script literal (bash/pwsh/cmd) rendered as a flat run string. */
  script?: string;
  /** Raw task identifier like `PublishBuildArtifacts@1` — not executable. */
  task?: string;
  displayName?: string;
}

export interface AzureJob {
  name: string;
  steps: AzureStep[];
}

export interface AzureStage {
  name: string;
  jobs: AzureJob[];
}

export interface AzurePipelineDoc {
  variables: Record<string, string>;
  stages: AzureStage[];
  warnings: string[];
}

function parseVariables(lines: Line[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ln of lines) {
    const m = ln.text.match(/^-?\s*([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (key === "name" || key === "value") continue; // list-of-maps style handled below
    out[key] = unquote(m[2]);
  }
  // Handle `- name: X\n  value: Y` shape.
  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].text.match(/^-\s*name:\s*(.*)$/);
    if (!nameMatch) continue;
    const valueLine = lines[i + 1];
    if (!valueLine) continue;
    const vm = valueLine.text.match(/^value:\s*(.*)$/);
    if (!vm) continue;
    out[unquote(nameMatch[1])] = unquote(vm[1]);
  }
  return out;
}

function parseStep(block: Line[]): AzureStep {
  const step: AzureStep = {};
  for (const ln of block) {
    const scriptMatch = ln.text.match(/^script:\s*(.*)$/);
    if (scriptMatch) step.script = unquote(scriptMatch[1]);
    const taskMatch = ln.text.match(/^task:\s*(.*)$/);
    if (taskMatch) step.task = unquote(taskMatch[1]);
    const nameMatch = ln.text.match(/^displayName:\s*(.*)$/);
    if (nameMatch) step.displayName = unquote(nameMatch[1]);
    const bashMatch = ln.text.match(/^bash:\s*(.*)$/);
    if (bashMatch) step.script = unquote(bashMatch[1]);
    const pwshMatch = ln.text.match(/^pwsh:\s*(.*)$/);
    if (pwshMatch) step.script = unquote(pwshMatch[1]);
  }
  return step;
}

function parseSteps(lines: Line[], warnings: string[]): AzureStep[] {
  const baseIndent = lines[0]?.indent ?? 2;
  const groups = splitByListItems(lines, baseIndent);
  const steps: AzureStep[] = [];
  for (const g of groups) {
    const s = parseStep(g);
    if (s.task && !s.script) {
      warnings.push(`unsupported task '${s.task}' — emitted as comment-only stub`);
    }
    steps.push(s);
  }
  return steps;
}

function parseJobs(lines: Line[], warnings: string[]): AzureJob[] {
  const baseIndent = lines[0]?.indent ?? 2;
  const groups = splitByListItems(lines, baseIndent);
  const jobs: AzureJob[] = [];
  for (const g of groups) {
    const name = g.find((l) => /^job:\s*/.test(l.text))?.text.replace(/^job:\s*/, "") ?? "job";
    const stepsIdx = g.findIndex((l) => /^steps:\s*$/.test(l.text));
    const steps = stepsIdx >= 0 ? parseSteps(g.slice(stepsIdx + 1), warnings) : [];
    jobs.push({ name: unquote(name), steps });
  }
  return jobs;
}

function parseStages(lines: Line[], warnings: string[]): AzureStage[] {
  const baseIndent = lines[0]?.indent ?? 2;
  const groups = splitByListItems(lines, baseIndent);
  const stages: AzureStage[] = [];
  for (const g of groups) {
    const nameLine = g.find((l) => /^stage:\s*/.test(l.text));
    const name = nameLine?.text.replace(/^stage:\s*/, "") ?? "stage";
    const jobsIdx = g.findIndex((l) => /^jobs:\s*$/.test(l.text));
    const jobs = jobsIdx >= 0 ? parseJobs(g.slice(jobsIdx + 1), warnings) : [];
    stages.push({ name: unquote(name), jobs });
  }
  return stages;
}

export function parseAzurePipeline(source: string): AzurePipelineDoc {
  const warnings: string[] = [];
  if (/\btemplate:\s/.test(source)) warnings.push("templates are not expanded — inline them before import");
  if (/\bstrategy:\s/.test(source)) warnings.push("matrix/strategy is not translated");
  const lines = tokenize(source);
  const sections = topSections(lines);
  const variables = sections.variables ? parseVariables(sections.variables) : {};
  let stages: AzureStage[] = [];
  if (sections.stages) {
    stages = parseStages(sections.stages, warnings);
  } else if (sections.jobs) {
    stages = [{ name: "build", jobs: parseJobs(sections.jobs, warnings) }];
  } else if (sections.steps) {
    const steps = parseSteps(sections.steps, warnings);
    stages = [{ name: "build", jobs: [{ name: "job", steps }] }];
  } else {
    warnings.push("no stages, jobs, or steps section found");
  }
  return { variables, stages, warnings };
}

/** Render parsed Azure doc as .pushci.yml. */
export function toPushciYaml(doc: AzurePipelineDoc, name = "azure-devops-import"): string {
  const lines: string[] = ["# Imported from azure-pipelines.yml by PushCI"];
  for (const w of doc.warnings) lines.push(`# WARNING: ${w}`);
  lines.push(`version: '1'`);
  lines.push(`name: ${yamlQuote(name)}`);
  if (Object.keys(doc.variables).length > 0) {
    lines.push("env:");
    for (const [k, v] of Object.entries(doc.variables)) lines.push(`  ${k}: ${yamlQuote(v)}`);
  }
  lines.push("stages:");
  if (doc.stages.length === 0) lines.push("  # no stages detected");
  for (const stage of doc.stages) {
    const allSteps = stage.jobs.flatMap((j) => j.steps);
    lines.push(`  - name: ${yamlQuote(stage.name)}`);
    if (allSteps.length === 0) {
      lines.push(`    run: []`);
      continue;
    }
    lines.push(`    run:`);
    for (const s of allSteps) {
      if (s.script) lines.push(`      - ${yamlQuote(s.script)}`);
      else if (s.task) lines.push(`      # TODO: task ${s.task} — migrate manually`);
    }
  }
  return lines.join("\n") + "\n";
}

export function azurePipelineToPushciYaml(source: string, name?: string) {
  const doc = parseAzurePipeline(source);
  return { doc, yaml: toPushciYaml(doc, name) };
}
