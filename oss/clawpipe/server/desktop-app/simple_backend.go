package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

var (
	// clusterMasterURL is the base URL for the Python cluster master
	clusterMasterURL string
	// gatewayURL is the base URL for the Python API gateway
	gatewayURL string
	// startTime tracks when the backend started
	startTime = time.Now()
)

func initConfig() {
	_ = godotenv.Load()

	clusterMasterURL = envOrDefault("FINSAVVYAI_MASTER_URL", "http://localhost:5555")
	gatewayURL = envOrDefault("FINSAVVYAI_GATEWAY_URL", "http://localhost:5000")
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Node struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Status  string    `json:"status"`
	IP      string    `json:"ip"`
	CPU     float64   `json:"cpu"`
	Memory  float64   `json:"memory"`
	AddedAt time.Time `json:"added_at"`
}

type AIProvider struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	APIKey  string `json:"api_key,omitempty"`
	BaseURL string `json:"base_url,omitempty"`
	Model   string `json:"model"`
	Enabled bool   `json:"enabled"`
}

type AIRequest struct {
	Prompt   string `json:"prompt"`
	Provider string `json:"provider,omitempty"`
	Stream   bool   `json:"stream,omitempty"`
}

type AIResponse struct {
	Response  string    `json:"response"`
	Provider  string    `json:"provider"`
	Model     string    `json:"model"`
	Tokens    int       `json:"tokens,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Error     string    `json:"error,omitempty"`
}

type LocalModel struct {
	Name         string `json:"name"`
	ID           string `json:"id"`
	Size         string `json:"size"`
	Description  string `json:"description"`
	DownloadURL  string `json:"download_url"`
	Installed    bool   `json:"installed"`
	Path         string `json:"path"`
	Provider     string `json:"provider"`
	Parameters   int    `json:"parameters"`
	Quantization string `json:"quantization"`
}

type ModelDownloadProgress struct {
	ModelID  string  `json:"model_id"`
	Progress float64 `json:"progress"`
	Status   string  `json:"status"`
	Speed    string  `json:"speed"`
	ETA      string  `json:"eta"`
	Error    string  `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// AI Providers
// ---------------------------------------------------------------------------

var aiProviders = []AIProvider{
	{Name: "FinSavvyAI Cluster", Type: "cluster", BaseURL: "", Model: "auto", Enabled: true},
	{Name: "OpenAI GPT-4", Type: "openai", Model: "gpt-4", BaseURL: "https://api.openai.com/v1", Enabled: true},
	{Name: "OpenAI GPT-3.5", Type: "openai", Model: "gpt-3.5-turbo", BaseURL: "https://api.openai.com/v1", Enabled: true},
	{Name: "Anthropic Claude", Type: "anthropic", Model: "claude-3-sonnet-20240229", BaseURL: "https://api.anthropic.com", Enabled: true},
	{Name: "Ollama Local", Type: "ollama", Model: "llama2", BaseURL: "http://localhost:11434", Enabled: false},
}

// ---------------------------------------------------------------------------
// Available GGUF models for download
// ---------------------------------------------------------------------------

var availableModels = []LocalModel{
	{Name: "Mistral 7B Instruct", ID: "mistral-7b-instruct", Size: "4.1GB", Description: "High-quality instruction-tuned model, excellent for general tasks", DownloadURL: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf", Provider: "Mistral AI", Parameters: 7, Quantization: "Q4_K_M"},
	{Name: "Llama 2 7B Chat", ID: "llama2-7b-chat", Size: "3.8GB", Description: "Meta's Llama 2 fine-tuned for chat conversations", DownloadURL: "https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf", Provider: "Meta", Parameters: 7, Quantization: "Q4_K_M"},
	{Name: "GLM 6B Chat", ID: "chatglm3-6b", Size: "3.2GB", Description: "THUDM's General Language Model optimized for Chinese and English", DownloadURL: "https://huggingface.co/TheBloke/ChatGLM3-6B-GGUF/resolve/main/chatglm3-6b.Q4_K_M.gguf", Provider: "THUDM", Parameters: 6, Quantization: "Q4_K_M"},
	{Name: "GLM4 9B Chat", ID: "glm4-9b-chat", Size: "5.1GB", Description: "Zhipu AI's latest GLM4 - superior reasoning, coding, and multilingual", DownloadURL: "https://huggingface.co/TheBloke/GLM4-9B-Chat-GGUF/resolve/main/glm4-9b-chat.Q4_K_M.gguf", Provider: "Zhipu AI", Parameters: 9, Quantization: "Q4_K_M"},
	{Name: "Phi-2 Mini", ID: "phi-2", Size: "1.6GB", Description: "Microsoft's small but powerful model for reasoning and coding", DownloadURL: "https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf", Provider: "Microsoft", Parameters: 3, Quantization: "Q4_K_M"},
	{Name: "Qwen 7B Chat", ID: "qwen-7b-chat", Size: "4.1GB", Description: "Alibaba's multilingual chat model", DownloadURL: "https://huggingface.co/TheBloke/Qwen-7B-Chat-GGUF/resolve/main/qwen7b-chat.Q4_K_M.gguf", Provider: "Alibaba", Parameters: 7, Quantization: "Q4_K_M"},
}

var (
	downloadProgress   = make(map[string]ModelDownloadProgress)
	downloadProgressMu sync.RWMutex
)

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		// Allow localhost origins only
		return strings.HasPrefix(origin, "http://localhost") ||
			strings.HasPrefix(origin, "http://127.0.0.1") ||
			strings.HasPrefix(origin, "https://localhost") ||
			strings.HasPrefix(origin, "https://127.0.0.1")
	},
}

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" &&
			(strings.HasPrefix(origin, "http://localhost") ||
				strings.HasPrefix(origin, "http://127.0.0.1")) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "3600")
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

