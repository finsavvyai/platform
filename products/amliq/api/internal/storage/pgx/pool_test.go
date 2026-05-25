package pgx

import (
	"context"
	"testing"
)

func TestNewPool(t *testing.T) {
	tests := []struct {
		name        string
		databaseURL string
		wantErr     bool
	}{
		{
			name:        "invalid url",
			databaseURL: "invalid://not-a-url",
			wantErr:     true,
		},
		{
			name:        "empty url",
			databaseURL: "",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pool, err := NewPool(tt.databaseURL)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewPool() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil && pool != nil {
				pool.Close()
			}
		})
	}
}

func TestPool_Ping(t *testing.T) {
	tests := []struct {
		name    string
		ctx     context.Context
		wantErr bool
	}{
		{
			name:    "context background",
			ctx:     context.Background(),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					if !tt.wantErr {
						t.Errorf("Ping() panicked: %v", r)
					}
				}
			}()
			pool := &Pool{db: nil}
			err := pool.Ping(tt.ctx)
			if (err != nil) != tt.wantErr {
				t.Errorf("Ping() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
