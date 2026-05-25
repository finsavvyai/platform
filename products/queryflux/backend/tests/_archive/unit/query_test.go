package entities

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewQuery(t *testing.T) {
	tests := []struct {
		name         string
		userID       string
		connectionID string
		sql          string
		expectError  bool
		errorMsg     string
	}{
		{
			name:         "valid query",
			userID:       "user-123",
			connectionID: "conn-456",
			sql:          "SELECT * FROM users",
			expectError:  false,
		},
		{
			name:         "empty user ID",
			userID:       "",
			connectionID: "conn-456",
			sql:          "SELECT * FROM users",
			expectError:  true,
			errorMsg:     "user ID is required",
		},
		{
			name:         "empty connection ID",
			userID:       "user-123",
			connectionID: "",
			sql:          "SELECT * FROM users",
			expectError:  true,
			errorMsg:     "connection ID is required",
		},
		{
			name:         "empty SQL",
			userID:       "user-123",
			connectionID: "conn-456",
			sql:          "",
			expectError:  true,
			errorMsg:     "SQL query is required",
		},
		{
			name:         "whitespace only SQL",
			userID:       "user-123",
			connectionID: "conn-456",
			sql:          "   \n\t   ",
			expectError:  true,
			errorMsg:     "SQL query cannot be empty",
		},
		{
			name:         "SQL too large",
			userID:       "user-123",
			connectionID: "conn-456",
			sql:          string(make([]byte, 1000001)), // 1MB + 1 byte
			expectError:  true,
			errorMsg:     "SQL query is too large",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query, err := NewQuery(tt.userID, tt.connectionID, tt.sql)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, query)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, query)
				assert.NotEmpty(t, query.ID)
				assert.Equal(t, tt.userID, query.UserID)
				assert.Equal(t, tt.connectionID, query.ConnectionID)
				assert.Equal(t, "SELECT * FROM users", query.SQL) // Trimmed
				assert.Equal(t, QueryStatusPending, query.Status)
				assert.WithinDuration(t, time.Now(), query.ExecutedAt, time.Second)
				assert.WithinDuration(t, time.Now(), query.CreatedAt, time.Second)
			}
		})
	}
}

func TestNewNamedQuery(t *testing.T) {
	query, err := NewNamedQuery("user-123", "conn-456", "My Query", "SELECT * FROM users")
	assert.NoError(t, err)
	assert.Equal(t, "My Query", query.Name)

	// Test invalid name
	_, err = NewNamedQuery("user-123", "conn-456", "", "SELECT * FROM users")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "query name cannot be empty")
}

func TestQuery_Validate(t *testing.T) {
	validQuery, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	// Valid query
	err = validQuery.Validate()
	assert.NoError(t, err)

	// Invalid query - empty ID
	invalidQuery := *validQuery
	invalidQuery.ID = ""
	err = invalidQuery.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "query ID is required")

	// Invalid status
	invalidQuery = *validQuery
	invalidQuery.Status = "invalid-status"
	err = invalidQuery.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid query status")
}

func TestQuery_SetName(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	err = query.SetName("My Query")
	assert.NoError(t, err)
	assert.Equal(t, "My Query", query.Name)

	err = query.SetName("")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "query name cannot be empty")

	// Test name too long
	longName := string(make([]byte, 256))
	err = query.SetName(longName)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "query name must be less than 255 characters")
}

func TestQuery_Start(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	originalTime := query.ExecutedAt
	time.Sleep(time.Millisecond)

	query.Start()
	assert.Equal(t, QueryStatusRunning, query.Status)
	assert.True(t, query.ExecutedAt.After(originalTime))
}

func TestQuery_Complete(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	results := []map[string]interface{}{
		{"id": 1, "name": "John"},
		{"id": 2, "name": "Jane"},
	}
	duration := 150 * time.Millisecond

	query.Complete(results, duration)

	assert.Equal(t, QueryStatusCompleted, query.Status)
	assert.Equal(t, results, query.Results)
	assert.Equal(t, 2, query.RowCount)
	assert.Equal(t, int64(150), query.Duration)
	assert.Empty(t, query.Error)
}

func TestQuery_Fail(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	testError := assert.AnError
	duration := 50 * time.Millisecond

	query.Fail(testError, duration)

	assert.Equal(t, QueryStatusFailed, query.Status)
	assert.Equal(t, testError.Error(), query.Error)
	assert.Equal(t, int64(50), query.Duration)
	assert.Nil(t, query.Results)
	assert.Equal(t, 0, query.RowCount)
}

func TestQuery_Cancel(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	duration := 25 * time.Millisecond

	query.Cancel(duration)

	assert.Equal(t, QueryStatusCancelled, query.Status)
	assert.Equal(t, int64(25), query.Duration)
	assert.Nil(t, query.Results)
	assert.Equal(t, 0, query.RowCount)
}

