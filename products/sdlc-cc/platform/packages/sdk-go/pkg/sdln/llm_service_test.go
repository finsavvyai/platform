//go:build never
// +build never

package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestLLMService_CreateChatCompletion(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		request       *LLMRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful chat completion",
			setupMock: func() {
				response := map[string]interface{}{
					"id":      "chatcmpl-123",
					"object":  "chat.completion",
					"created": time.Now().Unix(),
					"model":   "gpt-3.5-turbo",
					"choices": []map[string]interface{}{
						{
							"index": 0,
							"message": map[string]interface{}{
								"role":    "assistant",
								"content": "Hello! How can I help you today?",
							},
							"finish_reason": "stop",
						},
					},
					"usage": map[string]interface{}{
						"prompt_tokens":     10,
						"completion_tokens": 15,
						"total_tokens":      25,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/chat/completions", response)
			},
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "Hello, how are you?",
					},
				},
				MaxTokens:   100,
				Temperature: 0.7,
			},
			expectedError: false,
		},
		{
			name:          "nil request",
			request:       nil,
			expectedError: true,
			errorMsg:      "LLM request cannot be nil",
		},
		{
			name: "empty model",
			request: &LLMRequest{
				Model:    "",
				Messages: []LLMMessage{{Role: "user", Content: "Hello"}},
			},
			expectedError: true,
			errorMsg:      "model cannot be empty",
		},
		{
			name: "empty messages",
			request: &LLMRequest{
				Model:    "gpt-3.5-turbo",
				Messages: []LLMMessage{},
			},
			expectedError: true,
			errorMsg:      "messages cannot be empty",
		},
		{
			name: "invalid temperature",
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "Hello",
					},
				},
				Temperature: 2.5, // Invalid: > 2.0
			},
			expectedError: true,
			errorMsg:      "temperature must be between 0 and 2",
		},
		{
			name: "model not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "model 'invalid-model' not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/chat/completions", errorResp)
			},
			request: &LLMRequest{
				Model: "invalid-model",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "Hello",
					},
				},
			},
			expectedError: true,
			errorMsg:      "model not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.CreateChatCompletion(TestContext(), tt.request)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected completion ID to be set")
				}
				if len(result.Choices) == 0 {
					t.Fatal("Expected at least one choice")
				}
				if result.Usage == nil {
					t.Fatal("Expected usage information")
				}
			}
		})
	}
}

func TestLLMService_CreateStreamingChatCompletion(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		request       *LLMRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful streaming completion",
			setupMock: func() {
				// Simulate SSE response
				sseData := []string{
					`data: {"id": "chatcmpl-123", "choices": [{"index": 0, "delta": {"role": "assistant"}}]}`,
					`data: {"id": "chatcmpl-123", "choices": [{"index": 0, "delta": {"content": "Hello"}}]}`,
					`data: {"id": "chatcmpl-123", "choices": [{"index": 0, "delta": {"content": "!"}}]}`,
					`data: [DONE]`,
				}
				response := strings.Join(sseData, "\n\n")
				server.SetResponse("POST", "/api/v1/llm/chat/completions",
					&mockStreamResponse{data: response})
			},
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "Hello",
					},
				},
				Stream: true,
			},
			expectedError: false,
		},
		{
			name: "streaming error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "streaming failed",
						"code":    500,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/chat/completions", errorResp)
			},
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "Hello",
					},
				},
				Stream: true,
			},
			expectedError: true,
			errorMsg:      "streaming failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			resultChan, err := client.LLM.CreateStreamingChatCompletion(TestContext(), tt.request)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if resultChan == nil {
					t.Fatal("Expected non-nil result channel")
				}

				// Test channel reception
				select {
				case result, ok := <-resultChan:
					if !ok {
						t.Fatal("Channel closed unexpectedly")
					}
					if result.ID == "" {
						t.Fatal("Expected result ID to be set")
					}
				case <-time.After(5 * time.Second):
					t.Fatal("Timeout waiting for streaming result")
				}
			}
		})
	}
}

