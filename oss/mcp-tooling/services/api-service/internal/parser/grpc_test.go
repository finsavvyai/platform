package parser

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGRPCParser_DetectFormat(t *testing.T) {
	parser := NewGRPCParser()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name: "proto3 syntax",
			input: `syntax = "proto3";
package example;`,
			want:    "grpc",
			wantErr: false,
		},
		{
			name: "proto2 syntax",
			input: `syntax = "proto2";
package example;`,
			want:    "grpc",
			wantErr: false,
		},
		{
			name: "service definition",
			input: `service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}`,
			want:    "grpc",
			wantErr: false,
		},
		{
			name: "message definition",
			input: `message User {
  string name = 1;
  int32 age = 2;
}`,
			want:    "grpc",
			wantErr: false,
		},
		{
			name:    "invalid content",
			input:   `{"openapi": "3.0.0"}`,
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parser.DetectFormat([]byte(tt.input))
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestGRPCParser_Parse_SimpleService(t *testing.T) {
	parser := NewGRPCParser()

	protoContent := `
syntax = "proto3";

package example.v1;

option go_package = "example/v1;examplev1";

// User service provides user management operations
service UserService {
  // GetUser retrieves a user by ID
  rpc GetUser(GetUserRequest) returns (User);
  
  // ListUsers returns a list of users
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
}

message GetUserRequest {
  string user_id = 1;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
}
`

	ctx := context.Background()
	ir, err := parser.Parse(ctx, []byte(protoContent), ParseOptions{})

	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "example.v1", ir.Metadata.Title)
	assert.Equal(t, "grpc", ir.Source.Format)

	// Check endpoints (RPC methods)
	assert.Len(t, ir.Endpoints, 2)

	// Check GetUser endpoint
	getUserEndpoint := ir.Endpoints[0]
	assert.Equal(t, "UserService.GetUser", getUserEndpoint.ID)
	assert.Equal(t, "GetUser", getUserEndpoint.Name)
	assert.Equal(t, "POST", getUserEndpoint.Method)
	assert.Equal(t, "/example.v1/UserService/GetUser", getUserEndpoint.Path)
	assert.Equal(t, "application/grpc", getUserEndpoint.RequestBody.ContentType)
	assert.Equal(t, "GetUserRequest", getUserEndpoint.RequestBody.Schema.Ref)

	// Check ListUsers endpoint
	listUsersEndpoint := ir.Endpoints[1]
	assert.Equal(t, "UserService.ListUsers", listUsersEndpoint.ID)
	assert.Equal(t, "ListUsers", listUsersEndpoint.Name)

	// Check types (messages)
	assert.GreaterOrEqual(t, len(ir.Types), 4)

	// Find User message type
	var userType *TypeDefinition
	for i, typeDef := range ir.Types {
		if typeDef.Name == "User" {
			userType = &ir.Types[i]
			break
		}
	}
	require.NotNil(t, userType)
	assert.Equal(t, "object", userType.Type)
	assert.Len(t, userType.Properties, 4)
	assert.Contains(t, userType.Properties, "id")
	assert.Contains(t, userType.Properties, "name")
	assert.Contains(t, userType.Properties, "email")
	assert.Contains(t, userType.Properties, "age")

	// Check extensions
	assert.Equal(t, "proto3", ir.Extensions["proto_syntax"])
	assert.Equal(t, "example.v1", ir.Extensions["package"])
}

func TestGRPCParser_Parse_StreamingService(t *testing.T) {
	parser := NewGRPCParser()

	protoContent := `
syntax = "proto3";

package streaming.v1;

service ChatService {
  // Client streaming
  rpc UploadMessages(stream Message) returns (UploadResult);
  
  // Server streaming
  rpc DownloadMessages(DownloadRequest) returns (stream Message);
  
  // Bidirectional streaming
  rpc Chat(stream Message) returns (stream Message);
}

message Message {
  string text = 1;
  string sender = 2;
}

message UploadResult {
  int32 count = 1;
}

message DownloadRequest {
  string channel = 1;
}
`

	ctx := context.Background()
	ir, err := parser.Parse(ctx, []byte(protoContent), ParseOptions{})

	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check endpoints
	assert.Len(t, ir.Endpoints, 3)

	// Check client streaming
	uploadEndpoint := ir.Endpoints[0]
	assert.Equal(t, "UploadMessages", uploadEndpoint.Name)
	assert.NotNil(t, uploadEndpoint.Streaming)
	assert.Equal(t, "client-stream", uploadEndpoint.Streaming.Type)
	assert.Equal(t, true, uploadEndpoint.Extensions["client_streaming"])
	assert.Equal(t, false, uploadEndpoint.Extensions["server_streaming"])

	// Check server streaming
	downloadEndpoint := ir.Endpoints[1]
	assert.Equal(t, "DownloadMessages", downloadEndpoint.Name)
	assert.NotNil(t, downloadEndpoint.Streaming)
	assert.Equal(t, "server-stream", downloadEndpoint.Streaming.Type)
	assert.Equal(t, false, downloadEndpoint.Extensions["client_streaming"])
	assert.Equal(t, true, downloadEndpoint.Extensions["server_streaming"])

	// Check bidirectional streaming
	chatEndpoint := ir.Endpoints[2]
	assert.Equal(t, "Chat", chatEndpoint.Name)
	assert.NotNil(t, chatEndpoint.Streaming)
	assert.Equal(t, "bidirectional", chatEndpoint.Streaming.Type)
	assert.Equal(t, true, chatEndpoint.Extensions["client_streaming"])
	assert.Equal(t, true, chatEndpoint.Extensions["server_streaming"])
	assert.Equal(t, true, chatEndpoint.Extensions["bidirectional"])
}

