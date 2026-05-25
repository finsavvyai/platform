package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Config struct {
	Server   ServerConfig    `json:"server"`
	Cluster  ClusterConfig   `json:"cluster"`
	UI       UIConfig        `json:"ui"`
	Profiles []ProfileConfig `json:"profiles"`
	Logging  LoggingConfig   `json:"logging"`
}

type ServerConfig struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

type ClusterConfig struct {
	MasterHost string `json:"master_host"`
	MasterPort int    `json:"master_port"`
	APIKey     string `json:"api_key"`
	Timeout    int    `json:"timeout"` // in seconds
}

type UIConfig struct {
	Theme             string `json:"theme"`
	Language          string `json:"language"`
	AutoStart         bool   `json:"auto_start"`
	MinimizeToTray    bool   `json:"minimize_to_tray"`
	ShowNotifications bool   `json:"show_notifications"`
	RefreshInterval   int    `json:"refresh_interval"` // in seconds
}

type ProfileConfig struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Cluster     ClusterConfig `json:"cluster"`
	UI          UIConfig      `json:"ui"`
}

type LoggingConfig struct {
	Level  string `json:"level"`
	File   string `json:"file"`
	Format string `json:"format"`
}

func Default() *Config {
	return &Config{
		Server: ServerConfig{
			Host: "localhost",
			Port: 8080,
		},
		Cluster: ClusterConfig{
			MasterHost: "localhost",
			MasterPort: 8000,
			APIKey:     "",
			Timeout:    30,
		},
		UI: UIConfig{
			Theme:             "dark",
			Language:          "en",
			AutoStart:         false,
			MinimizeToTray:    true,
			ShowNotifications: true,
			RefreshInterval:   5,
		},
		Profiles: []ProfileConfig{
			{
				Name:        "default",
				Description: "Default FinSavvyAI cluster configuration",
				Cluster: ClusterConfig{
					MasterHost: "localhost",
					MasterPort: 8000,
					APIKey:     "",
					Timeout:    30,
				},
				UI: UIConfig{
					Theme:             "dark",
					Language:          "en",
					AutoStart:         false,
					MinimizeToTray:    true,
					ShowNotifications: true,
					RefreshInterval:   5,
				},
			},
		},
		Logging: LoggingConfig{
			Level:  "info",
			File:   "logs/desktop-app.log",
			Format: "json",
		},
	}
}

// getConfigPathFunc allows tests to override the config file path.
var getConfigPathFunc = getConfigPath

func Load() (*Config, error) {
	configPath := getConfigPathFunc()

	// Create config directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Create default config
		config := Default()
		if err := Save(*config); err != nil {
			return nil, fmt.Errorf("failed to save default config: %w", err)
		}
		return config, nil
	}

	// Load existing config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

func Save(config Config) error {
	configPath := getConfigPathFunc()

	// Create config directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

func getConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "finsavvyai-config.json"
	}

	return filepath.Join(home, ".finsavvyai", "desktop-config.json")
}
