package generator

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// JavaSpringGenerator generates Java/Kotlin code for Spring Boot MCP functions
type JavaSpringGenerator struct {
	*BaseGenerator
	useKotlin bool
}

// NewJavaSpringGenerator creates a new Java Spring Boot generator
func NewJavaSpringGenerator(useKotlin bool) *JavaSpringGenerator {
	language := "java"
	if useKotlin {
		language = "kotlin"
	}

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

	gen := &JavaSpringGenerator{
		BaseGenerator: NewBaseGenerator(language, "spring-boot", "1.0.0", features),
		useKotlin:     useKotlin,
	}

	return gen
}

// Generate generates Java/Kotlin code from the intermediate representation
func (g *JavaSpringGenerator) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
	startTime := time.Now()

	// Validate IR
	result, err := g.Validate(ir)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	if !result.Valid {
		return nil, fmt.Errorf("IR validation failed: %v", result.Errors)
	}

	files := []GeneratedFile{}

	// Generate main application class
	appFile, err := g.generateApplicationFile(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate application file: %w", err)
	}
	files = append(files, appFile)

	// Generate controller
	controllerFile, err := g.generateControllerFile(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate controller: %w", err)
	}
	files = append(files, controllerFile)

	// Generate service layer
	serviceFile, err := g.generateServiceFile(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate service: %w", err)
	}
	files = append(files, serviceFile)

	// Generate models/DTOs
	if len(ir.Types) > 0 {
		modelsFile, err := g.generateModelsFile(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate models: %w", err)
		}
		files = append(files, modelsFile)
	}

	// Generate API client
	clientFile, err := g.generateClientFile(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate client: %w", err)
	}
	files = append(files, clientFile)

	// Generate configuration
	configFile, err := g.generateConfigFile(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate config: %w", err)
	}
	files = append(files, configFile)

	// Generate pom.xml (Maven)
	pomFile, err := g.generatePomXml(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate pom.xml: %w", err)
	}
	files = append(files, pomFile)

	// Generate application.properties
	propsFile, err := g.generateApplicationProperties(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate application.properties: %w", err)
	}
	files = append(files, propsFile)

	// Generate README
	if opts.IncludeDocs {
		readmeFile, err := g.generateReadme(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate README: %w", err)
		}
		files = append(files, readmeFile)
	}

	// Generate tests
	if opts.IncludeTests {
		testsFile, err := g.generateTestFile(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate tests: %w", err)
		}
		files = append(files, testsFile)
	}

	// Calculate dependencies
	deps := g.generateDependencies(ir, opts)

	// Calculate statistics
	stats := GenerationStatistics{
		TotalFiles:     len(files),
		TotalLines:     g.CountLines(files),
		TotalEndpoints: len(ir.Endpoints),
		TotalTypes:     len(ir.Types),
		GenerationTime: time.Since(startTime),
	}

	return g.CreateGeneratedCode(files, deps, stats), nil
}

// generateApplicationFile generates the main Spring Boot application class
func (g *JavaSpringGenerator) generateApplicationFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)
	className := toPascalCase(ir.Metadata.Name) + "Application"

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s\n\n", packageName))
		sb.WriteString("import org.springframework.boot.autoconfigure.SpringBootApplication\n")
		sb.WriteString("import org.springframework.boot.runApplication\n\n")
		sb.WriteString("@SpringBootApplication\n")
		sb.WriteString(fmt.Sprintf("class %s\n\n", className))
		sb.WriteString("fun main(args: Array<String>) {\n")
		sb.WriteString(fmt.Sprintf("    runApplication<%s>(*args)\n", className))
		sb.WriteString("}\n")

		return GeneratedFile{
			Path:     fmt.Sprintf("src/main/kotlin/%s/%s.kt", strings.ReplaceAll(packageName, ".", "/"), className),
			Content:  sb.String(),
			Type:     FileTypeSource,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s;\n\n", packageName))
	sb.WriteString("import org.springframework.boot.SpringApplication;\n")
	sb.WriteString("import org.springframework.boot.autoconfigure.SpringBootApplication;\n\n")
	sb.WriteString("/**\n")
	sb.WriteString(fmt.Sprintf(" * %s MCP Server\n", ir.Metadata.Title))
	if ir.Metadata.Description != "" {
		sb.WriteString(fmt.Sprintf(" * %s\n", ir.Metadata.Description))
	}
	sb.WriteString(" * Auto-generated by MCPOverflow\n")
	sb.WriteString(" */\n")
	sb.WriteString("@SpringBootApplication\n")
	sb.WriteString(fmt.Sprintf("public class %s {\n\n", className))
	sb.WriteString("    public static void main(String[] args) {\n")
	sb.WriteString(fmt.Sprintf("        SpringApplication.run(%s.class, args);\n", className))
	sb.WriteString("    }\n")
	sb.WriteString("}\n")

	return GeneratedFile{
		Path:     fmt.Sprintf("src/main/java/%s/%s.java", strings.ReplaceAll(packageName, ".", "/"), className),
		Content:  sb.String(),
		Type:     FileTypeSource,
		Language: "java",
	}, nil
}

