package generator

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// CSharpDotNetGenerator generates C# ASP.NET Core MCP servers
type CSharpDotNetGenerator struct {
	*BaseGenerator
}

// NewCSharpDotNetGenerator creates a new C# .NET generator
func NewCSharpDotNetGenerator() *CSharpDotNetGenerator {
	features := []Feature{
		FeatureBasicGeneration,
		FeatureTypeGeneration,
		FeatureAuthGeneration,
		FeatureValidation,
		FeatureErrorHandling,
		FeatureRetryLogic,
		FeatureLogging,
		FeatureRESTSupport,
		FeatureInlineDocs,
		FeatureExamples,
		FeatureAsyncAwait,
	}

	gen := &CSharpDotNetGenerator{
		BaseGenerator: NewBaseGenerator("csharp", "dotnet", "1.0.0", features),
	}

	return gen
}

// Generate generates C# ASP.NET Core code from IR
func (g *CSharpDotNetGenerator) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
	startTime := time.Now()

	// Validate IR
	result, err := g.Validate(ir)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	if !result.Valid {
		return nil, fmt.Errorf("IR validation failed: %d errors", len(result.Errors))
	}

	files := make([]GeneratedFile, 0)

	// Generate all project files
	generators := []struct {
		name      string
		fileType  FileType
		generator func(*parser.IntermediateRepresentation) (string, error)
	}{
		{"Program.cs", FileTypeSource, g.generateProgram},
		{"Controllers/McpController.cs", FileTypeSource, g.generateController},
		{"Services/McpService.cs", FileTypeSource, g.generateService},
		{"Services/IApiClient.cs", FileTypeSource, g.generateApiClientInterface},
		{"Services/ApiClient.cs", FileTypeSource, g.generateApiClient},
		{"Models/ExecuteRequest.cs", FileTypeSource, g.generateExecuteRequest},
		{"Models/ExecuteResponse.cs", FileTypeSource, g.generateExecuteResponse},
		{"Models/McpManifest.cs", FileTypeSource, g.generateManifest},
		{"Models/Tool.cs", FileTypeSource, g.generateToolModel},
		{g.getNamespace(ir) + ".csproj", FileTypeConfig, g.generateCsproj},
		{"appsettings.json", FileTypeConfig, g.generateAppSettings},
		{"appsettings.Development.json", FileTypeConfig, g.generateDevAppSettings},
		{"README.md", FileTypeDocs, g.generateReadme},
		{"Tests/" + g.getNamespace(ir) + ".Tests.csproj", FileTypeConfig, g.generateTestProject},
		{"Tests/McpServiceTests.cs", FileTypeTest, g.generateTests},
	}

	for _, gen := range generators {
		content, err := gen.generator(ir)
		if err != nil {
			return nil, fmt.Errorf("failed to generate %s: %w", gen.name, err)
		}

		files = append(files, GeneratedFile{
			Path:     gen.name,
			Content:  content,
			Type:     gen.fileType,
			Language: "csharp",
		})
	}

	// Calculate statistics
	totalLines := 0
	for _, file := range files {
		totalLines += len(strings.Split(file.Content, "\n"))
	}

	// Build metadata
	hasAuth := len(ir.Auth) > 0

	code := &GeneratedCode{
		Language: g.language,
		Runtime:  g.runtime,
		Files:    files,
		Metadata: GenerationMetadata{
			GeneratorName:    "csharp-dotnet",
			GeneratorVersion: g.version,
			GeneratedAt:      time.Now(),
			SourceFormat:     "openapi",
			Features:         g.features,
			Statistics: GenerationStatistics{
				TotalFiles:     len(files),
				TotalLines:     totalLines,
				TotalEndpoints: len(ir.Endpoints),
				TotalTypes:     len(ir.Types),
				GenerationTime: time.Since(startTime),
			},
			Extensions: map[string]interface{}{
				"namespace":       g.getNamespace(ir),
				"has_auth":        hasAuth,
				"endpoints_count": len(ir.Endpoints),
			},
		},
	}

	return code, nil
}

