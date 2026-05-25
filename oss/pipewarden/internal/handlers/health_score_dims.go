package handlers

import (
	"fmt"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func actionPinningDim(open []storage.FindingRecord) ScoreDimension {
	var unpinned int
	for _, f := range open {
		if f.Category == "supply-chain" {
			unpinned++
		}
	}
	s := 100 - unpinned*20
	if s < 0 {
		s = 0
	}
	return ScoreDimension{
		Name:    "Action Pinning",
		Score:   s,
		Weight:  25,
		Status:  dimStatus(s),
		Details: formatCount(unpinned, "unpinned action"),
	}
}

func secretHygieneDim(open []storage.FindingRecord) ScoreDimension {
	var count int
	for _, f := range open {
		if f.Category == "secret-exposure" {
			count++
		}
	}
	s := 100 - count*25
	if s < 0 {
		s = 0
	}
	return ScoreDimension{
		Name:    "Secret Hygiene",
		Score:   s,
		Weight:  30,
		Status:  dimStatus(s),
		Details: formatCount(count, "open secret exposure"),
	}
}

func containerSecurityDim(open []storage.FindingRecord) ScoreDimension {
	var count int
	for _, f := range open {
		if f.Category == "container-security" {
			count++
		}
	}
	s := 100 - count*30
	if s < 0 {
		s = 0
	}
	return ScoreDimension{
		Name:    "Container Security",
		Score:   s,
		Weight:  20,
		Status:  dimStatus(s),
		Details: formatCount(count, "container security finding"),
	}
}

func policyComplianceDim(open []storage.FindingRecord) ScoreDimension {
	var count int
	for _, f := range open {
		if f.Category == "policy" {
			count++
		}
	}
	s := 100 - count*20
	if s < 0 {
		s = 0
	}
	return ScoreDimension{
		Name:    "Policy Compliance",
		Score:   s,
		Weight:  15,
		Status:  dimStatus(s),
		Details: formatCount(count, "policy violation"),
	}
}

func scanRecencyDim(lastScan *time.Time) ScoreDimension {
	s := 0
	details := "Never scanned"
	if lastScan != nil {
		age := time.Since(*lastScan)
		switch {
		case age < 24*time.Hour:
			s = 100
			details = "Scanned within 24h"
		case age < 7*24*time.Hour:
			s = 70
			details = "Scanned within 7 days"
		case age < 30*24*time.Hour:
			s = 30
			details = "Scanned within 30 days"
		default:
			s = 0
			details = "Last scan > 30 days ago"
		}
	}
	return ScoreDimension{
		Name:    "Scan Recency",
		Score:   s,
		Weight:  10,
		Status:  dimStatus(s),
		Details: details,
	}
}

func dimStatus(score int) string {
	switch {
	case score >= 75:
		return "pass"
	case score >= 40:
		return "warn"
	default:
		return "fail"
	}
}

func formatCount(n int, noun string) string {
	if n == 0 {
		return fmt.Sprintf("No %ss found", noun)
	}
	if n == 1 {
		return fmt.Sprintf("1 %s", noun)
	}
	return fmt.Sprintf("%d %ss", n, noun)
}