// generateControllerFile generates the Spring REST controller
func (g *JavaSpringGenerator) generateControllerFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)
	className := "McpController"

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s.controller\n\n", packageName))
		sb.WriteString("import org.springframework.web.bind.annotation.*\n")
		sb.WriteString("import org.springframework.http.ResponseEntity\n")
		sb.WriteString(fmt.Sprintf("import %s.service.McpService\n", packageName))
		sb.WriteString(fmt.Sprintf("import %s.model.*\n\n", packageName))

		sb.WriteString("@RestController\n")
		sb.WriteString("@RequestMapping(\"/\")\n")
		sb.WriteString("@CrossOrigin(origins = [\"*\"])\n")
		sb.WriteString(fmt.Sprintf("class %s(private val mcpService: McpService) {\n\n", className))

		// Manifest endpoint
		sb.WriteString("    @GetMapping(\"/.well-known/mcp.json\")\n")
		sb.WriteString("    fun getManifest(): ResponseEntity<Map<String, Any>> {\n")
		sb.WriteString("        return ResponseEntity.ok(mcpService.getManifest())\n")
		sb.WriteString("    }\n\n")

		// Execute endpoint
		sb.WriteString("    @PostMapping(\"/mcp/execute\")\n")
		sb.WriteString("    fun executeTool(@RequestBody request: ExecuteRequest): ResponseEntity<Any> {\n")
		sb.WriteString("        return ResponseEntity.ok(mcpService.executeTool(request))\n")
		sb.WriteString("    }\n")
		sb.WriteString("}\n")

		return GeneratedFile{
			Path:     fmt.Sprintf("src/main/kotlin/%s/controller/%s.kt", strings.ReplaceAll(packageName, ".", "/"), className),
			Content:  sb.String(),
			Type:     FileTypeSource,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s.controller;\n\n", packageName))
	sb.WriteString("import org.springframework.beans.factory.annotation.Autowired;\n")
	sb.WriteString("import org.springframework.http.ResponseEntity;\n")
	sb.WriteString("import org.springframework.web.bind.annotation.*;\n")
	sb.WriteString(fmt.Sprintf("import %s.service.McpService;\n", packageName))
	sb.WriteString(fmt.Sprintf("import %s.model.*;\n", packageName))
	sb.WriteString("import java.util.Map;\n\n")

	sb.WriteString("/**\n")
	sb.WriteString(" * MCP REST Controller\n")
	sb.WriteString(" */\n")
	sb.WriteString("@RestController\n")
	sb.WriteString("@RequestMapping(\"/\")\n")
	sb.WriteString("@CrossOrigin(origins = \"*\")\n")
	sb.WriteString(fmt.Sprintf("public class %s {\n\n", className))

	sb.WriteString("    @Autowired\n")
	sb.WriteString("    private McpService mcpService;\n\n")

	// Manifest endpoint
	sb.WriteString("    /**\n")
	sb.WriteString("     * Get MCP manifest\n")
	sb.WriteString("     */\n")
	sb.WriteString("    @GetMapping(\"/.well-known/mcp.json\")\n")
	sb.WriteString("    public ResponseEntity<Map<String, Object>> getManifest() {\n")
	sb.WriteString("        return ResponseEntity.ok(mcpService.getManifest());\n")
	sb.WriteString("    }\n\n")

	// Execute endpoint
	sb.WriteString("    /**\n")
	sb.WriteString("     * Execute MCP tool\n")
	sb.WriteString("     */\n")
	sb.WriteString("    @PostMapping(\"/mcp/execute\")\n")
	sb.WriteString("    public ResponseEntity<Object> executeTool(@RequestBody ExecuteRequest request) {\n")
	sb.WriteString("        return ResponseEntity.ok(mcpService.executeTool(request));\n")
	sb.WriteString("    }\n")
	sb.WriteString("}\n")

	return GeneratedFile{
		Path:     fmt.Sprintf("src/main/java/%s/controller/%s.java", strings.ReplaceAll(packageName, ".", "/"), className),
		Content:  sb.String(),
		Type:     FileTypeSource,
		Language: "java",
	}, nil
}

