package domain

import (
	"fmt"
	"time"
)

// EvidenceType classifies attached evidence.
type EvidenceType string

const (
	EvidenceCustomerDoc    EvidenceType = "customer_doc"
	EvidenceScreenResult   EvidenceType = "screening_result"
	EvidenceAdverseMedia   EvidenceType = "adverse_media"
	EvidenceAnalystNote    EvidenceType = "analyst_note"
	EvidenceRegulatorReq   EvidenceType = "regulator_request"
)

// ValidEvidenceTypes lists accepted types.
var ValidEvidenceTypes = []EvidenceType{
	EvidenceCustomerDoc, EvidenceScreenResult,
	EvidenceAdverseMedia, EvidenceAnalystNote,
	EvidenceRegulatorReq,
}

// Evidence is a document or note attached to a compliance case.
type Evidence struct {
	ID         string       `json:"id"`
	CaseID     string       `json:"case_id"`
	Type       EvidenceType `json:"type"`
	Content    string       `json:"content"`
	UploadedBy string       `json:"uploaded_by"`
	CreatedAt  time.Time    `json:"created_at"`
}

// NewEvidence creates validated evidence for a case.
func NewEvidence(
	caseID string,
	evidenceType EvidenceType,
	content string,
	uploadedBy string,
) (Evidence, error) {
	if caseID == "" || content == "" {
		return Evidence{}, fmt.Errorf("case_id and content required")
	}
	if !isValidEvidenceType(evidenceType) {
		return Evidence{}, fmt.Errorf("invalid evidence type: %s", evidenceType)
	}
	return Evidence{
		ID:         fmt.Sprintf("ev_%d", time.Now().UnixNano()),
		CaseID:     caseID,
		Type:       evidenceType,
		Content:    content,
		UploadedBy: uploadedBy,
		CreatedAt:  time.Now().UTC(),
	}, nil
}

func isValidEvidenceType(t EvidenceType) bool {
	for _, v := range ValidEvidenceTypes {
		if v == t {
			return true
		}
	}
	return false
}