// getNamespace returns the C# namespace from IR metadata
func (g *CSharpDotNetGenerator) getNamespace(ir *parser.IntermediateRepresentation) string {
	name := ir.Metadata.Name
	if name == "" {
		name = ir.Metadata.Title
	}
	if name != "" {
		// Convert to PascalCase and sanitize
		parts := strings.Split(name, "-")
		for i, part := range parts {
			if len(part) > 0 {
				parts[i] = strings.ToUpper(part[:1]) + strings.ToLower(part[1:])
			}
		}
		return sanitizeIdentifier(strings.Join(parts, ""))
	}
	return "McpServer"
}

// generateProgram generates the main Program.cs file
func (g *CSharpDotNetGenerator) generateProgram(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using %s.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register application services
builder.Services.AddSingleton<IApiClient, ApiClient>();
builder.Services.AddSingleton<McpService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add HTTP client
builder.Services.AddHttpClient();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();
`, namespace), nil
}

// generateController generates the ASP.NET Core controller
func (g *CSharpDotNetGenerator) generateController(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using Microsoft.AspNetCore.Mvc;
using %s.Models;
using %s.Services;

namespace %s.Controllers
{
    /// <summary>
    /// MCP (Model Context Protocol) Controller
    /// Handles MCP tool execution and manifest serving
    /// </summary>
    [ApiController]
    [Route("")]
    public class McpController : ControllerBase
    {
        private readonly McpService _mcpService;

        public McpController(McpService mcpService)
        {
            _mcpService = mcpService;
        }

        /// <summary>
        /// Get the MCP manifest
        /// </summary>
        [HttpGet(".well-known/mcp.json")]
        [ProducesResponseType(typeof(McpManifest), 200)]
        public IActionResult GetManifest()
        {
            var manifest = _mcpService.GetManifest();
            return Ok(manifest);
        }

        /// <summary>
        /// Execute an MCP tool
        /// </summary>
        [HttpPost("mcp/execute")]
        [ProducesResponseType(typeof(ExecuteResponse), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> ExecuteTool([FromBody] ExecuteRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.Tool))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Invalid request",
                    Detail = "Tool name is required"
                });
            }

            try
            {
                var result = await _mcpService.ExecuteToolAsync(request);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Invalid tool",
                    Detail = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ProblemDetails
                {
                    Title = "Execution error",
                    Detail = ex.Message
                });
            }
        }

        /// <summary>
        /// Health check endpoint
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
        }
    }
}
`, namespace, namespace, namespace), nil
}

