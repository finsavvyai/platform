package screening

import "strings"

// detectChain infers blockchain from a wallet address format.
func detectChain(address string) string {
	lower := strings.ToLower(address)
	switch {
	case strings.HasPrefix(lower, "0x"):
		return "ETH"
	case strings.HasPrefix(lower, "bc1"),
		strings.HasPrefix(lower, "1"),
		strings.HasPrefix(lower, "3"):
		return "BTC"
	case strings.HasPrefix(address, "T") && len(address) == 34:
		return "TRX"
	case strings.HasPrefix(address, "r") && len(address) >= 25:
		return "XRP"
	case len(address) >= 32 && len(address) <= 44 && !strings.HasPrefix(lower, "0x"):
		return "SOL" // base58 Solana addresses
	default:
		return "unknown"
	}
}
