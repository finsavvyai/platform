package deployment

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Builder handles the compilation of Go code to WebAssembly for Cloudflare Workers
type Builder struct {
	tempDir string
	logger  BuildLogger
}

// BuildLogger interface for build logging
type BuildLogger interface {
	Info(msg string, args ...interface{})
	Error(msg string, args ...interface{})
	Debug(msg string, args ...interface{})
}

// DefaultBuildLogger implements a simple console logger
type DefaultBuildLogger struct{}

func (l *DefaultBuildLogger) Info(msg string, args ...interface{}) {
	fmt.Printf("[INFO] "+msg+"\n", args...)
}

func (l *DefaultBuildLogger) Error(msg string, args ...interface{}) {
	fmt.Printf("[ERROR] "+msg+"\n", args...)
}

func (l *DefaultBuildLogger) Debug(msg string, args ...interface{}) {
	fmt.Printf("[DEBUG] "+msg+"\n", args...)
}

// NewBuilder creates a new builder instance
func NewBuilder(logger BuildLogger) (*Builder, error) {
	if logger == nil {
		logger = &DefaultBuildLogger{}
	}

	tempDir, err := os.MkdirTemp("", "mcp-build-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %w", err)
	}

	return &Builder{
		tempDir: tempDir,
		logger:  logger,
	}, nil
}

// BuildRequest represents a build request
type BuildRequest struct {
	ConnectorID  string            `json:"connector_id"`
	SourceCode   string            `json:"source_code"`
	GoMod        string            `json:"go_mod"`
	GoSum        string            `json:"go_sum"`
	Dependencies map[string]string `json:"dependencies"` // package -> version
	BuildTags    []string          `json:"build_tags"`
	Optimization string            `json:"optimization"` // size, speed, balanced
	Environment  string            `json:"environment"`  // development, staging, production
}

// BuildResult represents the result of a build operation
type BuildResult struct {
	Success    bool              `json:"success"`
	WASMBinary []byte            `json:"wasm_binary"`
	WorkerJS   string            `json:"worker_js"`
	BundleSize int64             `json:"bundle_size"`
	BuildTime  time.Duration     `json:"build_time"`
	Logs       []BuildLogEntry   `json:"logs"`
	Artifacts  map[string][]byte `json:"artifacts"`
	Metadata   BuildMetadata     `json:"metadata"`
}

// BuildLogEntry represents a single build log entry
type BuildLogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"` // info, warning, error
	Message   string    `json:"message"`
	Source    string    `json:"source"` // tinygo, go, custom
}

// BuildMetadata contains metadata about the build
type BuildMetadata struct {
	TinyGoVersion   string            `json:"tinygo_version"`
	GoVersion       string            `json:"go_version"`
	Target          string            `json:"target"`
	BuildTags       []string          `json:"build_tags"`
	Optimization    string            `json:"optimization"`
	CompileTime     time.Time         `json:"compile_time"`
	Dependencies    map[string]string `json:"dependencies"`
	Imports         []string          `json:"imports"`
	Functions       []string          `json:"functions"`
	GlobalVariables []string          `json:"global_variables"`
	EstimatedMemory int64             `json:"estimated_memory"`
	EstimatedSize   int64             `json:"estimated_size"`
}

// Build builds Go source code to WebAssembly for Cloudflare Workers
func (b *Builder) Build(ctx context.Context, req *BuildRequest) (*BuildResult, error) {
	startTime := time.Now()

	result := &BuildResult{
		Success:   false,
		Logs:      []BuildLogEntry{},
		Artifacts: make(map[string][]byte),
		Metadata: BuildMetadata{
			CompileTime: startTime,
		},
	}

	b.logInfo("Starting build for connector %s", req.ConnectorID)

	// Create build directory
	buildDir := filepath.Join(b.tempDir, req.ConnectorID)
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return b.addError(result, fmt.Errorf("failed to create build directory: %w", err))
	}

	// Write source files
	if err := b.writeSourceFiles(buildDir, req); err != nil {
		return b.addError(result, fmt.Errorf("failed to write source files: %w", err))
	}

	// Check TinyGo availability
	tinygoVersion, err := b.checkTinyGo()
	if err != nil {
		return b.addError(result, fmt.Errorf("TinyGo not available: %w", err))
	}
	result.Metadata.TinyGoVersion = tinygoVersion

	// Get Go version
	goVersion, err := b.getGoVersion()
	if err != nil {
		b.logWarn("Failed to get Go version: %v", err)
	} else {
		result.Metadata.GoVersion = goVersion
	}

	// Compile to WebAssembly
	wasmPath := filepath.Join(buildDir, "main.wasm")
	wasmBinary, err := b.compileToWASM(ctx, buildDir, wasmPath, req)
	if err != nil {
		return b.addError(result, fmt.Errorf("compilation failed: %w", err))
	}
	result.WASMBinary = wasmBinary

	// Generate Cloudflare Worker JavaScript wrapper
	workerJS, err := b.generateWorkerWrapper(buildDir, req)
	if err != nil {
		return b.addError(result, fmt.Errorf("failed to generate worker wrapper: %w", err))
	}
	result.WorkerJS = workerJS

	// Analyze the compiled binary
	if err := b.analyzeBinary(result, wasmPath); err != nil {
		b.logWarn("Failed to analyze binary: %v", err)
	}

	// Create deployment bundle
	bundleSize, err := b.createDeploymentBundle(result, buildDir)
	if err != nil {
		return b.addError(result, fmt.Errorf("failed to create deployment bundle: %w", err))
	}
	result.BundleSize = bundleSize

	// Calculate build time
	result.BuildTime = time.Since(startTime)

	// Mark as successful
	result.Success = true
	result.Metadata.CompileTime = time.Now()

	b.logInfo("Build completed successfully in %v", result.BuildTime)

	return result, nil
}

