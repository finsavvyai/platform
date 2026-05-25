package generator

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// RubySinatraGenerator generates Ruby Sinatra MCP servers
type RubySinatraGenerator struct {
	*BaseGenerator
}

// NewRubySinatraGenerator creates a new Ruby Sinatra generator
func NewRubySinatraGenerator() *RubySinatraGenerator {
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
	}

	gen := &RubySinatraGenerator{
		BaseGenerator: NewBaseGenerator("ruby", "sinatra", "1.0.0", features),
	}

	return gen
}

// Generate generates Ruby Sinatra code from IR
func (g *RubySinatraGenerator) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
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
		{"app.rb", FileTypeSource, g.generateApp},
		{"lib/mcp_service.rb", FileTypeSource, g.generateMcpService},
		{"lib/api_client.rb", FileTypeSource, g.generateApiClient},
		{"lib/models.rb", FileTypeSource, g.generateModels},
		{"config.ru", FileTypeConfig, g.generateConfigRu},
		{"Gemfile", FileTypeConfig, g.generateGemfile},
		{"config/environment.rb", FileTypeConfig, g.generateEnvironment},
		{"spec/app_spec.rb", FileTypeTest, g.generateTests},
		{"spec/spec_helper.rb", FileTypeTest, g.generateSpecHelper},
		{"README.md", FileTypeDocs, g.generateReadme},
		{"Dockerfile", FileTypeConfig, g.generateDockerfile},
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
			Language: "ruby",
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
			GeneratorName:    "ruby-sinatra",
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
				"module_name":     g.getModuleName(ir),
				"has_auth":        hasAuth,
				"endpoints_count": len(ir.Endpoints),
			},
		},
	}

	return code, nil
}

