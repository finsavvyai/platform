package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/discovery"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/health"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

type ClawService struct {
	store           ClawStore
	policyEngine    *policy.PolicyEngine
	serviceRegistry *discovery.ServiceRegistry
	healthRegistry  *health.Registry
	logger          *logrus.Logger
	version         string
}

func NewClawService(
	store ClawStore,
	policyEngine *policy.PolicyEngine,
	serviceRegistry *discovery.ServiceRegistry,
	healthRegistry *health.Registry,
	logger *logrus.Logger,
	version string,
) *ClawService {
	if logger == nil {
		logger = logrus.New()
	}

	return &ClawService{
		store:           store,
		policyEngine:    policyEngine,
		serviceRegistry: serviceRegistry,
		healthRegistry:  healthRegistry,
		logger:          logger,
		version:         version,
	}
}

func (s *ClawService) EnsureSchema(ctx context.Context) error {
	if s == nil || s.store == nil {
		return nil
	}
	return s.store.EnsureSchema(ctx)
}

func (s *ClawService) Capabilities() ClawCapabilitiesResponse {
	return ClawCapabilitiesResponse{
		Status:       "ok",
		Version:      s.version,
		Tools:        clawToolDefinitions(),
		Memory:       map[string]any{"enabled": true, "persisted": true, "search": true},
		DiscoveredAt: time.Now().UTC(),
	}
}

func (app *Application) handleClawHealth(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status":  "unavailable",
			"message": "Claw runtime is not configured",
		})
		return
	}

	ctx := r.Context()
	checks := map[string]any{}
	status := "ok"
	memoryStatus := "ok"
	policyStatus := "disabled"

	if err := service.store.Health(ctx); err != nil {
		status = "degraded"
		memoryStatus = "unhealthy"
		checks["memory_store_error"] = err.Error()
	}

	if service.policyEngine != nil {
		policyStatus = "ok"
		if err := service.policyEngine.Health(ctx); err != nil {
			status = "degraded"
			policyStatus = "degraded"
			checks["policy_engine_error"] = err.Error()
		}
	}

	if service.healthRegistry != nil {
		checks["gateway_health"] = service.healthRegistry.CheckAll(ctx)
	}
	if service.serviceRegistry != nil {
		checks["service_registry"] = service.serviceRegistry.GetRegistryInfo()
	}

	response := ClawHealthResponse{
		Status:          status,
		Version:         service.version,
		MemoryStore:     memoryStatus,
		PolicyEngine:    policyStatus,
		RegisteredSvcs:  registeredServiceCount(service.serviceRegistry),
		Checks:          checks,
		Timestamp:       time.Now().UTC(),
		AvailableTools:  clawToolNames(),
		AvailableMemory: true,
	}

	code := http.StatusOK
	if status != "ok" {
		code = http.StatusServiceUnavailable
	}

	writeClawJSON(w, code, response)
}

func (app *Application) handleClawCapabilities(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status":  "unavailable",
			"message": "Claw runtime is not configured",
		})
		return
	}

	writeClawJSON(w, http.StatusOK, service.Capabilities())
}

func (app *Application) handleClawSessionRegister(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "claw service unavailable"})
		return
	}

	var request ClawSessionRegisterRequest
	if err := decodeClawJSON(r, &request); err != nil {
		writeClawError(w, http.StatusBadRequest, err)
		return
	}

	if strings.TrimSpace(request.SessionID) == "" || strings.TrimSpace(request.TenantID) == "" ||
		strings.TrimSpace(request.UserID) == "" || strings.TrimSpace(request.ProjectID) == "" ||
		strings.TrimSpace(request.Adapter) == "" {
		writeClawError(w, http.StatusBadRequest, fmt.Errorf("session_id, tenant_id, user_id, project_id, and adapter are required"))
		return
	}

	session, err := service.store.RegisterSession(r.Context(), ClawSession{
		SessionID: request.SessionID,
		TenantID:  request.TenantID,
		UserID:    request.UserID,
		ProjectID: request.ProjectID,
		Adapter:   request.Adapter,
		AgentID:   request.AgentID,
		Metadata:  request.Metadata,
	})
	if err != nil {
		writeClawError(w, http.StatusInternalServerError, err)
		return
	}

	writeClawJSON(w, http.StatusOK, session)
}

func (app *Application) handleClawToolsList(w http.ResponseWriter, r *http.Request) {
	writeClawJSON(w, http.StatusOK, map[string]any{
		"tools":     clawToolDefinitions(),
		"timestamp": time.Now().UTC(),
	})
}