// writeSourceFiles writes the Go source files to the build directory
func (b *Builder) writeSourceFiles(buildDir string, req *BuildRequest) error {
	// Write main.go
	mainPath := filepath.Join(buildDir, "main.go")
	if err := os.WriteFile(mainPath, []byte(req.SourceCode), 0644); err != nil {
		return fmt.Errorf("failed to write main.go: %w", err)
	}

	// Write go.mod if provided
	if req.GoMod != "" {
		goModPath := filepath.Join(buildDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(req.GoMod), 0644); err != nil {
			return fmt.Errorf("failed to write go.mod: %w", err)
		}
	}

	// Write go.sum if provided
	if req.GoSum != "" {
		goSumPath := filepath.Join(buildDir, "go.sum")
		if err := os.WriteFile(goSumPath, []byte(req.GoSum), 0644); err != nil {
			return fmt.Errorf("failed to write go.sum: %w", err)
		}
	}

	// Create additional source files for AgentKit integration
	if err := b.createSupportFiles(buildDir, req); err != nil {
		return fmt.Errorf("failed to create support files: %w", err)
	}

	return nil
}

// createSupportFiles creates additional files needed for the build
func (b *Builder) createSupportFiles(buildDir string, req *BuildRequest) error {
	// Create wasm_exec.js for WebAssembly support
	wasmExecPath := filepath.Join(buildDir, "wasm_exec.js")
	wasmExecContent := `// WebAssembly support for Cloudflare Workers
// This is a minimal implementation for Cloudflare Workers environment

export class WasmRunner {
  constructor(wasmModule) {
    this.wasmModule = wasmModule;
    this.instance = null;
  }

  async instantiate() {
    if (!this.wasmModule) {
      throw new Error('WASM module not provided');
    }

    this.instance = await WebAssembly.instantiate(this.wasmModule, {
      env: {
        // Cloudflare Workers compatible imports
        // These will be provided by the Worker runtime
      }
    });

    return this.instance;
  }

  call(functionName, ...args) {
    if (!this.instance) {
      throw new Error('WASM module not instantiated');
    }

    if (!(functionName in this.instance.exports)) {
      throw new Error("Function " + functionName + " not found");
    }

    return this.instance.exports[functionName](...args);
  }
}
`

	if err := os.WriteFile(wasmExecPath, []byte(wasmExecContent), 0644); err != nil {
		return fmt.Errorf("failed to write wasm_exec.js: %w", err)
	}

	return nil
}