func TestLLMService_CreateTextCompletion(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		request       *TextCompletionRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful text completion",
			setupMock: func() {
				response := map[string]interface{}{
					"id":      "cmpl-123",
					"object":  "text_completion",
					"created": time.Now().Unix(),
					"model":   "text-davinci-003",
					"choices": []map[string]interface{}{
						{
							"text":          "This is a completion.",
							"index":         0,
							"logprobs":      nil,
							"finish_reason": "stop",
						},
					},
					"usage": map[string]interface{}{
						"prompt_tokens":     5,
						"completion_tokens": 4,
						"total_tokens":      9,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/completions", response)
			},
			request: &TextCompletionRequest{
				Model:       "text-davinci-003",
				Prompt:      "The weather today is",
				MaxTokens:   50,
				Temperature: 0.7,
			},
			expectedError: false,
		},
		{
			name:          "nil request",
			request:       nil,
			expectedError: true,
			errorMsg:      "text completion request cannot be nil",
		},
		{
			name: "empty model",
			request: &TextCompletionRequest{
				Model:  "",
				Prompt: "test",
			},
			expectedError: true,
			errorMsg:      "model cannot be empty",
		},
		{
			name: "empty prompt",
			request: &TextCompletionRequest{
				Model:  "text-davinci-003",
				Prompt: "",
			},
			expectedError: true,
			errorMsg:      "prompt cannot be empty",
		},
		{
			name: "invalid max tokens",
			request: &TextCompletionRequest{
				Model:     "text-davinci-003",
				Prompt:    "test",
				MaxTokens: -1,
			},
			expectedError: true,
			errorMsg:      "max tokens must be positive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.CreateTextCompletion(TestContext(), tt.request)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected completion ID to be set")
				}
				if len(result.Choices) == 0 {
					t.Fatal("Expected at least one choice")
				}
			}
		})
	}
}

func TestLLMService_CreateEmbedding(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		request       *EmbeddingRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful embedding creation",
			setupMock: func() {
				response := map[string]interface{}{
					"object": "list",
					"data": []map[string]interface{}{
						{
							"object":    "embedding",
							"embedding": []float64{0.1, 0.2, 0.3, 0.4, 0.5},
							"index":     0,
						},
					},
					"model": "text-embedding-ada-002",
					"usage": map[string]interface{}{
						"prompt_tokens": 4,
						"total_tokens":  4,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/embeddings", response)
			},
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: "Hello world",
			},
			expectedError: false,
		},
		{
			name:          "nil request",
			request:       nil,
			expectedError: true,
			errorMsg:      "embedding request cannot be nil",
		},
		{
			name: "empty model",
			request: &EmbeddingRequest{
				Model: "",
				Input: "test",
			},
			expectedError: true,
			errorMsg:      "model cannot be empty",
		},
		{
			name: "empty input",
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: "",
			},
			expectedError: true,
			errorMsg:      "input cannot be empty",
		},
		{
			name: "invalid model",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid embedding model",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/embeddings", errorResp)
			},
			request: &EmbeddingRequest{
				Model: "invalid-model",
				Input: "test",
			},
			expectedError: true,
			errorMsg:      "invalid embedding model",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.CreateEmbedding(TestContext(), tt.request)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if len(result.Data) == 0 {
					t.Fatal("Expected at least one embedding")
				}
				if len(result.Data[0].Embedding) == 0 {
					t.Fatal("Expected embedding values")
				}
			}
		})
	}
}

func TestLLMService_CreateFineTuningJob(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		request       *FineTuningJobRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful fine-tuning job creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "ftjob-123",
					"object":     "fine_tuning.job",
					"model":      "gpt-3.5-turbo",
					"status":     "created",
					"created_at": time.Now().Unix(),
				}
				server.SetResponse("POST", "/api/v1/llm/fine-tuning/jobs", response)
			},
			request: &FineTuningJobRequest{
				Model:        "gpt-3.5-turbo",
				TrainingFile: "file-123",
				Hyperparameters: map[string]interface{}{
					"n_epochs": 3,
				},
			},
			expectedError: false,
		},
		{
			name:          "nil request",
			request:       nil,
			expectedError: true,
			errorMsg:      "fine-tuning job request cannot be nil",
		},
		{
			name: "empty model",
			request: &FineTuningJobRequest{
				Model:        "",
				TrainingFile: "file-123",
			},
			expectedError: true,
			errorMsg:      "model cannot be empty",
		},
		{
			name: "empty training file",
			request: &FineTuningJobRequest{
				Model:        "gpt-3.5-turbo",
				TrainingFile: "",
			},
			expectedError: true,
			errorMsg:      "training file cannot be empty",
		},
		{
			name: "invalid training file",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "training file not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/fine-tuning/jobs", errorResp)
			},
			request: &FineTuningJobRequest{
				Model:        "gpt-3.5-turbo",
				TrainingFile: "nonexistent-file",
			},
			expectedError: true,
			errorMsg:      "training file not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.CreateFineTuningJob(TestContext(), tt.request)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected job ID to be set")
				}
				if result.Status == "" {
					t.Fatal("Expected job status to be set")
				}
			}
		})
	}
}