func (app *Application) handleClawToolCall(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawJSON(w, http.StatusServiceUnavailable, ClawToolCallResponse{
			Tool:      "unknown",
			Success:   false,
			Error:     "claw service unavailable",
			Timestamp: time.Now().UTC(),
		})
		return
	}

	var request ClawToolCallRequest
	if err := decodeClawJSON(r, &request); err != nil {
		writeClawError(w, http.StatusBadRequest, err)
		return
	}

	request.Tool = strings.TrimSpace(request.Tool)
	if request.Tool == "" {
		writeClawError(w, http.StatusBadRequest, fmt.Errorf("tool is required"))
		return
	}

	response := ClawToolCallResponse{
		Tool:      request.Tool,
		Success:   false,
		Timestamp: time.Now().UTC(),
	}

	var (
		result any
		err    error
	)

	switch request.Tool {
	case "document_search":
		result, err = service.callDocumentSearch(r.Context(), request.Arguments)
	case "rag_query":
		result, err = service.callRAGQuery(r.Context(), request.Arguments)
	case "policy_check":
		result, err = service.callPolicyCheck(r.Context(), request.Arguments)
	case "provider_health":
		result, err = service.callProviderHealth(r.Context())
	case "audit_write":
		result, err = service.callAuditWrite(r.Context(), request.Arguments)
	default:
		err = fmt.Errorf("unsupported tool %q", request.Tool)
	}

	if err != nil {
		response.Error = err.Error()
		writeClawJSON(w, http.StatusBadRequest, response)
		return
	}

	response.Success = true
	response.Result = result
	response.Metadata = map[string]any{
		"tool_count": len(clawToolDefinitions()),
	}
	writeClawJSON(w, http.StatusOK, response)
}

func (app *Application) handleClawMemoryWrite(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawError(w, http.StatusServiceUnavailable, fmt.Errorf("claw service unavailable"))
		return
	}

	var request ClawMemoryWriteRequest
	if err := decodeClawJSON(r, &request); err != nil {
		writeClawError(w, http.StatusBadRequest, err)
		return
	}

	if strings.TrimSpace(request.TenantID) == "" || strings.TrimSpace(request.UserID) == "" ||
		strings.TrimSpace(request.Type) == "" || strings.TrimSpace(request.Content) == "" {
		writeClawError(w, http.StatusBadRequest, fmt.Errorf("tenant_id, user_id, type, and content are required"))
		return
	}

	memory, err := service.store.WriteMemory(r.Context(), request)
	if err != nil {
		writeClawError(w, http.StatusInternalServerError, err)
		return
	}

	writeClawJSON(w, http.StatusCreated, memory)
}

func (app *Application) handleClawMemorySearch(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawError(w, http.StatusServiceUnavailable, fmt.Errorf("claw service unavailable"))
		return
	}

	var request ClawMemorySearchRequest
	if err := decodeClawJSON(r, &request); err != nil {
		writeClawError(w, http.StatusBadRequest, err)
		return
	}

	if strings.TrimSpace(request.TenantID) == "" || strings.TrimSpace(request.UserID) == "" {
		writeClawError(w, http.StatusBadRequest, fmt.Errorf("tenant_id and user_id are required"))
		return
	}

	results, err := service.store.SearchMemories(r.Context(), request)
	if err != nil {
		writeClawError(w, http.StatusInternalServerError, err)
		return
	}

	writeClawJSON(w, http.StatusOK, map[string]any{
		"count":      len(results),
		"memories":   results,
		"query":      request.Query,
		"session_id": request.SessionID,
	})
}

func (app *Application) handleClawMemoryGet(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawError(w, http.StatusServiceUnavailable, fmt.Errorf("claw service unavailable"))
		return
	}

	tenantID := strings.TrimSpace(r.URL.Query().Get("tenant_id"))
	userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
	memoryID := chi.URLParam(r, "id")
	if tenantID == "" || userID == "" || memoryID == "" {
		writeClawError(w, http.StatusBadRequest, fmt.Errorf("tenant_id, user_id, and memory id are required"))
		return
	}

	memory, err := service.store.GetMemory(r.Context(), tenantID, userID, memoryID)
	if err != nil {
		if errors.Is(err, errClawMemoryNotFound) {
			writeClawError(w, http.StatusNotFound, err)
			return
		}
		writeClawError(w, http.StatusInternalServerError, err)
		return
	}

	writeClawJSON(w, http.StatusOK, memory)
}

func (app *Application) handleClawMemoryDelete(w http.ResponseWriter, r *http.Request) {
	service := app.clawService()
	if service == nil {
		writeClawError(w, http.StatusServiceUnavailable, fmt.Errorf("claw service unavailable"))
		return
	}

	tenantID := strings.TrimSpace(r.URL.Query().Get("tenant_id"))
	userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
	memoryID := chi.URLParam(r, "id")
	if tenantID == "" || userID == "" || memoryID == "" {
		writeClawError(w, http.StatusBadRequest, fmt.Errorf("tenant_id, user_id, and memory id are required"))
		return
	}

	if err := service.store.DeleteMemory(r.Context(), tenantID, userID, memoryID); err != nil {
		if errors.Is(err, errClawMemoryNotFound) {
			writeClawError(w, http.StatusNotFound, err)
			return
		}
		writeClawError(w, http.StatusInternalServerError, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *ClawService) callDocumentSearch(ctx context.Context, arguments map[string]any) (any, error) {
	request, err := decodeToolArguments[ClawDocumentSearchRequest](arguments)
	if err != nil {
		return nil, err
	}
	results, err := s.store.SearchDocuments(ctx, request)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"query":     request.Query,
		"count":     len(results),
		"documents": results,
	}, nil
}

func (s *ClawService) callRAGQuery(ctx context.Context, arguments map[string]any) (any, error) {
	request, err := decodeToolArguments[ClawRAGQueryRequest](arguments)
	if err != nil {
		return nil, err
	}
	results, err := s.store.RAGQuery(ctx, request)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"query":   request.Query,
		"count":   len(results),
		"results": results,
	}, nil
}

