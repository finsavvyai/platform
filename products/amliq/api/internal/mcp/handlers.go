package mcp

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

func registerScreenHandlers(s *Server) {
	s.tools["screen_entity"] = s.handleScreen
	s.tools["check_pep"] = s.handleCheckPEP
	s.tools["analyze_transaction"] = s.handleAnalyzeTxn
	s.tools["get_entity_details"] = s.handleGetEntity
	s.tools["explain_match"] = s.handleExplainMatch
	s.tools["monitor_entity"] = s.handleMonitorEntity
}

func (s *Server) handleScreen(params json.RawMessage) (interface{}, error) {
	var p struct {
		Name      string   `json:"name"`
		Lists     []string `json:"lists"`
		Threshold float64  `json:"threshold"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	start := time.Now()
	results, err := s.engine.ScreenByName(p.Name, screening.SearchOpts{
		Lists: p.Lists, Limit: 20,
	})
	if err != nil {
		return nil, err
	}
	matches := filterByThreshold(results, p.Threshold)
	riskLevel := riskFromMatches(matches)
	return map[string]interface{}{
		"matches": formatResults(matches), "risk_level": riskLevel,
		"processing_ms": time.Since(start).Milliseconds(),
	}, nil
}

func (s *Server) handleCheckPEP(params json.RawMessage) (interface{}, error) {
	var p struct {
		Name    string `json:"name"`
		Country string `json:"country"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	results, err := s.engine.ScreenByName(p.Name, screening.SearchOpts{Limit: 10})
	if err != nil {
		return nil, err
	}
	return buildPEPResponse(results, p.Country), nil
}

func (s *Server) handleAnalyzeTxn(params json.RawMessage) (interface{}, error) {
	var p struct {
		Sender      string  `json:"sender"`
		Receiver    string  `json:"receiver"`
		Amount      float64 `json:"amount"`
		SenderCtry  string  `json:"sender_country"`
		RecvCtry    string  `json:"receiver_country"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	senderHits, _ := s.engine.ScreenByName(p.Sender, screening.SearchOpts{Limit: 5})
	recvHits, _ := s.engine.ScreenByName(p.Receiver, screening.SearchOpts{Limit: 5})
	sRisk := domain.CountryRiskScore(p.SenderCtry)
	rRisk := domain.CountryRiskScore(p.RecvCtry)
	decision := txnDecision(senderHits, recvHits, sRisk, rRisk)
	return map[string]interface{}{
		"decision": decision, "sender_matches": formatResults(senderHits),
		"receiver_matches": formatResults(recvHits),
		"patterns": []string{countryPattern(sRisk, rRisk)},
	}, nil
}

func countryPattern(sRisk, rRisk float64) string {
	if sRisk > 0.5 || rRisk > 0.5 {
		return "high_risk_jurisdiction"
	}
	return strings.Join([]string{"standard_risk"}, "")
}
