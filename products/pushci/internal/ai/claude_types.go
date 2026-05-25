package ai

const apiURL = "https://api.anthropic.com/v1/messages"

// DefaultAnthropicModel is the stable Haiku alias. Using the family
// alias instead of a dated snapshot (`claude-haiku-4-5-20251001`)
// means model deprecations don't silently break the client — the
// alias always points at the current recommended snapshot. Users who
// want deterministic behavior can pin via PUSHCI_AI_MODEL.
const DefaultAnthropicModel = "claude-haiku-4-5"

// Provider identifies which LLM backend a Client is talking to.
// Ask() dispatches on this field so callers only hold an *ai.Client
// and never care which provider is underneath.
type Provider string

const (
	ProviderAnthropic Provider = "anthropic"
	ProviderDeepSeek  Provider = "deepseek"
	ProviderGroq      Provider = "groq"
	ProviderOpenAI    Provider = "openai"
	ProviderGemini    Provider = "gemini"
	ProviderLocal     Provider = "local"
	ProviderProxy     Provider = "pushci-proxy"
)

// Client is the single public AI-client type. One struct, many
// backends: consumers call client.Ask and dispatch happens internally
// via the provider field.
type Client struct {
	apiKey   string
	model    string
	endpoint string
	provider Provider
}

// IsConfigured returns true when the client has credentials for a real call.
func (c *Client) IsConfigured() bool { return c.apiKey != "" }

// Provider returns the backend this client is talking to.
func (c *Client) Provider() Provider { return c.provider }

type request struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system,omitempty"`
	Messages  []message `json:"messages"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type response struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text,omitempty"`
	} `json:"content"`
}
