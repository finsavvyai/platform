package utils

import (
	"testing"
)

func TestDetectOpenAPI(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantFormat string
		minConf    float64
	}{
		{
			name: "OpenAPI 3.0",
			input: `{
				"openapi": "3.0.0",
				"info": {"title": "Test API", "version": "1.0.0"},
				"paths": {}
			}`,
			wantFormat: "openapi",
			minConf:    0.9,
		},
		{
			name: "Swagger 2.0",
			input: `{
				"swagger": "2.0",
				"info": {"title": "Test API", "version": "1.0.0"},
				"paths": {}
			}`,
			wantFormat: "openapi",
			minConf:    0.9,
		},
	}

	detector := &DefaultFormatDetector{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			format, confidence, err := detector.Detect([]byte(tt.input))
			if err != nil {
				t.Fatalf("Detect() error = %v", err)
			}

			if format != tt.wantFormat {
				t.Errorf("Detect() format = %v, want %v", format, tt.wantFormat)
			}

			if confidence < tt.minConf {
				t.Errorf("Detect() confidence = %v, want >= %v", confidence, tt.minConf)
			}
		})
	}
}

func TestDetectAsyncAPI(t *testing.T) {
	input := `{
		"asyncapi": "2.0.0",
		"info": {"title": "Test API", "version": "1.0.0"},
		"channels": {}
	}`

	detector := &DefaultFormatDetector{}
	format, confidence, err := detector.Detect([]byte(input))
	
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}

	if format != "asyncapi" {
		t.Errorf("Detect() format = %v, want asyncapi", format)
	}

	if confidence < 0.9 {
		t.Errorf("Detect() confidence = %v, want >= 0.9", confidence)
	}
}

func TestDetectPostman(t *testing.T) {
	input := `{
		"info": {
			"name": "Test Collection",
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
		},
		"item": []
	}`

	detector := &DefaultFormatDetector{}
	format, confidence, err := detector.Detect([]byte(input))
	
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}

	if format != "postman" {
		t.Errorf("Detect() format = %v, want postman", format)
	}

	if confidence < 0.8 {
		t.Errorf("Detect() confidence = %v, want >= 0.8", confidence)
	}
}

func TestDetectGraphQL(t *testing.T) {
	input := `{
		"data": {
			"__schema": {
				"queryType": {"name": "Query"}
			}
		}
	}`

	detector := &DefaultFormatDetector{}
	format, confidence, err := detector.Detect([]byte(input))
	
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}

	if format != "graphql" {
		t.Errorf("Detect() format = %v, want graphql", format)
	}

	if confidence < 0.9 {
		t.Errorf("Detect() confidence = %v, want >= 0.9", confidence)
	}
}

func TestDetectGRPC(t *testing.T) {
	input := `
syntax = "proto3";

package test;

service TestService {
  rpc GetUser(GetUserRequest) returns (User) {}
}

message GetUserRequest {
  string user_id = 1;
}

message User {
  string id = 1;
  string name = 2;
}
`

	detector := &DefaultFormatDetector{}
	format, confidence, err := detector.Detect([]byte(input))
	
	if err != nil {
		t.Fatalf("Detect() error = %v", err)
	}

	if format != "grpc" {
		t.Errorf("Detect() format = %v, want grpc", format)
	}

	if confidence < 0.8 {
		t.Errorf("Detect() confidence = %v, want >= 0.8", confidence)
	}
}

func TestIsJSON(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"Valid JSON", `{"key": "value"}`, true},
		{"Invalid JSON", `{key: value}`, false},
		{"Array JSON", `[1, 2, 3]`, true},
		{"Empty", ``, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsJSON([]byte(tt.input)); got != tt.want {
				t.Errorf("IsJSON() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsYAML(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"Valid YAML", "key: value\nkey2: value2", true},
		{"Invalid YAML", ":::invalid", false},
		{"JSON as YAML", `{"key": "value"}`, true}, // JSON is valid YAML
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsYAML([]byte(tt.input)); got != tt.want {
				t.Errorf("IsYAML() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetContentType(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"JSON", `{"key": "value"}`, "application/json"},
		{"YAML", "key: value", "application/yaml"},
		{"Plain", "just text", "text/plain"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := GetContentType([]byte(tt.input)); got != tt.want {
				t.Errorf("GetContentType() = %v, want %v", got, tt.want)
			}
		})
	}
}
