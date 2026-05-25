// Package reports — Israeli AML reporting helpers.
//
// IMPA SAR XML — IMPORTANT NO-BLUF NOTE (2026-04-29):
// The Israel Money Laundering and Terror Financing Prohibition
// Authority (IMPA) does NOT publish an open XSD at a stable
// public URL. The real Form 211 (banks) / Form 411 (FSPs)
// submission is performed through a Hebrew web portal that
// IMPA migrated under gov.il; the legacy impa.justice.gov.il
// host returns "site not found" as of 2026-04-29.
//
// What this serializer produces is therefore a *best-effort*
// internal representation: stable JSON-equivalent XML that a
// compliance officer can inspect, archive (7-year retention is
// mandatory under §7 of the Order on Money Laundering Prohibition
// (Reporting and Records Keeping Obligations of Financial Service
// Providers), 5773-2013, not §29 of the parent law as I wrote
// before — §29 is about disclosure to authorities), and use as a
// paste-source when filling the IMPA web form. It is
// NOT a drop-in upload — IMPA does not currently accept XML
// attachments for Form 211/411 in the consumer-facing portal.
//
// The XML namespace "http://amliq.ai/schema/sar/v1" is therefore
// owned by us, not IMPA, to avoid implying a non-existent IMPA
// schema endorsement. When IMPA publishes a real XSD we will
// re-namespace this output and re-test against the live schema.
package reports

import (
	"encoding/xml"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// impaSARNamespace is AMLIQ-owned. We do NOT claim alignment to a
// published IMPA XSD because IMPA has not made one public; using a
// fabricated impa.justice.gov.il namespace would be a regulator-
// visible bluff. See package doc.
const impaSARNamespace = "http://amliq.ai/schema/sar/v1"

// ImpaSAR is the root element AMLIQ emits.
type ImpaSAR struct {
	XMLName xml.Name        `xml:"SAR"`
	XMLNS   string          `xml:"xmlns,attr"`
	Header  impaSARHeader   `xml:"ReportHeader"`
	Subject impaSARSubject  `xml:"Subject"`
	Activ   impaSARActivity `xml:"Activity"`
	Report  impaSARReporter `xml:"Reporter"`
}

type impaSARHeader struct {
	ReportID    string `xml:"ReportID"`
	ReportType  string `xml:"ReportType"` // 411 for FSPs
	GeneratedAt string `xml:"GeneratedAt"`
}

type impaSARSubject struct {
	Name        string `xml:"FullName"`
	NameHe      string `xml:"FullNameHebrew,omitempty"`
	Country     string `xml:"Country,omitempty"`
	IDNumber    string `xml:"IDNumber,omitempty"`
	Risk        string `xml:"RiskLevel"` // critical|high|medium|low
}

type impaSARActivity struct {
	OccurredAt   string  `xml:"OccurredAt"`
	Confidence   float64 `xml:"MatchConfidence"`
	MatchedLists string  `xml:"MatchedLists,omitempty"`
	Notes        string  `xml:"Notes,omitempty"`
}

type impaSARReporter struct {
	TenantID string `xml:"ReporterTenantID"`
	System   string `xml:"ReportingSystem"`
}

// BuildImpaSAR converts a stored screening into the IMPA SAR XML
// structure. The caller must hold a write-blocking lock on the
// underlying screening — IMPA mandates that submitted reports be
// immutable for 7 years.
func BuildImpaSAR(resp *domain.ScreenResponse) (*ImpaSAR, error) {
	if resp == nil {
		return nil, fmt.Errorf("nil screening")
	}
	prim := resp.Request.Entity.PrimaryName()
	risk := classifyImpaRisk(resp.MaxConfidence())

	matchedLists := ""
	for i, m := range resp.Matches {
		if i > 0 {
			matchedLists += ","
		}
		matchedLists += m.ListID
	}

	return &ImpaSAR{
		XMLNS: impaSARNamespace,
		Header: impaSARHeader{
			ReportID:    resp.ID,
			ReportType:  "411",
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		},
		Subject: impaSARSubject{
			Name:    prim.Full,
			NameHe:  pickHebrewName(resp.Request.Entity.Names),
			Country: metaString(resp.Request.Entity.Metadata, "country"),
			Risk:    risk,
		},
		Activ: impaSARActivity{
			OccurredAt:   resp.Timestamp.Format(time.RFC3339),
			Confidence:   resp.MaxConfidence(),
			MatchedLists: matchedLists,
		},
		Report: impaSARReporter{
			TenantID: resp.Request.TenantID.String(),
			System:   "AMLIQ-Aegis",
		},
	}, nil
}

func classifyImpaRisk(score float64) string {
	switch {
	case score >= 0.9:
		return "critical"
	case score >= 0.75:
		return "high"
	case score >= 0.5:
		return "medium"
	default:
		return "low"
	}
}

func pickHebrewName(names []domain.Name) string {
	for _, n := range names {
		if n.OriginalScript == "he" || n.OriginalScript == "Hebrew" {
			return n.Full
		}
	}
	return ""
}

func metaString(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// MarshalImpaSAR returns the indented XML byte stream the IMPA
// portal expects (UTF-8, BOM-less, two-space indent).
func MarshalImpaSAR(sar *ImpaSAR) ([]byte, error) {
	out, err := xml.MarshalIndent(sar, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal IMPA SAR: %w", err)
	}
	header := []byte(xml.Header)
	return append(header, out...), nil
}
