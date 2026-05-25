package ai

import "os"

// ---- DeepSeek --------------------------------------------------------------

const deepseekAPIURL = "https://api.deepseek.com/v1/chat/completions"

// DefaultDeepSeekModel is DeepSeek-V3. Use "deepseek-reasoner" for R1.
const DefaultDeepSeekModel = "deepseek-chat"

func newDeepSeekClient() *Client {
	model := os.Getenv("PUSHCI_AI_MODEL")
	if model == "" {
		model = DefaultDeepSeekModel
	}
	return &Client{
		apiKey:   os.Getenv("DEEPSEEK_API_KEY"),
		model:    model,
		endpoint: deepseekAPIURL,
		provider: ProviderDeepSeek,
	}
}

// ---- Groq ------------------------------------------------------------------

const groqAPIURL = "https://api.groq.com/openai/v1/chat/completions"

// DefaultGroqModel is Llama 3.3 70B on Groq LPUs — ~500 tok/sec.
const DefaultGroqModel = "llama-3.3-70b-versatile"

func newGroqClient() *Client {
	model := os.Getenv("PUSHCI_AI_MODEL")
	if model == "" {
		model = DefaultGroqModel
	}
	return &Client{
		apiKey:   os.Getenv("GROQ_API_KEY"),
		model:    model,
		endpoint: groqAPIURL,
		provider: ProviderGroq,
	}
}

// ---- OpenAI ----------------------------------------------------------------

const openaiAPIURL = "https://api.openai.com/v1/chat/completions"

// DefaultOpenAIModel is gpt-4o-mini — cheap, fast, good enough for CI diagnosis.
const DefaultOpenAIModel = "gpt-4o-mini"

// newOpenAIClient reads OPEN_AI_KEY and falls back to OPENAI_API_KEY.
func newOpenAIClient() *Client {
	key := os.Getenv("OPEN_AI_KEY")
	if key == "" {
		key = os.Getenv("OPENAI_API_KEY")
	}
	model := os.Getenv("PUSHCI_AI_MODEL")
	if model == "" {
		model = DefaultOpenAIModel
	}
	return &Client{
		apiKey:   key,
		model:    model,
		endpoint: openaiAPIURL,
		provider: ProviderOpenAI,
	}
}
