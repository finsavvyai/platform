package dlp

// Counts tallies how many of each PII kind were redacted in a single
// MaskAML pass. Caller-facing surface for DLP-as-a-service:
// dashboards visualise which kind dominates a tenant's traffic, and
// the audit log persists the per-row breakdown for forensics.
//
// Adding a new field is a backward-compatible change for JSON
// consumers (older clients ignore unknown fields). The Total()
// helper must be updated when fields are added.
type Counts struct {
	// Fintech
	PAN  int `json:"pan"`
	IBAN int `json:"iban"`
	BIC  int `json:"bic"`
	// Universal
	Email int `json:"email"`
	Phone int `json:"phone"`
	// Government IDs
	ILID     int `json:"il_id"`
	SSN      int `json:"ssn"`
	UKNI     int `json:"uk_ni"`
	BSN      int `json:"nl_bsn"`
	SteuerID int `json:"de_steuer_id"`
	SIN      int `json:"ca_sin"`
	TFN      int `json:"au_tfn"`
	NPI      int `json:"us_npi"`
	// Network
	IP int `json:"ip"`
	// Secrets / credentials
	Credentials int `json:"credentials"`
}

// Total is a convenience for "did anything get redacted?" without
// reflecting over the struct.
func (c Counts) Total() int {
	return c.PAN + c.IBAN + c.BIC + c.ILID + c.Email + c.Phone +
		c.SSN + c.UKNI + c.BSN + c.SteuerID + c.SIN + c.TFN + c.NPI +
		c.IP + c.Credentials
}

// MaskAMLWithCounts is the audit-friendly variant of MaskAML. Same
// scrubbing pipeline; additionally reports how many tokens of each
// kind matched + passed the validator gate (Luhn for PAN, mod-97 for
// IBAN, mod-10 for IL ID).
//
// Validator-aware: a string that looks like a PAN but fails Luhn
// stays unmasked AND doesn't increment the counter. Counts therefore
// reflect actual redactions, not raw regex hits, which keeps the
// dashboard signal honest (no "we scrubbed 50 things" when 47 were
// false positives the validator filtered out).
func MaskAMLWithCounts(s string) (string, Counts) {
	var c Counts
	c.PAN = countValid(piiPANRE.FindAllString(s, -1), luhnValid)
	c.IBAN = countValid(piiIBANRE.FindAllString(s, -1), ibanValid)
	c.BIC = countValid(piiBICRE.FindAllString(s, -1), bicLooksValid)
	c.ILID = countValid(piiILIDRE.FindAllString(s, -1), ilIDValid)
	c.Email = len(piiEmailRE.FindAllString(s, -1))
	c.Phone = countPhones(piiPhoneRE.FindAllString(s, -1))
	c.SSN = countValid(piiSSNRE.FindAllString(s, -1), ssnValid)
	c.UKNI = countUKNI(s)
	c.BSN = countBSN(s)
	c.SteuerID = countSteuerID(s)
	c.SIN = countSIN(s)
	c.TFN = countTFN(s)
	c.NPI = countNPI(s)
	c.IP = countIPs(s)
	c.Credentials = countCredentials(s)
	return MaskAML(s), c
}

// countValid pairs a regex's match list with its validator so we
// only credit redactions that the masker actually applied.
func countValid(matches []string, valid func(string) bool) int {
	n := 0
	for _, m := range matches {
		if valid(m) {
			n++
		}
	}
	return n
}

// bicLooksValid mirrors the BIC mask's "len(m) >= 8" rule. We can't
// import internals; reproducing the predicate here keeps the count
// honest without leaking BIC validation rules into a public API.
func bicLooksValid(m string) bool { return len(m) >= 8 }

// countPhones counts only those phone-shaped strings the masker
// actually redacts (>=4 digits — its own internal rule). Reuses
// stripNonDigits already exposed within this package.
func countPhones(matches []string) int {
	n := 0
	for _, m := range matches {
		if len(stripNonDigits(m)) >= 4 {
			n++
		}
	}
	return n
}
