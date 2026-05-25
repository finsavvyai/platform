import type { RitualDefinition, RitualStep } from "./types";

import { spawn } from "child_process";
import * as fs from "fs";

export class RitualEngine {
  private rituals = new Map<string, RitualDefinition>();

  register(def: RitualDefinition) {
    this.rituals.set(def.id, def);
  }

  list(): RitualDefinition[] {
    return Array.from(this.rituals.values());
  }

  get(id: string): RitualDefinition | undefined {
    return this.rituals.get(id);
  }

  async execute(ritual: RitualDefinition): Promise<any[]> {
    const results: any[] = [];
    for (const step of ritual.steps) {
      results.push(await this.executeStep(step));
    }
    return results;
  }

  private async executeStep(step: RitualStep): Promise<any> {
    switch (step.type) {
      case "command":
      case "test":
        return await runCommand(step.data.cmd, step.data.cwd ?? process.cwd());
      case "fileChange":
        return await readFile(step.data.path);
      case "http":
        return await fetch(step.data.url).then((r) => r.text());
      default:
        return step.data;
    }
  }
}

function runCommand(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, { cwd, shell: true });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (out += d.toString()));
    proc.on("close", () => resolve(out));
    proc.on("error", reject);
  });
}

function readFile(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(p, "utf8", (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
