package ingestion

import "testing"

func TestChainCodeFromLabel(t *testing.T) {
	tests := []struct{ in, want string }{
		{"bitcoin", "XBT"},
		{"Ethereum", "ETH"},
		{"MONERO", "XMR"},
		{"litecoin", "LTC"},
		{"dash", "DASH"},
		{"zcash", "ZEC"},
		{"", "UNKNOWN"},
		{"polkadot", "POLKADOT"},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got := chainCodeFromLabel(tt.in)
			if got != tt.want {
				t.Errorf("got %q want %q", got, tt.want)
			}
		})
	}
}
