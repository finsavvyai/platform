package llm

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/internal/observability"
	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
)

// attemptCompletionWithFailover attempts completion with failover to other providers
func (g *Gateway) attemptCompletionWithFailover(ctx context.Context, req *models.CompletionRequest,
	initialProvider providers.Provider) (*models.CompletionResponse, error) {

	providerList := g.providerFactory.GetProvidersByPriority()

	var startIndex int
	for i, p := range providerList {
		if p.GetName() == initialProvider.GetName() {
			startIndex = i
			break
		}
	}

	var lastError error

	for i := 0; i < len(providerList); i++ {
		providerIndex := (startIndex + i) % len(providerList)
		provider := providerList[providerIndex]

		if !provider.IsEnabled() {
			continue
		}

		if req.Model != "" {
			modelInfo, err := provider.GetModelInfo()
			if err != nil {
				continue
			}
			modelSupported := false
			for _, model := range modelInfo {
				if model.ID == req.Model && model.IsAvailable {
					modelSupported = true
					break
				}
			}
			if !modelSupported {
				continue
			}
		}

		start := time.Now()
		spanCtx, span := observability.TraceLLMGeneration(ctx, provider.GetName(), req.Model)
		response, err := provider.Complete(spanCtx, req)
		elapsed := time.Since(start).Milliseconds()

		// Record outcome for smart routing
		if g.smartRouter != nil {
			g.smartRouter.RecordOutcome(provider.GetName(), req.Model, err == nil, elapsed)
		}

		if err == nil {
			observability.FinishLLMGeneration(span, observability.LLMCallAttrs{
				Provider:     provider.GetName(),
				Model:        response.Model,
				TenantID:     req.TenantID,
				UserID:       req.UserID,
				InputTokens:  response.Usage.PromptTokens,
				OutputTokens: response.Usage.CompletionTokens,
				TotalTokens:  response.Usage.TotalTokens,
				CostUSD:      response.Cost,
				ResponseID:   response.ID,
			})
			span.End()
			return response, nil
		}
		span.RecordError(err)
		span.End()

		lastError = err

		if providers.ShouldRetry(err, 0) && g.config.MaxRetries > 0 {
			for attempt := 1; attempt <= g.config.MaxRetries; attempt++ {
				g.logger.WithFields(logrus.Fields{
					"provider": provider.GetName(),
					"attempt":  attempt,
					"error":    err.Error(),
				}).Warn("Retrying completion")

				time.Sleep(g.config.RetryDelay)

				response, retryErr := provider.Complete(ctx, req)
				if retryErr == nil {
					return response, nil
				}
				lastError = retryErr
				if !providers.ShouldRetry(retryErr, attempt) {
					break
				}
			}
		}

		if !g.config.EnableFailover {
			break
		}

		g.logger.WithFields(logrus.Fields{
			"provider": provider.GetName(),
			"error":    err.Error(),
		}).Warn("Provider failed, trying next provider")
	}

	return nil, fmt.Errorf("all providers failed. Last error: %w", lastError)
}