// compileToWASM compiles Go code to WebAssembly using TinyGo
func (b *Builder) compileToWASM(ctx context.Context, buildDir, wasmPath string, req *BuildRequest) ([]byte, error) {
	b.logInfo("Compiling Go code to WebAssembly...")

	// Build compilation arguments
	args := []string{
		"build",
		"-o", wasmPath,
		"-target=wasm",
		"-no-debug",
		"-gc=custom",      // Custom garbage collector for smaller binary
		"-scheduler=none", // No scheduler for smaller binary
		"-tags=custommalloc",
	}

	// Add build tags
	if len(req.BuildTags) > 0 {
		args = append(args, "-tags", strings.Join(req.BuildTags, ","))
	}

	// Add optimization flags
	switch req.Optimization {
	case "size":
		args = append(args, "-ldflags=-s -w") // Strip symbols and debug info
	case "speed":
		args = append(args, "-ldflags=-w") // Only strip debug info
	case "balanced":
		args = append(args, "-ldflags=-s") // Strip symbols only
	default:
		args = append(args, "-ldflags=-s -w") // Default to size optimization
	}

	// Add the main package
	args = append(args, ".")

	// Set environment variables for the build
	env := os.Environ()
	env = append(env,
		"GOOS=js",
		"GOARCH=wasm",
		"GO111MODULE=on",
		"CGO_ENABLED=0",
	)

	// Add environment-specific variables
	if req.Environment == "production" {
		env = append(env, "GIN_MODE=release")
	}

	// Create the command
	cmd := exec.CommandContext(ctx, "tinygo", args...)
	cmd.Dir = buildDir
	cmd.Env = env

	// Run the compilation
	output, err := cmd.CombinedOutput()
	if err != nil {
		b.logError("TinyGo compilation failed: %v", err)
		b.logError("Output: %s", string(output))
		return nil, fmt.Errorf("TinyGo compilation failed: %w\nOutput: %s", err, string(output))
	}

	b.logInfo("TinyGo compilation completed successfully")

	// Read the compiled WASM binary
	wasmBinary, err := os.ReadFile(wasmPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read compiled WASM file: %w", err)
	}

	b.logInfo("Generated WASM binary: %d bytes", len(wasmBinary))

	return wasmBinary, nil
}

// generateWorkerWrapper generates the Cloudflare Worker JavaScript wrapper
func (b *Builder) generateWorkerWrapper(buildDir string, req *BuildRequest) (string, error) {
	b.logInfo("Generating Cloudflare Worker wrapper...")

	// In a real implementation, this would generate a proper JavaScript wrapper
	// that loads the WASM module and provides the MCP protocol interface
	workerTemplate := `
// Cloudflare Worker for MCP Connector: %s
// Generated at: %s
// Environment: %s

import { WasmRunner } from './wasm_exec.js';

// WebAssembly module (will be injected during deployment)
let wasmModule = null;
let wasmRunner = null;

class MCPWorker {
  constructor(env) {
    this.env = env;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load WASM module (in production, this would be from a binding or import)
      if (!wasmModule) {
        throw new Error('WASM module not loaded');
      }

      wasmRunner = new WasmRunner(wasmModule);
      await wasmRunner.instantiate();

      // Initialize the MCP server
      if (wasmRunner.call('init_mcp_server') !== 0) {
        throw new Error('Failed to initialize MCP server');
      }

      this.initialized = true;
      console.log('MCP Worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCP Worker:', error);
      throw error;
    }
  }

  async handleRequest(request) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Parse the MCP request
      const mcpRequest = await request.json();

      // Convert request to bytes for WASM
      const requestBytes = new TextEncoder().encode(JSON.stringify(mcpRequest));

      // Allocate memory in WASM and copy request
      const requestPtr = wasmRunner.call('allocate_memory', requestBytes.length);
      const wasmMemory = new Uint8Array(wasmRunner.instance.exports.memory.buffer, requestPtr, requestBytes.length);
      wasmMemory.set(requestBytes);

      // Call the MCP handler
      const responsePtr = wasmRunner.call('handle_mcp_request', requestPtr, requestBytes.length);
      const responseLength = wasmRunner.call('get_response_length', responsePtr);

      // Read response from WASM memory
      const responseMemory = new Uint8Array(wasmRunner.instance.exports.memory.buffer, responsePtr, responseLength);
      const responseJson = new TextDecoder().decode(responseMemory);

      // Clean up allocated memory
      wasmRunner.call('free_memory', requestPtr, requestBytes.length);
      wasmRunner.call('free_memory', responsePtr, responseLength);

      const mcpResponse = JSON.parse(responseJson);

      return new Response(JSON.stringify(mcpResponse), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);

      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  async handle(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only handle POST requests for MCP
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    return await this.handleRequest(request);
  }
}

// Export the worker handler
export default {
  async fetch(request, env, ctx) {
    const worker = new MCPWorker(env);
    return await worker.handle(request);
  },
};
`

	workerJS := fmt.Sprintf(workerTemplate, req.ConnectorID, time.Now().Format(time.RFC3339), req.Environment)

	// Write the worker file
	workerPath := filepath.Join(buildDir, "worker.js")
	if err := os.WriteFile(workerPath, []byte(workerJS), 0644); err != nil {
		return "", fmt.Errorf("failed to write worker.js: %w", err)
	}

	return workerJS, nil
}