// getModuleName returns the Ruby module name from IR metadata
func (g *RubySinatraGenerator) getModuleName(ir *parser.IntermediateRepresentation) string {
	name := ir.Metadata.Name
	if name == "" {
		name = ir.Metadata.Title
	}
	if name != "" {
		// Convert to PascalCase
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

// generateApp generates the main Sinatra application file
func (g *RubySinatraGenerator) generateApp(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)

	// Generate route handlers
	routes := ""
	for _, endpoint := range ir.Endpoints {
		method := strings.ToLower(endpoint.Method)
		path := endpoint.Path

		// Convert path parameters from {id} to :id
		rubifyPath := strings.ReplaceAll(path, "{", ":")
		rubifyPath = strings.ReplaceAll(rubifyPath, "}", "")

		routes += fmt.Sprintf(`
# %s
%s '%s' do
  # This route is handled by MCP service
  halt 404, { error: 'Not an MCP endpoint' }.to_json
end
`, endpoint.Description, method, rubifyPath)
	}

	return fmt.Sprintf(`# frozen_string_literal: true

require 'sinatra/base'
require 'json'
require_relative 'lib/mcp_service'

module %s
  # Main Sinatra application for MCP server
  class App < Sinatra::Base
    configure do
      set :show_exceptions, false
      set :raise_errors, true

      # CORS configuration
      before do
        headers['Access-Control-Allow-Origin'] = '*'
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
      end

      # Handle OPTIONS requests for CORS
      options '*' do
        200
      end
    end

    # Initialize MCP service
    def mcp_service
      @mcp_service ||= McpService.new
    end

    # MCP manifest endpoint
    get '/.well-known/mcp.json' do
      content_type :json
      mcp_service.manifest.to_json
    end

    # MCP tool execution endpoint
    post '/mcp/execute' do
      content_type :json

      begin
        request_body = JSON.parse(request.body.read)
        result = mcp_service.execute_tool(request_body)
        result.to_json
      rescue JSON::ParserError => e
        status 400
        { success: false, error: 'Invalid JSON' }.to_json
      rescue StandardError => e
        status 500
        { success: false, error: e.message }.to_json
      end
    end

    # Health check endpoint
    get '/health' do
      content_type :json
      { status: 'healthy', timestamp: Time.now.utc.iso8601 }.to_json
    end
%s
    # Error handlers
    error do
      content_type :json
      status 500
      { success: false, error: env['sinatra.error'].message }.to_json
    end

    not_found do
      content_type :json
      { success: false, error: 'Not found' }.to_json
    end
  end
end
`, moduleName, routes), nil
}

// generateMcpService generates the MCP service implementation
func (g *RubySinatraGenerator) generateMcpService(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)

	// Generate tool methods
	toolMethods := ""
	for _, endpoint := range ir.Endpoints {
		toolName := g.toSnakeCase(endpoint.Name)
		method := strings.ToUpper(endpoint.Method)

		toolMethods += fmt.Sprintf(`
    # Execute %s tool
    # @param args [Hash] Tool arguments
    # @return [Hash] Tool result
    def execute_%s(args = {})
      @api_client.%s('%s', args)
    end
`, endpoint.Name, toolName, strings.ToLower(method), endpoint.Path)
	}

	// Generate tool dispatcher
	toolCases := ""
	for _, endpoint := range ir.Endpoints {
		toolName := g.toSnakeCase(endpoint.Name)
		toolCases += fmt.Sprintf(`      when '%s'
        execute_%s(args)
`, endpoint.Name, toolName)
	}

	// Generate tools list
	toolsList := g.generateToolsList(ir)

	return fmt.Sprintf(`# frozen_string_literal: true

require_relative 'api_client'
require_relative 'models'

module %s
  # MCP service implementation
  # Manages tool execution and manifest generation
  class McpService
    def initialize
      @api_client = ApiClient.new
    end

    # Get the MCP manifest
    # @return [Hash] MCP manifest
    def manifest
      {
        version: '1.0.0',
        name: '%s',
        description: '%s',
        tools: tools
      }
    end

    # Get all available tools
    # @return [Array<Hash>] List of tools
    def tools
      [
%s
      ]
    end

    # Execute a tool by name
    # @param request [Hash] Execution request
    # @return [Hash] Execution result
    def execute_tool(request)
      tool_name = request['tool']
      args = request['arguments'] || {}

      raise ArgumentError, 'Tool name is required' if tool_name.nil? || tool_name.empty?

      result = case tool_name
%s
      else
        raise ArgumentError, "Unknown tool: #{tool_name}"
      end

      { success: true, result: result }
    rescue StandardError => e
      { success: false, error: e.message }
    end
%s
  end
end
`, moduleName, g.getNameOrDefault(ir), g.getDescriptionOrDefault(ir), toolsList, toolCases, toolMethods), nil
}

// generateToolsList generates the tools array for the manifest
func (g *RubySinatraGenerator) generateToolsList(ir *parser.IntermediateRepresentation) string {
	var tools []string

	for _, endpoint := range ir.Endpoints {
		description := endpoint.Description
		if description == "" {
			description = fmt.Sprintf("%s %s", endpoint.Method, endpoint.Path)
		}

		// Generate input schema
		inputSchema := g.generateInputSchema(endpoint)

		tool := fmt.Sprintf(`        {
          name: '%s',
          description: '%s',
          input_schema: %s
        }`, endpoint.Name, escapeString(description), inputSchema)

		tools = append(tools, tool)
	}

	return strings.Join(tools, ",\n")
}

// generateInputSchema generates JSON schema for tool inputs
func (g *RubySinatraGenerator) generateInputSchema(endpoint parser.UnifiedEndpoint) string {
	if len(endpoint.Parameters) == 0 {
		return `{
            type: 'object',
            properties: {}
          }`
	}

	properties := make([]string, 0)
	required := make([]string, 0)

	for _, param := range endpoint.Parameters {
		paramType := "string"
		if param.Schema != nil && param.Schema.Type != "" {
			paramType = param.Schema.Type
		}

		propDef := fmt.Sprintf(`            %s: {
              type: '%s',
              description: '%s'
            }`, param.Name, g.typeToJsonSchema(paramType), escapeString(param.Description))

		properties = append(properties, propDef)

		if param.Required {
			required = append(required, fmt.Sprintf("'%s'", param.Name))
		}
	}

	requiredStr := ""
	if len(required) > 0 {
		requiredStr = fmt.Sprintf(",\n            required: [%s]", strings.Join(required, ", "))
	}

	return fmt.Sprintf(`{
            type: 'object',
            properties: {
%s
            }%s
          }`, strings.Join(properties, ",\n"), requiredStr)
}