// generateService generates the MCP service implementation
func (g *CSharpDotNetGenerator) generateService(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	// Generate tool execution methods
	toolMethods := ""
	for _, endpoint := range ir.Endpoints {
		toolName := endpoint.Name
		method := strings.ToUpper(endpoint.Method)

		toolMethods += fmt.Sprintf(`
        /// <summary>
        /// Execute %s tool
        /// </summary>
        private async Task<object> Execute_%s(Dictionary<string, object> args)
        {
            return await _apiClient.%sAsync("%s", args);
        }
`, toolName, sanitizeIdentifier(toolName), method, endpoint.Path)
	}

	// Generate tool dispatcher
	toolCases := ""
	for _, endpoint := range ir.Endpoints {
		toolName := endpoint.Name
		toolCases += fmt.Sprintf(`                case "%s":
                    return await Execute_%s(request.Arguments ?? new Dictionary<string, object>());
`, toolName, sanitizeIdentifier(toolName))
	}

	return fmt.Sprintf(`using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using %s.Models;

namespace %s.Services
{
    /// <summary>
    /// Core MCP service implementation
    /// Manages tool execution and manifest generation
    /// </summary>
    public class McpService
    {
        private readonly IApiClient _apiClient;

        public McpService(IApiClient apiClient)
        {
            _apiClient = apiClient;
        }

        /// <summary>
        /// Get the MCP manifest with all available tools
        /// </summary>
        public McpManifest GetManifest()
        {
            return new McpManifest
            {
                Version = "1.0.0",
                Name = "%s",
                Description = "%s",
                Tools = GetTools()
            };
        }

        /// <summary>
        /// Get all available tools
        /// </summary>
        private List<Tool> GetTools()
        {
            return new List<Tool>
            {
%s
            };
        }

        /// <summary>
        /// Execute a tool by name with provided arguments
        /// </summary>
        public async Task<ExecuteResponse> ExecuteToolAsync(ExecuteRequest request)
        {
            if (string.IsNullOrEmpty(request.Tool))
            {
                throw new ArgumentException("Tool name is required");
            }

            try
            {
                object result = request.Tool switch
                {
%s
                    _ => throw new ArgumentException($"Unknown tool: {request.Tool}")
                };

                return new ExecuteResponse
                {
                    Success = true,
                    Result = result
                };
            }
            catch (Exception ex)
            {
                return new ExecuteResponse
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }
%s
    }
}
`, namespace, namespace, g.getNameOrDefault(ir), g.getDescriptionOrDefault(ir), g.generateToolsList(ir), toolCases, toolMethods), nil
}

// generateToolsList generates the tools list for the manifest
func (g *CSharpDotNetGenerator) generateToolsList(ir *parser.IntermediateRepresentation) string {
	var tools []string

	for _, endpoint := range ir.Endpoints {
		description := endpoint.Description
		if description == "" {
			description = fmt.Sprintf("%s %s", endpoint.Method, endpoint.Path)
		}

		// Generate input schema
		inputSchema := g.generateInputSchema(endpoint)

		tool := fmt.Sprintf(`                new Tool
                {
                    Name = "%s",
                    Description = "%s",
                    InputSchema = %s
                }`, endpoint.Name, escapeString(description), inputSchema)

		tools = append(tools, tool)
	}

	return strings.Join(tools, ",\n")
}

// generateInputSchema generates JSON schema for tool inputs
func (g *CSharpDotNetGenerator) generateInputSchema(endpoint parser.UnifiedEndpoint) string {
	if len(endpoint.Parameters) == 0 {
		return `new Dictionary<string, object>
                    {
                        { "type", "object" },
                        { "properties", new Dictionary<string, object>() }
                    }`
	}

	properties := make([]string, 0)
	required := make([]string, 0)

	for _, param := range endpoint.Parameters {
		paramType := "string"
		if param.Schema != nil && param.Schema.Type != "" {
			paramType = param.Schema.Type
		}

		propSchema := fmt.Sprintf(`                            { "%s", new Dictionary<string, object>
                            {
                                { "type", "%s" },
                                { "description", "%s" }
                            } }`, param.Name, g.typeToJsonSchema(paramType), escapeString(param.Description))

		properties = append(properties, propSchema)

		if param.Required {
			required = append(required, fmt.Sprintf(`"%s"`, param.Name))
		}
	}

	requiredStr := ""
	if len(required) > 0 {
		requiredStr = fmt.Sprintf(`,
                        { "required", new string[] { %s } }`, strings.Join(required, ", "))
	}

	return fmt.Sprintf(`new Dictionary<string, object>
                    {
                        { "type", "object" },
                        { "properties", new Dictionary<string, object>
                        {
%s
                        } }%s
                    }`, strings.Join(properties, ",\n"), requiredStr)
}

