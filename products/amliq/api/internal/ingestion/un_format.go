package ingestion

import (
	"fmt"
	"strings"
)

// formatDOBs formats UN date-of-birth entries.
func formatDOBs(dobs []unDOB) string {
	var parts []string
	for _, d := range dobs {
		v := firstNonEmptyStr(
			strings.TrimSpace(d.Date),
			unDOBToISO(d.Year, d.Month, d.Day),
		)
		if v != "" {
			parts = append(parts, v)
		}
	}
	return strings.Join(parts, "; ")
}

// unDOBToISO builds an ISO date (YYYY-MM-DD or YYYY-MM or YYYY)
// from UN DOB year/month/day parts. Returns "" if year missing.
func unDOBToISO(year, month, day string) string {
	y := strings.TrimSpace(year)
	if y == "" {
		return ""
	}
	m := strings.TrimSpace(month)
	d := strings.TrimSpace(day)
	if m == "" {
		return y
	}
	mNum := atoiSafe(m)
	if mNum < 1 || mNum > 12 {
		return y
	}
	if d == "" {
		return fmt.Sprintf("%s-%02d", y, mNum)
	}
	dNum := atoiSafe(d)
	if dNum < 1 || dNum > 31 {
		return fmt.Sprintf("%s-%02d", y, mNum)
	}
	return fmt.Sprintf("%s-%02d-%02d", y, mNum, dNum)
}

func atoiSafe(s string) int {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int(r-'0')
	}
	return n
}

// formatPOBs formats UN place-of-birth entries.
func formatPOBs(pobs []unPOB) string {
	var parts []string
	for _, p := range pobs {
		v := joinNonEmpty(p.City, p.StateProvince, p.Country)
		if v != "" {
			parts = append(parts, v)
		}
	}
	return strings.Join(parts, "; ")
}

// formatDocuments formats UN document entries.
func formatDocuments(docs []unDocument) string {
	var parts []string
	for _, d := range docs {
		v := joinNonEmpty(d.TypeOfDoc, d.Number, d.IssuingCountry)
		if v != "" {
			parts = append(parts, v)
		}
	}
	return strings.Join(parts, "; ")
}