// generateApiClient generates the API client implementation
func (g *RubySinatraGenerator) generateApiClient(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)
	baseURL := g.getBaseURL(ir)
	authCode := g.generateAuthCode(ir)

	return fmt.Sprintf(`# frozen_string_literal: true

require 'net/http'
require 'json'
require 'uri'

module %s
  # HTTP client for API communication
  # Handles authentication, retries, and error handling
  class ApiClient
    BASE_URL = ENV['API_BASE_URL'] || '%s'
    TIMEOUT = 30

    def initialize
      @base_url = URI(BASE_URL)
%s
    end

    # Execute GET request
    # @param path [String] Request path
    # @param params [Hash] Query parameters
    # @return [Hash] Response data
    def get(path, params = {})
      uri = build_uri(path, params)
      request = Net::HTTP::Get.new(uri)
      add_headers(request)
      execute_request(uri, request)
    end

    # Execute POST request
    # @param path [String] Request path
    # @param body [Hash] Request body
    # @return [Hash] Response data
    def post(path, body = {})
      uri = build_uri(path)
      request = Net::HTTP::Post.new(uri)
      add_headers(request)
      request.body = body.to_json
      execute_request(uri, request)
    end

    # Execute PUT request
    # @param path [String] Request path
    # @param body [Hash] Request body
    # @return [Hash] Response data
    def put(path, body = {})
      uri = build_uri(path)
      request = Net::HTTP::Put.new(uri)
      add_headers(request)
      request.body = body.to_json
      execute_request(uri, request)
    end

    # Execute PATCH request
    # @param path [String] Request path
    # @param body [Hash] Request body
    # @return [Hash] Response data
    def patch(path, body = {})
      uri = build_uri(path)
      request = Net::HTTP::Patch.new(uri)
      add_headers(request)
      request.body = body.to_json
      execute_request(uri, request)
    end

    # Execute DELETE request
    # @param path [String] Request path
    # @param params [Hash] Query parameters
    # @return [Hash] Response data
    def delete(path, params = {})
      uri = build_uri(path, params)
      request = Net::HTTP::Delete.new(uri)
      add_headers(request)
      execute_request(uri, request)
    end

    private

    # Build URI with query parameters
    # @param path [String] Request path
    # @param params [Hash] Query parameters
    # @return [URI] Complete URI
    def build_uri(path, params = {})
      uri = @base_url.dup
      uri.path = path
      uri.query = URI.encode_www_form(params) unless params.empty?
      uri
    end

    # Add headers to request
    # @param request [Net::HTTPRequest] HTTP request
    def add_headers(request)
      request['Content-Type'] = 'application/json'
      request['Accept'] = 'application/json'
%s
    end

    # Execute HTTP request
    # @param uri [URI] Request URI
    # @param request [Net::HTTPRequest] HTTP request
    # @return [Hash] Response data
    def execute_request(uri, request)
      response = Net::HTTP.start(uri.hostname, uri.port,
                                  use_ssl: uri.scheme == 'https',
                                  read_timeout: TIMEOUT) do |http|
        http.request(request)
      end

      raise "HTTP #{response.code}: #{response.message}" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    rescue JSON::ParserError
      response.body
    end
  end
end
`, moduleName, baseURL, authCode, g.generateAuthHeaders(ir)), nil
}

