package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPoliciesService_CreatePolicy(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		input         *Policy
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful policy creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "test-policy-id",
					"name":        "Test Policy",
					"description": "A test policy",
					"status":      "active",
					"rules": []map[string]interface{}{
						{
							"id":       "rule-1",
							"type":     "allow",
							"resource": "documents",
							"action":   "read",
							"effect":   "allow",
						},
					},
					"created_at": time.Now().Format(time.RFC3339),
					"updated_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/policies", response)
			},
			input: &Policy{
				Name:        "Test Policy",
				Description: "A test policy",
				Status:      "active",
				Rules: []PolicyRule{
					{
						ID:       "rule-1",
						Type:     "allow",
						Resource: "documents",
						Action:   "read",
						Effect:   "allow",
					},
				},
			},
			expectedError: false,
		},
		{
			name: "empty policy name",
			input: &Policy{
				Name:        "",
				Description: "A test policy",
				Status:      "active",
			},
			expectedError: true,
			errorMsg:      "policy name cannot be empty",
		},
		{
			name:          "nil policy input",
			input:         nil,
			expectedError: true,
			errorMsg:      "policy input cannot be nil",
		},
		{
			name: "invalid policy status",
			input: &Policy{
				Name:        "Test Policy",
				Description: "A test policy",
				Status:      "invalid_status",
			},
			expectedError: true,
			errorMsg:      "invalid policy status",
		},
		{
			name: "conflict error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy already exists",
						"code":    409,
					},
				}
				server.SetResponse("POST", "/api/v1/policies", errorResp)
			},
			input: &Policy{
				Name:        "Existing Policy",
				Description: "This policy already exists",
				Status:      "active",
			},
			expectedError: true,
			errorMsg:      "policy already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.CreatePolicy(TestContext(), tt.input)

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
					t.Fatal("Expected policy ID to be set")
				}
				if result.Name != tt.input.Name {
					t.Fatalf("Expected policy name %q, got %q", tt.input.Name, result.Name)
				}
			}
		})
	}
}

func TestPoliciesService_GetPolicy(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		policyID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "test-policy-id",
					"name":        "Test Policy",
					"description": "A test policy",
					"status":      "active",
					"created_at":  time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/policies/test-policy-id", response)
			},
			policyID:      "test-policy-id",
			expectedError: false,
		},
		{
			name:          "empty policy ID",
			policyID:      "",
			expectedError: true,
			errorMsg:      "policy ID cannot be empty",
		},
		{
			name: "policy not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/policies/nonexistent", errorResp)
			},
			policyID:      "nonexistent",
			expectedError: true,
			errorMsg:      "policy not found",
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "internal server error",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/policies/error", errorResp)
			},
			policyID:      "error",
			expectedError: true,
			errorMsg:      "internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.GetPolicy(TestContext(), tt.policyID)

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
				if result.ID != tt.policyID {
					t.Fatalf("Expected policy ID %q, got %q", tt.policyID, result.ID)
				}
			}
		})
	}
}

func TestPoliciesService_UpdatePolicy(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		policyID      string
		input         *Policy
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful update",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "test-policy-id",
					"name":        "Updated Policy",
					"description": "Updated description",
					"status":      "active",
					"updated_at":  time.Now().Format(time.RFC3339),
				}
				server.SetResponse("PUT", "/api/v1/policies/test-policy-id", response)
			},
			policyID: "test-policy-id",
			input: &Policy{
				Name:        "Updated Policy",
				Description: "Updated description",
				Status:      "active",
			},
			expectedError: false,
		},
		{
			name:          "empty policy ID",
			policyID:      "",
			input:         GenerateTestPolicy(),
			expectedError: true,
			errorMsg:      "policy ID cannot be empty",
		},
		{
			name:          "nil input",
			policyID:      "test-policy-id",
			input:         nil,
			expectedError: true,
			errorMsg:      "policy input cannot be nil",
		},
		{
			name: "policy not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy not found",
						"code":    404,
					},
				}
				server.SetResponse("PUT", "/api/v1/policies/nonexistent", errorResp)
			},
			policyID:      "nonexistent",
			input:         GenerateTestPolicy(),
			expectedError: true,
			errorMsg:      "policy not found",
		},
		{
			name: "conflict error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy conflict",
						"code":    409,
					},
				}
				server.SetResponse("PUT", "/api/v1/policies/conflict", errorResp)
			},
			policyID:      "conflict",
			input:         GenerateTestPolicy(),
			expectedError: true,
			errorMsg:      "policy conflict",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.UpdatePolicy(TestContext(), tt.policyID, tt.input)

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
				if result.ID != tt.policyID {
					t.Fatalf("Expected policy ID %q, got %q", tt.policyID, result.ID)
				}
				if result.Name != tt.input.Name {
					t.Fatalf("Expected policy name %q, got %q", tt.input.Name, result.Name)
				}
			}
		})
	}
}

