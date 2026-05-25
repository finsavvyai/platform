/**
 * Sanctions / PEP screening — public surface (types only, M1 W2).
 *
 * Implementations will be wired in tier-by-tier:
 *   - ofac_public      (this package, Starter SKU)
 *   - compa_pro        (Pro SKU, M2 W7 — partnership with ComplyAdvantage)
 *   - djr_enterprise   (Enterprise SKU, M7+ — Dow Jones Risk, customer-licensed)
 */

export type {
  SanctionsAdapter,
  SanctionsMatch,
  SanctionsScreenResult,
  SanctionsSubject,
  SanctionsTier,
} from "./types.js";
