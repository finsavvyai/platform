// Package llm — Vertex AI request/response shapes used by google.go.
package llm

type vertexPart struct {
	Text string `json:"text"`
}

type vertexContent struct {
	Role  string       `json:"role"`
	Parts []vertexPart `json:"parts"`
}

type vertexGenCfg struct {
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
	Temperature     float32 `json:"temperature,omitempty"`
}

type vertexGenReq struct {
	Contents          []vertexContent `json:"contents"`
	SystemInstruction *vertexContent  `json:"systemInstruction,omitempty"`
	GenerationConfig  *vertexGenCfg   `json:"generationConfig,omitempty"`
}

type vertexGenResp struct {
	Candidates []struct {
		Content      vertexContent `json:"content"`
		FinishReason string        `json:"finishReason"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
	} `json:"usageMetadata"`
	ModelVersion string `json:"modelVersion"`
}

type vertexEmbedInstance struct {
	Content string `json:"content"`
}

type vertexEmbedReq struct {
	Instances []vertexEmbedInstance `json:"instances"`
}

type vertexEmbedResp struct {
	Predictions []struct {
		Embeddings struct {
			Values []float32 `json:"values"`
		} `json:"embeddings"`
	} `json:"predictions"`
}
