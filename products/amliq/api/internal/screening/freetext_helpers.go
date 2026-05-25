package screening

import (
	"strings"
	"unicode"
)

func startsUpper(w string) bool {
	for _, r := range w {
		return unicode.IsUpper(r)
	}
	return false
}

func cleanWord(w string) string {
	return strings.TrimRight(w, ".,;:!?\"'()[]{}—–-")
}

func isConnector(w string) bool {
	switch strings.ToLower(w) {
	case "al", "al-", "el", "el-", "bin", "ibn", "ben",
		"von", "van", "de", "del", "di", "du", "la", "le",
		"of", "the", "and":
		return true
	}
	return false
}

var commonWords = map[string]bool{
	"the": true, "and": true, "for": true, "this": true, "wire": true, "transfer": true, "usd": true, "eur": true, "gbp": true, "funds": true, "account": true, "additional": true, "review": true, "required": true, "linked": true, "previous": true, "transactions": true, "beneficiary": true, "operations": true,
	"that": true, "with": true, "from": true, "will": true,
	"have": true, "been": true, "were": true, "they": true,
	"their": true, "which": true, "would": true, "there": true,
	"about": true, "these": true, "other": true, "after": true,
	"january": true, "february": true, "march": true,
	"april": true, "may": true, "june": true, "july": true,
	"august": true, "september": true, "october": true,
	"november": true, "december": true,
	"monday": true, "tuesday": true, "wednesday": true,
	"thursday": true, "friday": true, "saturday": true, "sunday": true,
	"dear": true, "sincerely": true, "regards": true,
	"subject": true, "date": true, "ref": true, "reference": true,
	"please": true, "thank": true, "note": true,
}

func isCommonWord(s string) bool {
	return commonWords[strings.ToLower(s)]
}
