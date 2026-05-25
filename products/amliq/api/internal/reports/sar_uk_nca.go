package reports

import (
	"encoding/xml"
	"fmt"
	"time"
)

// UKNCASAR represents a UK NCA Defence Against Money Laundering report.
type UKNCASAR struct {
	XMLName     xml.Name   `xml:"SuspiciousActivityReport"`
	ReportRef   string     `xml:"ReportReference"`
	ReportDate  string     `xml:"ReportDate"`
	Reporter    UKReporter `xml:"Reporter"`
	Subject     UKSubject  `xml:"Subject"`
	Reason      string     `xml:"ReasonForSuspicion"`
	Consent     bool       `xml:"ConsentRequested"`
}

// UKReporter is the filing institution.
type UKReporter struct {
	Name       string `xml:"InstitutionName"`
	FCARef     string `xml:"FCAReference,omitempty"`
	ContactName string `xml:"ContactName"`
	ContactEmail string `xml:"ContactEmail"`
}

// UKSubject is the person/entity under suspicion.
type UKSubject struct {
	Name    string `xml:"FullName"`
	DOB     string `xml:"DateOfBirth,omitempty"`
	Address string `xml:"Address,omitempty"`
	Country string `xml:"Nationality,omitempty"`
}

// GenerateUKNCA creates a UK NCA DAML SAR XML report.
func GenerateUKNCA(input SARInput) ([]byte, error) {
	sar := UKNCASAR{
		ReportRef:  fmt.Sprintf("NCA-%d", time.Now().UnixNano()),
		ReportDate: time.Now().Format("2006-01-02"),
		Reporter: UKReporter{
			Name: input.InstitutionName,
		},
		Subject: UKSubject{
			Name:    input.SubjectName,
			DOB:     input.SubjectDOB,
			Country: input.SubjectCountry,
		},
		Reason:  input.Narrative,
		Consent: true,
	}
	return xml.MarshalIndent(sar, "", "  ")
}