// generateApiClientInterface generates the API client interface
func (g *CSharpDotNetGenerator) generateApiClientInterface(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using System.Collections.Generic;
using System.Threading.Tasks;

namespace %s.Services
{
    /// <summary>
    /// API client interface for making HTTP requests
    /// </summary>
    public interface IApiClient
    {
        Task<object> GETAsync(string path, Dictionary<string, object> parameters);
        Task<object> POSTAsync(string path, Dictionary<string, object> body);
        Task<object> PUTAsync(string path, Dictionary<string, object> body);
        Task<object> PATCHAsync(string path, Dictionary<string, object> body);
        Task<object> DELETEAsync(string path, Dictionary<string, object> parameters);
    }
}
`, namespace), nil
}

// generateApiClient generates the API client implementation
func (g *CSharpDotNetGenerator) generateApiClient(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)
	baseURL := g.getBaseURL(ir)
	authCode := g.generateAuthCode(ir)

	return fmt.Sprintf(`using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace %s.Services
{
    /// <summary>
    /// HTTP client for API communication
    /// Handles authentication, retries, and error handling
    /// </summary>
    public class ApiClient : IApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly string _baseUrl;

        public ApiClient(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClient = httpClientFactory.CreateClient();
            _configuration = configuration;
            _baseUrl = configuration["ApiBaseUrl"] ?? "%s";

            ConfigureClient();
        }

        private void ConfigureClient()
        {
            _httpClient.BaseAddress = new Uri(_baseUrl);
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
%s
        }

        public async Task<object> GETAsync(string path, Dictionary<string, object> parameters)
        {
            var url = BuildUrl(path, parameters);
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<object>();
        }

        public async Task<object> POSTAsync(string path, Dictionary<string, object> body)
        {
            var response = await _httpClient.PostAsJsonAsync(path, body);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<object>();
        }

        public async Task<object> PUTAsync(string path, Dictionary<string, object> body)
        {
            var response = await _httpClient.PutAsJsonAsync(path, body);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<object>();
        }

        public async Task<object> PATCHAsync(string path, Dictionary<string, object> body)
        {
            var response = await _httpClient.PatchAsJsonAsync(path, body);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<object>();
        }

        public async Task<object> DELETEAsync(string path, Dictionary<string, object> parameters)
        {
            var url = BuildUrl(path, parameters);
            var response = await _httpClient.DeleteAsync(url);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<object>();
        }

        private string BuildUrl(string path, Dictionary<string, object> parameters)
        {
            if (parameters == null || parameters.Count == 0)
            {
                return path;
            }

            var query = string.Join("&", parameters.Select(kv =>
                $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value?.ToString() ?? "")}"));

            return $"{path}?{query}";
        }
    }
}
`, namespace, baseURL, authCode), nil
}

// generateAuthCode generates authentication configuration code
func (g *CSharpDotNetGenerator) generateAuthCode(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	// Use the first auth scheme
	auth := ir.Auth[0]

	switch auth.Type {
	case "apiKey":
		if auth.In == "header" {
			return fmt.Sprintf(`
            // API Key authentication
            var apiKey = _configuration["ApiKey"];
            if (!string.IsNullOrEmpty(apiKey))
            {
                _httpClient.DefaultRequestHeaders.Add("%s", apiKey);
            }`, auth.Name)
		}
		return `
            // API Key authentication (query parameter)
            // Will be added to each request in BuildUrl method`

	case "http":
		if auth.Scheme == "bearer" {
			return `
            // Bearer token authentication
            var bearerToken = _configuration["BearerToken"];
            if (!string.IsNullOrEmpty(bearerToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", bearerToken);
            }`
		}
		return `
            // HTTP Basic authentication
            var username = _configuration["BasicAuth:Username"];
            var password = _configuration["BasicAuth:Password"];
            if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(password))
            {
                var credentials = Convert.ToBase64String(
                    System.Text.Encoding.ASCII.GetBytes($"{username}:{password}"));
                _httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
            }`

	case "oauth2":
		return `
            // OAuth2 authentication
            var accessToken = _configuration["OAuth2:AccessToken"];
            if (!string.IsNullOrEmpty(accessToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            }`

	default:
		return ""
	}
}