func TestPoliciesService_DeletePolicy(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		policyID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful deletion",
			setupMock: func() {
				response := map[string]interface{}{
					"success": true,
					"message": "policy deleted",
				}
				server.SetResponse("DELETE", "/api/v1/policies/test-policy-id", response)
			},
			policyID:      "test-policy-id",
			expectedError: false,
		},
		{
			name:          "empty policy ID",
			policyID:      "",
			expectedError: true,
			errorMsg:      "policy ID cannot be empty",
		},
		{
			name: "policy not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy not found",
						"code":    404,
					},
				}
				server.SetResponse("DELETE", "/api/v1/policies/nonexistent", errorResp)
			},
			policyID:      "nonexistent",
			expectedError: true,
			errorMsg:      "policy not found",
		},
		{
			name: "policy in use",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy is in use and cannot be deleted",
						"code":    409,
					},
				}
				server.SetResponse("DELETE", "/api/v1/policies/in-use", errorResp)
			},
			policyID:      "in-use",
			expectedError: true,
			errorMsg:      "policy is in use",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.Policies.DeletePolicy(TestContext(), tt.policyID)

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
			}
		})
	}
}

func TestPoliciesService_ListPolicies(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		params        *PolicyListParams
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list",
			setupMock: func() {
				response := PolicyListResponse{
					Policies: []*Policy{
						{
							ID:          "policy-1",
							Name:        "Policy 1",
							Description: "First policy",
							Status:      "active",
						},
						{
							ID:          "policy-2",
							Name:        "Policy 2",
							Description: "Second policy",
							Status:      "inactive",
						},
					},
					Total: 2,
				}
				server.SetResponse("GET", "/api/v1/policies", response)
			},
			params: &PolicyListParams{
				Status: "active",
				Limit:  10,
				Offset: 0,
			},
			expectedError: false,
		},
		{
			name: "empty results",
			setupMock: func() {
				response := PolicyListResponse{
					Policies: []*Policy{},
					Total:    0,
				}
				server.SetResponse("GET", "/api/v1/policies", response)
			},
			params: &PolicyListParams{
				Status: "nonexistent",
				Limit:  10,
			},
			expectedError: false,
		},
		{
			name: "invalid pagination",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid pagination parameters",
						"code":    400,
					},
				}
				server.SetResponse("GET", "/api/v1/policies", errorResp)
			},
			params: &PolicyListParams{
				Limit:  -1,
				Offset: -1,
			},
			expectedError: true,
			errorMsg:      "invalid pagination parameters",
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "database error",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/policies", errorResp)
			},
			params: &PolicyListParams{
				Limit: 10,
			},
			expectedError: true,
			errorMsg:      "database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.ListPolicies(TestContext(), tt.params)

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
				if result.Total < 0 {
					t.Fatal("Expected non-negative total count")
				}
			}
		})
	}
}