func TestLLMService_GetFineTuningJob(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		jobID         string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get fine-tuning job",
			setupMock: func() {
				response := map[string]interface{}{
					"id":             "ftjob-123",
					"object":         "fine_tuning.job",
					"model":          "gpt-3.5-turbo",
					"status":         "running",
					"created_at":     time.Now().Unix(),
					"finished_at":    nil,
					"trained_tokens": 1000,
				}
				server.SetResponse("GET", "/api/v1/llm/fine-tuning/jobs/ftjob-123", response)
			},
			jobID:         "ftjob-123",
			expectedError: false,
		},
		{
			name:          "empty job ID",
			jobID:         "",
			expectedError: true,
			errorMsg:      "job ID cannot be empty",
		},
		{
			name: "job not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "fine-tuning job not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/llm/fine-tuning/jobs/nonexistent", errorResp)
			},
			jobID:         "nonexistent",
			expectedError: true,
			errorMsg:      "fine-tuning job not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.GetFineTuningJob(TestContext(), tt.jobID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.jobID {
					t.Fatalf("Expected job ID %q, got %q", tt.jobID, result.ID)
				}
			}
		})
	}
}

func TestLLMService_ListFineTuningJobs(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list fine-tuning jobs",
			setupMock: func() {
				response := map[string]interface{}{
					"object": "list",
					"data": []map[string]interface{}{
						{
							"id":     "ftjob-1",
							"object": "fine_tuning.job",
							"model":  "gpt-3.5-turbo",
							"status": "succeeded",
						},
						{
							"id":     "ftjob-2",
							"object": "fine_tuning.job",
							"model":  "gpt-3.5-turbo",
							"status": "running",
						},
					},
				}
				server.SetResponse("GET", "/api/v1/llm/fine-tuning/jobs", response)
			},
			expectedError: false,
		},
		{
			name: "empty list",
			setupMock: func() {
				response := map[string]interface{}{
					"object": "list",
					"data":   []interface{}{},
				}
				server.SetResponse("GET", "/api/v1/llm/fine-tuning/jobs", response)
			},
			expectedError: false,
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "failed to list fine-tuning jobs",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/llm/fine-tuning/jobs", errorResp)
			},
			expectedError: true,
			errorMsg:      "failed to list fine-tuning jobs",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.ListFineTuningJobs(TestContext())

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Data == nil {
					t.Fatal("Expected data to be set")
				}
			}
		})
	}
}

func TestLLMService_CancelFineTuningJob(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		jobID         string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful cancellation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "ftjob-123",
					"object":     "fine_tuning.job",
					"model":      "gpt-3.5-turbo",
					"status":     "cancelled",
					"created_at": time.Now().Unix(),
				}
				server.SetResponse("POST", "/api/v1/llm/fine-tuning/jobs/ftjob-123/cancel", response)
			},
			jobID:         "ftjob-123",
			expectedError: false,
		},
		{
			name:          "empty job ID",
			jobID:         "",
			expectedError: true,
			errorMsg:      "job ID cannot be empty",
		},
		{
			name: "job already completed",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "job cannot be cancelled: already completed",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/llm/fine-tuning/jobs/completed/cancel", errorResp)
			},
			jobID:         "completed",
			expectedError: true,
			errorMsg:      "job cannot be cancelled",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.CancelFineTuningJob(TestContext(), tt.jobID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Status != "cancelled" {
					t.Fatalf("Expected cancelled status, got %s", result.Status)
				}
			}
		})
	}
}