// generateServiceFile generates the service layer
func (g *JavaSpringGenerator) generateServiceFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)
	className := "McpService"

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s.service\n\n", packageName))
		sb.WriteString("import org.springframework.stereotype.Service\n")
		sb.WriteString("import org.springframework.beans.factory.annotation.Autowired\n")
		sb.WriteString(fmt.Sprintf("import %s.client.ApiClient\n", packageName))
		sb.WriteString(fmt.Sprintf("import %s.model.*\n\n", packageName))

		sb.WriteString("@Service\n")
		sb.WriteString(fmt.Sprintf("class %s(@Autowired private val apiClient: ApiClient) {\n\n", className))

		// Manifest method
		sb.WriteString("    fun getManifest(): Map<String, Any> {\n")
		sb.WriteString("        return mapOf(\n")
		sb.WriteString(fmt.Sprintf("            \"name\" to \"%s\",\n", ir.Metadata.Name))
		sb.WriteString(fmt.Sprintf("            \"version\" to \"%s\",\n", ir.Metadata.Version))
		if ir.Metadata.Description != "" {
			sb.WriteString(fmt.Sprintf("            \"description\" to \"%s\",\n", escapeString(ir.Metadata.Description)))
		}
		sb.WriteString("            \"tools\" to getTools()\n")
		sb.WriteString("        )\n")
		sb.WriteString("    }\n\n")

		// Tools list method
		sb.WriteString("    fun getTools(): List<Map<String, Any>> {\n")
		sb.WriteString("        return listOf(\n")
		for i, endpoint := range ir.Endpoints {
			toolName := g.getToolName(endpoint)
			description := endpoint.Description
			if description == "" {
				description = fmt.Sprintf("%s %s", endpoint.Method, endpoint.Path)
			}

			sb.WriteString("            mapOf(\n")
			sb.WriteString(fmt.Sprintf("                \"name\" to \"%s\",\n", toolName))
			sb.WriteString(fmt.Sprintf("                \"description\" to \"%s\"\n", escapeString(description)))
			sb.WriteString("            )")
			if i < len(ir.Endpoints)-1 {
				sb.WriteString(",")
			}
			sb.WriteString("\n")
		}
		sb.WriteString("        )\n")
		sb.WriteString("    }\n\n")

		// Execute method
		sb.WriteString("    fun executeTool(request: ExecuteRequest): Any {\n")
		sb.WriteString("        return when (request.tool) {\n")
		for _, endpoint := range ir.Endpoints {
			toolName := g.getToolName(endpoint)
			methodName := toCamelCase(sanitizeIdentifier(toolName))
			sb.WriteString(fmt.Sprintf("            \"%s\" -> apiClient.%s(request.arguments)\n", toolName, methodName))
		}
		sb.WriteString("            else -> throw IllegalArgumentException(\"Unknown tool: ${request.tool}\")\n")
		sb.WriteString("        }\n")
		sb.WriteString("    }\n")
		sb.WriteString("}\n")

		return GeneratedFile{
			Path:     fmt.Sprintf("src/main/kotlin/%s/service/%s.kt", strings.ReplaceAll(packageName, ".", "/"), className),
			Content:  sb.String(),
			Type:     FileTypeSource,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s.service;\n\n", packageName))
	sb.WriteString("import org.springframework.beans.factory.annotation.Autowired;\n")
	sb.WriteString("import org.springframework.stereotype.Service;\n")
	sb.WriteString(fmt.Sprintf("import %s.client.ApiClient;\n", packageName))
	sb.WriteString(fmt.Sprintf("import %s.model.*;\n", packageName))
	sb.WriteString("import java.util.*;\n\n")

	sb.WriteString("/**\n")
	sb.WriteString(" * MCP Service Layer\n")
	sb.WriteString(" */\n")
	sb.WriteString("@Service\n")
	sb.WriteString(fmt.Sprintf("public class %s {\n\n", className))

	sb.WriteString("    @Autowired\n")
	sb.WriteString("    private ApiClient apiClient;\n\n")

	// Manifest method
	sb.WriteString("    public Map<String, Object> getManifest() {\n")
	sb.WriteString("        Map<String, Object> manifest = new HashMap<>();\n")
	sb.WriteString(fmt.Sprintf("        manifest.put(\"name\", \"%s\");\n", ir.Metadata.Name))
	sb.WriteString(fmt.Sprintf("        manifest.put(\"version\", \"%s\");\n", ir.Metadata.Version))
	if ir.Metadata.Description != "" {
		sb.WriteString(fmt.Sprintf("        manifest.put(\"description\", \"%s\");\n", escapeString(ir.Metadata.Description)))
	}
	sb.WriteString("        manifest.put(\"tools\", getTools());\n")
	sb.WriteString("        return manifest;\n")
	sb.WriteString("    }\n\n")

	// Tools method
	sb.WriteString("    public List<Map<String, Object>> getTools() {\n")
	sb.WriteString("        List<Map<String, Object>> tools = new ArrayList<>();\n")
	for _, endpoint := range ir.Endpoints {
		toolName := g.getToolName(endpoint)
		description := endpoint.Description
		if description == "" {
			description = fmt.Sprintf("%s %s", endpoint.Method, endpoint.Path)
		}

		sb.WriteString("        {\n")
		sb.WriteString("            Map<String, Object> tool = new HashMap<>();\n")
		sb.WriteString(fmt.Sprintf("            tool.put(\"name\", \"%s\");\n", toolName))
		sb.WriteString(fmt.Sprintf("            tool.put(\"description\", \"%s\");\n", escapeString(description)))
		sb.WriteString("            tools.add(tool);\n")
		sb.WriteString("        }\n")
	}
	sb.WriteString("        return tools;\n")
	sb.WriteString("    }\n\n")

	// Execute method
	sb.WriteString("    public Object executeTool(ExecuteRequest request) {\n")
	sb.WriteString("        String toolName = request.getTool();\n")
	sb.WriteString("        Map<String, Object> arguments = request.getArguments();\n\n")
	sb.WriteString("        switch (toolName) {\n")
	for _, endpoint := range ir.Endpoints {
		toolName := g.getToolName(endpoint)
		methodName := toCamelCase(sanitizeIdentifier(toolName))
		sb.WriteString(fmt.Sprintf("            case \"%s\":\n", toolName))
		sb.WriteString(fmt.Sprintf("                return apiClient.%s(arguments);\n", methodName))
	}
	sb.WriteString("            default:\n")
	sb.WriteString("                throw new IllegalArgumentException(\"Unknown tool: \" + toolName);\n")
	sb.WriteString("        }\n")
	sb.WriteString("    }\n")
	sb.WriteString("}\n")

	return GeneratedFile{
		Path:     fmt.Sprintf("src/main/java/%s/service/%s.java", strings.ReplaceAll(packageName, ".", "/"), className),
		Content:  sb.String(),
		Type:     FileTypeSource,
		Language: "java",
	}, nil
}

