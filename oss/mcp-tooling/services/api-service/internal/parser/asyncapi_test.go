package parser

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncAPIParser_DetectFormat(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name: "AsyncAPI 3.0.0",
			input: `{
				"asyncapi": "3.0.0",
				"info": {"title": "Test API", "version": "1.0.0"}
			}`,
			want:    "asyncapi",
			wantErr: false,
		},
		{
			name: "AsyncAPI 2.6.0",
			input: `{
				"asyncapi": "2.6.0",
				"info": {"title": "Test API", "version": "1.0.0"}
			}`,
			want:    "asyncapi",
			wantErr: false,
		},
		{
			name: "Invalid JSON",
			input: `{
				"openapi": "3.0.0"
			}`,
			want:    "",
			wantErr: true,
		},
		{
			name:    "Not JSON",
			input:   `not json`,
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

	_ = ctx
}

func TestAsyncAPIParser_Parse_WebSocketAPI(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "WebSocket Chat API",
			"version": "1.0.0",
			"description": "Real-time chat application using WebSocket"
		},
		"defaultContentType": "application/json",
		"servers": {
			"production": {
				"url": "wss://chat.example.com",
				"protocol": "ws",
				"description": "Production WebSocket server"
			}
		},
		"channels": {
			"chat/messages": {
				"address": "chat/messages",
				"messages": {
					"chatMessage": {
						"title": "Chat Message",
						"description": "A message sent in the chat",
						"contentType": "application/json",
						"payload": {
							"type": "object",
							"properties": {
								"text": {"type": "string"},
								"userId": {"type": "string"},
								"timestamp": {"type": "string", "format": "date-time"}
							}
						}
					}
				}
			}
		},
		"operations": {
			"sendMessage": {
				"action": "send",
				"channel": "chat/messages",
				"title": "Send Chat Message",
				"description": "Send a message to the chat",
				"messages": ["chatMessage"]
			},
			"receiveMessages": {
				"action": "receive",
				"channel": "chat/messages",
				"title": "Receive Chat Messages",
				"description": "Receive messages from the chat",
				"messages": ["chatMessage"]
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "WebSocket Chat API", ir.Metadata.Title)
	assert.Equal(t, "1.0.0", ir.Metadata.Version)
	assert.Equal(t, "asyncapi", ir.Source.Format)
	assert.Equal(t, "3.0.0", ir.Source.Version)

	// Check servers
	assert.Len(t, ir.Servers, 1)
	assert.Equal(t, "wss://chat.example.com", ir.Servers[0].URL)
	assert.Equal(t, "ws", ir.Servers[0].Extensions["protocol"])

	// Check operations/endpoints
	assert.GreaterOrEqual(t, len(ir.Endpoints), 2)

	// Find send operation
	var sendOp *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "sendMessage" {
			sendOp = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, sendOp)
	assert.Equal(t, "Send Chat Message", sendOp.Name)
	assert.Equal(t, "SEND", sendOp.Method)
	assert.Equal(t, "chat/messages", sendOp.Path)
	assert.NotNil(t, sendOp.Streaming)
	assert.Equal(t, "client-stream", sendOp.Streaming.Type)

	// Find receive operation
	var receiveOp *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "receiveMessages" {
			receiveOp = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, receiveOp)
	assert.Equal(t, "Receive Chat Messages", receiveOp.Name)
	assert.Equal(t, "RECEIVE", receiveOp.Method)
	assert.NotNil(t, receiveOp.Streaming)
	assert.Equal(t, "server-stream", receiveOp.Streaming.Type)
}