func TestLLMService_ListModels(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list models",
			setupMock: func() {
				response := map[string]interface{}{
					"object": "list",
					"data": []map[string]interface{}{
						{
							"id":       "gpt-3.5-turbo",
							"object":   "model",
							"created":  time.Now().Unix(),
							"owned_by": "openai",
						},
						{
							"id":       "text-davinci-003",
							"object":   "model",
							"created":  time.Now().Unix(),
							"owned_by": "openai",
						},
					},
				}
				server.SetResponse("GET", "/api/v1/llm/models", response)
			},
			expectedError: false,
		},
		{
			name: "empty models list",
			setupMock: func() {
				response := map[string]interface{}{
					"object": "list",
					"data":   []interface{}{},
				}
				server.SetResponse("GET", "/api/v1/llm/models", response)
			},
			expectedError: false,
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "failed to list models",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/llm/models", errorResp)
			},
			expectedError: true,
			errorMsg:      "failed to list models",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.ListModels(TestContext())

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Data == nil {
					t.Fatal("Expected data to be set")
				}
			}
		})
	}
}

func TestLLMService_GetModel(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		modelID       string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get model",
			setupMock: func() {
				response := map[string]interface{}{
					"id":       "gpt-3.5-turbo",
					"object":   "model",
					"created":  time.Now().Unix(),
					"owned_by": "openai",
				}
				server.SetResponse("GET", "/api/v1/llm/models/gpt-3.5-turbo", response)
			},
			modelID:       "gpt-3.5-turbo",
			expectedError: false,
		},
		{
			name:          "empty model ID",
			modelID:       "",
			expectedError: true,
			errorMsg:      "model ID cannot be empty",
		},
		{
			name: "model not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "model not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/llm/models/nonexistent", errorResp)
			},
			modelID:       "nonexistent",
			expectedError: true,
			errorMsg:      "model not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.GetModel(TestContext(), tt.modelID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.modelID {
					t.Fatalf("Expected model ID %q, got %q", tt.modelID, result.ID)
				}
			}
		})
	}
}

func TestLLMService_GetUsage(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get usage",
			setupMock: func() {
				response := map[string]interface{}{
					"total_usage": map[string]interface{}{
						"prompt_tokens":     10000,
						"completion_tokens": 5000,
						"total_tokens":      15000,
					},
					"current_period_usage": map[string]interface{}{
						"prompt_tokens":     1000,
						"completion_tokens": 500,
						"total_tokens":      1500,
					},
					"period_start": time.Now().AddDate(0, -1, 0).Format(time.RFC3339),
					"period_end":   time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/llm/usage", response)
			},
			expectedError: false,
		},
		{
			name: "usage not available",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "usage data not available",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/llm/usage", errorResp)
			},
			expectedError: true,
			errorMsg:      "usage data not available",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.LLM.GetUsage(TestContext())

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.TotalUsage == nil {
					t.Fatal("Expected total usage to be set")
				}
			}
		})
	}
}

