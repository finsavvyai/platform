package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConnection_NewConnection(t *testing.T) {
	tests := []struct {
		name    string
		input   ConnectionConfig
		want    *Connection
		wantErr bool
	}{
		{
			name: "valid PostgreSQL connection",
			input: ConnectionConfig{
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
			},
			want: &Connection{
				ID:        "",
				UserID:    "",
				Name:      "",
				Type:      "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
				Status:    "disconnected",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "invalid connection type",
			input: ConnectionConfig{
				Type:     "invalid",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "missing required fields",
			input: ConnectionConfig{
				Type: "postgresql",
				Host: "",
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewConnection(tt.input, "user123", "Test Connection")

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, got)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.NotEmpty(t, got.ID)
				assert.Equal(t, "user123", got.UserID)
				assert.Equal(t, "Test Connection", got.Name)
				assert.Equal(t, tt.input.Type, got.Type)
				assert.Equal(t, tt.input.Host, got.Host)
				assert.Equal(t, tt.input.Port, got.Port)
				assert.Equal(t, tt.input.Database, got.Database)
				assert.Equal(t, tt.input.Username, got.Username)
				assert.Equal(t, tt.input.Password, got.Password)
				assert.Equal(t, "disconnected", got.Status)
				assert.WithinDuration(t, time.Now(), got.CreatedAt, time.Second)
				assert.WithinDuration(t, time.Now(), got.UpdatedAt, time.Second)
			}
		})
	}
}

