package api

// providerNameOf reports the underlying provider that served (or
// last-tried) a Complete call. The handler-level AISummarizer is
// often a FallbackChain wrapping multiple providers — this helper
// reaches into the chain to surface which one actually served.
//
// Defined as an interface check so handler tests with fakeSummarizer
// (no chain semantics) still compile and just return "fake".
type namedProvider interface{ LastUsed() string }

func providerNameOf(s AISummarizer) string {
	if np, ok := s.(namedProvider); ok {
		if name := np.LastUsed(); name != "" {
			return name
		}
		return "fallback-chain-empty"
	}
	return "direct"
}