// generateAuthCode generates authentication initialization code
func (g *RubySinatraGenerator) generateAuthCode(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		if auth.In == "header" {
			return fmt.Sprintf(`      @api_key = ENV['API_KEY']
      @api_key_header = '%s'`, auth.Name)
		}
		return `      @api_key = ENV['API_KEY']`

	case "http":
		if auth.Scheme == "bearer" {
			return `      @bearer_token = ENV['BEARER_TOKEN']`
		}
		return `      @basic_username = ENV['BASIC_AUTH_USERNAME']
      @basic_password = ENV['BASIC_AUTH_PASSWORD']`

	case "oauth2":
		return `      @access_token = ENV['OAUTH2_ACCESS_TOKEN']`

	default:
		return ""
	}
}

// generateAuthHeaders generates code to add authentication headers
func (g *RubySinatraGenerator) generateAuthHeaders(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		if auth.In == "header" {
			return `      request[@api_key_header] = @api_key if @api_key`
		}
		return `      # API key added to query params`

	case "http":
		if auth.Scheme == "bearer" {
			return `      request['Authorization'] = "Bearer #{@bearer_token}" if @bearer_token`
		}
		return `      if @basic_username && @basic_password
        credentials = Base64.strict_encode64("#{@basic_username}:#{@basic_password}")
        request['Authorization'] = "Basic #{credentials}"
      end`

	case "oauth2":
		return `      request['Authorization'] = "Bearer #{@access_token}" if @access_token`

	default:
		return ""
	}
}

// generateModels generates the models file
func (g *RubySinatraGenerator) generateModels(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)

	return fmt.Sprintf(`# frozen_string_literal: true

module %s
  # MCP tool execution request
  class ExecuteRequest
    attr_accessor :tool, :arguments

    def initialize(tool:, arguments: {})
      @tool = tool
      @arguments = arguments
    end

    def to_h
      {
        tool: @tool,
        arguments: @arguments
      }
    end
  end

  # MCP tool execution response
  class ExecuteResponse
    attr_accessor :success, :result, :error

    def initialize(success:, result: nil, error: nil)
      @success = success
      @result = result
      @error = error
    end

    def to_h
      {
        success: @success,
        result: @result,
        error: @error
      }.compact
    end
  end
end
`, moduleName), nil
}

// generateConfigRu generates the config.ru file for Rack
func (g *RubySinatraGenerator) generateConfigRu(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)

	return fmt.Sprintf(`# frozen_string_literal: true

require_relative 'config/environment'
require_relative 'app'

run %s::App
`, moduleName), nil
}

// generateGemfile generates the Gemfile
func (g *RubySinatraGenerator) generateGemfile(ir *parser.IntermediateRepresentation) (string, error) {
	return `# frozen_string_literal: true

source 'https://rubygems.org'

ruby '>= 2.7.0'

# Web framework
gem 'sinatra', '~> 3.1'

# Web server
gem 'puma', '~> 6.4'

# JSON handling
gem 'json', '~> 2.7'

# HTTP client
gem 'httparty', '~> 0.21'

# Environment variables
gem 'dotenv', '~> 2.8'

group :development, :test do
  # Testing framework
  gem 'rspec', '~> 3.12'
  gem 'rack-test', '~> 2.1'

  # Code quality
  gem 'rubocop', '~> 1.57', require: false
  gem 'rubocop-rspec', '~> 2.25', require: false
end
`, nil
}

// generateEnvironment generates the environment configuration
func (g *RubySinatraGenerator) generateEnvironment(ir *parser.IntermediateRepresentation) (string, error) {
	return `# frozen_string_literal: true

require 'bundler/setup'
Bundler.require(:default, ENV['RACK_ENV'] || 'development')

# Load environment variables
require 'dotenv/load' if %w[development test].include?(ENV['RACK_ENV'])

# Set default environment
ENV['RACK_ENV'] ||= 'development'

# Require all lib files
Dir[File.join(__dir__, '..', 'lib', '*.rb')].sort.each { |file| require file }
`, nil
}

