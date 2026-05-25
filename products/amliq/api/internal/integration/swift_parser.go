package integration

import (
	"strings"
)

// SWIFTParty represents an extracted party from a SWIFT message.
type SWIFTParty struct {
	Role    string // originator, beneficiary, intermediary
	Name    string
	Account string
	BIC     string
}

// SWIFTMessage holds parsed fields from MT103/MT202.
type SWIFTMessage struct {
	MessageType string
	Originator  SWIFTParty
	Beneficiary SWIFTParty
	Intermediary *SWIFTParty
	Amount      string
	Currency    string
	Reference   string
}

// ParseMT103 extracts parties from a SWIFT MT103 message.
func ParseMT103(raw string) SWIFTMessage {
	msg := SWIFTMessage{MessageType: "MT103"}
	lines := strings.Split(raw, "\n")

	for i, line := range lines {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, ":50K:"):
			msg.Originator = parseParty("originator", line, lines, i)
		case strings.HasPrefix(line, ":59:"):
			msg.Beneficiary = parseParty("beneficiary", line, lines, i)
		case strings.HasPrefix(line, ":56A:"):
			p := parseParty("intermediary", line, lines, i)
			msg.Intermediary = &p
		case strings.HasPrefix(line, ":32A:"):
			msg.Currency, msg.Amount = parseCurrencyAmount(line)
		case strings.HasPrefix(line, ":20:"):
			msg.Reference = strings.TrimPrefix(line, ":20:")
		}
	}
	return msg
}

func parseParty(role, firstLine string, lines []string, idx int) SWIFTParty {
	party := SWIFTParty{Role: role}
	// Remove tag prefix
	content := firstLine
	for _, prefix := range []string{":50K:", ":59:", ":56A:"} {
		content = strings.TrimPrefix(content, prefix)
	}

	if strings.HasPrefix(content, "/") {
		party.Account = strings.TrimPrefix(content, "/")
		if idx+1 < len(lines) && !strings.HasPrefix(lines[idx+1], ":") {
			party.Name = strings.TrimSpace(lines[idx+1])
		}
	} else {
		party.Name = content
	}
	return party
}

func parseCurrencyAmount(line string) (string, string) {
	val := strings.TrimPrefix(line, ":32A:")
	// Format: YYMMDDCCCAMOUNT (e.g., 260403USD50000,00)
	if len(val) > 9 {
		return val[6:9], val[9:]
	}
	return "", val
}

// Parties returns all parties for screening.
func (m SWIFTMessage) Parties() []SWIFTParty {
	parties := []SWIFTParty{m.Originator, m.Beneficiary}
	if m.Intermediary != nil {
		parties = append(parties, *m.Intermediary)
	}
	return parties
}