func main() {
	logrus.SetFormatter(&logrus.JSONFormatter{})
	logrus.SetLevel(logrus.InfoLevel)

	initConfig()

	mux := http.NewServeMux()

	// Serve the single production HTML
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, "src-frontend/index.html")
	})

	// API routes
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/nodes", nodesRouter)
	mux.HandleFunc("/api/cluster/status", clusterStatusHandler)
	mux.HandleFunc("/api/config", configHandler)
	mux.HandleFunc("/api/metrics", metricsHandler)
	mux.HandleFunc("/api/logs", logsHandler)
	mux.HandleFunc("/api/performance", performanceHandler)
	mux.HandleFunc("/api/alerts", alertsHandler)
	mux.HandleFunc("/api/deployments", deploymentsHandler)
	mux.HandleFunc("/api/system/info", systemInfoHandler)
	mux.HandleFunc("/api/ai/chat", aiChatHandler)
	mux.HandleFunc("/api/models", modelsHandler)
	mux.HandleFunc("/api/models/download", downloadModelHandler)
	mux.HandleFunc("/api/models/delete", deleteModelHandler)
	mux.HandleFunc("/api/models/progress", downloadProgressHandler)
	mux.HandleFunc("/ws", websocketHandler)

	handler := corsMiddleware(mux)

	port := envOrDefault("PORT", "8080")

	logrus.WithField("port", port).Info("Starting FinSavvyAI Desktop Backend")
	log.Printf("FinSavvyAI Desktop Backend listening on port %s", port)
	log.Printf("Frontend: http://localhost:%s", port)
	log.Printf("Cluster master: %s", clusterMasterURL)
	log.Printf("Gateway: %s", gatewayURL)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		logrus.WithError(err).Fatal("Failed to start server")
	}
}

// ---------------------------------------------------------------------------
// Helpers for proxying to the Python cluster
// ---------------------------------------------------------------------------

var httpClient = &http.Client{Timeout: 10 * time.Second}

