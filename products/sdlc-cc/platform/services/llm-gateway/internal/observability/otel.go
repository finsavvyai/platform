// Package observability provides OpenTelemetry instrumentation for the LLM
// gateway following the OTel GenAI semantic conventions compatible with
// OpenLLMetry (https://github.com/traceloop/openllmetry).
package observability

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

// OTel GenAI semantic convention attribute keys. These mirror the spec used by
// OpenLLMetry so traces are interoperable with Traceloop and any OTel backend
// that understands the gen_ai.* namespace.
const (
	AttrGenAISystem       = "gen_ai.system"
	AttrGenAIRequestModel = "gen_ai.request.model"
	AttrGenAIResponseID   = "gen_ai.response.id"
	AttrGenAIInputTokens  = "gen_ai.usage.input_tokens"
	AttrGenAIOutputTokens = "gen_ai.usage.output_tokens"
	AttrGenAITotalTokens  = "gen_ai.usage.total_tokens"
	AttrGenAIOperation    = "gen_ai.operation.name"
	AttrLLMTenantID       = "llm.tenant_id"
	AttrLLMUserID         = "llm.user_id"
	AttrLLMCostUSD        = "llm.cost_usd"
)

var (
	tracerOnce   sync.Once
	globalTracer trace.Tracer
)

// IsEnabled reports whether OTel instrumentation has been opted into via the
// OTEL_ENABLED environment variable.
func IsEnabled() bool {
	v := os.Getenv("OTEL_ENABLED")
	if v == "" {
		return false
	}
	enabled, err := strconv.ParseBool(v)
	if err != nil {
		return false
	}
	return enabled
}

// InitOTel configures the global OpenTelemetry tracer provider with an OTLP
// gRPC exporter. When OTEL_ENABLED is unset or falsy, it returns (nil, nil)
// and the helpers in this package become no-ops.
//
// Environment variables consulted:
//   - OTEL_ENABLED: master opt-in flag
//   - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (default: localhost:4317)
//   - OTEL_EXPORTER_OTLP_INSECURE: if "true", skip TLS (default: true)
//   - OTEL_SERVICE_VERSION: semantic version label (optional)
func InitOTel(serviceName string) (*sdktrace.TracerProvider, error) {
	if !IsEnabled() {
		return nil, nil
	}

	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "localhost:4317"
	}

	opts := []otlptracegrpc.Option{otlptracegrpc.WithEndpoint(endpoint)}
	if insecure, _ := strconv.ParseBool(os.Getenv("OTEL_EXPORTER_OTLP_INSECURE")); insecure || os.Getenv("OTEL_EXPORTER_OTLP_INSECURE") == "" {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exporter, err := otlptrace.New(ctx, otlptracegrpc.NewClient(opts...))
	if err != nil {
		return nil, fmt.Errorf("create otlp exporter: %w", err)
	}

	version := os.Getenv("OTEL_SERVICE_VERSION")
	if version == "" {
		version = "dev"
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(version),
			attribute.String("service.framework", "openllmetry"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("create otel resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	tracerOnce.Do(func() {
		globalTracer = tp.Tracer("llm-gateway/observability")
	})

	return tp, nil
}

// Tracer returns the package tracer. Safe to call even when OTel is disabled;
// in that case a no-op tracer from the global provider is returned.
func Tracer() trace.Tracer {
	if globalTracer != nil {
		return globalTracer
	}
	return otel.Tracer("llm-gateway/observability")
}

// LLMCallAttrs captures the context of a single LLM provider invocation for
// emission as span attributes following the gen_ai.* semantic conventions.
type LLMCallAttrs struct {
	Provider     string
	Model        string
	TenantID     string
	UserID       string
	InputTokens  int
	OutputTokens int
	TotalTokens  int
	CostUSD      float64
	ResponseID   string
}

// TraceLLMGeneration starts a span representing an LLM generation call. The
// caller must invoke span.End() (typically via defer). The returned context
// carries the span so downstream calls are automatically children.
//
// Only the invariant request attributes (system, model, operation) are set up
// front; emit tokens/cost via FinishLLMGeneration once the provider responds.
func TraceLLMGeneration(ctx context.Context, provider, model string) (context.Context, trace.Span) {
	spanName := fmt.Sprintf("gen_ai.completion %s", model)
	ctx, span := Tracer().Start(ctx, spanName, trace.WithSpanKind(trace.SpanKindClient))
	span.SetAttributes(
		attribute.String(AttrGenAISystem, provider),
		attribute.String(AttrGenAIRequestModel, model),
		attribute.String(AttrGenAIOperation, "chat"),
	)
	return ctx, span
}

// FinishLLMGeneration records usage and cost attributes on an active span
// before the caller ends it. Pass zero values for fields that are unknown.
func FinishLLMGeneration(span trace.Span, attrs LLMCallAttrs) {
	if span == nil || !span.IsRecording() {
		return
	}
	kv := []attribute.KeyValue{
		attribute.Int(AttrGenAIInputTokens, attrs.InputTokens),
		attribute.Int(AttrGenAIOutputTokens, attrs.OutputTokens),
		attribute.Int(AttrGenAITotalTokens, attrs.TotalTokens),
		attribute.Float64(AttrLLMCostUSD, attrs.CostUSD),
	}
	if attrs.ResponseID != "" {
		kv = append(kv, attribute.String(AttrGenAIResponseID, attrs.ResponseID))
	}
	if attrs.TenantID != "" {
		kv = append(kv, attribute.String(AttrLLMTenantID, attrs.TenantID))
	}
	if attrs.UserID != "" {
		kv = append(kv, attribute.String(AttrLLMUserID, attrs.UserID))
	}
	span.SetAttributes(kv...)
}
