import type { PolicyContext, PolicyRule, PolicyViolation } from "./types.js";

export class FileSizeRule implements PolicyRule {
  readonly id = "portfolio/file-size-200";
  readonly severity = "high" as const;
  constructor(private readonly maxLines: number = 200) {}

  evaluate(ctx: PolicyContext): readonly PolicyViolation[] {
    const out: PolicyViolation[] = [];
    for (const file of ctx.files) {
      const lines = Number(ctx.metadata[`lines:${file}`] ?? "0");
      if (lines > this.maxLines) {
        out.push({
          ruleId: this.id,
          severity: this.severity,
          message: `File ${file} has ${lines} lines (cap ${this.maxLines}).`,
          file,
        });
      }
    }
    return out;
  }
}

export class SecretScanRule implements PolicyRule {
  readonly id = "portfolio/no-secrets";
  readonly severity = "critical" as const;
  private readonly pattern = /\b(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{32,})\b/;

  evaluate(ctx: PolicyContext): readonly PolicyViolation[] {
    const out: PolicyViolation[] = [];
    for (const file of ctx.files) {
      const sample = ctx.metadata[`content:${file}`] ?? "";
      if (this.pattern.test(sample)) {
        out.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Secret-like token detected in ${file}.`,
          file,
        });
      }
    }
    return out;
  }
}
