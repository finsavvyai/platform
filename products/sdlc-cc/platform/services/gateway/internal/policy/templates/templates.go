// Pre-built DLP policy templates. Claude Team D2 closeout: every
// regulated org wants to start from a known-good baseline rather
// than rolling their own action + custom-pattern combo. The
// templates below land curated picks for the four most-asked
// frameworks.
//
// Templates are static Go literals (not loaded from disk) so a
// fresh deployment ships them without a separate config copy step.
// The admin endpoint applies a chosen template by upserting the
// tenant_dlp_policy row.
package templates

import "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"

// Template carries the values the admin endpoint upserts onto a
// tenant_dlp_policy row.
type Template struct {
	Name           string                            // canonical template id
	Description    string                            // human-readable
	Action         middleware.Action                 // mask|redact|tokenize|block
	ImagePolicy    middleware.ImagePolicy            // allow|block|warn
	CustomPatterns []middleware.CustomPatternSpec    // optional; merged with built-in pack
}

// All returns every template keyed by canonical name. Stable
// ordering (HIPAA, PCI, GDPR, SOC2) makes the listing endpoint's
// output deterministic.
func All() []Template {
	return []Template{
		hipaaStrict(),
		pciDss(),
		gdprEU(),
		soc2CodeReviewer(),
	}
}

// ByName returns one template + a found flag. Used by the admin
// endpoint to apply a template to a tenant.
func ByName(name string) (Template, bool) {
	for _, t := range All() {
		if t.Name == name {
			return t, true
		}
	}
	return Template{}, false
}

// hipaaStrict — health-care covered entity. Block everything that
// could leak PHI; refuse images outright (no OCR coverage).
func hipaaStrict() Template {
	return Template{
		Name:        "hipaa-strict",
		Description: "Block PHI; refuse image inputs. Sized for HIPAA covered entities and business associates without OCR-aware DLP coverage.",
		Action:      middleware.ActionBlock,
		ImagePolicy: middleware.ImagePolicyBlock,
		CustomPatterns: []middleware.CustomPatternSpec{
			// NPI: 10-digit national provider identifier.
			{Name: "npi", Regex: `\b\d{10}\b`},
			// DEA number: 2 letters + 7 digits.
			{Name: "dea", Regex: `\b[A-Z]{2}\d{7}\b`},
			// ICD-10 code (loose): letter + 2 digits + optional .nn.
			{Name: "icd10", Regex: `\b[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?\b`},
		},
	}
}

// pciDss — payment-card org. Tokenize so analysis is still useful;
// images flagged for review (warn).
func pciDss() Template {
	return Template{
		Name:        "pci-dss",
		Description: "Tokenize PAN + cardholder data so the LLM never sees raw numbers; warn on image inputs (manual review path).",
		Action:      middleware.ActionTokenize,
		ImagePolicy: middleware.ImagePolicyWarn,
		CustomPatterns: []middleware.CustomPatternSpec{
			// CVV: 3-4 digits adjacent to a card-related label.
			{Name: "cvv", Regex: `(?i)\b(?:cvv|cvc|cvn|cid)\W*\d{3,4}\b`},
			// Cardholder name placeholder pattern (rough).
			{Name: "cardholder_name", Regex: `(?i)\bcardholder\s*name\s*[:=]\s*[A-Za-z' -]{2,40}`},
		},
	}
}

// gdprEU — EU data controller. Tokenize so right-to-erasure is
// trivial (drop the map); allow images (uploaded passport scans
// are common in customer-support workflows).
func gdprEU() Template {
	return Template{
		Name:        "gdpr-eu",
		Description: "Tokenize personal data so erasure is one map drop. Honor data-subject access via /v1/me/redactions. Allow images.",
		Action:      middleware.ActionTokenize,
		ImagePolicy: middleware.ImagePolicyAllow,
		CustomPatterns: []middleware.CustomPatternSpec{
			// EU IBAN (broad — country + 13-32 digits/letters).
			{Name: "iban", Regex: `\b[A-Z]{2}\d{2}[A-Z0-9]{13,30}\b`},
			// Spanish DNI: 8 digits + 1 letter.
			{Name: "dni_es", Regex: `\b\d{8}[A-Z]\b`},
			// French SSN-ish: 13 digits.
			{Name: "nir_fr", Regex: `\b[12]\d{12}\b`},
			// German Steuer-ID: 11 digits.
			{Name: "steuerid_de", Regex: `\b\d{11}\b`},
		},
	}
}

// soc2CodeReviewer — engineering org under SOC 2 Type II audit.
// Redact only (so reviewers still see context); warn on images so
// pasted dashboards are tagged for review.
func soc2CodeReviewer() Template {
	return Template{
		Name:        "soc2-code-reviewer",
		Description: "Redact code-secrets in pasted snippets; warn on screenshots. Sized for engineering orgs running SOC 2 Type II workflows.",
		Action:      middleware.ActionRedact,
		ImagePolicy: middleware.ImagePolicyWarn,
		CustomPatterns: []middleware.CustomPatternSpec{
			// Internal hostname: *.internal, *.corp, *.local — common
			// patterns engineers shouldn't paste.
			{Name: "internal_hostname", Regex: `\b[a-z0-9-]+\.(?:internal|corp|local)\b`},
			// Jira/Linear ticket IDs — not PII per se but useful as
			// a tenant-extensible default for code reviewers.
			{Name: "ticket_id", Regex: `\b(?:JIRA|LINEAR|PROJ)-\d{1,6}\b`},
		},
	}
}