func TestGRPCParser_Parse_ComplexTypes(t *testing.T) {
	parser := NewGRPCParser()

	protoContent := `
syntax = "proto3";

package complex.v1;

service ProductService {
  rpc GetProduct(ProductRequest) returns (Product);
}

enum ProductStatus {
  UNKNOWN = 0;
  ACTIVE = 1;
  INACTIVE = 2;
  DISCONTINUED = 3;
}

message ProductRequest {
  string id = 1;
}

message Product {
  string id = 1;
  string name = 2;
  repeated string tags = 3;
  map<string, string> metadata = 4;
  ProductStatus status = 5;
  optional string description = 6;
}
`

	ctx := context.Background()
	ir, err := parser.Parse(ctx, []byte(protoContent), ParseOptions{})

	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Find Product message
	var productType *TypeDefinition
	for i, typeDef := range ir.Types {
		if typeDef.Name == "Product" {
			productType = &ir.Types[i]
			break
		}
	}
	require.NotNil(t, productType)

	// Check repeated field
	tagsProp := productType.Properties["tags"]
	assert.Equal(t, "array", tagsProp.Type)
	assert.NotNil(t, tagsProp.Items)

	// Check map field
	metadataProp := productType.Properties["metadata"]
	assert.Equal(t, "object", metadataProp.Type)

	// Find ProductStatus enum
	var statusEnum *TypeDefinition
	for i, typeDef := range ir.Types {
		if typeDef.Name == "ProductStatus" {
			statusEnum = &ir.Types[i]
			break
		}
	}
	require.NotNil(t, statusEnum)
	assert.Equal(t, "string", statusEnum.Type)
	assert.Len(t, statusEnum.Enum, 4)
	assert.Contains(t, statusEnum.Enum, "UNKNOWN")
	assert.Contains(t, statusEnum.Enum, "ACTIVE")
	assert.Contains(t, statusEnum.Enum, "INACTIVE")
	assert.Contains(t, statusEnum.Enum, "DISCONTINUED")
}

func TestGRPCParser_Parse_WithImports(t *testing.T) {
	parser := NewGRPCParser()

	protoContent := `
syntax = "proto3";

package import_test.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";
import public "common/types.proto";

service TestService {
  rpc Test(google.protobuf.Empty) returns (google.protobuf.Empty);
}
`

	ctx := context.Background()
	ir, err := parser.Parse(ctx, []byte(protoContent), ParseOptions{})

	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check imports are captured in extensions
	imports, ok := ir.Extensions["imports"].([]string)
	assert.True(t, ok)
	assert.Len(t, imports, 3)
	assert.Contains(t, imports, "google/protobuf/timestamp.proto")
	assert.Contains(t, imports, "google/protobuf/empty.proto")
	assert.Contains(t, imports, "common/types.proto")
}

func TestGRPCParser_Validate(t *testing.T) {
	parser := NewGRPCParser()

	protoContent := `
syntax = "proto3";

package validation.v1;

service ValidationService {
  rpc ValidateUser(User) returns (User);
}

message User {
  string name = 1;
}
`

	ctx := context.Background()
	ir, err := parser.Parse(ctx, []byte(protoContent), ParseOptions{})
	require.NoError(t, err)

	// Validate
	results, err := parser.Validate(ir)
	require.NoError(t, err)
	assert.NotNil(t, results)
}

func TestGRPCParser_GetFormat(t *testing.T) {
	parser := NewGRPCParser()
	assert.Equal(t, "grpc", parser.GetFormat())
}

func TestGRPCParser_GetVersion(t *testing.T) {
	parser := NewGRPCParser()
	assert.Equal(t, "1.0.0", parser.GetVersion())
}

func TestGRPCParser_GetSupportedVersions(t *testing.T) {
	parser := NewGRPCParser()
	versions := parser.GetSupportedVersions()
	assert.Len(t, versions, 2)
	assert.Contains(t, versions, "proto2")
	assert.Contains(t, versions, "proto3")
}

func TestGRPCParser_ProtoTypeToJSONType(t *testing.T) {
	parser := NewGRPCParser()

	tests := []struct {
		protoType string
		jsonType  string
	}{
		{"string", "string"},
		{"int32", "integer"},
		{"int64", "integer"},
		{"float", "number"},
		{"double", "number"},
		{"bool", "boolean"},
		{"bytes", "string"},
		{"CustomMessage", "object"},
	}

	for _, tt := range tests {
		t.Run(tt.protoType, func(t *testing.T) {
			got := parser.protoTypeToJSONType(tt.protoType)
			assert.Equal(t, tt.jsonType, got)
		})
	}
}
