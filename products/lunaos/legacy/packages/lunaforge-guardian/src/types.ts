export interface GuardianRule {
  id: string;
  name: string;
  description: string;
  /** Glob-like or prefix-based matcher for "from" files, e.g. "domain/core/**" */
  fromPattern: string;
  /** Glob-like or prefix-based matcher for "to" files, e.g. "domain/ui/**" */
  toPattern: string;
  /** Whether this dependency is allowed or forbidden */
  effect: "allow" | "deny";
}

export interface GuardianViolation {
  ruleId: string;
  from: string;
  to: string;
  message: string;
}