func TestPoliciesService_EvaluatePolicy(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		request       *PolicyEvaluationRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful evaluation - allow",
			setupMock: func() {
				response := PolicyEvaluationResponse{
					Allowed:     true,
					Decision:    "allow",
					Reason:      "User has read access to documents",
					PolicyID:    "policy-1",
					EvaluatedAt: time.Now(),
				}
				server.SetResponse("POST", "/api/v1/policies/evaluate", response)
			},
			request: &PolicyEvaluationRequest{
				UserID:   "user-1",
				Resource: "documents",
				Action:   "read",
				Context: map[string]interface{}{
					"document_id": "doc-1",
					"department":  "engineering",
				},
			},
			expectedError: false,
		},
		{
			name: "successful evaluation - deny",
			setupMock: func() {
				response := PolicyEvaluationResponse{
					Allowed:     false,
					Decision:    "deny",
					Reason:      "User does not have write access to documents",
					PolicyID:    "policy-2",
					EvaluatedAt: time.Now(),
				}
				server.SetResponse("POST", "/api/v1/policies/evaluate", response)
			},
			request: &PolicyEvaluationRequest{
				UserID:   "user-1",
				Resource: "documents",
				Action:   "write",
				Context: map[string]interface{}{
					"document_id": "doc-1",
					"department":  "engineering",
				},
			},
			expectedError: false,
		},
		{
			name:          "nil request",
			request:       nil,
			expectedError: true,
			errorMsg:      "evaluation request cannot be nil",
		},
		{
			name: "empty user ID",
			request: &PolicyEvaluationRequest{
				UserID:   "",
				Resource: "documents",
				Action:   "read",
			},
			expectedError: true,
			errorMsg:      "user ID cannot be empty",
		},
		{
			name: "empty resource",
			request: &PolicyEvaluationRequest{
				UserID:   "user-1",
				Resource: "",
				Action:   "read",
			},
			expectedError: true,
			errorMsg:      "resource cannot be empty",
		},
		{
			name: "empty action",
			request: &PolicyEvaluationRequest{
				UserID:   "user-1",
				Resource: "documents",
				Action:   "",
			},
			expectedError: true,
			errorMsg:      "action cannot be empty",
		},
		{
			name: "invalid policy",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy evaluation failed: invalid rule syntax",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/policies/evaluate", errorResp)
			},
			request: &PolicyEvaluationRequest{
				UserID:   "user-1",
				Resource: "documents",
				Action:   "read",
			},
			expectedError: true,
			errorMsg:      "policy evaluation failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.EvaluatePolicy(TestContext(), tt.request)

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
				// Check that decision is set
				if result.Decision == "" {
					t.Fatal("Expected decision to be set")
				}
			}
		})
	}
}

func TestPoliciesService_CreatePolicyTemplate(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		template      *PolicyTemplate
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful template creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "template-1",
					"name":        "Document Access Template",
					"description": "Template for document access policies",
					"template": map[string]interface{}{
						"rules": []map[string]interface{}{
							{
								"type":     "allow",
								"resource": "documents",
								"action":   "read",
								"effect":   "allow",
							},
						},
					},
					"variables":  []string{"department", "role"},
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/policy-templates", response)
			},
			template: &PolicyTemplate{
				Name:        "Document Access Template",
				Description: "Template for document access policies",
				Template: map[string]interface{}{
					"rules": []map[string]interface{}{
						{
							"type":     "allow",
							"resource": "documents",
							"action":   "read",
							"effect":   "allow",
						},
					},
				},
				Variables: []string{"department", "role"},
			},
			expectedError: false,
		},
		{
			name: "empty template name",
			template: &PolicyTemplate{
				Name:        "",
				Description: "Template description",
				Template:    map[string]interface{}{},
			},
			expectedError: true,
			errorMsg:      "template name cannot be empty",
		},
		{
			name:          "nil template",
			template:      nil,
			expectedError: true,
			errorMsg:      "template cannot be nil",
		},
		{
			name: "template already exists",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "template already exists",
						"code":    409,
					},
				}
				server.SetResponse("POST", "/api/v1/policy-templates", errorResp)
			},
			template: &PolicyTemplate{
				Name:        "Existing Template",
				Description: "This template already exists",
				Template:    map[string]interface{}{},
			},
			expectedError: true,
			errorMsg:      "template already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.CreatePolicyTemplate(TestContext(), tt.template)

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
					t.Fatal("Expected template ID to be set")
				}
				if result.Name != tt.template.Name {
					t.Fatalf("Expected template name %q, got %q", tt.template.Name, result.Name)
				}
			}
		})
	}
}