// generateModelsFile generates the model classes/DTOs
func (g *JavaSpringGenerator) generateModelsFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s.model\n\n", packageName))
		sb.WriteString("import com.fasterxml.jackson.annotation.JsonProperty\n\n")

		// ExecuteRequest
		sb.WriteString("data class ExecuteRequest(\n")
		sb.WriteString("    val tool: String,\n")
		sb.WriteString("    val arguments: Map<String, Any>\n")
		sb.WriteString(")\n\n")

		// Generate type definitions
		for _, typeDef := range ir.Types {
			sb.WriteString(g.generateTypeDefinitionKotlin(typeDef))
			sb.WriteString("\n")
		}

		return GeneratedFile{
			Path:     fmt.Sprintf("src/main/kotlin/%s/model/Models.kt", strings.ReplaceAll(packageName, ".", "/")),
			Content:  sb.String(),
			Type:     FileTypeSource,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s.model;\n\n", packageName))
	sb.WriteString("import com.fasterxml.jackson.annotation.JsonProperty;\n")
	sb.WriteString("import java.util.Map;\n\n")

	// ExecuteRequest class
	sb.WriteString("/**\n")
	sb.WriteString(" * MCP Tool Execution Request\n")
	sb.WriteString(" */\n")
	sb.WriteString("public class ExecuteRequest {\n")
	sb.WriteString("    private String tool;\n")
	sb.WriteString("    private Map<String, Object> arguments;\n\n")
	sb.WriteString("    public String getTool() { return tool; }\n")
	sb.WriteString("    public void setTool(String tool) { this.tool = tool; }\n\n")
	sb.WriteString("    public Map<String, Object> getArguments() { return arguments; }\n")
	sb.WriteString("    public void setArguments(Map<String, Object> arguments) { this.arguments = arguments; }\n")
	sb.WriteString("}\n\n")

	// Generate type definitions
	for _, typeDef := range ir.Types {
		sb.WriteString(g.generateTypeDefinitionJava(typeDef))
		sb.WriteString("\n")
	}

	return GeneratedFile{
		Path:     fmt.Sprintf("src/main/java/%s/model/Models.java", strings.ReplaceAll(packageName, ".", "/")),
		Content:  sb.String(),
		Type:     FileTypeSource,
		Language: "java",
	}, nil
}

// generateTypeDefinitionJava generates a Java class from a type definition
func (g *JavaSpringGenerator) generateTypeDefinitionJava(typeDef parser.TypeDefinition) string {
	var sb strings.Builder
	className := toPascalCase(typeDef.Name)

	if typeDef.Description != "" {
		sb.WriteString(fmt.Sprintf("/** %s */\n", typeDef.Description))
	}
	sb.WriteString(fmt.Sprintf("public class %s {\n", className))

	// Fields
	for propName, propDef := range typeDef.Properties {
		javaType := g.typeToJava(propDef.Type)
		fieldName := toCamelCase(propName)

		if propDef.Description != "" {
			sb.WriteString(fmt.Sprintf("    /** %s */\n", propDef.Description))
		}
		sb.WriteString(fmt.Sprintf("    private %s %s;\n\n", javaType, fieldName))
	}

	// Getters and setters
	for propName, propDef := range typeDef.Properties {
		javaType := g.typeToJava(propDef.Type)
		fieldName := toCamelCase(propName)
		methodName := toPascalCase(propName)

		sb.WriteString(fmt.Sprintf("    public %s get%s() { return %s; }\n", javaType, methodName, fieldName))
		sb.WriteString(fmt.Sprintf("    public void set%s(%s %s) { this.%s = %s; }\n\n", methodName, javaType, fieldName, fieldName, fieldName))
	}

	sb.WriteString("}\n")
	return sb.String()
}

