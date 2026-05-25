package reports

import (
	"encoding/xml"
	"fmt"
	"time"
)

// GoAMLReport represents a UNODC goAML XML report.
type GoAMLReport struct {
	XMLName     xml.Name        `xml:"goAMLReport"`
	Xmlns       string          `xml:"xmlns,attr"`
	Version     string          `xml:"version,attr"`
	ReportID    string          `xml:"report_id"`
	ReportDate  string          `xml:"report_date"`
	Institution GoAMLInst       `xml:"reporting_institution"`
	Transaction GoAMLTxn        `xml:"transaction"`
	Persons     []GoAMLPerson   `xml:"person"`
	Narrative   string          `xml:"narrative"`
}

type GoAMLInst struct {
	Name    string `xml:"name"`
	Country string `xml:"country"`
}

type GoAMLTxn struct {
	Date   string `xml:"date"`
	Amount string `xml:"amount"`
	Type   string `xml:"type"`
}

type GoAMLPerson struct {
	Role    string `xml:"role,attr"`
	Name    string `xml:"name"`
	DOB     string `xml:"dob,omitempty"`
	Country string `xml:"country,omitempty"`
}

// GenerateGoAML creates a goAML 4.0 compliant XML report.
func GenerateGoAML(input SARInput) ([]byte, error) {
	report := GoAMLReport{
		Xmlns:      "http://www.unodc.org/goAML/4.0",
		Version:    "4.0",
		ReportID:   fmt.Sprintf("GOAML-%d", time.Now().UnixNano()),
		ReportDate: time.Now().Format("2006-01-02"),
		Institution: GoAMLInst{Name: input.InstitutionName},
		Transaction: GoAMLTxn{
			Date:   time.Now().Format("2006-01-02"),
			Amount: input.Amount,
			Type:   input.ActivityType,
		},
		Persons: []GoAMLPerson{{
			Role:    "suspect",
			Name:    input.SubjectName,
			DOB:     input.SubjectDOB,
			Country: input.SubjectCountry,
		}},
		Narrative: input.Narrative,
	}
	return xml.MarshalIndent(report, "", "  ")
}