func TestPoliciesService_GetPolicyTemplate(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		templateID    string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "template-1",
					"name":        "Document Access Template",
					"description": "Template for document access policies",
					"created_at":  time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/policy-templates/template-1", response)
			},
			templateID:    "template-1",
			expectedError: false,
		},
		{
			name:          "empty template ID",
			templateID:    "",
			expectedError: true,
			errorMsg:      "template ID cannot be empty",
		},
		{
			name: "template not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "template not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/policy-templates/nonexistent", errorResp)
			},
			templateID:    "nonexistent",
			expectedError: true,
			errorMsg:      "template not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.GetPolicyTemplate(TestContext(), tt.templateID)

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
				if result.ID != tt.templateID {
					t.Fatalf("Expected template ID %q, got %q", tt.templateID, result.ID)
				}
			}
		})
	}
}

func TestPoliciesService_ListPolicyTemplates(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list",
			setupMock: func() {
				response := []PolicyTemplate{
					{
						ID:          "template-1",
						Name:        "Document Access",
						Description: "Document access template",
					},
					{
						ID:          "template-2",
						Name:        "User Management",
						Description: "User management template",
					},
				}
				server.SetResponse("GET", "/api/v1/policy-templates", response)
			},
			expectedError: false,
		},
		{
			name: "empty list",
			setupMock: func() {
				response := []PolicyTemplate{}
				server.SetResponse("GET", "/api/v1/policy-templates", response)
			},
			expectedError: false,
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "template database error",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/policy-templates", errorResp)
			},
			expectedError: true,
			errorMsg:      "template database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.ListPolicyTemplates(TestContext())

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
			}
		})
	}
}

func TestPoliciesService_CreatePolicyFromTemplate(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		templateID    string
		variables     map[string]interface{}
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful creation from template",
			setupMock: func() {
				response := map[string]interface{}{
					"id":          "policy-from-template",
					"name":        "Engineering Document Access",
					"description": "Generated from template",
					"status":      "active",
					"created_at":  time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/policy-templates/template-1/create", response)
			},
			templateID: "template-1",
			variables: map[string]interface{}{
				"department": "engineering",
				"role":       "developer",
			},
			expectedError: false,
		},
		{
			name:          "empty template ID",
			templateID:    "",
			expectedError: true,
			errorMsg:      "template ID cannot be empty",
		},
		{
			name: "template not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "template not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/policy-templates/nonexistent/create", errorResp)
			},
			templateID:    "nonexistent",
			expectedError: true,
			errorMsg:      "template not found",
		},
		{
			name: "missing variables",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "missing required variables: department, role",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/policy-templates/template-1/create", errorResp)
			},
			templateID: "template-1",
			variables: map[string]interface{}{
				"other": "value",
			},
			expectedError: true,
			errorMsg:      "missing required variables",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.CreatePolicyFromTemplate(TestContext(), tt.templateID, tt.variables)

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
					t.Fatal("Expected policy ID to be set")
				}
			}
		})
	}
}