// generateTests generates RSpec tests
func (g *RubySinatraGenerator) generateTests(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)

	return fmt.Sprintf(`# frozen_string_literal: true

require_relative 'spec_helper'

RSpec.describe %s::App do
  include Rack::Test::Methods

  def app
    %s::App
  end

  describe 'GET /.well-known/mcp.json' do
    it 'returns the MCP manifest' do
      get '/.well-known/mcp.json'

      expect(last_response).to be_ok
      expect(last_response.content_type).to include('application/json')

      manifest = JSON.parse(last_response.body)
      expect(manifest['version']).to eq('1.0.0')
      expect(manifest['tools']).to be_an(Array)
    end
  end

  describe 'POST /mcp/execute' do
    context 'with valid request' do
      it 'returns error for unknown tool' do
        post '/mcp/execute', { tool: 'unknown_tool' }.to_json, 'CONTENT_TYPE' => 'application/json'

        expect(last_response.status).to eq(200)
        response = JSON.parse(last_response.body)
        expect(response['success']).to be false
        expect(response['error']).to include('Unknown tool')
      end
    end

    context 'with invalid JSON' do
      it 'returns 400 error' do
        post '/mcp/execute', 'invalid json', 'CONTENT_TYPE' => 'application/json'

        expect(last_response.status).to eq(400)
        response = JSON.parse(last_response.body)
        expect(response['success']).to be false
      end
    end

    context 'without tool name' do
      it 'returns error' do
        post '/mcp/execute', { arguments: {} }.to_json, 'CONTENT_TYPE' => 'application/json'

        expect(last_response.status).to eq(200)
        response = JSON.parse(last_response.body)
        expect(response['success']).to be false
      end
    end
  end

  describe 'GET /health' do
    it 'returns health status' do
      get '/health'

      expect(last_response).to be_ok
      health = JSON.parse(last_response.body)
      expect(health['status']).to eq('healthy')
      expect(health['timestamp']).not_to be_nil
    end
  end

  describe 'CORS headers' do
    it 'includes CORS headers' do
      get '/.well-known/mcp.json'

      expect(last_response.headers['Access-Control-Allow-Origin']).to eq('*')
      expect(last_response.headers['Access-Control-Allow-Methods']).to include('GET', 'POST')
    end
  end
end
`, moduleName, moduleName), nil
}

// generateSpecHelper generates the RSpec helper configuration
func (g *RubySinatraGenerator) generateSpecHelper(ir *parser.IntermediateRepresentation) (string, error) {
	return `# frozen_string_literal: true

ENV['RACK_ENV'] = 'test'

require 'rack/test'
require 'rspec'
require 'json'

require_relative '../config/environment'
require_relative '../app'

RSpec.configure do |config|
  config.include Rack::Test::Methods

  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = 'spec/examples.txt'
  config.disable_monkey_patching!
  config.warnings = true

  config.default_formatter = 'doc' if config.files_to_run.one?
  config.order = :random
  Kernel.srand config.seed
end
`, nil
}