// generateTypeDefinitionKotlin generates a Kotlin data class
func (g *JavaSpringGenerator) generateTypeDefinitionKotlin(typeDef parser.TypeDefinition) string {
	var sb strings.Builder
	className := toPascalCase(typeDef.Name)

	if typeDef.Description != "" {
		sb.WriteString(fmt.Sprintf("/** %s */\n", typeDef.Description))
	}

	sb.WriteString(fmt.Sprintf("data class %s(\n", className))

	props := make([]string, 0, len(typeDef.Properties))
	for propName, propDef := range typeDef.Properties {
		kotlinType := g.typeToKotlin(propDef.Type)
		fieldName := toCamelCase(propName)

		// Check if optional
		isRequired := contains(typeDef.Required, propName)
		if !isRequired {
			kotlinType = kotlinType + "?"
		}

		prop := fmt.Sprintf("    val %s: %s", fieldName, kotlinType)
		if propDef.Description != "" {
			prop = fmt.Sprintf("    /** %s */\n%s", propDef.Description, prop)
		}
		props = append(props, prop)
	}

	sb.WriteString(strings.Join(props, ",\n"))
	sb.WriteString("\n)\n")

	return sb.String()
}

// generateClientFile generates the API client
func (g *JavaSpringGenerator) generateClientFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)
	className := "ApiClient"

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s.client\n\n", packageName))
		sb.WriteString("import org.springframework.stereotype.Component\n")
		sb.WriteString("import org.springframework.web.client.RestTemplate\n")
		sb.WriteString("import org.springframework.beans.factory.annotation.Value\n\n")

		sb.WriteString("@Component\n")
		sb.WriteString("class ApiClient {\n\n")
		sb.WriteString("    @Value(\"\\${api.base.url}\")\n")
		sb.WriteString("    private lateinit var baseUrl: String\n\n")
		sb.WriteString("    private val restTemplate = RestTemplate()\n\n")

		// Generate client methods
		for _, endpoint := range ir.Endpoints {
			sb.WriteString(g.generateClientMethodKotlin(endpoint))
			sb.WriteString("\n")
		}

		sb.WriteString("}\n")

		return GeneratedFile{
			Path:     fmt.Sprintf("src/main/kotlin/%s/client/%s.kt", strings.ReplaceAll(packageName, ".", "/"), className),
			Content:  sb.String(),
			Type:     FileTypeSource,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s.client;\n\n", packageName))
	sb.WriteString("import org.springframework.beans.factory.annotation.Value;\n")
	sb.WriteString("import org.springframework.stereotype.Component;\n")
	sb.WriteString("import org.springframework.web.client.RestTemplate;\n")
	sb.WriteString("import java.util.Map;\n\n")

	sb.WriteString("/**\n")
	sb.WriteString(" * API Client\n")
	sb.WriteString(" */\n")
	sb.WriteString("@Component\n")
	sb.WriteString(fmt.Sprintf("public class %s {\n\n", className))

	sb.WriteString("    @Value(\"${api.base.url}\")\n")
	sb.WriteString("    private String baseUrl;\n\n")
	sb.WriteString("    private final RestTemplate restTemplate = new RestTemplate();\n\n")

	// Generate client methods
	for _, endpoint := range ir.Endpoints {
		sb.WriteString(g.generateClientMethodJava(endpoint))
		sb.WriteString("\n")
	}

	sb.WriteString("}\n")

	return GeneratedFile{
		Path:     fmt.Sprintf("src/main/java/%s/client/%s.java", strings.ReplaceAll(packageName, ".", "/"), className),
		Content:  sb.String(),
		Type:     FileTypeSource,
		Language: "java",
	}, nil
}

// generateClientMethodJava generates a Java client method
func (g *JavaSpringGenerator) generateClientMethodJava(endpoint parser.UnifiedEndpoint) string {
	var sb strings.Builder
	toolName := g.getToolName(endpoint)
	methodName := toCamelCase(sanitizeIdentifier(toolName))

	if endpoint.Description != "" {
		sb.WriteString(fmt.Sprintf("    /** %s */\n", endpoint.Description))
	}
	sb.WriteString(fmt.Sprintf("    public Object %s(Map<String, Object> args) {\n", methodName))

	// Build URL
	path := endpoint.Path
	for _, param := range endpoint.Parameters {
		if param.In == "path" {
			path = strings.ReplaceAll(path, "{"+param.Name+"}", "{"+toCamelCase(param.Name)+"}")
		}
	}

	sb.WriteString(fmt.Sprintf("        String url = baseUrl + \"%s\";\n", path))
	sb.WriteString("        // TODO: Implement HTTP request\n")
	sb.WriteString("        return null;\n")
	sb.WriteString("    }\n")

	return sb.String()
}