func TestAsyncAPIParser_Parse_MQTTSensor(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "IoT Sensor MQTT API",
			"version": "1.0.0",
			"description": "MQTT API for IoT sensors"
		},
		"servers": {
			"mqtt-broker": {
				"url": "mqtt://broker.example.com:1883",
				"protocol": "mqtt",
				"protocolVersion": "5.0",
				"description": "MQTT broker for sensor data"
			}
		},
		"channels": {
			"sensors/temperature/{sensorId}": {
				"address": "sensors/temperature/{sensorId}",
				"parameters": {
					"sensorId": {
						"description": "Unique sensor identifier"
					}
				},
				"messages": {
					"temperatureReading": {
						"title": "Temperature Reading",
						"description": "Temperature sensor reading",
						"contentType": "application/json",
						"payload": {
							"type": "object",
							"properties": {
								"temperature": {"type": "number"},
								"unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
								"timestamp": {"type": "string"}
							}
						}
					}
				}
			}
		},
		"operations": {
			"publishTemperature": {
				"action": "send",
				"channel": "sensors/temperature/{sensorId}",
				"title": "Publish Temperature",
				"description": "Publish temperature reading from sensor",
				"messages": ["temperatureReading"]
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "IoT Sensor MQTT API", ir.Metadata.Title)

	// Check servers
	assert.Len(t, ir.Servers, 1)
	assert.Contains(t, ir.Servers[0].URL, "mqtt://")
	assert.Equal(t, "mqtt", ir.Servers[0].Extensions["protocol"])
	assert.Equal(t, "5.0", ir.Servers[0].Extensions["protocol_version"])

	// Check operation
	assert.GreaterOrEqual(t, len(ir.Endpoints), 1)
	var publishOp *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "publishTemperature" {
			publishOp = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, publishOp)
	assert.Equal(t, "Publish Temperature", publishOp.Name)
	assert.Contains(t, publishOp.Path, "sensors/temperature")
}

func TestAsyncAPIParser_Parse_KafkaEvents(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "Order Events Kafka API",
			"version": "1.0.0",
			"description": "Kafka API for order events"
		},
		"servers": {
			"kafka-cluster": {
				"url": "kafka://kafka.example.com:9092",
				"protocol": "kafka",
				"description": "Kafka cluster for order events"
			}
		},
		"channels": {
			"orders.created": {
				"address": "orders.created",
				"messages": {
					"orderCreated": {
						"title": "Order Created Event",
						"description": "Event published when an order is created",
						"contentType": "application/json",
						"payload": {
							"type": "object",
							"properties": {
								"orderId": {"type": "string"},
								"customerId": {"type": "string"},
								"total": {"type": "number"},
								"items": {"type": "array"}
							}
						}
					}
				}
			}
		},
		"operations": {
			"publishOrderCreated": {
				"action": "send",
				"channel": "orders.created",
				"title": "Publish Order Created",
				"description": "Publish order created event to Kafka",
				"messages": ["orderCreated"]
			},
			"subscribeOrderCreated": {
				"action": "receive",
				"channel": "orders.created",
				"title": "Subscribe to Order Created",
				"description": "Subscribe to order created events",
				"messages": ["orderCreated"]
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "Order Events Kafka API", ir.Metadata.Title)

	// Check servers
	assert.Len(t, ir.Servers, 1)
	assert.Contains(t, ir.Servers[0].URL, "kafka://")
	assert.Equal(t, "kafka", ir.Servers[0].Extensions["protocol"])

	// Check operations
	assert.GreaterOrEqual(t, len(ir.Endpoints), 2)

	// Check publish operation
	var publishOp *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "publishOrderCreated" {
			publishOp = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, publishOp)
	assert.Equal(t, "SEND", publishOp.Method)
	assert.NotNil(t, publishOp.Streaming)

	// Check subscribe operation
	var subscribeOp *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "subscribeOrderCreated" {
			subscribeOp = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, subscribeOp)
	assert.Equal(t, "RECEIVE", subscribeOp.Method)
	assert.NotNil(t, subscribeOp.Streaming)
}

