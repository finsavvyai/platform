package redisclient

import (
	"context"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

func TestNew_EmptyHost_ReturnsNilNil(t *testing.T) {
	c, err := New(context.Background(), config.RedisConfig{})
	require.NoError(t, err)
	assert.Nil(t, c)
}

func TestNew_PingsMiniredis(t *testing.T) {
	mr := miniredis.RunT(t)
	host, portStr, err := net.SplitHostPort(mr.Addr())
	require.NoError(t, err)
	port, err := strconv.Atoi(portStr)
	require.NoError(t, err)

	c, err := New(context.Background(), config.RedisConfig{
		Host: host, Port: port, DialTimeout: time.Second,
	})
	require.NoError(t, err)
	require.NotNil(t, c)
	defer c.Close()

	require.NoError(t, c.Ping(context.Background()).Err())
}

func TestNew_BadHost_Errors(t *testing.T) {
	_, err := New(context.Background(), config.RedisConfig{
		Host: "127.0.0.1", Port: 1, DialTimeout: 200 * time.Millisecond,
	})
	assert.Error(t, err)
}
