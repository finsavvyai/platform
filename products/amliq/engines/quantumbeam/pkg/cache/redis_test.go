package cache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedisClient_SetGet(t *testing.T) {
	// Setup test Redis client
	config := &Config{
		Host:     "localhost",
		Port:     6379,
		Password: "",
		DB:       1, // Use test DB
	}

	client, err := NewRedisClient(config)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Test string
	err = client.Set(ctx, "test:string", "hello world", time.Hour)
	require.NoError(t, err)

	var result string
	err = client.Get(ctx, "test:string", &result)
	require.NoError(t, err)
	assert.Equal(t, "hello world", result)

	// Test JSON object
	type TestStruct struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}

	testObj := TestStruct{Name: "John", Age: 30}
	err = client.Set(ctx, "test:object", testObj, time.Hour)
	require.NoError(t, err)

	var retrievedObj TestStruct
	err = client.Get(ctx, "test:object", &retrievedObj)
	require.NoError(t, err)
	assert.Equal(t, testObj.Name, retrievedObj.Name)
	assert.Equal(t, testObj.Age, retrievedObj.Age)

	// Cleanup
	client.Delete(ctx, "test:string", "test:object")
}

func TestRedisClient_Exists(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   1,
	}

	client, err := NewRedisClient(config)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Test non-existent key
	exists, err := client.Exists(ctx, "nonexistent")
	require.NoError(t, err)
	assert.False(t, exists)

	// Test existing key
	err = client.Set(ctx, "test:exists", "value", time.Hour)
	require.NoError(t, err)

	exists, err = client.Exists(ctx, "test:exists")
	require.NoError(t, err)
	assert.True(t, exists)

	// Cleanup
	client.Delete(ctx, "test:exists")
}

func TestRedisClient_SetNX(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   1,
	}

	client, err := NewRedisClient(config)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// First SetNX should succeed
	success, err := client.SetNX(ctx, "test:setnx", "first", time.Hour)
	require.NoError(t, err)
	assert.True(t, success)

	// Second SetNX should fail
	success, err = client.SetNX(ctx, "test:setnx", "second", time.Hour)
	require.NoError(t, err)
	assert.False(t, success)

	// Verify value is still "first"
	var result string
	err = client.Get(ctx, "test:setnx", &result)
	require.NoError(t, err)
	assert.Equal(t, "first", result)

	// Cleanup
	client.Delete(ctx, "test:setnx")
}

func TestRedisClient_Increment(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   1,
	}

	client, err := NewRedisClient(config)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Increment non-existent key (starts from 0)
	val, err := client.Increment(ctx, "test:counter")
	require.NoError(t, err)
	assert.Equal(t, int64(1), val)

	// Increment existing key
	val, err = client.Increment(ctx, "test:counter")
	require.NoError(t, err)
	assert.Equal(t, int64(2), val)

	// Increment by specific amount
	val, err = client.IncrementBy(ctx, "test:counter", 5)
	require.NoError(t, err)
	assert.Equal(t, int64(7), val)

	// Cleanup
	client.Delete(ctx, "test:counter")
}

func TestRedisClient_ExpireTTL(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   1,
	}

	client, err := NewRedisClient(config)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Set key with 2 second expiration
	err = client.Set(ctx, "test:expire", "value", 2*time.Second)
	require.NoError(t, err)

	// Check TTL immediately
	ttl, err := client.TTL(ctx, "test:expire")
	require.NoError(t, err)
	assert.True(t, ttl > 0 && ttl <= 2*time.Second)

	// Wait for expiration
	time.Sleep(3 * time.Second)

	// Key should no longer exist
	exists, err := client.Exists(ctx, "test:expire")
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestRedisClient_Delete(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   1,
	}

	client, err := NewRedisClient(config)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Set multiple keys
	client.Set(ctx, "test:delete1", "value1", time.Hour)
	client.Set(ctx, "test:delete2", "value2", time.Hour)
	client.Set(ctx, "test:delete3", "value3", time.Hour)

	// Verify keys exist
	assert.True(t, func() bool {
		exists, _ := client.Exists(ctx, "test:delete1")
		return exists
	}())
	assert.True(t, func() bool {
		exists, _ := client.Exists(ctx, "test:delete2")
		return exists
	}())
	assert.True(t, func() bool {
		exists, _ := client.Exists(ctx, "test:delete3")
		return exists
	}())

	// Delete keys
	err = client.Delete(ctx, "test:delete1", "test:delete2")
	require.NoError(t, err)

	// Verify deletion
	assert.False(t, func() bool {
		exists, _ := client.Exists(ctx, "test:delete1")
		return exists
	}())
	assert.False(t, func() bool {
		exists, _ := client.Exists(ctx, "test:delete2")
		return exists
	}())
	assert.True(t, func() bool {
		exists, _ := client.Exists(ctx, "test:delete3")
		return exists
	}())

	// Cleanup
	client.Delete(ctx, "test:delete3")
}