func TestLLMService_ContextCancellation(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel the context immediately
	cancel()

	request := &LLMRequest{
		Model: "gpt-3.5-turbo",
		Messages: []LLMMessage{
			{
				Role:    "user",
				Content: "Hello",
			},
		},
	}

	_, err := client.LLM.CreateChatCompletion(ctx, request)
	if err == nil {
		t.Fatal("Expected context cancellation error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "context canceled") {
		t.Fatalf("Expected context cancellation error, got %v", err)
	}
}

func TestLLMService_StreamHandling(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Test malformed SSE data
	t.Run("malformed SSE data", func(t *testing.T) {
		malformedData := "invalid sse data"
		server.SetResponse("POST", "/api/v1/llm/chat/completions",
			&mockStreamResponse{data: malformedData})

		request := &LLMRequest{
			Model:    "gpt-3.5-turbo",
			Messages: []LLMMessage{{Role: "user", Content: "Hello"}},
			Stream:   true,
		}

		_, err := client.LLM.CreateStreamingChatCompletion(TestContext(), request)
		if err == nil {
			t.Fatal("Expected error for malformed SSE data")
		}
	})

	// Test empty SSE data
	t.Run("empty SSE data", func(t *testing.T) {
		server.SetResponse("POST", "/api/v1/llm/chat/completions",
			&mockStreamResponse{data: ""})

		request := &LLMRequest{
			Model:    "gpt-3.5-turbo",
			Messages: []LLMMessage{{Role: "user", Content: "Hello"}},
			Stream:   true,
		}

		resultChan, err := client.LLM.CreateStreamingChatCompletion(TestContext(), request)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Channel should close immediately
		select {
		case _, ok := <-resultChan:
			if ok {
				t.Fatal("Expected channel to be closed")
			}
		case <-time.After(1 * time.Second):
			t.Fatal("Timeout waiting for channel to close")
		}
	})
}

func TestLLMService_JsonSerialization(t *testing.T) {
	t.Run("LLMRequest serialization", func(t *testing.T) {
		request := &LLMRequest{
			Model: "gpt-3.5-turbo",
			Messages: []LLMMessage{
				{
					Role:    "user",
					Content: "Hello, world!",
				},
				{
					Role:    "assistant",
					Content: "Hi there!",
				},
			},
			MaxTokens:   100,
			Temperature: 0.7,
			TopP:        1.0,
			Stream:      false,
		}

		data, err := json.Marshal(request)
		if err != nil {
			t.Fatalf("Failed to marshal LLM request: %v", err)
		}

		var decoded LLMRequest
		err = json.Unmarshal(data, &decoded)
		if err != nil {
			t.Fatalf("Failed to unmarshal LLM request: %v", err)
		}

		if decoded.Model != request.Model {
			t.Fatalf("Expected model %q, got %q", request.Model, decoded.Model)
		}
		if len(decoded.Messages) != len(request.Messages) {
			t.Fatalf("Expected %d messages, got %d", len(request.Messages), len(decoded.Messages))
		}
	})

	t.Run("LLMResponse serialization", func(t *testing.T) {
		response := &LLMResponse{
			ID:      "chatcmpl-123",
			Object:  "chat.completion",
			Created: time.Now().Unix(),
			Model:   "gpt-3.5-turbo",
			Choices: []LLMChoice{
				{
					Index: 0,
					Message: LLMMessage{
						Role:    "assistant",
						Content: "Hello!",
					},
					FinishReason: "stop",
				},
			},
			Usage: &Usage{
				PromptTokens:     10,
				CompletionTokens: 15,
				TotalTokens:      25,
			},
		}

		data, err := json.Marshal(response)
		if err != nil {
			t.Fatalf("Failed to marshal LLM response: %v", err)
		}

		var decoded LLMResponse
		err = json.Unmarshal(data, &decoded)
		if err != nil {
			t.Fatalf("Failed to unmarshal LLM response: %v", err)
		}

		if decoded.ID != response.ID {
			t.Fatalf("Expected ID %q, got %q", response.ID, decoded.ID)
		}
		if len(decoded.Choices) != len(response.Choices) {
			t.Fatalf("Expected %d choices, got %d", len(response.Choices), len(decoded.Choices))
		}
		if decoded.Usage == nil {
			t.Fatal("Expected usage to be set")
		}
	})
}

func TestLLMService_ConcurrentOperations(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Setup mock responses for concurrent operations
	for i := 0; i < 10; i++ {
		response := map[string]interface{}{
			"id":      fmt.Sprintf("chatcmpl-%d", i),
			"object":  "chat.completion",
			"created": time.Now().Unix(),
			"model":   "gpt-3.5-turbo",
			"choices": []map[string]interface{}{
				{
					"index": 0,
					"message": map[string]interface{}{
						"role":    "assistant",
						"content": fmt.Sprintf("Response %d", i),
					},
					"finish_reason": "stop",
				},
			},
		}
		server.SetResponse("POST", "/api/v1/llm/chat/completions", response)
	}

	// Test concurrent chat completions
	const numGoroutines = 10
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)
	results := make(chan *LLMResponse, numGoroutines)

	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			request := &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: fmt.Sprintf("Test message %d", id),
					},
				},
			}

			response, err := client.LLM.CreateChatCompletion(TestContext(), request)
			if err != nil {
				errors <- err
				return
			}
			results <- response
		}(i)
	}

	wg.Wait()
	close(errors)
	close(results)

	// Check for errors
	for err := range errors {
		t.Errorf("Concurrent operation failed: %v", err)
	}

	// Check results
	resultCount := 0
	for range results {
		resultCount++
	}

	if resultCount != numGoroutines {
		t.Errorf("Expected %d results, got %d", numGoroutines, resultCount)
	}
}