func TestAsyncAPIParser_Parse_RequestReply(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "Request-Reply Pattern API",
			"version": "1.0.0"
		},
		"channels": {
			"user/query": {
				"address": "user/query",
				"messages": {
					"userQuery": {
						"title": "User Query",
						"description": "Query user information",
						"payload": {
							"type": "object",
							"properties": {
								"userId": {"type": "string"}
							}
						}
					}
				}
			},
			"user/response": {
				"address": "user/response",
				"messages": {
					"userResponse": {
						"title": "User Response",
						"description": "User information response",
						"payload": {
							"type": "object",
							"properties": {
								"userId": {"type": "string"},
								"name": {"type": "string"},
								"email": {"type": "string"}
							}
						}
					}
				}
			}
		},
		"operations": {
			"queryUser": {
				"action": "send",
				"channel": "user/query",
				"title": "Query User",
				"reply": {
					"channel": "user/response",
					"messages": ["userResponse"]
				}
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Find the query operation
	var queryOp *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "queryUser" {
			queryOp = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, queryOp)

	// Check that reply info is preserved in extensions
	assert.NotNil(t, queryOp.Extensions["reply"])
}

func TestAsyncAPIParser_Parse_WithComponents(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "API with Components",
			"version": "1.0.0"
		},
		"channels": {
			"events": {
				"address": "events",
				"messages": {
					"event": {
						"$ref": "#/components/messages/genericEvent"
					}
				}
			}
		},
		"components": {
			"messages": {
				"genericEvent": {
					"title": "Generic Event",
					"description": "A generic event message",
					"payload": {
						"type": "object",
						"properties": {
							"eventType": {"type": "string"},
							"data": {"type": "object"}
						}
					}
				}
			},
			"schemas": {
				"EventData": {
					"type": "object",
					"properties": {
						"id": {"type": "string"},
						"timestamp": {"type": "string"}
					}
				}
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check that types were extracted from components
	assert.GreaterOrEqual(t, len(ir.Types), 1)

	// Check for EventData schema
	var foundEventData bool
	for _, typeDef := range ir.Types {
		if typeDef.Name == "EventData" {
			foundEventData = true
			break
		}
	}
	assert.True(t, foundEventData, "EventData schema should be extracted from components")
}

func TestAsyncAPIParser_Validate(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "Valid API",
			"version": "1.0.0"
		},
		"channels": {}
	}`

	ir, err := parser.Parse(ctx, []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)

	results, err := parser.Validate(ir)
	require.NoError(t, err)
	assert.NotNil(t, results)
	assert.True(t, results.Valid || results.IsValid)
}

func TestAsyncAPIParser_GetFormat(t *testing.T) {
	parser := NewAsyncAPIParser()
	assert.Equal(t, "asyncapi", parser.GetFormat())
}

func TestAsyncAPIParser_GetVersion(t *testing.T) {
	parser := NewAsyncAPIParser()
	assert.Equal(t, "1.0.0", parser.GetVersion())
}

func TestAsyncAPIParser_GetSupportedVersions(t *testing.T) {
	parser := NewAsyncAPIParser()
	versions := parser.GetSupportedVersions()
	assert.Contains(t, versions, "2.0.0")
	assert.Contains(t, versions, "2.6.0")
	assert.Contains(t, versions, "3.0.0")
}

func TestAsyncAPIParser_Parse_MissingRequired(t *testing.T) {
	parser := NewAsyncAPIParser()
	ctx := context.Background()

	tests := []struct {
		name    string
		input   string
		wantErr string
	}{
		{
			name: "Missing asyncapi field",
			input: `{
				"info": {"title": "Test", "version": "1.0.0"}
			}`,
			wantErr: "missing required field: asyncapi",
		},
		{
			name: "Missing info.title",
			input: `{
				"asyncapi": "3.0.0",
				"info": {"version": "1.0.0"}
			}`,
			wantErr: "missing required field: info.title",
		},
		{
			name: "Missing info.version",
			input: `{
				"asyncapi": "3.0.0",
				"info": {"title": "Test"}
			}`,
			wantErr: "missing required field: info.version",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parser.Parse(ctx, []byte(tt.input), ParseOptions{})
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}