func TestConnection_Validate(t *testing.T) {
	tests := []struct {
		name    string
		conn    *Connection
		wantErr bool
	}{
		{
			name: "valid connection",
			conn: &Connection{
				ID:       "conn123",
				UserID:   "user123",
				Name:     "Test Connection",
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
				Status:   "connected",
			},
			wantErr: false,
		},
		{
			name: "missing ID",
			conn: &Connection{
				UserID:   "user123",
				Name:     "Test Connection",
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
				Status:   "connected",
			},
			wantErr: true,
		},
		{
			name: "invalid status",
			conn: &Connection{
				ID:       "conn123",
				UserID:   "user123",
				Name:     "Test Connection",
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
				Status:   "invalid",
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			conn: &Connection{
				ID:       "conn123",
				UserID:   "user123",
				Name:     "Test Connection",
				Type:     "postgresql",
				Host:     "localhost",
				Port:     0,
				Database: "testdb",
				Username: "user",
				Password: "password",
				Status:   "connected",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.conn.Validate()

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConnection_UpdateStatus(t *testing.T) {
	conn := &Connection{
		ID:        "conn123",
		Status:    "disconnected",
		UpdatedAt: time.Now().Add(-1 * time.Hour),
	}

	oldUpdatedAt := conn.UpdatedAt
	err := conn.UpdateStatus("connected")

	assert.NoError(t, err)
	assert.Equal(t, "connected", conn.Status)
	assert.True(t, conn.UpdatedAt.After(oldUpdatedAt))
}

func TestConnection_UpdateStatus_InvalidStatus(t *testing.T) {
	conn := &Connection{
		ID:     "conn123",
		Status: "disconnected",
	}

	err := conn.UpdateStatus("invalid")
	assert.Error(t, err)
	assert.Equal(t, "disconnected", conn.Status)
}

func TestConnection_GetConnectionString(t *testing.T) {
	tests := []struct {
		name string
		conn *Connection
		want string
	}{
		{
			name: "PostgreSQL connection string",
			conn: &Connection{
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
			},
			want: "postgres://user:password@localhost:5432/testdb",
		},
		{
			name: "MySQL connection string",
			conn: &Connection{
				Type:     "mysql",
				Host:     "localhost",
				Port:     3306,
				Database: "testdb",
				Username: "user",
				Password: "password",
			},
			want: "user:password@tcp(localhost:3306)/testdb",
		},
		{
			name: "MongoDB connection string",
			conn: &Connection{
				Type:     "mongodb",
				Host:     "localhost",
				Port:     27017,
				Database: "testdb",
				Username: "user",
				Password: "password",
			},
			want: "mongodb://user:password@localhost:27017/testdb",
		},
		{
			name: "Redis connection string",
			conn: &Connection{
				Type:     "redis",
				Host:     "localhost",
				Port:     6379,
				Password: "password",
			},
			want: "redis://:password@localhost:6379",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.conn.GetConnectionString()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestConnection_IsSecure(t *testing.T) {
	tests := []struct {
		name string
		conn *Connection
		want bool
	}{
		{
			name: "secure PostgreSQL connection",
			conn: &Connection{
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
				SSLMode:  "require",
			},
			want: true,
		},
		{
			name: "insecure PostgreSQL connection",
			conn: &Connection{
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
				SSLMode:  "disable",
			},
			want: false,
		},
		{
			name: "secure MySQL connection",
			conn: &Connection{
				Type:     "mysql",
				Host:     "localhost",
				Port:     3306,
				Database: "testdb",
				Username: "user",
				Password: "password",
				SSLMode:  "true",
			},
			want: true,
		},
		{
			name: "default insecure connection",
			conn: &Connection{
				Type:     "postgresql",
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "user",
				Password: "password",
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.conn.IsSecure()
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestConnection_Clone(t *testing.T) {
	original := &Connection{
		ID:        "conn123",
		UserID:    "user123",
		Name:      "Test Connection",
		Type:      "postgresql",
		Host:      "localhost",
		Port:      5432,
		Database:  "testdb",
		Username:  "user",
		Password:  "password",
		Status:    "connected",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	clone := original.Clone()

	assert.Equal(t, original.ID, clone.ID)
	assert.Equal(t, original.UserID, clone.UserID)
	assert.Equal(t, original.Name, clone.Name)
	assert.Equal(t, original.Type, clone.Type)
	assert.Equal(t, original.Host, clone.Host)
	assert.Equal(t, original.Port, clone.Port)
	assert.Equal(t, original.Database, clone.Database)
	assert.Equal(t, original.Username, clone.Username)
	assert.Equal(t, original.Password, clone.Password)
	assert.Equal(t, original.Status, clone.Status)
	assert.Equal(t, original.CreatedAt, clone.CreatedAt)
	assert.Equal(t, original.UpdatedAt, clone.UpdatedAt)

	// Ensure they are different objects
	assert.NotSame(t, original, clone)

	// Modify clone and ensure original is not affected
	clone.Name = "Modified Connection"
	assert.NotEqual(t, original.Name, clone.Name)
}

func TestConnection_GetConnectionTypeDisplayName(t *testing.T) {
	tests := []struct {
		name string
		conn *Connection
		want string
	}{
		{
			name: "PostgreSQL display name",
			conn: &Connection{Type: "postgresql"},
			want: "PostgreSQL",
		},
		{
			name: "MySQL display name",
			conn: &Connection{Type: "mysql"},
			want: "MySQL",
		},
		{
			name: "MongoDB display name",
			conn: &Connection{Type: "mongodb"},
			want: "MongoDB",
		},
		{
			name: "Redis display name",
			conn: &Connection{Type: "redis"},
			want: "Redis",
		},
		{
			name: "unknown type",
			conn: &Connection{Type: "unknown"},
			want: "Unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.conn.GetConnectionTypeDisplayName()
			assert.Equal(t, tt.want, got)
		})
	}
}

// Benchmark tests
func BenchmarkConnection_NewConnection(b *testing.B) {
	config := ConnectionConfig{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
		Username: "user",
		Password: "password",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := NewConnection(config, "user123", "Test Connection")
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkConnection_Validate(b *testing.B) {
	conn := &Connection{
		ID:       "conn123",
		UserID:   "user123",
		Name:     "Test Connection",
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
		Username: "user",
		Password: "password",
		Status:   "connected",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := conn.Validate()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkConnection_GetConnectionString(b *testing.B) {
	conn := &Connection{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
		Username: "user",
		Password: "password",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = conn.GetConnectionString()
	}
}