func (s *ClawService) callPolicyCheck(ctx context.Context, arguments map[string]any) (any, error) {
	if s.policyEngine == nil {
		return nil, fmt.Errorf("policy engine is not configured")
	}

	request, err := decodeToolArguments[ClawPolicyCheckRequest](arguments)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(request.Query) == "" {
		return nil, fmt.Errorf("query is required")
	}

	decision, err := s.policyEngine.EvaluatePolicy(ctx, policy.PolicyInput{
		Query:     request.Query,
		Data:      request.Data,
		TenantID:  request.TenantID,
		UserID:    request.UserID,
		RequestID: request.RequestID,
		Action:    request.Action,
		Resource:  request.Resource,
		Context:   request.Context,
	})
	if err != nil {
		return nil, err
	}

	return decision, nil
}

func (s *ClawService) callProviderHealth(ctx context.Context) (any, error) {
	result := map[string]any{
		"status":      "ok",
		"timestamp":   time.Now().UTC(),
		"services":    map[string]any{},
		"policy":      "disabled",
		"gateway_env": s.version,
	}

	if s.healthRegistry != nil {
		result["gateway_health"] = s.healthRegistry.CheckAll(ctx)
	}
	if s.serviceRegistry != nil {
		result["services"] = s.serviceRegistry.GetRegistryInfo()
	}
	if s.policyEngine != nil {
		if err := s.policyEngine.Health(ctx); err != nil {
			result["status"] = "degraded"
			result["policy"] = map[string]any{"status": "degraded", "error": err.Error()}
		} else {
			result["policy"] = "ok"
		}
	}

	return result, nil
}

func (s *ClawService) callAuditWrite(ctx context.Context, arguments map[string]any) (any, error) {
	request, err := decodeToolArguments[ClawAuditWriteRequest](arguments)
	if err != nil {
		return nil, err
	}
	auditID, err := s.store.WriteAudit(ctx, request)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"audit_id":   auditID,
		"created_at": time.Now().UTC(),
	}, nil
}

func (app *Application) clawService() *ClawService {
	return app.Claw
}

func writeClawJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeClawError(w http.ResponseWriter, status int, err error) {
	writeClawJSON(w, status, map[string]any{
		"error":     err.Error(),
		"timestamp": time.Now().UTC(),
	})
}

func decodeClawJSON(r *http.Request, target any) error {
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	return nil
}

func decodeToolArguments[T any](arguments map[string]any) (T, error) {
	var target T
	data, err := json.Marshal(arguments)
	if err != nil {
		return target, fmt.Errorf("encode tool arguments: %w", err)
	}
	if err := json.Unmarshal(data, &target); err != nil {
		return target, fmt.Errorf("decode tool arguments: %w", err)
	}
	return target, nil
}

func registeredServiceCount(registry *discovery.ServiceRegistry) int {
	if registry == nil {
		return 0
	}
	return len(registry.ListServices())
}

func clawToolNames() []string {
	definitions := clawToolDefinitions()
	names := make([]string, 0, len(definitions))
	for _, definition := range definitions {
		names = append(names, definition.Name)
	}
	return names
}

func clawToolDefinitions() []ClawToolDefinition {
	return []ClawToolDefinition{
		{
			Name:        "document_search",
			Description: "Search tenant documents by filename, content type, classification, or status",
			InputSchema: map[string]any{
				"type": "object",
				"required": []string{"tenant_id", "query"},
			},
		},
		{
			Name:        "rag_query",
			Description: "Retrieve relevant document chunks for a tenant using PostgreSQL full-text search",
			InputSchema: map[string]any{
				"type": "object",
				"required": []string{"tenant_id", "query"},
			},
		},
		{
			Name:        "policy_check",
			Description: "Evaluate an SDLC policy decision with the configured policy engine",
			InputSchema: map[string]any{
				"type": "object",
				"required": []string{"tenant_id", "user_id", "query", "action", "resource"},
			},
		},
		{
			Name:        "provider_health",
			Description: "Inspect gateway health, policy health, and registered upstream services",
			InputSchema: map[string]any{
				"type": "object",
			},
		},
		{
			Name:        "audit_write",
			Description: "Write a compliance audit record to the SDLC audit log",
			InputSchema: map[string]any{
				"type": "object",
				"required": []string{"tenant_id", "action", "resource_type"},
			},
		},
	}
}