// generateReadme generates README.md
func (g *RubySinatraGenerator) generateReadme(ir *parser.IntermediateRepresentation) (string, error) {
	moduleName := g.getModuleName(ir)
	baseURL := g.getBaseURL(ir)
	authDocs := g.generateAuthDocs(ir)

	return fmt.Sprintf(`# %s - MCP Server

Ruby Sinatra MCP (Model Context Protocol) server generated from OpenAPI specification.

## Description

%s

Base URL: %s

## Prerequisites

- Ruby >= 2.7.0
- Bundler

## Installation

` + "```bash" + `
bundle install
` + "```" + `

## Configuration

Create a ` + "`.env`" + ` file with the following variables:

` + "```env" + `
API_BASE_URL=%s
RACK_ENV=development%s
` + "```" + `

## Running the Server

### Development mode
` + "```bash" + `
bundle exec rackup -p 4567
` + "```" + `

The server will start on http://localhost:4567

### Production mode
` + "```bash" + `
RACK_ENV=production bundle exec puma -p 4567
` + "```" + `

## Running Tests

` + "```bash" + `
bundle exec rspec
` + "```" + `

### With coverage
` + "```bash" + `
bundle exec rspec --format documentation
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
.
├── app.rb                    # Main Sinatra application
├── lib/
│   ├── mcp_service.rb        # MCP service implementation
│   ├── api_client.rb         # HTTP client
│   └── models.rb             # Data models
├── config/
│   └── environment.rb        # Environment configuration
├── spec/
│   ├── app_spec.rb           # Application tests
│   └── spec_helper.rb        # Test configuration
├── config.ru                 # Rack configuration
├── Gemfile                   # Ruby dependencies
└── README.md                 # This file
` + "```" + `

## Docker Support

### Build image
` + "```bash" + `
docker build -t %s .
` + "```" + `

### Run container
` + "```bash" + `
docker run -p 4567:4567 %s
` + "```" + `

## Code Quality

Run RuboCop for code quality checks:

` + "```bash" + `
bundle exec rubocop
` + "```" + `

## License

Generated by MCP Overflow
`, moduleName, g.getDescriptionOrDefault(ir), baseURL, baseURL, authDocs, g.generateToolsDocs(ir), strings.ToLower(moduleName), strings.ToLower(moduleName)), nil
}

// generateDockerfile generates a Dockerfile
func (g *RubySinatraGenerator) generateDockerfile(ir *parser.IntermediateRepresentation) (string, error) {
	return `FROM ruby:3.2-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache build-base

# Copy Gemfile
COPY Gemfile Gemfile.lock ./
RUN bundle install --without development test

# Copy application
COPY . .

# Expose port
EXPOSE 4567

# Run the application
CMD ["bundle", "exec", "puma", "-p", "4567"]
`, nil
}

// generateAuthDocs generates authentication documentation
func (g *RubySinatraGenerator) generateAuthDocs(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return fmt.Sprintf("\nAPI_KEY=your-api-key-here")
	case "http":
		if auth.Scheme == "bearer" {
			return "\nBEARER_TOKEN=your-bearer-token-here"
		}
		return "\nBASIC_AUTH_USERNAME=your-username\nBASIC_AUTH_PASSWORD=your-password"
	case "oauth2":
		return "\nOAUTH2_ACCESS_TOKEN=your-access-token-here"
	default:
		return ""
	}
}

// generateToolsDocs generates documentation for available tools
func (g *RubySinatraGenerator) generateToolsDocs(ir *parser.IntermediateRepresentation) string {
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
func (g *RubySinatraGenerator) typeToJsonSchema(irType string) string {
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

// toSnakeCase converts a string to snake_case
func (g *RubySinatraGenerator) toSnakeCase(s string) string {
	// Simple conversion - can be enhanced
	result := ""
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result += "_"
		}
		result += strings.ToLower(string(r))
	}
	return result
}

// getBaseURL extracts base URL from IR
func (g *RubySinatraGenerator) getBaseURL(ir *parser.IntermediateRepresentation) string {
	if len(ir.Servers) > 0 {
		return ir.Servers[0].URL
	}
	return "https://api.example.com"
}

// getNameOrDefault returns name from IR or default
func (g *RubySinatraGenerator) getNameOrDefault(ir *parser.IntermediateRepresentation) string {
	if ir.Metadata.Name != "" {
		return ir.Metadata.Name
	}
	if ir.Metadata.Title != "" {
		return ir.Metadata.Title
	}
	return "MCP Server"
}

// getDescriptionOrDefault returns description from IR or default
func (g *RubySinatraGenerator) getDescriptionOrDefault(ir *parser.IntermediateRepresentation) string {
	if ir.Metadata.Description != "" {
		return ir.Metadata.Description
	}
	return "MCP server generated from OpenAPI specification"
}