// proxyGet fetches JSON from the cluster master and returns the decoded body.
// Returns nil, err if the master is unreachable.
func proxyGet(url string) (map[string]interface{}, error) {
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// writeJSON is a helper that writes JSON to the response.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

func healthHandler(w http.ResponseWriter, r *http.Request) {
	// Check cluster master connectivity
	clusterHealthy := false
	if data, err := proxyGet(clusterMasterURL + "/health"); err == nil {
		if s, ok := data["status"].(string); ok && s == "ok" {
			clusterHealthy = true
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":            "healthy",
		"service":           "FinSavvyAI Desktop Backend",
		"version":           "1.0.0",
		"timestamp":         time.Now(),
		"cluster_master":    clusterMasterURL,
		"cluster_reachable": clusterHealthy,
		"uptime":            time.Since(startTime).String(),
	})
}

// ---------------------------------------------------------------------------
// Nodes - proxy to real cluster master
// ---------------------------------------------------------------------------

func nodesRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		nodesHandler(w, r)
	case "POST":
		addNodeHandler(w, r)
	case "DELETE":
		removeNodeHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func nodesHandler(w http.ResponseWriter, r *http.Request) {
	// Try to fetch real nodes from cluster master
	data, err := proxyGet(clusterMasterURL + "/cluster/nodes")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	// Fallback: cluster unreachable
	logrus.WithError(err).Warn("Cluster master unreachable, returning empty nodes")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"nodes": []interface{}{},
		"total": 0,
		"error": "Cluster master unreachable",
	})
}

func addNodeHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	// Forward to cluster master
	resp, err := httpClient.Post(clusterMasterURL+"/cluster/nodes", "application/json", bytes.NewBuffer(body))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Cluster master unreachable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

func removeNodeHandler(w http.ResponseWriter, r *http.Request) {
	nodeID := r.URL.Query().Get("id")
	if nodeID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Node ID is required"})
		return
	}

	req, _ := http.NewRequest("DELETE", clusterMasterURL+"/cluster/nodes?id="+nodeID, nil)
	resp, err := httpClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Cluster master unreachable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

// ---------------------------------------------------------------------------
// Cluster Status - proxy to real master
// ---------------------------------------------------------------------------

func clusterStatusHandler(w http.ResponseWriter, r *http.Request) {
	data, err := proxyGet(clusterMasterURL + "/cluster/status")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	// Fallback when cluster is unreachable
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"cluster_id": "finsavvy-cluster-main",
		"master":     clusterMasterURL,
		"is_running": false,
		"status":     "unreachable",
		"nodes":      0,
		"uptime":     "N/A",
		"version":    "1.0.0",
		"timestamp":  time.Now(),
		"error":      "Cluster master unreachable: " + err.Error(),
	})
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

func configHandler(w http.ResponseWriter, r *http.Request) {
	// Try real config from master
	data, err := proxyGet(clusterMasterURL + "/cluster/config")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	// Fallback with local defaults
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"cluster": map[string]interface{}{
			"name":         "FinSavvyAI Cluster",
			"master_url":   clusterMasterURL,
			"gateway_url":  gatewayURL,
			"max_nodes":    10,
			"auto_scaling": false,
		},
		"api": map[string]interface{}{
			"timeout":    30,
			"retries":    3,
			"rate_limit": 1000,
		},
		"monitoring": map[string]interface{}{
			"interval":  5,
			"retention": "7d",
			"alerts":    true,
		},
	})
}

// ---------------------------------------------------------------------------
// Metrics - proxy to real master or gateway
// ---------------------------------------------------------------------------

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	// Try gateway metrics first
	data, err := proxyGet(gatewayURL + "/metrics")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	// Try master metrics
	data, err = proxyGet(clusterMasterURL + "/metrics")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	// Fallback
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total_nodes":      0,
		"active_nodes":     0,
		"avg_cpu_usage":    0,
		"avg_memory_usage": 0,
		"error":            "Cluster unreachable",
	})
}

// ---------------------------------------------------------------------------
// Logs - proxy to master
// ---------------------------------------------------------------------------

func logsHandler(w http.ResponseWriter, r *http.Request) {
	data, err := proxyGet(clusterMasterURL + "/logs")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs":  []interface{}{},
		"total": 0,
		"error": "Cluster unreachable",
	})
}

// ---------------------------------------------------------------------------
// Performance - proxy to gateway
// ---------------------------------------------------------------------------

