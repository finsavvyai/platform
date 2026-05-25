package ai

// geminiPart holds a single text fragment in a Gemini message.
type geminiPart struct {
	Text string `json:"text"`
}

// geminiContent is a single message in a Gemini conversation.
type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

// geminiRequest is the body sent to the generateContent endpoint.
type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
}

// geminiResponse is the body returned by the generateContent endpoint.
type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}
