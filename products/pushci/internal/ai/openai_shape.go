package ai

// openAIRequest/openAIMessage/openAIResponse are the shared wire
// shapes for every OpenAI-compatible chat completions backend we
// talk to (DeepSeek, Groq, Together, Fireworks, llamafile, vLLM).
// Keeping them in one file stops two callers (deepseek.go + llamafile.go)
// from racing to declare the same type and breaking compilation.

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIRequest struct {
	Model     string          `json:"model"`
	Messages  []openAIMessage `json:"messages"`
	MaxTokens int             `json:"max_tokens,omitempty"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}
