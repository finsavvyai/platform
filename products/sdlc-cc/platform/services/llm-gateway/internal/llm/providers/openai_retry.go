package providers

// isRetryableError checks if an error is retryable
func (p *OpenAIProvider) isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	retryableErrors := []string{
		"timeout", "connection", "temporary failure", "rate limit",
		"503", "502", "500",
	}
	for _, retryableErr := range retryableErrors {
		if contains(errStr, retryableErr) {
			return true
		}
	}
	return false
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		(len(s) > len(substr) &&
			(s[:len(substr)] == substr ||
				s[len(s)-len(substr):] == substr ||
				findSubstring(s, substr))))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
