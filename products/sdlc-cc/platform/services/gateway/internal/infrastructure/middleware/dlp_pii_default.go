// SPDX-License-Identifier: AGPL-3.0-or-later
//
// pii_default extended patterns — phones, US street addresses, and
// honorific-prefixed names. These run as part of the always-on
// default pack (init-time append to the global `patterns` slice in
// dlp.go), not as an opt-in vertical preset, because phone numbers
// and addresses are baseline PII that every regulated buyer expects
// out of the box.
//
// IMPORTANT — heuristic only. This file does NOT replace a real NER
// engine (Microsoft Presidio, spaCy + transformers). The name
// detector here catches honorific-prefixed forms ("Dr. Jane Doe",
// "Mr. John Smith") which are the most common privilege-relevant
// case in legal/medical text. For general-purpose person-name
// detection, wire a NER backend via the Detector interface — the
// hook is `DetectWith(input, extraPatterns)` and a `presidio`
// adapter is the planned production path.
//
// Each pattern below ships with a docstring noting the spec source
// and the false-positive class the pattern intentionally accepts.

package middleware

func init() {
	patterns = append(patterns, piiDefaultExtended...)
}

// piiDefaultExtended is the always-on extension to the pii_default
// preset. Appended to the global `patterns` slice at package init
// so DetectWith / ApplyWith pick them up without any tenant config.
var piiDefaultExtended = []pattern{
	// E.164 international phone. Format: leading '+', country code
	// (1-3 digits, first non-zero), then 6-14 more digits. Conservative
	// — requires the '+' so we don't false-positive on long numeric
	// runs like timestamps or hashes.
	// Source: ITU-T E.164 recommendation.
	{"phone_e164", mustCompile(`\+[1-9]\d{6,14}\b`)},

	// US / NANP phone. Optional country prefix "+1" or "1", optional
	// parenthesised area code, then 3-3-4 with separator. Area code
	// must start [2-9] per NANP rules — this is what keeps the
	// pattern off ISO dates like 2024-12-31 (first group "2024" is
	// four digits and won't match).
	// Source: NANPA assignment rules — area code never starts 0 or 1.
	{"phone_us", mustCompile(`\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]\d{3}[-.\s]\d{4}\b`)},

	// US street address. Anchored on a known street-type suffix so we
	// don't fire on every "123 things" run. Accepts house number
	// (1-5 digits), one to four capitalised words, optional dir
	// prefix (N/S/E/W), then a suffix. Suffix list covers the common
	// USPS abbreviations and full forms.
	// Source: USPS Publication 28 — Postal Addressing Standards.
	{"us_street_address", mustCompile(
		`\b\d{1,5}\s+(?:(?:N|S|E|W|NE|NW|SE|SW)\.?\s+)?` +
			`(?:[A-Z][A-Za-z]+\s+){1,4}` +
			`(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|` +
			`Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Hwy|Highway|` +
			`Cir|Circle|Ter|Terrace|Sq|Square)\.?\b`,
	)},

	// US ZIP code with explicit "ZIP"/"Zip" label OR preceded by a
	// 2-letter state abbreviation + comma/space. The bare 5-digit
	// form is intentionally NOT included — it false-positives on
	// every order ID and reference number. ZIP+4 supported.
	// Source: USPS ZIP Code lookup rules.
	{"us_zip", mustCompile(
		`(?:\b(?:ZIP|Zip|zip)[:#]?\s*\d{5}(?:-\d{4})?\b)|` +
			`(?:\b[A-Z]{2}[,\s]+\d{5}(?:-\d{4})?\b)`,
	)},

	// Person name — honorific-prefixed form only. Catches "Dr. Jane
	// Doe", "Ms. Alice Wong", "Sen. John Smith". One to three given
	// names plus optional hyphenated/apostrophised parts (O'Neill,
	// Smith-Jones). Bare capitalised bigrams ("Steve Jobs",
	// "New York") are NOT matched because the false-positive blast
	// on technical text is catastrophic without a NER backend.
	//
	// Honorific list covers titles common in legal / medical /
	// political correspondence — the buyer segments most likely to
	// be parsing privileged text through this gateway.
	{"person_name", mustCompile(
		`\b(?:Mr|Mrs|Ms|Mx|Dr|Prof|Sir|Madam|Lord|Lady|` +
			`Sen|Rep|Gov|Pres|Hon|Rev|Fr|Sr|Br|` +
			`Sgt|Capt|Lt|Col|Gen|Maj|Adm|Cmdr)\.?\s+` +
			`(?:[A-Z][a-z]+(?:[-'][A-Z][a-z]+)?)` +
			`(?:\s+[A-Z][a-z]+(?:[-'][A-Z][a-z]+)?){0,2}\b`,
	)},
}