func TestPoliciesService_TestPolicy(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		policyID      string
		testCases     []*PolicyTestCase
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful policy testing",
			setupMock: func() {
				response := PolicyTestResponse{
					Passed: true,
					Results: []*PolicyTestResult{
						{
							TestCase: PolicyTestCase{
								Name:        "Test Case 1",
								Description: "Should allow read access",
								Input: map[string]interface{}{
									"user_id":  "user-1",
									"resource": "documents",
									"action":   "read",
								},
								Expected: true,
							},
							Actual:   true,
							Passed:   true,
							Duration: 10 * time.Millisecond,
							Error:    "",
						},
					},
					Summary: PolicyTestSummary{
						Total:   1,
						Passed:  1,
						Failed:  0,
						Skipped: 0,
					},
				}
				server.SetResponse("POST", "/api/v1/policies/test-policy/test", response)
			},
			policyID: "test-policy",
			testCases: []*PolicyTestCase{
				{
					Name:        "Test Case 1",
					Description: "Should allow read access",
					Input: map[string]interface{}{
						"user_id":  "user-1",
						"resource": "documents",
						"action":   "read",
					},
					Expected: true,
				},
			},
			expectedError: false,
		},
		{
			name:          "empty policy ID",
			policyID:      "",
			expectedError: true,
			errorMsg:      "policy ID cannot be empty",
		},
		{
			name:          "no test cases",
			policyID:      "test-policy",
			testCases:     []*PolicyTestCase{},
			expectedError: true,
			errorMsg:      "test cases cannot be empty",
		},
		{
			name: "policy not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/policies/nonexistent/test", errorResp)
			},
			policyID:      "nonexistent",
			testCases:     []*PolicyTestCase{{Name: "Test", Expected: true}},
			expectedError: true,
			errorMsg:      "policy not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.TestPolicy(TestContext(), tt.policyID, tt.testCases)

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
				if len(result.Results) != len(tt.testCases) {
					t.Fatalf("Expected %d test results, got %d", len(tt.testCases), len(result.Results))
				}
			}
		})
	}
}

func TestPoliciesService_GetPolicyUsage(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		policyID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful usage retrieval",
			setupMock: func() {
				response := PolicyUsageResponse{
					PolicyID:   "test-policy",
					EvalCount:  150,
					AllowCount: 120,
					DenyCount:  30,
					LastUsed:   time.Now().Add(-1 * time.Hour),
					UsageStats: map[string]interface{}{
						"daily_evaluations": []int{10, 12, 8, 15, 11, 9, 13},
						"top_users":         []string{"user-1", "user-2", "user-3"},
						"top_resources":     []string{"documents", "users", "settings"},
					},
				}
				server.SetResponse("GET", "/api/v1/policies/test-policy/usage", response)
			},
			policyID:      "test-policy",
			expectedError: false,
		},
		{
			name:          "empty policy ID",
			policyID:      "",
			expectedError: true,
			errorMsg:      "policy ID cannot be empty",
		},
		{
			name: "policy not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "policy not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/policies/nonexistent/usage", errorResp)
			},
			policyID:      "nonexistent",
			expectedError: true,
			errorMsg:      "policy not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.GetPolicyUsage(TestContext(), tt.policyID)

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
				if result.PolicyID != tt.policyID {
					t.Fatalf("Expected policy ID %q, got %q", tt.policyID, result.PolicyID)
				}
				if result.EvalCount < 0 {
					t.Fatal("Expected non-negative evaluation count")
				}
			}
		})
	}
}