func TestSessionManager_CreateSession(t *testing.T) {
	// Setup Redis client for testing
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   2, // Use separate DB for sessions
	}

	redisClient, err := NewRedisClient(config)
	require.NoError(t, err)
	defer redisClient.Close()

	// Setup session manager
	sessionConfig := &SessionConfig{
		SessionDuration:    time.Hour,
		MaxSessionsPerUser: 3,
		SessionPrefix:      "test_session:",
		UserSessionsPrefix: "test_user_sessions:",
	}

	sessionManager := NewSessionManager(redisClient, sessionConfig)
	ctx := context.Background()

	// Create a session
	session, err := sessionManager.CreateSession(
		ctx,
		"user123",
		"quantumbeam",
		"user@example.com",
		"analyst",
		"192.168.1.100",
		"Mozilla/5.0 Test Browser",
	)
	require.NoError(t, err)
	require.NotEmpty(t, session.ID)
	assert.Equal(t, "user123", session.UserID)
	assert.Equal(t, "quantumbeam", session.Organization)
	assert.Equal(t, "user@example.com", session.Email)
	assert.Equal(t, "analyst", session.Role)
	assert.True(t, session.Active)
	assert.True(t, time.Since(session.CreatedAt) < time.Minute)

	// Cleanup
	sessionManager.DeleteSession(ctx, session.ID)
}

func TestSessionManager_GetSession(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   2,
	}

	redisClient, err := NewRedisClient(config)
	require.NoError(t, err)
	defer redisClient.Close()

	sessionConfig := &SessionConfig{
		SessionDuration:    time.Hour,
		SessionPrefix:      "test_session:",
		UserSessionsPrefix: "test_user_sessions:",
	}

	sessionManager := NewSessionManager(redisClient, sessionConfig)
	ctx := context.Background()

	// Create a session
	originalSession, err := sessionManager.CreateSession(
		ctx,
		"user456",
		"quantumbeam",
		"test@example.com",
		"admin",
		"10.0.0.1",
		"TestAgent",
	)
	require.NoError(t, err)

	// Retrieve the session
	retrievedSession, err := sessionManager.GetSession(ctx, originalSession.ID)
	require.NoError(t, err)
	assert.Equal(t, originalSession.ID, retrievedSession.ID)
	assert.Equal(t, originalSession.UserID, retrievedSession.UserID)
	assert.Equal(t, originalSession.Email, retrievedSession.Email)
	assert.Equal(t, originalSession.Role, retrievedSession.Role)
	assert.True(t, retrievedSession.Active)

	// Test non-existent session
	_, err = sessionManager.GetSession(ctx, "nonexistent-session-id")
	assert.Error(t, err)
	assert.Equal(t, ErrSessionNotFound, err)

	// Cleanup
	sessionManager.DeleteSession(ctx, originalSession.ID)
}

func TestSessionManager_RefreshSession(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   2,
	}

	redisClient, err := NewRedisClient(config)
	require.NoError(t, err)
	defer redisClient.Close()

	sessionConfig := &SessionConfig{
		SessionDuration:    30 * time.Minute, // Short duration for testing
		SessionPrefix:      "test_session:",
		UserSessionsPrefix: "test_user_sessions:",
	}

	sessionManager := NewSessionManager(redisClient, sessionConfig)
	ctx := context.Background()

	// Create a session
	session, err := sessionManager.CreateSession(
		ctx,
		"user789",
		"quantumbeam",
		"refresh@example.com",
		"user",
		"127.0.0.1",
		"RefreshTest",
	)
	require.NoError(t, err)

	originalExpiresAt := session.ExpiresAt

	// Wait a bit to ensure different timestamp
	time.Sleep(100 * time.Millisecond)

	// Refresh session
	refreshedSession, err := sessionManager.RefreshSession(ctx, session.ID)
	require.NoError(t, err)
	assert.True(t, refreshedSession.ExpiresAt.After(originalExpiresAt))
	assert.Equal(t, session.ID, refreshedSession.ID)

	// Cleanup
	sessionManager.DeleteSession(ctx, session.ID)
}