func performanceHandler(w http.ResponseWriter, r *http.Request) {
	data, err := proxyGet(gatewayURL + "/performance")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"response_times": map[string]interface{}{"avg_ms": 0, "p95_ms": 0, "p99_ms": 0},
		"throughput":     map[string]interface{}{"requests_per_second": 0, "peak_rps": 0},
		"error":          "Gateway unreachable",
	})
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	data, err := proxyGet(clusterMasterURL + "/alerts")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"alerts": []interface{}{},
		"total":  0,
		"active": 0,
		"error":  "Cluster unreachable",
	})
}

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

func deploymentsHandler(w http.ResponseWriter, r *http.Request) {
	data, err := proxyGet(clusterMasterURL + "/deployments")
	if err == nil {
		writeJSON(w, http.StatusOK, data)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"deployments": []interface{}{},
		"total":       0,
		"error":       "Cluster unreachable",
	})
}

// ---------------------------------------------------------------------------
// System Info
// ---------------------------------------------------------------------------

func systemInfoHandler(w http.ResponseWriter, r *http.Request) {
	// Aggregate from master if available
	masterInfo, masterErr := proxyGet(clusterMasterURL + "/cluster/status")

	totalNodes := 0
	activeNodes := 0
	clusterStatus := "unreachable"
	if masterErr == nil {
		if n, ok := masterInfo["total_workers"]; ok {
			totalNodes = int(n.(float64))
		}
		if n, ok := masterInfo["online_workers"]; ok {
			activeNodes = int(n.(float64))
		}
		clusterStatus = "connected"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"cluster": map[string]interface{}{
			"name":        "FinSavvyAI Production Cluster",
			"version":     "1.0.0",
			"master_url":  clusterMasterURL,
			"gateway_url": gatewayURL,
			"environment": envOrDefault("FINSAVVYAI_ENV", "development"),
			"status":      clusterStatus,
		},
		"system": map[string]interface{}{
			"backend":    "Go",
			"os":         "darwin",
			"uptime":     time.Since(startTime).String(),
			"build_time": startTime,
		},
		"features": []string{
			"Real-time monitoring",
			"Cluster proxy",
			"Node management",
			"AI inference (local + cloud)",
			"WebSocket updates",
			"Model download manager",
		},
		"resources": map[string]interface{}{
			"total_nodes":  totalNodes,
			"active_nodes": activeNodes,
		},
	})
}

// ---------------------------------------------------------------------------
// WebSocket - with ping/pong keepalive
// ---------------------------------------------------------------------------

func websocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Println("WebSocket client connected")

	// Configure ping/pong keepalive
	conn.SetReadDeadline(time.Now().Add(90 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		return nil
	})

	// Read pump (handles pong responses and client messages)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				return
			}
		}
	}()

	// Write pump: send pings and periodic metrics
	pingTicker := time.NewTicker(30 * time.Second)
	metricsTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()
	defer metricsTicker.Stop()

	for {
		select {
		case <-done:
			return
		case <-pingTicker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("WebSocket ping error: %v", err)
				return
			}
		case <-metricsTicker.C:
			metrics := fetchLiveMetrics()
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteJSON(metrics); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}
}

// fetchLiveMetrics gets real metrics from the cluster or returns zeros.
func fetchLiveMetrics() map[string]interface{} {
	update := map[string]interface{}{
		"type":      "metrics_update",
		"timestamp": time.Now(),
	}

	// Try real metrics from gateway health endpoint
	data, err := proxyGet(gatewayURL + "/health")
	if err == nil {
		if ws, ok := data["workers_summary"].(map[string]interface{}); ok {
			update["nodes"] = ws["online"]
			update["total_nodes"] = ws["total"]
		}
	}

	// Try real metrics from master
	data, err = proxyGet(clusterMasterURL + "/metrics")
	if err == nil {
		for _, key := range []string{"cpu_usage", "memory_usage", "requests_per_second", "error_rate", "network_throughput"} {
			if v, ok := data[key]; ok {
				update[key] = v
			}
		}
		return update
	}

	// Fallback: zeros (cluster offline)
	if _, ok := update["nodes"]; !ok {
		update["nodes"] = 0
	}
	update["cpu_usage"] = float64(0)
	update["memory_usage"] = float64(0)
	update["requests_per_second"] = 0
	update["error_rate"] = float64(0)
	update["network_throughput"] = float64(0)

	return update
}

