package integration

import "testing"

func TestParseMT103(t *testing.T) {
	raw := `:20:TXN-2026-001
:32A:260403USD50000,00
:50K:/US12345678
John Smith
123 Main St
:56A:DEUTDEFF
:59:/RU98765432
Ivan Petrov
Moscow
`
	msg := ParseMT103(raw)

	tests := []struct {
		name  string
		check func() bool
	}{
		{"type", func() bool { return msg.MessageType == "MT103" }},
		{"reference", func() bool { return msg.Reference == "TXN-2026-001" }},
		{"currency", func() bool { return msg.Currency == "USD" }},
		{"amount", func() bool { return msg.Amount == "50000,00" }},
		{"originator_account", func() bool { return msg.Originator.Account == "US12345678" }},
		{"originator_name", func() bool { return msg.Originator.Name == "John Smith" }},
		{"beneficiary_account", func() bool { return msg.Beneficiary.Account == "RU98765432" }},
		{"beneficiary_name", func() bool { return msg.Beneficiary.Name == "Ivan Petrov" }},
		{"intermediary", func() bool { return msg.Intermediary != nil }},
		{"parties_count", func() bool { return len(msg.Parties()) == 3 }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}
