package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// applyPeriod filters FindingRecords to those created within [from, to].
// Either bound may be nil for an open-ended window. Out-of-window records
// are silently dropped — the report's Coverage block still reflects them
// in TotalFindings via the unfiltered input.
func applyPeriod(in []storage.FindingRecord, from, to *time.Time) []storage.FindingRecord {
	if from == nil && to == nil {
		return in
	}
	out := make([]storage.FindingRecord, 0, len(in))
	for _, f := range in {
		if from != nil && f.CreatedAt.Before(*from) {
			continue
		}
		if to != nil && f.CreatedAt.After(*to) {
			continue
		}
		out = append(out, f)
	}
	return out
}

// computeCoverage attests to evidence breadth. Auditors need to see this
// to distinguish "clean" from "didn't scan anything".
func computeCoverage(findings []storage.FindingRecord) ComplianceCoverage {
	conns := map[string]bool{}
	runs := map[string]bool{}
	for _, f := range findings {
		if f.ConnectionName != "" {
			conns[f.ConnectionName] = true
		}
		if f.RunID != "" {
			runs[f.ConnectionName+"/"+f.RunID] = true
		}
	}
	return ComplianceCoverage{
		ConnectionsScanned: len(conns),
		RunsScanned:        len(runs),
		TotalFindings:      len(findings),
	}
}

// hashEvidence returns a SHA256 over the canonical
// (framework, period, sorted finding IDs). Auditors re-derive this to
// verify the report wasn't doctored after generation. Stable across
// re-runs for the same input — sort guarantees order independence.
func hashEvidence(framework string, from, to *time.Time, findings []storage.FindingRecord) string {
	ids := make([]int64, len(findings))
	for i, f := range findings {
		ids[i] = f.ID
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	var b strings.Builder
	b.WriteString(strings.ToLower(framework))
	b.WriteByte('|')
	if from != nil {
		b.WriteString(from.UTC().Format(time.RFC3339))
	}
	b.WriteByte('|')
	if to != nil {
		b.WriteString(to.UTC().Format(time.RFC3339))
	}
	b.WriteByte('|')
	for _, id := range ids {
		fmt.Fprintf(&b, "%d,", id)
	}
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:])
}

// renderMarkdown formats a ComplianceReport as a human-readable markdown
// document — what an auditor pastes into their workpaper.
func renderMarkdown(r ComplianceReport) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s Compliance Report\n\n", strings.ToUpper(r.Framework))
	fmt.Fprintf(&b, "**Generated:** %s\n\n", r.GeneratedAt.UTC().Format(time.RFC3339))
	if r.PeriodFrom != nil || r.PeriodTo != nil {
		fmt.Fprintf(&b, "**Period:** %s → %s\n\n", fmtTimePtr(r.PeriodFrom), fmtTimePtr(r.PeriodTo))
	}
	fmt.Fprintf(&b, "**Evidence Hash:** `%s`\n\n", r.EvidenceHash)

	fmt.Fprintf(&b, "## Coverage\n\n- Connections scanned: %d\n- Runs scanned: %d\n- Total findings: %d\n\n",
		r.Coverage.ConnectionsScanned, r.Coverage.RunsScanned, r.Coverage.TotalFindings)

	fmt.Fprintf(&b, "## Summary\n\n- Total controls: %d\n- Passing: %d\n- Failing: %d\n- Score: %d/100\n\n",
		r.Summary.TotalControls, r.Summary.Passing, r.Summary.Failing, r.Summary.Score)

	b.WriteString("## Controls\n\n| ID | Title | Status | Findings |\n|---|---|---|---|\n")
	for _, c := range r.Controls {
		fmt.Fprintf(&b, "| %s | %s | %s | %s |\n", c.ID, c.Title, c.Status, strings.Join(c.Findings, ", "))
	}
	return b.String()
}

// renderCSV is the auditor-friendly spreadsheet format.
func renderCSV(r ComplianceReport) string {
	var b strings.Builder
	b.WriteString("control_id,title,status,finding_ids\n")
	for _, c := range r.Controls {
		fmt.Fprintf(&b, "%q,%q,%q,%q\n", c.ID, c.Title, c.Status, strings.Join(c.Findings, ";"))
	}
	return b.String()
}

func fmtTimePtr(t *time.Time) string {
	if t == nil {
		return "—"
	}
	return t.UTC().Format(time.RFC3339)
}

// parsePeriodParam returns *time.Time from "?from=" or "?to=" query param.
// RFC 3339 only — keeps audit consistency. Nil on absent or malformed
// input (caller decides whether that's an error).
func parsePeriodParam(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil
	}
	return &t
}