// generateClientMethodKotlin generates a Kotlin client method
func (g *JavaSpringGenerator) generateClientMethodKotlin(endpoint parser.UnifiedEndpoint) string {
	var sb strings.Builder
	toolName := g.getToolName(endpoint)
	methodName := toCamelCase(sanitizeIdentifier(toolName))

	if endpoint.Description != "" {
		sb.WriteString(fmt.Sprintf("    /** %s */\n", endpoint.Description))
	}
	sb.WriteString(fmt.Sprintf("    fun %s(args: Map<String, Any>): Any? {\n", methodName))

	path := endpoint.Path
	sb.WriteString(fmt.Sprintf("        val url = \"$baseUrl%s\"\n", path))
	sb.WriteString("        // TODO: Implement HTTP request\n")
	sb.WriteString("        return null\n")
	sb.WriteString("    }\n")

	return sb.String()
}

// generateConfigFile generates Spring configuration
func (g *JavaSpringGenerator) generateConfigFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)
	className := "AppConfig"

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s.config\n\n", packageName))
		sb.WriteString("import org.springframework.context.annotation.Configuration\n")
		sb.WriteString("import org.springframework.web.servlet.config.annotation.CorsRegistry\n")
		sb.WriteString("import org.springframework.web.servlet.config.annotation.WebMvcConfigurer\n\n")

		sb.WriteString("@Configuration\n")
		sb.WriteString("class AppConfig : WebMvcConfigurer {\n")
		sb.WriteString("    override fun addCorsMappings(registry: CorsRegistry) {\n")
		sb.WriteString("        registry.addMapping(\"/**\").allowedOrigins(\"*\")\n")
		sb.WriteString("    }\n")
		sb.WriteString("}\n")

		return GeneratedFile{
			Path:     fmt.Sprintf("src/main/kotlin/%s/config/%s.kt", strings.ReplaceAll(packageName, ".", "/"), className),
			Content:  sb.String(),
			Type:     FileTypeConfig,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s.config;\n\n", packageName))
	sb.WriteString("import org.springframework.context.annotation.Configuration;\n")
	sb.WriteString("import org.springframework.web.servlet.config.annotation.CorsRegistry;\n")
	sb.WriteString("import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;\n\n")

	sb.WriteString("@Configuration\n")
	sb.WriteString(fmt.Sprintf("public class %s implements WebMvcConfigurer {\n\n", className))
	sb.WriteString("    @Override\n")
	sb.WriteString("    public void addCorsMappings(CorsRegistry registry) {\n")
	sb.WriteString("        registry.addMapping(\"/**\").allowedOrigins(\"*\");\n")
	sb.WriteString("    }\n")
	sb.WriteString("}\n")

	return GeneratedFile{
		Path:     fmt.Sprintf("src/main/java/%s/config/%s.java", strings.ReplaceAll(packageName, ".", "/"), className),
		Content:  sb.String(),
		Type:     FileTypeConfig,
		Language: "java",
	}, nil
}

