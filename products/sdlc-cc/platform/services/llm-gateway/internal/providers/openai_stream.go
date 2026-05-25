package providers

import (
	"context"
	"fmt"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sashabaranov/go-openai"
)

// CompleteStream generates a streaming text completion using OpenAI
func (p *OpenAIProvider) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan StreamChunk, error) {
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
		return nil, fmt.Errorf("OpenAI stream creation failed: %w", err)
	}

	chunkChan := make(chan StreamChunk, 10)
	go func() {
		defer close(chunkChan)
		defer stream.Close()

		for {
			response, err := stream.Recv()
			if err != nil {
				chunkChan <- StreamChunk{
					Error: fmt.Errorf("stream error: %w", err),
					Done:  true,
				}
				return
			}

			if len(response.Choices) == 0 {
				chunkChan <- StreamChunk{Done: true}
				return
			}

			choices := make([]StreamChoice, len(response.Choices))
			for i, choice := range response.Choices {
				choices[i] = StreamChoice{
					Index:        choice.Index,
					Delta:        Delta{Role: choice.Delta.Role, Content: choice.Delta.Content},
					FinishReason: string(choice.FinishReason),
				}
			}

			chunkChan <- StreamChunk{
				ID:      response.ID,
				Object:  response.Object,
				Created: response.Created,
				Model:   response.Model,
				Choices: choices,
				Done:    len(response.Choices) > 0 && response.Choices[0].FinishReason != "",
			}
		}
	}()

	return chunkChan, nil
}