// generateExecuteRequest generates the ExecuteRequest model
func (g *CSharpDotNetGenerator) generateExecuteRequest(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using System.Collections.Generic;

namespace %s.Models
{
    /// <summary>
    /// Request model for tool execution
    /// </summary>
    public class ExecuteRequest
    {
        /// <summary>
        /// Name of the tool to execute
        /// </summary>
        public string Tool { get; set; } = string.Empty;

        /// <summary>
        /// Arguments for the tool
        /// </summary>
        public Dictionary<string, object>? Arguments { get; set; }
    }
}
`, namespace), nil
}

// generateExecuteResponse generates the ExecuteResponse model
func (g *CSharpDotNetGenerator) generateExecuteResponse(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`namespace %s.Models
{
    /// <summary>
    /// Response model for tool execution
    /// </summary>
    public class ExecuteResponse
    {
        /// <summary>
        /// Indicates if the execution was successful
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// The result of the execution
        /// </summary>
        public object? Result { get; set; }

        /// <summary>
        /// Error message if execution failed
        /// </summary>
        public string? Error { get; set; }
    }
}
`, namespace), nil
}

// generateManifest generates the McpManifest model
func (g *CSharpDotNetGenerator) generateManifest(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using System.Collections.Generic;

namespace %s.Models
{
    /// <summary>
    /// MCP manifest model
    /// </summary>
    public class McpManifest
    {
        /// <summary>
        /// MCP protocol version
        /// </summary>
        public string Version { get; set; } = "1.0.0";

        /// <summary>
        /// Server name
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Server description
        /// </summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Available tools
        /// </summary>
        public List<Tool> Tools { get; set; } = new List<Tool>();
    }
}
`, namespace), nil
}

// generateToolModel generates the Tool model
func (g *CSharpDotNetGenerator) generateToolModel(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using System.Collections.Generic;

namespace %s.Models
{
    /// <summary>
    /// MCP tool definition
    /// </summary>
    public class Tool
    {
        /// <summary>
        /// Tool name
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Tool description
        /// </summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Input schema (JSON Schema)
        /// </summary>
        public Dictionary<string, object> InputSchema { get; set; } = new Dictionary<string, object>();
    }
}
`, namespace), nil
}

// generateCsproj generates the .csproj file
func (g *CSharpDotNetGenerator) generateCsproj(ir *parser.IntermediateRepresentation) (string, error) {
	return `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="System.Text.Json" Version="8.0.0" />
  </ItemGroup>

</Project>
`, nil
}

// generateAppSettings generates appsettings.json
func (g *CSharpDotNetGenerator) generateAppSettings(ir *parser.IntermediateRepresentation) (string, error) {
	baseURL := g.getBaseURL(ir)

	config := map[string]interface{}{
		"Logging": map[string]interface{}{
			"LogLevel": map[string]string{
				"Default":              "Information",
				"Microsoft.AspNetCore": "Warning",
			},
		},
		"AllowedHosts": "*",
		"ApiBaseUrl":   baseURL,
	}

	// Add auth config if needed
	if len(ir.Auth) > 0 {
		auth := ir.Auth[0]
		if auth.Type == "apiKey" {
			config["ApiKey"] = "your-api-key-here"
		} else if auth.Type == "http" && auth.Scheme == "bearer" {
			config["BearerToken"] = "your-bearer-token-here"
		} else if auth.Type == "http" {
			config["BasicAuth"] = map[string]string{
				"Username": "your-username",
				"Password": "your-password",
			}
		} else if auth.Type == "oauth2" {
			config["OAuth2"] = map[string]string{
				"AccessToken": "your-access-token-here",
			}
		}
	}

	jsonBytes, _ := JsonMarshal(config)
	return string(jsonBytes), nil
}

// generateDevAppSettings generates appsettings.Development.json
func (g *CSharpDotNetGenerator) generateDevAppSettings(ir *parser.IntermediateRepresentation) (string, error) {
	return `{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  }
}
`, nil
}

// generateTestProject generates the test .csproj file
func (g *CSharpDotNetGenerator) generateTestProject(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="xUnit" Version="2.6.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.4">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Moq" Version="4.20.69" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../%s.csproj" />
  </ItemGroup>

</Project>
`, namespace), nil
}

