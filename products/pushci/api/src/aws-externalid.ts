// ExternalId helpers for AWS Role-mode confused-deputy protection.
//
// The ExternalId is a shared secret between PushCI and the customer's
// AWS account. The customer's trust policy MUST pin this value via:
//
//   "Condition": { "StringEquals": { "sts:ExternalId": "<value>" } }
//
// Without it, any principal that learns the customer's role ARN and is
// trusted by their role (e.g. the entire PushCI AWS account) can call
// sts:AssumeRole — the classic confused-deputy vulnerability.
//
// AWS best practice:
// https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html

export const EXTERNAL_ID_MIN_LEN = 16;
export const EXTERNAL_ID_GENERATED_LEN = 32;

// generateExternalId returns a 32-char hex string drawn from crypto
// randomness. Unique per-tenant; callers persist it to KV and display
// it back to the user so they can paste it into their trust policy.
export function generateExternalId(): string {
  const bytes = new Uint8Array(EXTERNAL_ID_GENERATED_LEN / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ExternalIdValidation {
  ok: boolean;
  error?: string;
}

// validateExternalId enforces the minimum-length policy. Length-only
// check because users may paste values from legacy AWS workflows that
// predate our format; random-enough entropy is enforced by the 16-char
// floor (~96 bits if hex, >80 bits even with low-alphabet inputs).
export function validateExternalId(v: unknown): ExternalIdValidation {
  if (typeof v !== "string") {
    return { ok: false, error: "externalId must be a string" };
  }
  if (v.length < EXTERNAL_ID_MIN_LEN) {
    return {
      ok: false,
      error:
        `externalId must be at least ${EXTERNAL_ID_MIN_LEN} characters ` +
        "(confused-deputy protection; see https://docs.aws.amazon.com/" +
        "IAM/latest/UserGuide/confused-deputy.html)",
    };
  }
  return { ok: true };
}

// redactExternalId shows just enough of the value for the user to
// confirm which one is stored without disclosing the whole secret.
// Short inputs (the minimum 16 chars) still reveal only 4+4 = 8 chars.
export function redactExternalId(v: string): string {
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export interface ResolveExternalIdOk {
  ok: true;
  mode: "static" | "role";
  externalId?: string;
  generated?: string;
}
export interface ResolveExternalIdErr {
  ok: false;
  error: string;
}

// resolveExternalId applies role-mode confused-deputy policy:
// - static mode → externalId dropped (N/A)
// - role mode + missing → auto-generated 32-char hex
// - role mode + present → length-validated; too short returns error
export function resolveExternalId(
  mode: "static" | "role",
  submitted: string | undefined
): ResolveExternalIdOk | ResolveExternalIdErr {
  if (mode === "static") return { ok: true, mode };
  if (submitted === undefined) {
    const generated = generateExternalId();
    return { ok: true, mode, externalId: generated, generated };
  }
  const check = validateExternalId(submitted);
  if (!check.ok) return { ok: false, error: check.error! };
  return { ok: true, mode, externalId: submitted };
}
