package domain

// CaseStatus enum includes pending-info and closed states.
// Existing statuses are in case_mgmt.go; these extend them.
const (
	CasePendingInfo CaseStatus = "pending_info"
	CaseClosed      CaseStatus = "closed"
)

// CaseTransition defines a valid workflow state change.
type CaseTransition struct {
	From            CaseStatus
	To              CaseStatus
	RequiresComment  bool
	RequiresApproval bool
}

// validTransitions defines the allowed case workflow transitions.
var validTransitions = []CaseTransition{
	{CaseOpen, CaseInReview, false, false},
	{CaseInReview, CaseEscalated, true, false},
	{CaseInReview, CasePendingInfo, true, false},
	{CaseInReview, CaseResolved, true, false},
	{CaseEscalated, CaseResolved, true, true},
	{CasePendingInfo, CaseInReview, false, false},
	{CaseResolved, CaseFalsePos, true, false},
	{CaseResolved, CaseTrueMatch, true, false},
	{CaseFalsePos, CaseClosed, false, false},
	{CaseTrueMatch, CaseClosed, false, true},
}

// CanTransition checks if moving from one status to another is allowed.
func CanTransition(from, to CaseStatus) bool {
	for _, t := range validTransitions {
		if t.From == from && t.To == to {
			return true
		}
	}
	return false
}

// GetTransition returns the transition rule if valid.
func GetTransition(from, to CaseStatus) (CaseTransition, bool) {
	for _, t := range validTransitions {
		if t.From == from && t.To == to {
			return t, true
		}
	}
	return CaseTransition{}, false
}

// ValidNextStatuses returns all statuses reachable from current.
func ValidNextStatuses(from CaseStatus) []CaseStatus {
	var next []CaseStatus
	for _, t := range validTransitions {
		if t.From == from {
			next = append(next, t.To)
		}
	}
	return next
}

// AllCaseStatuses returns every possible case status.
func AllCaseStatuses() []CaseStatus {
	return []CaseStatus{
		CaseOpen, CaseInReview, CaseEscalated,
		CasePendingInfo, CaseResolved,
		CaseFalsePos, CaseTrueMatch, CaseClosed,
	}
}

// Transition applies a validated status change to the case.
func (c *ComplianceCase) Transition(to CaseStatus, comment string) error {
	tr, ok := GetTransition(c.Status, to)
	if !ok {
		return errInvalidTransition(c.Status, to)
	}
	if tr.RequiresComment && comment == "" {
		return errCommentRequired(c.Status, to)
	}
	c.Status = to
	c.touchUpdated()
	return nil
}