// ---------------------------------------------------------------------------
// AI Chat - routes to cluster inference or external providers
// ---------------------------------------------------------------------------

func aiChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var request AIRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}
	if request.Prompt == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Prompt is required"})
		return
	}

	aiResponse := generateAIResponse(request.Prompt, request.Provider)

	response := map[string]interface{}{
		"response":  aiResponse.Response,
		"prompt":    request.Prompt,
		"timestamp": aiResponse.Timestamp,
		"provider":  aiResponse.Provider,
		"model":     aiResponse.Model,
	}
	if aiResponse.Tokens > 0 {
		response["tokens"] = aiResponse.Tokens
	}

	status := http.StatusOK
	if aiResponse.Error != "" {
		response["error"] = aiResponse.Error
		status = http.StatusPartialContent
	}
	writeJSON(w, status, response)
}

func generateAIResponse(prompt, providerName string) AIResponse {
	// Find the requested provider
	var selectedProvider *AIProvider
	if providerName != "" {
		for i := range aiProviders {
			if aiProviders[i].Name == providerName && aiProviders[i].Enabled {
				selectedProvider = &aiProviders[i]
				break
			}
		}
	}
	if selectedProvider == nil {
		for i := range aiProviders {
			if aiProviders[i].Enabled {
				selectedProvider = &aiProviders[i]
				break
			}
		}
	}
	if selectedProvider == nil {
		return AIResponse{
			Response:  "No AI providers configured.",
			Provider:  "none",
			Model:     "none",
			Timestamp: time.Now(),
			Error:     "No providers available",
		}
	}

	switch selectedProvider.Type {
	case "cluster":
		return callClusterInference(prompt, selectedProvider)
	case "openai":
		return callOpenAI(prompt, selectedProvider)
	case "anthropic":
		return callAnthropic(prompt, selectedProvider)
	case "ollama":
		return callOllama(prompt, selectedProvider)
	default:
		return AIResponse{
			Response:  fmt.Sprintf("Unknown provider type: %s", selectedProvider.Type),
			Provider:  selectedProvider.Name,
			Model:     selectedProvider.Model,
			Timestamp: time.Now(),
			Error:     "Unknown provider",
		}
	}
}

// callClusterInference calls the real Python cluster's /v1/chat/completions.
func callClusterInference(prompt string, provider *AIProvider) AIResponse {
	requestBody := map[string]interface{}{
		"model": "auto",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a helpful AI assistant for FinSavvyAI distributed cluster management."},
			{"role": "user", "content": prompt},
		},
		"max_tokens":  1000,
		"temperature": 0.7,
	}
	jsonBody, _ := json.Marshal(requestBody)

	inferenceClient := &http.Client{Timeout: 120 * time.Second}
	resp, err := inferenceClient.Post(gatewayURL+"/v1/chat/completions", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return AIResponse{
			Response:  fmt.Sprintf("Cluster inference unavailable: %v. Try using an external provider (OpenAI, Anthropic) or start the cluster.", err),
			Provider:  "FinSavvyAI Cluster",
			Model:     "none",
			Timestamp: time.Now(),
			Error:     "Cluster unreachable",
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return AIResponse{
			Response:  "Failed to parse cluster response.",
			Provider:  "FinSavvyAI Cluster",
			Model:     "unknown",
			Timestamp: time.Now(),
			Error:     "Parse error",
		}
	}

	// Extract from OpenAI-compatible response format
	if choices, ok := result["choices"].([]interface{}); ok && len(choices) > 0 {
		choice := choices[0].(map[string]interface{})
		if msg, ok := choice["message"].(map[string]interface{}); ok {
			content := msg["content"].(string)
			modelName := "local"
			if m, ok := result["model"].(string); ok {
				modelName = m
			}
			tokens := 0
			if usage, ok := result["usage"].(map[string]interface{}); ok {
				if t, ok := usage["total_tokens"].(float64); ok {
					tokens = int(t)
				}
			}
			return AIResponse{
				Response:  content,
				Provider:  "FinSavvyAI Cluster",
				Model:     modelName,
				Tokens:    tokens,
				Timestamp: time.Now(),
			}
		}
	}

	// If the response has a direct "response" field (simulated mode)
	if resp, ok := result["response"].(string); ok {
		return AIResponse{
			Response:  resp,
			Provider:  "FinSavvyAI Cluster",
			Model:     "simulated",
			Timestamp: time.Now(),
		}
	}

	return AIResponse{
		Response:  "Unexpected response format from cluster.",
		Provider:  "FinSavvyAI Cluster",
		Model:     "unknown",
		Timestamp: time.Now(),
		Error:     "Unexpected format",
	}
}

