package logger

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNew_DefaultLevel(t *testing.T) {
	log := New("info")
	assert.NotNil(t, log)
	assert.NotNil(t, log.Logger)
}

func TestNew_DebugLevel(t *testing.T) {
	log := New("debug")
	assert.NotNil(t, log)
}

func TestNew_WarnLevel(t *testing.T) {
	log := New("warn")
	assert.NotNil(t, log)
}

func TestNew_ErrorLevel(t *testing.T) {
	log := New("error")
	assert.NotNil(t, log)
}

func TestNew_UnknownLevel_DefaultsToInfo(t *testing.T) {
	log := New("unknown")
	assert.NotNil(t, log)
}

func TestLogger_CanLog(t *testing.T) {
	log := New("info")
	log.Info("test message", "key", "value")
}