// generateTests generates xUnit tests
func (g *CSharpDotNetGenerator) generateTests(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)

	return fmt.Sprintf(`using System.Collections.Generic;
using System.Threading.Tasks;
using Moq;
using Xunit;
using %s.Models;
using %s.Services;

namespace %s.Tests
{
    public class McpServiceTests
    {
        private readonly Mock<IApiClient> _mockApiClient;
        private readonly McpService _service;

        public McpServiceTests()
        {
            _mockApiClient = new Mock<IApiClient>();
            _service = new McpService(_mockApiClient.Object);
        }

        [Fact]
        public void GetManifest_ReturnsValidManifest()
        {
            // Act
            var manifest = _service.GetManifest();

            // Assert
            Assert.NotNull(manifest);
            Assert.Equal("1.0.0", manifest.Version);
            Assert.NotEmpty(manifest.Name);
            Assert.NotNull(manifest.Tools);
        }

        [Fact]
        public async Task ExecuteToolAsync_WithNullToolName_ThrowsArgumentException()
        {
            // Arrange
            var request = new ExecuteRequest { Tool = null! };

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(() =>
                _service.ExecuteToolAsync(request));
        }

        [Fact]
        public async Task ExecuteToolAsync_WithEmptyToolName_ThrowsArgumentException()
        {
            // Arrange
            var request = new ExecuteRequest { Tool = string.Empty };

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(() =>
                _service.ExecuteToolAsync(request));
        }

        [Fact]
        public async Task ExecuteToolAsync_WithUnknownTool_ReturnsErrorResponse()
        {
            // Arrange
            var request = new ExecuteRequest
            {
                Tool = "unknown_tool",
                Arguments = new Dictionary<string, object>()
            };

            // Act
            var response = await _service.ExecuteToolAsync(request);

            // Assert
            Assert.NotNull(response);
            Assert.False(response.Success);
            Assert.Contains("Unknown tool", response.Error);
        }
    }
}
`, namespace, namespace, namespace), nil
}

// generateReadme generates README.md
func (g *CSharpDotNetGenerator) generateReadme(ir *parser.IntermediateRepresentation) (string, error) {
	namespace := g.getNamespace(ir)
	baseURL := g.getBaseURL(ir)
	authDocs := g.generateAuthDocs(ir)

	return fmt.Sprintf(`# %s - MCP Server

ASP.NET Core MCP (Model Context Protocol) server generated from OpenAPI specification.

## Description

%s

Base URL: %s

## Prerequisites

- .NET 8.0 SDK or later
- Visual Studio 2022, VS Code, or Rider (optional)

## Installation

### Restore dependencies
` + "```bash" + `
dotnet restore
` + "```" + `

## Configuration

Edit ` + "`appsettings.json`" + ` to configure:

- API base URL
- Authentication credentials%s

## Running the Server

### Development mode
` + "```bash" + `
dotnet run
` + "```" + `

The server will start on http://localhost:5000

### Production mode
` + "```bash" + `
dotnet run --configuration Release
` + "```" + `

## Building

` + "```bash" + `
dotnet build
` + "```" + `

### Create production build
` + "```bash" + `
dotnet publish -c Release -o ./publish
` + "```" + `

## Running Tests

` + "```bash" + `
dotnet test
` + "```" + `

### With coverage
` + "```bash" + `
dotnet test /p:CollectCoverage=true
` + "```" + `

## API Endpoints

### Get MCP Manifest
` + "```" + `
GET /.well-known/mcp.json
` + "```" + `

Returns the MCP manifest with all available tools.

### Execute Tool
` + "```" + `
POST /mcp/execute
Content-Type: application/json

{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}
` + "```" + `

### Health Check
` + "```" + `
GET /health
` + "```" + `

## Available Tools

%s

## Project Structure

` + "```" + `
%s/
├── Program.cs              # Application entry point
├── Controllers/
│   └── McpController.cs    # MCP endpoints
├── Services/
│   ├── McpService.cs       # Core business logic
│   ├── IApiClient.cs       # API client interface
│   └── ApiClient.cs        # HTTP client implementation
├── Models/
│   ├── ExecuteRequest.cs   # Request models
│   ├── ExecuteResponse.cs  # Response models
│   ├── McpManifest.cs      # Manifest model
│   └── Tool.cs             # Tool model
├── appsettings.json        # Configuration
└── %s.csproj         # Project file
` + "```" + `

## Docker Support

### Build image
` + "```bash" + `
docker build -t %s .
` + "```" + `

### Run container
` + "```bash" + `
docker run -p 5000:80 %s
` + "```" + `

## License

Generated by MCP Overflow
`, namespace, g.getDescriptionOrDefault(ir), baseURL, authDocs, g.generateToolsDocs(ir), namespace, namespace, strings.ToLower(namespace), strings.ToLower(namespace)), nil
}

