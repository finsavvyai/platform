package providers

import (
	"context"
	"fmt"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sashabaranov/go-openai"
)

// CompleteStream generates a streaming completion using Ollama
func (p *OllamaProvider) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan StreamChunk, error) {
	openaiReq := openai.ChatCompletionRequest{
		Model:       req.Model,
		Messages:    convertMessages(req.Messages),
		MaxTokens:   req.MaxTokens,
		Temperature: float32(req.Temperature),
		TopP:        float32(req.TopP),
		Stream:      true,
		Stop:        req.Stop,
	}

	stream, err := p.client.CreateChatCompletionStream(ctx, openaiReq)
	if err != nil {
		return nil, fmt.Errorf("ollama stream failed: %w", err)
	}

	chunkChan := make(chan StreamChunk, 10)
	go func() {
		defer close(chunkChan)
		defer stream.Close()
		for {
			r, err := stream.Recv()
			if err != nil {
				chunkChan <- StreamChunk{Error: err, Done: true}
				return
			}
			if len(r.Choices) == 0 {
				chunkChan <- StreamChunk{Done: true}
				return
			}
			choices := make([]StreamChoice, len(r.Choices))
			for i, c := range r.Choices {
				choices[i] = StreamChoice{
					Index:        c.Index,
					Delta:        Delta{Role: c.Delta.Role, Content: c.Delta.Content},
					FinishReason: string(c.FinishReason),
				}
			}
			chunkChan <- StreamChunk{
				ID: r.ID, Object: r.Object, Created: r.Created, Model: r.Model,
				Choices: choices,
				Done:    len(r.Choices) > 0 && r.Choices[0].FinishReason != "",
			}
		}
	}()
	return chunkChan, nil
}