// generatePomXml generates Maven pom.xml
func (g *JavaSpringGenerator) generatePomXml(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder

	artifactId := toKebabCase(ir.Metadata.Name)
	groupId := "com.mcp"

	sb.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
	sb.WriteString("<project xmlns=\"http://maven.apache.org/POM/4.0.0\"\n")
	sb.WriteString("         xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n")
	sb.WriteString("         xsi:schemaLocation=\"http://maven.apache.org/POM/4.0.0\n")
	sb.WriteString("         https://maven.apache.org/xsd/maven-4.0.0.xsd\">\n")
	sb.WriteString("    <modelVersion>4.0.0</modelVersion>\n\n")

	sb.WriteString("    <parent>\n")
	sb.WriteString("        <groupId>org.springframework.boot</groupId>\n")
	sb.WriteString("        <artifactId>spring-boot-starter-parent</artifactId>\n")
	sb.WriteString("        <version>3.2.0</version>\n")
	sb.WriteString("    </parent>\n\n")

	sb.WriteString(fmt.Sprintf("    <groupId>%s</groupId>\n", groupId))
	sb.WriteString(fmt.Sprintf("    <artifactId>%s</artifactId>\n", artifactId))
	sb.WriteString(fmt.Sprintf("    <version>%s</version>\n", ir.Metadata.Version))
	sb.WriteString(fmt.Sprintf("    <name>%s</name>\n", ir.Metadata.Title))
	if ir.Metadata.Description != "" {
		sb.WriteString(fmt.Sprintf("    <description>%s</description>\n", escapeString(ir.Metadata.Description)))
	}
	sb.WriteString("\n")

	sb.WriteString("    <properties>\n")
	if g.useKotlin {
		sb.WriteString("        <kotlin.version>1.9.21</kotlin.version>\n")
	} else {
		sb.WriteString("        <java.version>17</java.version>\n")
	}
	sb.WriteString("    </properties>\n\n")

	sb.WriteString("    <dependencies>\n")
	sb.WriteString("        <dependency>\n")
	sb.WriteString("            <groupId>org.springframework.boot</groupId>\n")
	sb.WriteString("            <artifactId>spring-boot-starter-web</artifactId>\n")
	sb.WriteString("        </dependency>\n")

	if g.useKotlin {
		sb.WriteString("        <dependency>\n")
		sb.WriteString("            <groupId>org.jetbrains.kotlin</groupId>\n")
		sb.WriteString("            <artifactId>kotlin-stdlib</artifactId>\n")
		sb.WriteString("        </dependency>\n")
		sb.WriteString("        <dependency>\n")
		sb.WriteString("            <groupId>org.jetbrains.kotlin</groupId>\n")
		sb.WriteString("            <artifactId>kotlin-reflect</artifactId>\n")
		sb.WriteString("        </dependency>\n")
		sb.WriteString("        <dependency>\n")
		sb.WriteString("            <groupId>com.fasterxml.jackson.module</groupId>\n")
		sb.WriteString("            <artifactId>jackson-module-kotlin</artifactId>\n")
		sb.WriteString("        </dependency>\n")
	}

	sb.WriteString("        <dependency>\n")
	sb.WriteString("            <groupId>org.springframework.boot</groupId>\n")
	sb.WriteString("            <artifactId>spring-boot-starter-test</artifactId>\n")
	sb.WriteString("            <scope>test</scope>\n")
	sb.WriteString("        </dependency>\n")
	sb.WriteString("    </dependencies>\n\n")

	sb.WriteString("    <build>\n")
	sb.WriteString("        <plugins>\n")
	sb.WriteString("            <plugin>\n")
	sb.WriteString("                <groupId>org.springframework.boot</groupId>\n")
	sb.WriteString("                <artifactId>spring-boot-maven-plugin</artifactId>\n")
	sb.WriteString("            </plugin>\n")

	if g.useKotlin {
		sb.WriteString("            <plugin>\n")
		sb.WriteString("                <groupId>org.jetbrains.kotlin</groupId>\n")
		sb.WriteString("                <artifactId>kotlin-maven-plugin</artifactId>\n")
		sb.WriteString("            </plugin>\n")
	}

	sb.WriteString("        </plugins>\n")
	sb.WriteString("    </build>\n")
	sb.WriteString("</project>\n")

	return GeneratedFile{
		Path:     "pom.xml",
		Content:  sb.String(),
		Type:     FileTypeConfig,
		Language: "xml",
	}, nil
}

// generateApplicationProperties generates application.properties
func (g *JavaSpringGenerator) generateApplicationProperties(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder

	sb.WriteString("# Application Configuration\n")
	sb.WriteString(fmt.Sprintf("spring.application.name=%s\n", ir.Metadata.Name))
	sb.WriteString("server.port=8080\n\n")

	sb.WriteString("# API Configuration\n")
	server := GetPrimaryServer(ir)
	sb.WriteString(fmt.Sprintf("api.base.url=%s\n", server))

	if NeedsAuthentication(ir) {
		sb.WriteString("\n# Authentication\n")
		sb.WriteString("api.key=${API_KEY:}\n")
	}

	return GeneratedFile{
		Path:     "src/main/resources/application.properties",
		Content:  sb.String(),
		Type:     FileTypeConfig,
		Language: "properties",
	}, nil
}

