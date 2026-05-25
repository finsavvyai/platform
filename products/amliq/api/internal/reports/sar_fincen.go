package reports

import (
	"encoding/xml"
	"fmt"
	"time"
)

// FinCENSAR represents a BSA E-Filing SAR XML document.
type FinCENSAR struct {
	XMLName        xml.Name       `xml:"EFilingBatchXML"`
	FilingInst     FilingInst     `xml:"FilingInstitution"`
	Subject        SARSubject     `xml:"Subject"`
	Activity       SARActivity    `xml:"SuspiciousActivity"`
	Narrative      string         `xml:"Narrative"`
	FilingDate     string         `xml:"FilingDate"`
	ReferenceNum   string         `xml:"ReferenceNumber"`
}

type FilingInst struct {
	Name    string `xml:"InstitutionName"`
	RSSD    string `xml:"RSSD_ID"`
	Address string `xml:"Address"`
}

type SARSubject struct {
	Name        string `xml:"SubjectName"`
	DOB         string `xml:"DateOfBirth,omitempty"`
	IDType      string `xml:"IDType,omitempty"`
	IDNumber    string `xml:"IDNumber,omitempty"`
	Country     string `xml:"Country,omitempty"`
}

type SARActivity struct {
	Type        string `xml:"ActivityType"`
	DateBegin   string `xml:"DateBegin"`
	DateEnd     string `xml:"DateEnd,omitempty"`
	Amount      string `xml:"Amount,omitempty"`
}

// SARInput holds the data needed to generate a SAR.
type SARInput struct {
	InstitutionName string
	SubjectName     string
	SubjectDOB      string
	SubjectCountry  string
	ActivityType    string
	Narrative       string
	Amount          string
}

// GenerateFinCENSAR creates a FinCEN BSA E-Filing XML SAR.
func GenerateFinCENSAR(input SARInput) ([]byte, error) {
	sar := FinCENSAR{
		FilingInst: FilingInst{Name: input.InstitutionName},
		Subject: SARSubject{
			Name:    input.SubjectName,
			DOB:     input.SubjectDOB,
			Country: input.SubjectCountry,
		},
		Activity: SARActivity{
			Type:      input.ActivityType,
			DateBegin: time.Now().Format("2006-01-02"),
			Amount:    input.Amount,
		},
		Narrative:    input.Narrative,
		FilingDate:   time.Now().Format("2006-01-02"),
		ReferenceNum: fmt.Sprintf("SAR-%d", time.Now().UnixNano()),
	}
	return xml.MarshalIndent(sar, "", "  ")
}
