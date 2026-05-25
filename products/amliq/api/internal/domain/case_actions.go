package domain

import (
	"fmt"
	"time"
)

// Assign assigns the case to a user.
func (c *ComplianceCase) Assign(userID string) {
	c.AssignedTo = userID
	c.Status = CaseInReview
	c.UpdatedAt = time.Now().UTC()
}

// Escalate moves case to escalated status.
func (c *ComplianceCase) Escalate() {
	c.Status = CaseEscalated
	c.Priority = PriorityCritical
	c.UpdatedAt = time.Now().UTC()
}

// Resolve closes the case with a disposition.
func (c *ComplianceCase) Resolve(userID, resolution string, trueMatch bool) error {
	if resolution == "" {
		return fmt.Errorf("resolution reason required")
	}
	now := time.Now().UTC()
	c.ResolvedAt = &now
	c.ResolvedBy = userID
	c.Resolution = resolution
	c.UpdatedAt = now
	if trueMatch {
		c.Status = CaseTrueMatch
	} else {
		c.Status = CaseFalsePos
	}
	return nil
}

// CaseComment is a note attached to a case.
type CaseComment struct {
	ID        string
	CaseID    string
	AuthorID  string
	Content   string
	CreatedAt time.Time
}

func NewCaseComment(caseID, authorID, content string) (CaseComment, error) {
	if caseID == "" || content == "" {
		return CaseComment{}, fmt.Errorf("case_id and content required")
	}
	return CaseComment{
		ID:        fmt.Sprintf("cmt_%d", time.Now().UnixNano()),
		CaseID:    caseID,
		AuthorID:  authorID,
		Content:   content,
		CreatedAt: time.Now().UTC(),
	}, nil
}
