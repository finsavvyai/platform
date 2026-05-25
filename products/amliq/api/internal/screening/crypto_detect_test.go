package screening

import "testing"

func TestDetectChain(t *testing.T) {
	tests := []struct {
		addr string
		want string
	}{
		{"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "ETH"},
		{"1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "BTC"},
		{"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "BTC"},
		{"bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", "BTC"},
		{"TN2YqTv5DjTcFRXqEBEyWnFMs5LkQnLfZi", "TRX"},
		{"rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", "XRP"},
	}

	for _, tc := range tests {
		t.Run(tc.want+"_"+tc.addr[:8], func(t *testing.T) {
			got := detectChain(tc.addr)
			if got != tc.want {
				t.Errorf("detectChain(%q) = %q, want %q",
					tc.addr, got, tc.want)
			}
		})
	}
}