func TestQuery_GetQueryType(t *testing.T) {
	tests := []struct {
		name         string
		sql          string
		expectedType string
	}{
		{"SELECT query", "SELECT * FROM users", QueryTypeSelect},
		{"SELECT with WITH", "WITH cte AS (SELECT 1) SELECT * FROM cte", QueryTypeSelect},
		{"INSERT query", "INSERT INTO users (name) VALUES ('John')", QueryTypeInsert},
		{"UPDATE query", "UPDATE users SET name = 'Jane' WHERE id = 1", QueryTypeUpdate},
		{"DELETE query", "DELETE FROM users WHERE id = 1", QueryTypeDelete},
		{"CREATE query", "CREATE TABLE test (id INT)", QueryTypeDDL},
		{"ALTER query", "ALTER TABLE users ADD COLUMN email VARCHAR(255)", QueryTypeDDL},
		{"DROP query", "DROP TABLE test", QueryTypeDDL},
		{"TRUNCATE query", "TRUNCATE TABLE users", QueryTypeDDL},
		{"Other query", "EXPLAIN SELECT * FROM users", QueryTypeOther},
		{"Lowercase select", "select * from users", QueryTypeSelect},
		{"Mixed case", "Select * From users", QueryTypeSelect},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query, err := NewQuery("user-123", "conn-456", tt.sql)
			require.NoError(t, err)

			queryType := query.GetQueryType()
			assert.Equal(t, tt.expectedType, queryType)
		})
	}
}

func TestQuery_IsReadOnly(t *testing.T) {
	selectQuery, _ := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	assert.True(t, selectQuery.IsReadOnly())

	insertQuery, _ := NewQuery("user-123", "conn-456", "INSERT INTO users (name) VALUES ('John')")
	assert.False(t, insertQuery.IsReadOnly())

	updateQuery, _ := NewQuery("user-123", "conn-456", "UPDATE users SET name = 'Jane'")
	assert.False(t, updateQuery.IsReadOnly())

	deleteQuery, _ := NewQuery("user-123", "conn-456", "DELETE FROM users")
	assert.False(t, deleteQuery.IsReadOnly())
}

func TestQuery_IsCompleted(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	// Pending query
	assert.False(t, query.IsCompleted())

	// Running query
	query.Start()
	assert.False(t, query.IsCompleted())

	// Completed query
	query.Complete(nil, 0)
	assert.True(t, query.IsCompleted())

	// Failed query
	query.Status = QueryStatusFailed
	assert.True(t, query.IsCompleted())

	// Cancelled query
	query.Status = QueryStatusCancelled
	assert.True(t, query.IsCompleted())
}

func TestQuery_IsSuccessful(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	assert.False(t, query.IsSuccessful())

	query.Complete(nil, 0)
	assert.True(t, query.IsSuccessful())

	query.Status = QueryStatusFailed
	assert.False(t, query.IsSuccessful())
}

func TestQuery_GetDurationString(t *testing.T) {
	query, err := NewQuery("user-123", "conn-456", "SELECT * FROM users")
	require.NoError(t, err)

	tests := []struct {
		duration int64
		expected string
	}{
		{0, "0ms"},
		{150, "150ms"},
		{999, "999ms"},
		{1000, "1.00s"},
		{1500, "1.50s"},
		{60000, "1m 0.00s"},
		{90500, "1m 30.50s"},
	}

	for _, tt := range tests {
		query.Duration = tt.duration
		result := query.GetDurationString()
		assert.Equal(t, tt.expected, result)
	}
}

func TestQuery_GetSQLPreview(t *testing.T) {
	longSQL := strings.Repeat("A", 200)

	query, err := NewQuery("user-123", "conn-456", longSQL)
	require.NoError(t, err)

	// Default max length (100)
	preview := query.GetSQLPreview(0)
	assert.Len(t, preview, 100)
	assert.True(t, strings.HasSuffix(preview, "..."))

	// Custom max length
	preview = query.GetSQLPreview(50)
	assert.Len(t, preview, 50)
	assert.True(t, strings.HasSuffix(preview, "..."))

	// Short SQL
	shortQuery, _ := NewQuery("user-123", "conn-456", "SELECT 1")
	preview = shortQuery.GetSQLPreview(100)
	assert.Equal(t, "SELECT 1", preview)
}

func TestIsValidQueryStatus(t *testing.T) {
	assert.True(t, isValidQueryStatus(QueryStatusPending))
	assert.True(t, isValidQueryStatus(QueryStatusRunning))
	assert.True(t, isValidQueryStatus(QueryStatusCompleted))
	assert.True(t, isValidQueryStatus(QueryStatusFailed))
	assert.True(t, isValidQueryStatus(QueryStatusCancelled))
	assert.False(t, isValidQueryStatus("invalid"))
	assert.False(t, isValidQueryStatus(""))
}