// callOpenAI calls the OpenAI API.
func callOpenAI(prompt string, provider *AIProvider) AIResponse {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return AIResponse{
			Response:  "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
			Provider:  provider.Name,
			Model:     provider.Model,
			Timestamp: time.Now(),
			Error:     "Missing API key",
		}
	}

	requestBody := map[string]interface{}{
		"model": provider.Model,
		"messages": []map[string]string{
			{"role": "system", "content": "You are a helpful AI assistant for FinSavvyAI distributed cluster management."},
			{"role": "user", "content": prompt},
		},
		"max_tokens":  1000,
		"temperature": 0.7,
	}
	jsonBody, _ := json.Marshal(requestBody)

	req, err := http.NewRequest("POST", provider.BaseURL+"/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return AIResponse{Response: fmt.Sprintf("Error: %v", err), Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Request error"}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return AIResponse{Response: fmt.Sprintf("Error calling OpenAI: %v", err), Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "API call error"}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return AIResponse{Response: "Failed to parse OpenAI response.", Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Parse error"}
	}

	choices, ok := response["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return AIResponse{Response: "No response from OpenAI.", Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Empty response"}
	}

	choice := choices[0].(map[string]interface{})
	message := choice["message"].(map[string]interface{})
	content := message["content"].(string)

	tokens := 0
	if usage, ok := response["usage"].(map[string]interface{}); ok {
		if t, ok := usage["total_tokens"].(float64); ok {
			tokens = int(t)
		}
	}

	return AIResponse{Response: content, Provider: provider.Name, Model: provider.Model, Tokens: tokens, Timestamp: time.Now()}
}

// callAnthropic calls the Anthropic API.
func callAnthropic(prompt string, provider *AIProvider) AIResponse {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return AIResponse{
			Response:  "Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.",
			Provider:  provider.Name,
			Model:     provider.Model,
			Timestamp: time.Now(),
			Error:     "Missing API key",
		}
	}

	requestBody := map[string]interface{}{
		"model":      provider.Model,
		"max_tokens": 1000,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"system": "You are a helpful AI assistant for FinSavvyAI distributed cluster management.",
	}
	jsonBody, _ := json.Marshal(requestBody)

	req, err := http.NewRequest("POST", provider.BaseURL+"/v1/messages", bytes.NewBuffer(jsonBody))
	if err != nil {
		return AIResponse{Response: fmt.Sprintf("Error: %v", err), Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Request error"}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return AIResponse{Response: fmt.Sprintf("Error calling Anthropic: %v", err), Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "API call error"}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return AIResponse{Response: "Failed to parse Anthropic response.", Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Parse error"}
	}

	contentArr, ok := response["content"].([]interface{})
	if !ok || len(contentArr) == 0 {
		return AIResponse{Response: "No response from Anthropic.", Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Empty response"}
	}

	content := contentArr[0].(map[string]interface{})["text"].(string)

	tokens := 0
	if usage, ok := response["usage"].(map[string]interface{}); ok {
		in, _ := usage["input_tokens"].(float64)
		out, _ := usage["output_tokens"].(float64)
		tokens = int(in) + int(out)
	}

	return AIResponse{Response: content, Provider: provider.Name, Model: provider.Model, Tokens: tokens, Timestamp: time.Now()}
}

