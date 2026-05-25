package reporting

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// AIClient abstracts the narrative generation backend.
type AIClient interface {
	Generate(ctx context.Context, prompt string) (string, error)
}

// SARGenerator compiles SARs from case data and alerts.
type SARGenerator struct {
	ai AIClient
}

// NewSARGenerator creates a generator with an AI client.
func NewSARGenerator(ai AIClient) *SARGenerator {
	return &SARGenerator{ai: ai}
}

// CaseEvidence holds data used to generate a SAR.
type CaseEvidence struct {
	CaseID      string
	SubjectName string
	SubjectType string
	Alerts      []domain.TxnAlert
	Txns        []domain.Transaction
	TotalAmount int64
	DateFrom    time.Time
	DateTo      time.Time
}

// GenerateNarrative uses AI to create a SAR narrative.
func (g *SARGenerator) GenerateNarrative(
	ctx context.Context, ev CaseEvidence,
) (string, error) {
	prompt := buildSARPrompt(ev)
	narrative, err := g.ai.Generate(ctx, prompt)
	if err != nil {
		return "", fmt.Errorf("narrative generation failed: %w", err)
	}
	return narrative, nil
}

// GenerateSAR compiles a full SAR from case evidence.
func (g *SARGenerator) GenerateSAR(
	ctx context.Context, tenantID domain.TenantID,
	ev CaseEvidence, regBody domain.RegulatoryBody,
) (*domain.SAR, error) {
	actType := inferActivityType(ev.Alerts)
	sar, err := domain.NewSAR(tenantID, ev.CaseID, ev.SubjectName, actType)
	if err != nil {
		return nil, err
	}
	narrative, err := g.GenerateNarrative(ctx, ev)
	if err != nil {
		return nil, err
	}
	sar.NarrativeSummary = narrative
	sar.TotalAmount = ev.TotalAmount
	sar.DateRangeFrom = ev.DateFrom
	sar.DateRangeTo = ev.DateTo
	sar.SubjectType = ev.SubjectType
	sar.RegulatoryBody = regBody
	return &sar, nil
}

func buildSARPrompt(ev CaseEvidence) string {
	var sb strings.Builder
	sb.WriteString("You are an AML compliance expert. Generate a SAR narrative ")
	sb.WriteString("for the following case.\n\n")
	sb.WriteString(fmt.Sprintf("Subject: %s (%s)\n", ev.SubjectName, ev.SubjectType))
	sb.WriteString(fmt.Sprintf("Case ID: %s\n", ev.CaseID))
	sb.WriteString(fmt.Sprintf("Period: %s to %s\n",
		ev.DateFrom.Format("2006-01-02"), ev.DateTo.Format("2006-01-02")))
	sb.WriteString(fmt.Sprintf("Total Amount: $%.2f\n", float64(ev.TotalAmount)/100))
	sb.WriteString(fmt.Sprintf("Alert Count: %d\n", len(ev.Alerts)))
	sb.WriteString(fmt.Sprintf("Transaction Count: %d\n", len(ev.Txns)))
	sb.WriteString("\nProvide a clear, factual narrative suitable for regulatory filing.")
	return sb.String()
}

func inferActivityType(alerts []domain.TxnAlert) domain.SARActivityType {
	for _, a := range alerts {
		if a.AlertType == domain.TxnStructuring {
			return domain.ActivityStructuring
		}
	}
	return domain.ActivityMoneyLaundering
}