// generateReadme generates README documentation
func (g *JavaSpringGenerator) generateReadme(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder

	lang := "Java"
	if g.useKotlin {
		lang = "Kotlin"
	}

	sb.WriteString(fmt.Sprintf("# %s - %s Spring Boot MCP Server\n\n", ir.Metadata.Title, lang))

	if ir.Metadata.Description != "" {
		sb.WriteString(ir.Metadata.Description + "\n\n")
	}

	sb.WriteString(fmt.Sprintf("Auto-generated %s Spring Boot MCP server by MCPOverflow.\n\n", lang))

	sb.WriteString("## Requirements\n\n")
	sb.WriteString("- Java 17+\n")
	sb.WriteString("- Maven 3.6+\n\n")

	sb.WriteString("## Build & Run\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString("# Build\n")
	sb.WriteString("mvn clean package\n\n")
	sb.WriteString("# Run\n")
	sb.WriteString("mvn spring-boot:run\n")
	sb.WriteString("```\n\n")

	sb.WriteString("## Configuration\n\n")
	sb.WriteString("Edit `src/main/resources/application.properties`:\n\n")
	sb.WriteString("```properties\n")
	sb.WriteString(fmt.Sprintf("api.base.url=%s\n", GetPrimaryServer(ir)))
	if NeedsAuthentication(ir) {
		sb.WriteString("api.key=your-api-key-here\n")
	}
	sb.WriteString("```\n\n")

	sb.WriteString("## Endpoints\n\n")
	sb.WriteString("- `GET /.well-known/mcp.json` - MCP manifest\n")
	sb.WriteString("- `POST /mcp/execute` - Execute MCP tool\n\n")

	sb.WriteString("## Available Tools\n\n")
	for _, endpoint := range ir.Endpoints {
		toolName := g.getToolName(endpoint)
		description := endpoint.Description
		if description == "" {
			description = fmt.Sprintf("%s %s", endpoint.Method, endpoint.Path)
		}
		sb.WriteString(fmt.Sprintf("- `%s` - %s\n", toolName, description))
	}

	return GeneratedFile{
		Path:     "README.md",
		Content:  sb.String(),
		Type:     FileTypeDocs,
		Language: "markdown",
	}, nil
}

// generateTestFile generates test cases
func (g *JavaSpringGenerator) generateTestFile(ir *parser.IntermediateRepresentation, opts GenerateOptions) (GeneratedFile, error) {
	var sb strings.Builder
	packageName := g.getPackageName(ir)
	className := "McpControllerTest"

	if g.useKotlin {
		sb.WriteString(fmt.Sprintf("package %s\n\n", packageName))
		sb.WriteString("import org.junit.jupiter.api.Test\n")
		sb.WriteString("import org.springframework.boot.test.context.SpringBootTest\n\n")

		sb.WriteString("@SpringBootTest\n")
		sb.WriteString(fmt.Sprintf("class %s {\n\n", className))
		sb.WriteString("    @Test\n")
		sb.WriteString("    fun contextLoads() {\n")
		sb.WriteString("        // Test that Spring context loads\n")
		sb.WriteString("    }\n")
		sb.WriteString("}\n")

		return GeneratedFile{
			Path:     fmt.Sprintf("src/test/kotlin/%s/%s.kt", strings.ReplaceAll(packageName, ".", "/"), className),
			Content:  sb.String(),
			Type:     FileTypeTest,
			Language: "kotlin",
		}, nil
	}

	// Java version
	sb.WriteString(fmt.Sprintf("package %s;\n\n", packageName))
	sb.WriteString("import org.junit.jupiter.api.Test;\n")
	sb.WriteString("import org.springframework.boot.test.context.SpringBootTest;\n\n")

	sb.WriteString("@SpringBootTest\n")
	sb.WriteString(fmt.Sprintf("public class %s {\n\n", className))
	sb.WriteString("    @Test\n")
	sb.WriteString("    public void contextLoads() {\n")
	sb.WriteString("        // Test that Spring context loads\n")
	sb.WriteString("    }\n")
	sb.WriteString("}\n")

	return GeneratedFile{
		Path:     fmt.Sprintf("src/test/java/%s/%s.java", strings.ReplaceAll(packageName, ".", "/"), className),
		Content:  sb.String(),
		Type:     FileTypeTest,
		Language: "java",
	}, nil
}

// generateDependencies returns the list of dependencies
func (g *JavaSpringGenerator) generateDependencies(ir *parser.IntermediateRepresentation, opts GenerateOptions) []Dependency {
	deps := []Dependency{
		{
			Name:    "spring-boot-starter-web",
			Version: "3.2.0",
			Type:    DependencyTypeRuntime,
		},
		{
			Name:    "spring-boot-starter-test",
			Version: "3.2.0",
			Type:    DependencyTypeDev,
		},
	}

	if g.useKotlin {
		deps = append(deps, Dependency{
			Name:    "kotlin-stdlib",
			Version: "1.9.21",
			Type:    DependencyTypeRuntime,
		})
	}

	return deps
}

// Helper methods

func (g *JavaSpringGenerator) getPackageName(ir *parser.IntermediateRepresentation) string {
	name := strings.ToLower(ir.Metadata.Name)
	name = strings.ReplaceAll(name, "-", "")
	name = strings.ReplaceAll(name, "_", "")
	return "com.mcp." + name
}

func (g *JavaSpringGenerator) getToolName(endpoint parser.UnifiedEndpoint) string {
	if endpoint.Name != "" {
		return toSnakeCase(endpoint.Name)
	}

	if endpoint.ID != "" {
		return toSnakeCase(endpoint.ID)
	}

	method := strings.ToLower(endpoint.Method)
	path := strings.Trim(endpoint.Path, "/")
	path = strings.ReplaceAll(path, "/", "_")
	path = strings.ReplaceAll(path, "{", "")
	path = strings.ReplaceAll(path, "}", "")

	return fmt.Sprintf("%s_%s", method, path)
}

func (g *JavaSpringGenerator) typeToJava(t string) string {
	switch t {
	case "string":
		return "String"
	case "integer":
		return "Integer"
	case "number":
		return "Double"
	case "boolean":
		return "Boolean"
	case "array":
		return "List<Object>"
	case "object":
		return "Map<String, Object>"
	default:
		return "Object"
	}
}

func (g *JavaSpringGenerator) typeToKotlin(t string) string {
	switch t {
	case "string":
		return "String"
	case "integer":
		return "Int"
	case "number":
		return "Double"
	case "boolean":
		return "Boolean"
	case "array":
		return "List<Any>"
	case "object":
		return "Map<String, Any>"
	default:
		return "Any"
	}
}