// callOllama calls a local Ollama instance.
func callOllama(prompt string, provider *AIProvider) AIResponse {
	requestBody := map[string]interface{}{
		"model":  provider.Model,
		"prompt": prompt,
		"stream": false,
		"system": "You are a helpful AI assistant for FinSavvyAI distributed cluster management.",
	}
	jsonBody, _ := json.Marshal(requestBody)

	req, err := http.NewRequest("POST", provider.BaseURL+"/api/generate", bytes.NewBuffer(jsonBody))
	if err != nil {
		return AIResponse{Response: fmt.Sprintf("Error: %v", err), Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Request error"}
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return AIResponse{
			Response:  fmt.Sprintf("Ollama unreachable: %v. Make sure Ollama is running on %s", err, provider.BaseURL),
			Provider:  provider.Name,
			Model:     provider.Model,
			Timestamp: time.Now(),
			Error:     "API call error",
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return AIResponse{Response: "Failed to parse Ollama response.", Provider: provider.Name, Model: provider.Model, Timestamp: time.Now(), Error: "Parse error"}
	}

	content, _ := response["response"].(string)
	return AIResponse{Response: content, Provider: provider.Name, Model: provider.Model, Timestamp: time.Now()}
}

// ---------------------------------------------------------------------------
// Model Management
// ---------------------------------------------------------------------------

func getModelsDir() string {
	modelsDir := os.Getenv("FINSAVVYAI_MODELS_DIR")
	if modelsDir == "" {
		homeDir, _ := os.UserHomeDir()
		modelsDir = filepath.Join(homeDir, "finsavvyai-models")
	}
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		log.Printf("Failed to create models directory: %v", err)
		return "./models"
	}
	return modelsDir
}

func scanInstalledModels() {
	modelsDir := getModelsDir()
	for i := range availableModels {
		model := &availableModels[i]
		modelPath := filepath.Join(modelsDir, model.ID+".gguf")
		if _, err := os.Stat(modelPath); err == nil {
			model.Installed = true
			model.Path = modelPath
		} else {
			model.Installed = false
			model.Path = ""
		}
	}
}

func downloadModel(modelID string) error {
	modelsDir := getModelsDir()

	var targetModel *LocalModel
	for i := range availableModels {
		if availableModels[i].ID == modelID {
			targetModel = &availableModels[i]
			break
		}
	}
	if targetModel == nil {
		return fmt.Errorf("model not found: %s", modelID)
	}
	if targetModel.Installed {
		return fmt.Errorf("model already installed: %s", modelID)
	}

	downloadProgressMu.Lock()
	downloadProgress[modelID] = ModelDownloadProgress{ModelID: modelID, Progress: 0, Status: "downloading", Speed: "0 KB/s", ETA: "calculating..."}
	downloadProgressMu.Unlock()

	outputPath := filepath.Join(modelsDir, targetModel.ID+".gguf")

	resp, err := http.Get(targetModel.DownloadURL)
	if err != nil {
		downloadProgressMu.Lock()
		downloadProgress[modelID] = ModelDownloadProgress{ModelID: modelID, Status: "error", Error: err.Error()}
		downloadProgressMu.Unlock()
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err := fmt.Errorf("download failed with status: %s", resp.Status)
		downloadProgressMu.Lock()
		downloadProgress[modelID] = ModelDownloadProgress{ModelID: modelID, Status: "error", Error: err.Error()}
		downloadProgressMu.Unlock()
		return err
	}

	out, err := os.Create(outputPath)
	if err != nil {
		downloadProgressMu.Lock()
		downloadProgress[modelID] = ModelDownloadProgress{ModelID: modelID, Status: "error", Error: err.Error()}
		downloadProgressMu.Unlock()
		return err
	}
	defer out.Close()

	contentLength := resp.ContentLength
	buffer := make([]byte, 64*1024) // 64KB buffer
	var downloaded int64
	startTime := time.Now()

	for {
		n, readErr := resp.Body.Read(buffer)
		if n > 0 {
			wrote, _ := out.Write(buffer[:n])
			downloaded += int64(wrote)

			progress := float64(downloaded) / float64(contentLength) * 100
			elapsed := time.Since(startTime).Seconds()
			speed := float64(downloaded) / elapsed / 1024

			downloadProgressMu.Lock()
			downloadProgress[modelID] = ModelDownloadProgress{
				ModelID:  modelID,
				Progress: progress,
				Status:   "downloading",
				Speed:    fmt.Sprintf("%.1f KB/s", speed),
				ETA:      fmt.Sprintf("%.0f sec", float64(contentLength-downloaded)/speed/1024),
			}
			downloadProgressMu.Unlock()
		}
		if readErr != nil {
			break
		}
	}

	// Clean up partial download on error
	if downloaded < contentLength && contentLength > 0 {
		out.Close()
		os.Remove(outputPath)
		downloadProgressMu.Lock()
		downloadProgress[modelID] = ModelDownloadProgress{ModelID: modelID, Status: "error", Error: "Download incomplete"}
		downloadProgressMu.Unlock()
		return fmt.Errorf("download incomplete: got %d of %d bytes", downloaded, contentLength)
	}

	targetModel.Installed = true
	targetModel.Path = outputPath
	downloadProgressMu.Lock()
	downloadProgress[modelID] = ModelDownloadProgress{ModelID: modelID, Progress: 100, Status: "completed", Speed: "completed", ETA: "0 sec"}
	downloadProgressMu.Unlock()

	log.Printf("Model %s downloaded successfully to %s", modelID, outputPath)
	return nil
}

func deleteModel(modelID string) error {
	for i := range availableModels {
		model := &availableModels[i]
		if model.ID == modelID && model.Installed {
			if err := os.Remove(model.Path); err != nil {
				return err
			}
			model.Installed = false
			model.Path = ""
			downloadProgressMu.Lock()
			delete(downloadProgress, modelID)
			downloadProgressMu.Unlock()
			return nil
		}
	}
	return fmt.Errorf("model not found or not installed: %s", modelID)
}

// ---------------------------------------------------------------------------
// Model Management API Handlers
// ---------------------------------------------------------------------------

func modelsHandler(w http.ResponseWriter, r *http.Request) {
	scanInstalledModels()

	totalInstalled := 0
	var totalSize int64
	for _, model := range availableModels {
		if model.Installed {
			totalInstalled++
			if info, err := os.Stat(model.Path); err == nil {
				totalSize += info.Size()
			}
		}
	}

	sizeStr := fmt.Sprintf("%.1f MB", float64(totalSize)/(1024*1024))
	if totalSize >= 1024*1024*1024 {
		sizeStr = fmt.Sprintf("%.1f GB", float64(totalSize)/(1024*1024*1024))
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"available":       availableModels,
		"models_dir":      getModelsDir(),
		"total_installed": totalInstalled,
		"total_size":      sizeStr,
	})
}

func downloadModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var request map[string]string
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	modelID := request["model_id"]
	if modelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model_id is required"})
		return
	}

	go func() {
		if err := downloadModel(modelID); err != nil {
			log.Printf("Failed to download model %s: %v", modelID, err)
		}
	}()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  fmt.Sprintf("Download started for model: %s", modelID),
		"model_id": modelID,
	})
}

func deleteModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	modelID := r.URL.Query().Get("model_id")
	if modelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model_id is required"})
		return
	}

	if err := deleteModel(modelID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  fmt.Sprintf("Model deleted successfully: %s", modelID),
		"model_id": modelID,
	})
}

func downloadProgressHandler(w http.ResponseWriter, r *http.Request) {
	modelID := r.URL.Query().Get("model_id")

	downloadProgressMu.RLock()
	defer downloadProgressMu.RUnlock()

	if modelID != "" {
		if progress, exists := downloadProgress[modelID]; exists {
			writeJSON(w, http.StatusOK, progress)
		} else {
			writeJSON(w, http.StatusOK, map[string]interface{}{"model_id": modelID, "status": "not_started"})
		}
	} else {
		writeJSON(w, http.StatusOK, downloadProgress)
	}
}
