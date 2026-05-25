package ingestion

import "testing"

func TestParseNBCTFCrypto(t *testing.T) {
	tests := []struct {
		name  string
		html  string
		count int
		chain string
		addr  string
	}{
		{
			name:  "BTC address",
			html:  `<td>1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa</td>`,
			count: 1, chain: "BTC",
			addr: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
		},
		{
			name:  "ETH address lowercased",
			html:  `<td>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</td>`,
			count: 1, chain: "ETH",
			addr: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
		},
		{
			name:  "TRX address",
			html:  `<td>TN2YqTv5DjTcFRXqEBEyWnFMs5LkQnLfZi</td>`,
			count: 1, chain: "TRX",
			addr: "TN2YqTv5DjTcFRXqEBEyWnFMs5LkQnLfZi",
		},
		{
			name:  "multiple chains in one page",
			html:  `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`,
			count: 2,
		},
		{
			name:  "dedup identical addresses",
			html:  `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`,
			count: 1, chain: "BTC",
		},
		{
			name:  "no addresses returns empty",
			html:  `<html><body>No wallets here</body></html>`,
			count: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			entries := ParseNBCTFCrypto([]byte(tc.html))
			if len(entries) != tc.count {
				t.Errorf("got %d entries, want %d", len(entries), tc.count)
			}
			if tc.addr != "" && len(entries) > 0 {
				if entries[0].Address != tc.addr {
					t.Errorf("addr=%s, want %s", entries[0].Address, tc.addr)
				}
			}
			if tc.chain != "" && len(entries) > 0 {
				if entries[0].Chain != tc.chain {
					t.Errorf("chain=%s, want %s", entries[0].Chain, tc.chain)
				}
			}
		})
	}
}
