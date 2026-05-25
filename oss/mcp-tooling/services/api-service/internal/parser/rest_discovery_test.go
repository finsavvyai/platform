package parser

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRESTDiscoveryParser_DetectFormat(t *testing.T) {
	parser := NewRESTDiscoveryParser()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name: "HAL+JSON with _links",
			input: `{
				"_links": {
					"self": {"href": "/api/users/1"}
				}
			}`,
			want:    "rest-discovery",
			wantErr: false,
		},
		{
			name: "Siren with actions",
			input: `{
				"class": ["order"],
				"actions": [{
					"name": "add-item",
					"method": "POST",
					"href": "/orders/42/items"
				}]
			}`,
			want:    "rest-discovery",
			wantErr: false,
		},
		{
			name: "JSON-LD with @context",
			input: `{
				"@context": "https://schema.org",
				"@id": "/api/person/1"
			}`,
			want:    "rest-discovery",
			wantErr: false,
		},
		{
			name: "Not REST discovery",
			input: `{
				"openapi": "3.0.0"
			}`,
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

func TestRESTDiscoveryParser_Parse_HAL(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	ctx := context.Background()

	halDoc := `{
		"_links": {
			"self": {
				"href": "https://api.example.com/orders/42"
			},
			"items": {
				"href": "https://api.example.com/orders/42/items",
				"title": "Order Items"
			},
			"customer": {
				"href": "https://api.example.com/customers/123"
			},
			"update": {
				"href": "https://api.example.com/orders/42",
				"method": "PUT"
			},
			"delete": {
				"href": "https://api.example.com/orders/42",
				"method": "DELETE"
			}
		},
		"total": 30.00,
		"currency": "USD",
		"status": "pending"
	}`

	ir, err := parser.Parse(ctx, []byte(halDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "HAL API", ir.Metadata.Title)
	assert.Equal(t, "rest-discovery", ir.Source.Format)
	assert.Equal(t, "hal", ir.Source.Version)

	// Check servers
	assert.Len(t, ir.Servers, 1)
	assert.Equal(t, "https://api.example.com", ir.Servers[0].URL)

	// Check endpoints
	assert.GreaterOrEqual(t, len(ir.Endpoints), 4)

	// Find specific endpoints
	var selfEndpoint, updateEndpoint, deleteEndpoint *UnifiedEndpoint
	for i := range ir.Endpoints {
		switch ir.Endpoints[i].ID {
		case "self":
			selfEndpoint = &ir.Endpoints[i]
		case "update":
			updateEndpoint = &ir.Endpoints[i]
		case "delete":
			deleteEndpoint = &ir.Endpoints[i]
		}
	}

	require.NotNil(t, selfEndpoint)
	assert.Equal(t, "GET", selfEndpoint.Method)

	require.NotNil(t, updateEndpoint)
	assert.Equal(t, "PUT", updateEndpoint.Method)

	require.NotNil(t, deleteEndpoint)
	assert.Equal(t, "DELETE", deleteEndpoint.Method)
}

func TestRESTDiscoveryParser_Parse_Siren(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	ctx := context.Background()

	sirenDoc := `{
		"class": ["order"],
		"title": "Order 42",
		"properties": {
			"orderNumber": 42,
			"total": 30.00,
			"status": "pending"
		},
		"links": [
			{
				"rel": ["self"],
				"href": "https://api.example.com/orders/42"
			},
			{
				"rel": ["previous"],
				"href": "https://api.example.com/orders/41",
				"title": "Previous Order"
			},
			{
				"rel": ["next"],
				"href": "https://api.example.com/orders/43",
				"title": "Next Order"
			}
		],
		"actions": [
			{
				"name": "add-item",
				"title": "Add Item",
				"method": "POST",
				"href": "https://api.example.com/orders/42/items",
				"type": "application/x-www-form-urlencoded",
				"fields": [
					{
						"name": "orderNumber",
						"type": "hidden",
						"value": "42"
					},
					{
						"name": "productCode",
						"type": "text",
						"title": "Product Code"
					},
					{
						"name": "quantity",
						"type": "number",
						"title": "Quantity"
					}
				]
			},
			{
				"name": "delete-order",
				"title": "Delete Order",
				"method": "DELETE",
				"href": "https://api.example.com/orders/42"
			}
		]
	}`

	ir, err := parser.Parse(ctx, []byte(sirenDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "Order 42", ir.Metadata.Title)
	assert.Equal(t, "siren", ir.Source.Version)

	// Check endpoints from actions
	var addItemAction, deleteAction *UnifiedEndpoint
	for i := range ir.Endpoints {
		switch ir.Endpoints[i].ID {
		case "add-item":
			addItemAction = &ir.Endpoints[i]
		case "delete-order":
			deleteAction = &ir.Endpoints[i]
		}
	}

	require.NotNil(t, addItemAction)
	assert.Equal(t, "Add Item", addItemAction.Name)
	assert.Equal(t, "POST", addItemAction.Method)
	assert.Len(t, addItemAction.Parameters, 3)

	require.NotNil(t, deleteAction)
	assert.Equal(t, "DELETE", deleteAction.Method)

	// Check links
	var selfLink, prevLink *UnifiedEndpoint
	for i := range ir.Endpoints {
		switch ir.Endpoints[i].ID {
		case "self":
			selfLink = &ir.Endpoints[i]
		case "previous":
			prevLink = &ir.Endpoints[i]
		}
	}

	require.NotNil(t, selfLink)
	assert.Equal(t, "GET", selfLink.Method)

	require.NotNil(t, prevLink)
	assert.Equal(t, "Previous Order", prevLink.Name)
}

func TestRESTDiscoveryParser_Parse_JSONLD(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	ctx := context.Background()

	jsonldDoc := `{
		"@context": "https://schema.org",
		"@type": "Person",
		"@id": "https://api.example.com/people/123",
		"name": "Jane Doe",
		"url": "https://example.com/janedoe",
		"image": "https://example.com/janedoe.jpg",
		"jobTitle": "Software Engineer",
		"worksFor": "https://api.example.com/organizations/456"
	}`

	ir, err := parser.Parse(ctx, []byte(jsonldDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "JSON-LD API", ir.Metadata.Title)
	assert.Equal(t, "jsonld", ir.Source.Version)

	// Check self endpoint
	var selfEndpoint *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "self" {
			selfEndpoint = &ir.Endpoints[i]
			break
		}
	}

	require.NotNil(t, selfEndpoint)
	assert.Equal(t, "https://api.example.com/people/123", selfEndpoint.Path)
	assert.Equal(t, "GET", selfEndpoint.Method)

	// Should have discovered URL properties as endpoints
	assert.GreaterOrEqual(t, len(ir.Endpoints), 2)
}

func TestRESTDiscoveryParser_InferMethodFromRel(t *testing.T) {
	parser := NewRESTDiscoveryParser()

	tests := []struct {
		rel    string
		method string
	}{
		{"self", "GET"},
		{"next", "GET"},
		{"prev", "GET"},
		{"create-order", "POST"},
		{"add-item", "POST"},
		{"update-profile", "PUT"},
		{"edit-user", "PUT"},
		{"patch-data", "PATCH"},
		{"delete-record", "DELETE"},
		{"remove-item", "DELETE"},
	}

	for _, tt := range tests {
		t.Run(tt.rel, func(t *testing.T) {
			method := parser.inferMethodFromRel(tt.rel)
			assert.Equal(t, tt.method, method)
		})
	}
}

func TestRESTDiscoveryParser_Validate(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	ctx := context.Background()

	halDoc := `{
		"_links": {
			"self": {"href": "/api/test"}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(halDoc), ParseOptions{})
	require.NoError(t, err)

	results, err := parser.Validate(ir)
	require.NoError(t, err)
	assert.NotNil(t, results)
	assert.True(t, results.Valid || results.IsValid)
}

func TestRESTDiscoveryParser_GetFormat(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	assert.Equal(t, "rest-discovery", parser.GetFormat())
}

func TestRESTDiscoveryParser_GetVersion(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	assert.Equal(t, "1.0.0", parser.GetVersion())
}

func TestRESTDiscoveryParser_GetSupportedVersions(t *testing.T) {
	parser := NewRESTDiscoveryParser()
	versions := parser.GetSupportedVersions()
	assert.Contains(t, versions, "hal")
	assert.Contains(t, versions, "siren")
	assert.Contains(t, versions, "jsonld")
}
