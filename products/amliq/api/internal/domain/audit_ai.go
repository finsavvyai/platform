package domain

// AI-related audit actions. Iota base 200 to avoid colliding with the
// core block (0-) or the compliance block (100-).
const (
	AuditActionAISummarized AuditAction = iota + 200
)

func aiAuditString(aa AuditAction) string {
	if aa == AuditActionAISummarized {
		return "AISummarized"
	}
	return ""
}