// analyzeBinary analyzes the compiled WebAssembly binary
func (b *Builder) analyzeBinary(result *BuildResult, wasmPath string) error {
	// Read the binary
	wasmBinary, err := os.ReadFile(wasmPath)
	if err != nil {
		return fmt.Errorf("failed to read WASM binary: %w", err)
	}

	result.Metadata.EstimatedSize = int64(len(wasmBinary))

	// Basic WASM header validation
	if len(wasmBinary) < 8 {
		return fmt.Errorf("invalid WASM binary: too small")
	}

	if !bytes.Equal(wasmBinary[:4], []byte{0x00, 0x61, 0x73, 0x6D}) {
		return fmt.Errorf("invalid WASM binary: wrong magic number")
	}

	b.logInfo("WASM binary validated: %d bytes", len(wasmBinary))

	// Extract basic information
	result.Metadata.Target = "wasm"

	// In a real implementation, this would use a WASM parser to extract:
	// - Import/export information
	// - Function signatures
	// - Global variables
	// - Memory sections

	result.Metadata.Functions = []string{"init_mcp_server", "handle_mcp_request", "allocate_memory", "free_memory", "get_response_length"}
	result.Metadata.GlobalVariables = []string{"memory"}
	result.Metadata.EstimatedMemory = 1024 * 1024 // 1MB initial estimate

	return nil
}

// createDeploymentBundle creates a deployment bundle (zip file)
func (b *Builder) createDeploymentBundle(result *BuildResult, buildDir string) (int64, error) {
	b.logInfo("Creating deployment bundle...")

	// Create a buffer for the zip file
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	// Add files to the zip
	files := map[string]string{
		"worker.js":     result.WorkerJS,
		"wasm_exec.js":  "", // Will be read from file
		"main.wasm":     "", // Will be read from binary
		"package.json":  b.generatePackageJSON(),
		"wrangler.toml": b.generateWranglerTOML(),
	}

	for filename, content := range files {
		if content == "" {
			// Read file from disk
			filePath := filepath.Join(buildDir, filename)
			fileContent, err := os.ReadFile(filePath)
			if err != nil {
				b.logWarn("Failed to read file %s: %v", filename, err)
				continue
			}
			content = string(fileContent)
		}

		writer, err := zipWriter.Create(filename)
		if err != nil {
			return 0, fmt.Errorf("failed to create zip entry for %s: %w", filename, err)
		}

		if _, err := writer.Write([]byte(content)); err != nil {
			return 0, fmt.Errorf("failed to write %s to zip: %w", filename, err)
		}
	}

	// Close the zip writer
	if err := zipWriter.Close(); err != nil {
		return 0, fmt.Errorf("failed to close zip writer: %w", err)
	}

	// Store the bundle
	result.Artifacts["deployment.zip"] = buf.Bytes()
	bundleSize := int64(buf.Len())

	b.logInfo("Deployment bundle created: %d bytes", bundleSize)

	return bundleSize, nil
}

// generatePackageJSON generates a package.json for the worker
func (b *Builder) generatePackageJSON() string {
	return `{
  "name": "mcp-connector-worker",
  "version": "1.0.0",
  "description": "MCP Connector deployed on Cloudflare Workers",
  "main": "worker.js",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}`
}

// generateWranglerTOML generates a wrangler.toml configuration
func (b *Builder) generateWranglerTOML() string {
	return `name = "mcp-connector"
main = "worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production.vars]
ENVIRONMENT = "production"

[env.staging.vars]
ENVIRONMENT = "staging"

[env.development.vars]
ENVIRONMENT = "development"
`
}

// checkTinyGo checks if TinyGo is available and returns its version
func (b *Builder) checkTinyGo() (string, error) {
	cmd := exec.Command("tinygo", "version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("TinyGo not found or not executable: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// getGoVersion returns the Go version
func (b *Builder) getGoVersion() (string, error) {
	cmd := exec.Command("go", "version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("Go not found or not executable: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// addError adds an error to the build result and returns it
func (b *Builder) addError(result *BuildResult, err error) (*BuildResult, error) {
	result.Success = false
	result.Logs = append(result.Logs, BuildLogEntry{
		Timestamp: time.Now(),
		Level:     "error",
		Message:   err.Error(),
		Source:    "builder",
	})

	b.logError("Build error: %v", err)

	return result, err
}

// logInfo logs an info message
func (b *Builder) logInfo(msg string, args ...interface{}) {
	b.logger.Info(msg, args...)
}

// logError logs an error message
func (b *Builder) logError(msg string, args ...interface{}) {
	b.logger.Error(msg, args...)
}

// logWarn logs a warning message
func (b *Builder) logWarn(msg string, args ...interface{}) {
	b.logger.Info("WARNING: "+msg, args...)
}

// Cleanup cleans up temporary files
func (b *Builder) Cleanup() error {
	if b.tempDir != "" {
		return os.RemoveAll(b.tempDir)
	}
	return nil
}