func TestPoliciesService_BatchEvaluatePolicies(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		requests      []*PolicyEvaluationRequest
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful batch evaluation",
			setupMock: func() {
				response := BatchEvaluationResponse{
					Results: []*PolicyEvaluationResponse{
						{
							Allowed:     true,
							Decision:    "allow",
							Reason:      "User has access",
							PolicyID:    "policy-1",
							EvaluatedAt: time.Now(),
						},
						{
							Allowed:     false,
							Decision:    "deny",
							Reason:      "User denied access",
							PolicyID:    "policy-2",
							EvaluatedAt: time.Now(),
						},
					},
					Processed: 2,
					Failed:    0,
				}
				server.SetResponse("POST", "/api/v1/policies/batch-evaluate", response)
			},
			requests: []*PolicyEvaluationRequest{
				{
					UserID:   "user-1",
					Resource: "documents",
					Action:   "read",
				},
				{
					UserID:   "user-2",
					Resource: "users",
					Action:   "write",
				},
			},
			expectedError: false,
		},
		{
			name:          "empty requests",
			requests:      []*PolicyEvaluationRequest{},
			expectedError: true,
			errorMsg:      "evaluation requests cannot be empty",
		},
		{
			name:          "nil requests",
			requests:      nil,
			expectedError: true,
			errorMsg:      "evaluation requests cannot be empty",
		},
		{
			name: "partial failure",
			setupMock: func() {
				response := BatchEvaluationResponse{
					Results: []*PolicyEvaluationResponse{
						{
							Allowed:     true,
							Decision:    "allow",
							Reason:      "User has access",
							PolicyID:    "policy-1",
							EvaluatedAt: time.Now(),
						},
					},
					Processed: 1,
					Failed:    1,
					Errors: []string{
						"invalid evaluation request: missing user ID",
					},
				}
				server.SetResponse("POST", "/api/v1/policies/batch-evaluate", response)
			},
			requests: []*PolicyEvaluationRequest{
				{
					UserID:   "user-1",
					Resource: "documents",
					Action:   "read",
				},
				{
					Resource: "users", // Missing user ID
					Action:   "write",
				},
			},
			expectedError: false, // Batch evaluation doesn't return error for partial failures
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Policies.BatchEvaluatePolicies(TestContext(), tt.requests)

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
				if result.Processed < 0 || result.Failed < 0 {
					t.Fatal("Expected non-negative processed/failed counts")
				}
			}
		})
	}
}

