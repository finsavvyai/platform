/**
 * Sanctions / PEP screening — 3-tier surface (locked decision #8 of the
 * decisive plan):
 *
 *   - OFAC public          → Starter SKU (this brain package, free tier)
 *   - ComplyAdvantage      → Pro SKU (partnership; M2 W7)
 *   - Dow Jones Risk       → Enterprise SKU (customer-licensed; M7+)
 *
 * 200-line cap; types-only stub. Implementation lands once the OFAC parser
 * is extracted from products/amliq/api/ (see CONSOLIDATION_TODO).
 */

export type SanctionsTier = "ofac_public" | "compa_pro" | "djr_enterprise";

export interface SanctionsSubject {
  /** Hashed identifier (sha-256 of canonical subject form). NEVER plaintext PII. */
  readonly subjectHash: string;
  /** Optional non-PII attributes used for narrowing (country code, type). */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface SanctionsMatch {
  readonly tier: SanctionsTier;
  readonly listId: string;
  /** Stable identifier of the matched entity in the source list. */
  readonly entityId: string;
  readonly confidence: number; // 0..1
  /** Stable reason code, NEVER free-form / NEVER PII. */
  readonly reason: string;
}

export interface SanctionsScreenResult {
  readonly subjectHash: string;
  readonly matches: readonly SanctionsMatch[];
  readonly listVersion: string;
  readonly latencyMs: number;
}

export interface SanctionsAdapter {
  readonly tier: SanctionsTier;
  screen(subject: SanctionsSubject): Promise<SanctionsScreenResult>;
}