func TestSessionManager_DeleteUserSessions(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   2,
	}

	redisClient, err := NewRedisClient(config)
	require.NoError(t, err)
	defer redisClient.Close()

	sessionConfig := &SessionConfig{
		SessionDuration:    time.Hour,
		MaxSessionsPerUser: 5,
		SessionPrefix:      "test_session:",
		UserSessionsPrefix: "test_user_sessions:",
	}

	sessionManager := NewSessionManager(redisClient, sessionConfig)
	ctx := context.Background()

	userID := "user_all_sessions"

	// Create multiple sessions for the same user
	var sessionIDs []string
	for i := 0; i < 3; i++ {
		session, err := sessionManager.CreateSession(
			ctx,
			userID,
			"quantumbeam",
			"user+i@example.com",
			"user",
			"192.168.1.1",
			"TestAgent",
		)
		require.NoError(t, err)
		sessionIDs = append(sessionIDs, session.ID)
	}

	// Verify sessions exist
	sessions, err := sessionManager.GetUserSessions(ctx, userID)
	require.NoError(t, err)
	assert.Len(t, sessions, 3)

	// Delete all user sessions
	err = sessionManager.DeleteUserSessions(ctx, userID)
	require.NoError(t, err)

	// Verify all sessions are deleted
	sessions, err = sessionManager.GetUserSessions(ctx, userID)
	require.NoError(t, err)
	assert.Len(t, sessions, 0)

	// Verify individual sessions are gone
	for _, sessionID := range sessionIDs {
		_, err = sessionManager.GetSession(ctx, sessionID)
		assert.Error(t, err)
		assert.Equal(t, ErrSessionNotFound, err)
	}
}

func TestSessionManager_SessionExpiration(t *testing.T) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   2,
	}

	redisClient, err := NewRedisClient(config)
	require.NoError(t, err)
	defer redisClient.Close()

	sessionConfig := &SessionConfig{
		SessionDuration:    1 * time.Second, // Very short for testing
		SessionPrefix:      "test_session:",
		UserSessionsPrefix: "test_user_sessions:",
	}

	sessionManager := NewSessionManager(redisClient, sessionConfig)
	ctx := context.Background()

	// Create a session
	session, err := sessionManager.CreateSession(
		ctx,
		"expire_user",
		"quantumbeam",
		"expire@example.com",
		"user",
		"10.0.0.1",
		"ExpireTest",
	)
	require.NoError(t, err)

	// Session should be valid immediately
	_, err = sessionManager.GetSession(ctx, session.ID)
	assert.NoError(t, err)

	// Wait for expiration
	time.Sleep(2 * time.Second)

	// Session should be expired
	_, err = sessionManager.GetSession(ctx, session.ID)
	assert.Error(t, err)
	assert.Equal(t, ErrSessionExpired, err)
}

// Benchmark tests
func BenchmarkRedisClient_Set(b *testing.B) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   3,
	}

	client, err := NewRedisClient(config)
	if err != nil {
		b.Skip("Redis not available for benchmarking")
	}
	defer client.Close()

	ctx := context.Background()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("bench:set:%d", i)
		client.Set(ctx, key, "benchmark value", time.Hour)
	}
}

func BenchmarkRedisClient_Get(b *testing.B) {
	config := &Config{
		Host: "localhost",
		Port: 6379,
		DB:   3,
	}

	client, err := NewRedisClient(config)
	if err != nil {
		b.Skip("Redis not available for benchmarking")
	}
	defer client.Close()

	ctx := context.Background()

	// Pre-populate data
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("bench:get:%d", i)
		client.Set(ctx, key, "benchmark value", time.Hour)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("bench:get:%d", i%1000)
		var result string
		client.Get(ctx, key, &result)
	}
}