func TestLLMService_RequestValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		request   *LLMRequest
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid request",
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "Hello",
					},
				},
				MaxTokens:   100,
				Temperature: 0.7,
				TopP:        1.0,
			},
			expectErr: false,
		},
		{
			name: "invalid temperature - too high",
			request: &LLMRequest{
				Model:       "gpt-3.5-turbo",
				Messages:    []LLMMessage{{Role: "user", Content: "Hello"}},
				Temperature: 2.1,
			},
			expectErr: true,
			errMsg:    "temperature must be between 0 and 2",
		},
		{
			name: "invalid temperature - negative",
			request: &LLMRequest{
				Model:       "gpt-3.5-turbo",
				Messages:    []LLMMessage{{Role: "user", Content: "Hello"}},
				Temperature: -0.1,
			},
			expectErr: true,
			errMsg:    "temperature must be between 0 and 2",
		},
		{
			name: "invalid top_p - too high",
			request: &LLMRequest{
				Model:    "gpt-3.5-turbo",
				Messages: []LLMMessage{{Role: "user", Content: "Hello"}},
				TopP:     1.1,
			},
			expectErr: true,
			errMsg:    "top_p must be between 0 and 1",
		},
		{
			name: "invalid top_p - negative",
			request: &LLMRequest{
				Model:    "gpt-3.5-turbo",
				Messages: []LLMMessage{{Role: "user", Content: "Hello"}},
				TopP:     -0.1,
			},
			expectErr: true,
			errMsg:    "top_p must be between 0 and 1",
		},
		{
			name: "invalid max tokens - negative",
			request: &LLMRequest{
				Model:     "gpt-3.5-turbo",
				Messages:  []LLMMessage{{Role: "user", Content: "Hello"}},
				MaxTokens: -1,
			},
			expectErr: true,
			errMsg:    "max tokens must be positive",
		},
		{
			name: "invalid max tokens - zero",
			request: &LLMRequest{
				Model:     "gpt-3.5-turbo",
				Messages:  []LLMMessage{{Role: "user", Content: "Hello"}},
				MaxTokens: 0,
			},
			expectErr: true,
			errMsg:    "max tokens must be positive",
		},
		{
			name: "invalid message role",
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "invalid_role",
						Content: "Hello",
					},
				},
			},
			expectErr: true,
			errMsg:    "invalid message role",
		},
		{
			name: "empty message content",
			request: &LLMRequest{
				Model: "gpt-3.5-turbo",
				Messages: []LLMMessage{
					{
						Role:    "user",
						Content: "",
					},
				},
			},
			expectErr: true,
			errMsg:    "message content cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.LLM.CreateChatCompletion(TestContext(), tt.request)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

func TestLLMService_EmbeddingValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		request   *EmbeddingRequest
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid embedding request",
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: "Hello world",
			},
			expectErr: false,
		},
		{
			name: "empty input string",
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: "",
			},
			expectErr: true,
			errMsg:    "input cannot be empty",
		},
		{
			name: "input array with empty string",
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: []string{"hello", ""},
			},
			expectErr: true,
			errMsg:    "input strings cannot be empty",
		},
		{
			name: "invalid input type",
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: 123, // Invalid type
			},
			expectErr: true,
			errMsg:    "input must be string or array of strings",
		},
		{
			name: "too many inputs",
			request: &EmbeddingRequest{
				Model: "text-embedding-ada-002",
				Input: make([]string, 2049), // Exceeds typical limit
			},
			expectErr: true,
			errMsg:    "too many inputs",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := client.LLM.CreateEmbedding(TestContext(), tt.request)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

// Mock stream response for testing
type mockStreamResponse struct {
	data string
}

func (m *mockStreamResponse) Read(p []byte) (n int, err error) {
	if m.data == "" {
		return 0, io.EOF
	}

	if len(m.data) > len(p) {
		n = len(p)
		copy(p, m.data[:n])
		m.data = m.data[n:]
		return n, nil
	}

	n = len(m.data)
	copy(p, m.data)
	m.data = ""
	return n, io.EOF
}

func (m *mockStreamResponse) Close() error {
	return nil
}

func (m *mockStreamResponse) Header() http.Header {
	return make(http.Header)
}

func (m *mockStreamResponse) StatusCode() int {
	return 200
}