func TestPoliciesService_ContextCancellation(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel the context immediately
	cancel()

	_, err := client.Policies.GetPolicy(ctx, "test-id")
	if err == nil {
		t.Fatal("Expected context cancellation error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "context canceled") {
		t.Fatalf("Expected context cancellation error, got %v", err)
	}
}

func TestPoliciesService_JsonSerialization(t *testing.T) {
	policy := &Policy{
		ID:          "test-policy",
		Name:        "Test Policy",
		Description: "A test policy",
		Status:      "active",
		Rules: []PolicyRule{
			{
				ID:       "rule-1",
				Type:     "allow",
				Resource: "documents",
				Action:   "read",
				Effect:   "allow",
				Conditions: map[string]interface{}{
					"department": "engineering",
					"role":       "developer",
				},
			},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	data, err := json.Marshal(policy)
	if err != nil {
		t.Fatalf("Failed to marshal policy: %v", err)
	}

	var decoded Policy
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal policy: %v", err)
	}

	if decoded.ID != policy.ID {
		t.Fatalf("Expected ID %q, got %q", policy.ID, decoded.ID)
	}
	if decoded.Name != policy.Name {
		t.Fatalf("Expected name %q, got %q", policy.Name, decoded.Name)
	}
	if len(decoded.Rules) != len(policy.Rules) {
		t.Fatalf("Expected %d rules, got %d", len(policy.Rules), len(decoded.Rules))
	}
}

func TestPoliciesService_ConcurrentOperations(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Setup mock responses
	for i := 0; i < 10; i++ {
		response := map[string]interface{}{
			"id":          fmt.Sprintf("policy-%d", i),
			"name":        fmt.Sprintf("Policy %d", i),
			"description": fmt.Sprintf("Policy number %d", i),
			"status":      "active",
		}
		server.SetResponse("GET", fmt.Sprintf("/api/v1/policies/policy-%d", i), response)
	}

	// Test concurrent reads
	const numGoroutines = 10
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)
	results := make(chan *Policy, numGoroutines)

	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			policy, err := client.Policies.GetPolicy(TestContext(), fmt.Sprintf("policy-%d", id))
			if err != nil {
				errors <- err
				return
			}
			results <- policy
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

func TestPoliciesService_PolicyRuleValidation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		rule      PolicyRule
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid allow rule",
			rule: PolicyRule{
				ID:       "rule-1",
				Type:     "allow",
				Resource: "documents",
				Action:   "read",
				Effect:   "allow",
			},
			expectErr: false,
		},
		{
			name: "valid deny rule",
			rule: PolicyRule{
				ID:       "rule-2",
				Type:     "deny",
				Resource: "users",
				Action:   "write",
				Effect:   "deny",
			},
			expectErr: false,
		},
		{
			name: "empty rule ID",
			rule: PolicyRule{
				ID:       "",
				Type:     "allow",
				Resource: "documents",
				Action:   "read",
				Effect:   "allow",
			},
			expectErr: true,
			errMsg:    "rule ID cannot be empty",
		},
		{
			name: "invalid rule type",
			rule: PolicyRule{
				ID:       "rule-3",
				Type:     "invalid",
				Resource: "documents",
				Action:   "read",
				Effect:   "allow",
			},
			expectErr: true,
			errMsg:    "invalid rule type",
		},
		{
			name: "empty resource",
			rule: PolicyRule{
				ID:       "rule-4",
				Type:     "allow",
				Resource: "",
				Action:   "read",
				Effect:   "allow",
			},
			expectErr: true,
			errMsg:    "resource cannot be empty",
		},
		{
			name: "empty action",
			rule: PolicyRule{
				ID:       "rule-5",
				Type:     "allow",
				Resource: "documents",
				Action:   "",
				Effect:   "allow",
			},
			expectErr: true,
			errMsg:    "action cannot be empty",
		},
		{
			name: "invalid effect",
			rule: PolicyRule{
				ID:       "rule-6",
				Type:     "allow",
				Resource: "documents",
				Action:   "read",
				Effect:   "invalid",
			},
			expectErr: true,
			errMsg:    "invalid effect",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := &Policy{
				Name:        "Test Policy",
				Description: "A test policy",
				Status:      "active",
				Rules:       []PolicyRule{tt.rule},
			}

			_, err := client.Policies.CreatePolicy(TestContext(), policy)

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

func TestPoliciesService_EvaluationEngineLogic(t *testing.T) {
	// Test the logic that would happen in a real policy evaluation engine
	t.Run("Rule Priority Evaluation", func(t *testing.T) {
		rules := []PolicyRule{
			{
				ID:       "rule-1",
				Type:     "allow",
				Resource: "documents",
				Action:   "read",
				Effect:   "allow",
				Priority: 1,
			},
			{
				ID:       "rule-2",
				Type:     "deny",
				Resource: "documents",
				Action:   "read",
				Effect:   "deny",
				Priority: 2,
			},
		}

		// Higher priority rules should be evaluated first
		highestPriority := rules[0].Priority
		for _, rule := range rules {
			if rule.Priority > highestPriority {
				highestPriority = rule.Priority
			}
		}

		// Find the highest priority rule
		var highestPriorityRule *PolicyRule
		for _, rule := range rules {
			if rule.Priority == highestPriority {
				highestPriorityRule = &rule
				break
			}
		}

		if highestPriorityRule == nil {
			t.Fatal("Expected to find highest priority rule")
		}

		// The highest priority rule should be the deny rule (priority 2)
		if highestPriorityRule.Effect != "deny" {
			t.Fatalf("Expected highest priority rule to have deny effect, got %s", highestPriorityRule.Effect)
		}
	})

	t.Run("Rule Condition Matching", func(t *testing.T) {
		rule := PolicyRule{
			ID:       "rule-1",
			Type:     "allow",
			Resource: "documents",
			Action:   "read",
			Effect:   "allow",
			Conditions: map[string]interface{}{
				"department": "engineering",
				"role":       "developer",
			},
		}

		context := map[string]interface{}{
			"user_id":    "user-1",
			"resource":   "documents",
			"action":     "read",
			"department": "engineering",
			"role":       "developer",
		}

		// Simulate condition matching
		match := true
		for key, expectedValue := range rule.Conditions {
			if actualValue, exists := context[key]; !exists || actualValue != expectedValue {
				match = false
				break
			}
		}

		if !match {
			t.Fatal("Expected rule conditions to match context")
		}
	})
}