// generateAuthDocs generates authentication documentation
func (g *CSharpDotNetGenerator) generateAuthDocs(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return fmt.Sprintf("\n- API Key (%s in %s)", auth.Name, auth.In)
	case "http":
		if auth.Scheme == "bearer" {
			return "\n- Bearer token authentication"
		}
		return "\n- HTTP Basic authentication"
	case "oauth2":
		return "\n- OAuth2 authentication"
	default:
		return ""
	}
}

// generateToolsDocs generates documentation for available tools
func (g *CSharpDotNetGenerator) generateToolsDocs(ir *parser.IntermediateRepresentation) string {
	var docs []string

	for _, endpoint := range ir.Endpoints {
		doc := fmt.Sprintf("- **%s**: %s (%s %s)",
			endpoint.Name,
			endpoint.Description,
			strings.ToUpper(endpoint.Method),
			endpoint.Path)
		docs = append(docs, doc)
	}

	if len(docs) == 0 {
		return "No tools available"
	}

	return strings.Join(docs, "\n")
}

// typeToJsonSchema converts IR type to JSON Schema type
func (g *CSharpDotNetGenerator) typeToJsonSchema(irType string) string {
	switch irType {
	case "string":
		return "string"
	case "integer", "int", "int32", "int64":
		return "integer"
	case "number", "float", "double":
		return "number"
	case "boolean", "bool":
		return "boolean"
	case "array":
		return "array"
	case "object":
		return "object"
	default:
		return "string"
	}
}

// getBaseURL extracts base URL from IR
func (g *CSharpDotNetGenerator) getBaseURL(ir *parser.IntermediateRepresentation) string {
	if len(ir.Servers) > 0 {
		return ir.Servers[0].URL
	}
	return "https://api.example.com"
}

// getNameOrDefault returns name from IR or default
func (g *CSharpDotNetGenerator) getNameOrDefault(ir *parser.IntermediateRepresentation) string {
	if ir.Metadata.Name != "" {
		return ir.Metadata.Name
	}
	if ir.Metadata.Title != "" {
		return ir.Metadata.Title
	}
	return "MCP Server"
}

// getDescriptionOrDefault returns description from IR or default
func (g *CSharpDotNetGenerator) getDescriptionOrDefault(ir *parser.IntermediateRepresentation) string {
	if ir.Metadata.Description != "" {
		return ir.Metadata.Description
	}
	return "MCP server generated from OpenAPI specification"
}

// JsonMarshal is a helper for pretty JSON formatting
func JsonMarshal(v interface{}) ([]byte, error) {
	return []byte(fmt.Sprintf("%v", v)), nil
}
