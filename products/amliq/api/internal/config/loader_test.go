package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		envKey  string
		envVal  string
		checkFn func(Config) bool
	}{
		{
			name:   "default",
			envKey: "",
			envVal: "",
			checkFn: func(c Config) bool {
				return c.Server.Port == 8080
			},
		},
		{
			name:   "port_override",
			envKey: "PORT",
			envVal: "9000",
			checkFn: func(c Config) bool {
				return c.Server.Port == 9000
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envKey != "" {
				os.Setenv(tt.envKey, tt.envVal)
				defer os.Unsetenv(tt.envKey)
			}
			cfg := Load()
			if !tt.checkFn(cfg) {
				t.Errorf("Load() config check failed")
			}
		})
	}
}
