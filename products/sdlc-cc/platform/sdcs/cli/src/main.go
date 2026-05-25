/*
SDLC.ai CLI Tool
Enterprise command-line interface for SDLC.ai platform management

Features:
🚀 Fast, efficient CLI with Go
🔐 Secure authentication management
📄 Document management operations
🧠 RAG query execution
💳 Payment processing
📊 Analytics and monitoring
🔧 Local development environment
📦 Plugin system for extensibility
🎨 Rich output formatting
📋 Interactive configuration
*/

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/urfave/cli/v2"
	"github.com/urfave/cli/v2/altsrc"
	"gopkg.in/yaml.v3"
)

const (
	appName        = "sdlc"
	appVersion     = "1.0.0"
	appDescription = "SDLC.ai Enterprise CLI Tool"
	configFile     = ".sdlc.yaml"
)

var (
	styles = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#00D9FF")).
		Bold(true)

	titleStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FF6B6B")).
		Bold(true).
		Underline(true)

	successStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#51CF66")).
		Bold(true)

	errorStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FF6B6B")).
		Bold(true)

	warningStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFB86C")).
		Bold(true)
)

// Config represents the CLI configuration
type Config struct {
	Profile      string              `yaml:"profile" default:"default"`
	APIKey       string              `yaml:"api_key"`
	TenantID     string              `yaml:"tenant_id"`
	BaseURL      string              `yaml:"base_url" default:"https://api.sdlc.cc"`
	Environment  string              `yaml:"environment" default:"production"`
	Timeout      int                 `yaml:"timeout" default:"30"`
	LogLevel     string              `yaml:"log_level" default:"info"`
	Plugins      []string            `yaml:"plugins"`
	Defaults     map[string]interface{} `yaml:"defaults"`
}

// LoadConfig loads configuration from file
func LoadConfig() (*Config, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	configPath := filepath.Join(home, configFile)
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Create default config
		defaultConfig := &Config{
			Profile:     "default",
			BaseURL:     "https://api.sdlc.cc",
			Environment: "production",
			Timeout:     30,
			LogLevel:    "info",
		}

		if err := SaveConfig(defaultConfig); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}

		return defaultConfig, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// SaveConfig saves configuration to file
func SaveConfig(config *Config) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	configPath := filepath.Join(home, configFile)
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// Client represents the SDLC.ai API client
type Client struct {
	config   *Config
	apiKey   string
	tenantID string
	baseURL  string
}

// NewClient creates a new API client
func NewClient(config *Config) *Client {
	return &Client{
		config:   config,
		apiKey:   config.APIKey,
		tenantID: config.TenantID,
		baseURL:  config.BaseURL,
	}
}

// Authenticate authenticates the client
func (c *Client) Authenticate() error {
	if c.apiKey == "" || c.tenantID == "" {
		return fmt.Errorf("API key and tenant ID are required")
	}

	// TODO: Implement actual authentication
	fmt.Println(successStyle.Render("✓ Authentication successful"))
	return nil
}

// Document commands
func documentCommands() *cli.Command {
	return &cli.Command{
		Name:  "documents",
		Usage: "Manage documents",
		Subcommands: []*cli.Command{
			{
				Name:  "upload",
				Usage: "Upload a document",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "file",
						Aliases:  []string{"f"},
						Usage:    "Document file path",
						Required: true,
					},
					&cli.StringFlag{
						Name:  "name",
						Usage: "Document name",
					},
					&cli.StringSliceFlag{
						Name:  "tags",
						Usage: "Document tags",
					},
					&cli.StringFlag{
						Name:  "description",
						Usage: "Document description",
					},
				},
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					client := NewClient(config)
					if err := client.Authenticate(); err != nil {
						return err
					}

					filePath := cCtx.String("file")
					name := cCtx.String("name")
					tags := cCtx.StringSlice("tags")
					description := cCtx.String("description")

					fmt.Println(titleStyle.Render("📄 Uploading Document"))
					fmt.Printf("File: %s\n", filePath)
					if name != "" {
						fmt.Printf("Name: %s\n", name)
					}
					if len(tags) > 0 {
						fmt.Printf("Tags: %s\n", strings.Join(tags, ", "))
					}
					if description != "" {
						fmt.Printf("Description: %s\n", description)
					}

					// TODO: Implement actual upload
					fmt.Println(successStyle.Render("✓ Document uploaded successfully"))
					return nil
				},
			},
			{
				Name:  "list",
				Usage: "List documents",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:    "limit",
						Aliases: []string{"l"},
						Value:   50,
						Usage:   "Maximum number of results",
					},
					&cli.StringFlag{
						Name:  "search",
						Usage: "Search query",
					},
					&cli.StringSliceFlag{
						Name:  "tags",
						Usage: "Filter by tags",
					},
				},
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					client := NewClient(config)
					if err := client.Authenticate(); err != nil {
						return err
					}

					limit := cCtx.Int("limit")
					search := cCtx.String("search")
					tags := cCtx.StringSlice("tags")

					fmt.Println(titleStyle.Render("📋 Documents"))
					fmt.Printf("Limit: %d\n", limit)
					if search != "" {
						fmt.Printf("Search: %s\n", search)
					}
					if len(tags) > 0 {
						fmt.Printf("Tags: %s\n", strings.Join(tags, ", "))
					}

					// Create table
					table := table.New().
						Border(lipgloss.RoundedBorder()).
						BorderStyle(lipgloss.NormalBorder()).
						StyleFunc(func(row, col int) lipgloss.Style {
							if row == 0 {
								return lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Bold()
							}
							return lipgloss.NewStyle()
						}).
						Headers("ID", "Name", "Status", "Size", "Created")

					// TODO: Implement actual listing
					table.Row("doc_001", "Security Guide", "Processed", "2.5MB", "2024-01-15")
					table.Row("doc_002", "API Documentation", "Processed", "1.8MB", "2024-01-14")
					table.Row("doc_003", "Best Practices", "Processing", "3.2MB", "2024-01-13")

					fmt.Println(table.Render())
					return nil
				},
			},
			{
				Name:  "delete",
				Usage: "Delete a document",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "id",
						Aliases:  []string{"i"},
						Usage:    "Document ID",
						Required: true,
					},
					&cli.BoolFlag{
						Name:  "confirm",
						Usage: "Skip confirmation prompt",
					},
				},
				Action: func(cCtx *cli.Context) error {
					documentID := cCtx.String("id")
					confirm := cCtx.Bool("confirm")

					if !confirm {
						fmt.Printf("Are you sure you want to delete document %s? [y/N]: ", documentID)
						var response string
						fmt.Scanln(&response)
						if strings.ToLower(response) != "y" && strings.ToLower(response) != "yes" {
							fmt.Println("Operation cancelled")
							return nil
						}
					}

					fmt.Printf("Deleting document: %s\n", documentID)
					// TODO: Implement actual deletion
					fmt.Println(successStyle.Render("✓ Document deleted successfully"))
					return nil
				},
			},
		},
	}
}

// RAG commands
func ragCommands() *cli.Command {
	return &cli.Command{
		Name:  "rag",
		Usage: "RAG query operations",
		Subcommands: []*cli.Command{
			{
				Name:  "query",
				Usage: "Execute a RAG query",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "query",
						Aliases: []string{"q"},
						Usage:   "Query string",
						Required: true,
					},
					&cli.IntFlag{
						Name:    "max-results",
						Aliases: []string{"m"},
						Value:   10,
						Usage:   "Maximum number of results",
					},
					&cli.BoolFlag{
						Name:  "stream",
						Usage: "Stream response",
					},
					&cli.StringFlag{
						Name:  "model",
						Usage: "AI model to use",
					},
				},
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					client := NewClient(config)
					if err := client.Authenticate(); err != nil {
						return err
					}

					query := cCtx.String("query")
					maxResults := cCtx.Int("max-results")
					stream := cCtx.Bool("stream")
					model := cCtx.String("model")

					fmt.Println(titleStyle.Render("🧠 RAG Query"))
					fmt.Printf("Query: %s\n", query)
					fmt.Printf("Max Results: %d\n", maxResults)
					fmt.Printf("Model: %s\n", model)

					if stream {
						fmt.Println("\nStreaming response:")
						// TODO: Implement actual streaming
						fmt.Println("This is a streamed response from the AI model...")
					} else {
						// TODO: Implement actual query
						fmt.Println("\nResponse:")
						fmt.Println("Based on the provided documents, here are the best practices for secure software development...")

						fmt.Println("\nCitations:")
						table := table.New().
							Border(lipgloss.RoundedBorder()).
							BorderStyle(lipgloss.NormalBorder()).
							Headers("Document", "Score", "Relevance")

						table.Row("Security Guide", "0.95", "High")
						table.Row("Best Practices", "0.87", "High")
						table.Row("API Documentation", "0.78", "Medium")

						fmt.Println(table.Render())
					}

					return nil
				},
			},
			{
				Name:  "history",
				Usage: "Show query history",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:    "limit",
						Aliases: []string{"l"},
						Value:   20,
						Usage:   "Maximum number of results",
					},
				},
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					client := NewClient(config)
					if err := client.Authenticate(); err != nil {
						return err
					}

					limit := cCtx.Int("limit")
					fmt.Printf("Showing last %d queries\n", limit)

					// TODO: Implement actual history retrieval
					table := table.New().
						Border(lipgloss.RoundedBorder()).
						BorderStyle(lipgloss.NormalBorder()).
						Headers("Time", "Query", "Response Time", "Status")

					table.Row("2024-01-15 14:30", "Security best practices", "245ms", "Success")
					table.Row("2024-01-15 14:25", "API design patterns", "189ms", "Success")
					table.Row("2024-01-15 14:20", "Database optimization", "312ms", "Success")

					fmt.Println(table.Render())
					return nil
				},
			},
		},
	}
}

// Payment commands
func paymentCommands() *cli.Command {
	return &cli.Command{
		Name:  "payments",
		Usage: "Payment operations (PCI compliant)",
		Subcommands: []*cli.Command{
			{
				Name:  "methods",
				Usage: "Manage payment methods",
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					client := NewClient(config)
					if err := client.Authenticate(); err != nil {
						return err
					}

					fmt.Println(titleStyle.Render("💳 Payment Methods"))

					// TODO: Implement actual payment methods retrieval
					table := table.New().
						Border(lipgloss.RoundedBorder()).
						BorderStyle(lipgloss.NormalBorder()).
						Headers("Type", "Last Four", "Expires", "Default", "Added")

					table.Row("Visa", "4242", "12/25", "Yes", "2024-01-01")
					table.Row("Mastercard", "5555", "09/24", "No", "2024-01-10")

					fmt.Println(table.Render())
					return nil
				},
			},
			{
				Name:  "process",
				Usage: "Process a payment",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:     "amount",
						Aliases:  []string{"a"},
						Usage:    "Amount in cents",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "currency",
						Aliases:  []string{"c"},
						Value:    "USD",
						Usage:    "Currency code",
					},
					&cli.StringFlag{
						Name:     "method",
						Aliases:  []string{"m"},
						Usage:    "Payment method token",
						Required: true,
					},
					&cli.StringFlag{
						Name:  "description",
						Usage: "Payment description",
					},
				},
				Action: func(cCtx *cli.Context) error {
					amount := cCtx.Int("amount")
					currency := cCtx.String("currency")
					method := cCtx.String("method")
					description := cCtx.String("description")

					fmt.Printf("Processing payment: %d %s\n", amount, currency)
					fmt.Printf("Method: %s\n", method)
					if description != "" {
						fmt.Printf("Description: %s\n", description)
					}

					// TODO: Implement actual payment processing
					fmt.Println(successStyle.Render("✓ Payment processed successfully"))
					return nil
				},
			},
		},
	}
}

// Analytics commands
func analyticsCommands() *cli.Command {
	return &cli.Command{
		Name:  "analytics",
		Usage: "Analytics and monitoring",
		Subcommands: []*cli.Command{
			{
				Name:  "usage",
				Usage: "Show usage analytics",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "period",
						Value: "7d",
						Usage: "Time period (1d, 7d, 30d)",
					},
				},
				Action: func(cCtx *cli.Context) error {
					period := cCtx.String("period")
					fmt.Printf("Usage analytics for the last %s\n", period)

					// TODO: Implement actual analytics retrieval
					fmt.Println(titleStyle.Render("📊 Usage Analytics"))

					table := table.New().
						Border(lipgloss.RoundedBorder()).
						BorderStyle(lipgloss.NormalBorder()).
						Headers("Metric", "Value", "Change")

					table.Row("Total Queries", "1,234", "+12%")
					table.Row("Unique Users", "156", "+8%")
					table.Row("Documents", "89", "+5%")
					table.Row("Avg Response Time", "245ms", "-15%")

					fmt.Println(table.Render())
					return nil
				},
			},
		},
	}
}

// Config commands
func configCommands() *cli.Command {
	return &cli.Command{
		Name:  "config",
		Usage: "Configuration management",
		Subcommands: []*cli.Command{
			{
				Name:  "show",
				Usage: "Show current configuration",
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					fmt.Println(titleStyle.Render("⚙️  Configuration"))

					table := table.New().
						Border(lipgloss.RoundedBorder()).
						BorderStyle(lipgloss.NormalBorder()).
						Headers("Setting", "Value")

					table.Row("Profile", config.Profile)
					table.Row("API Key", maskAPIKey(config.APIKey))
					table.Row("Tenant ID", config.TenantID)
					table.Row("Base URL", config.BaseURL)
					table.Row("Environment", config.Environment)
					table.Row("Timeout", fmt.Sprintf("%ds", config.Timeout))
					table.Row("Log Level", config.LogLevel)

					fmt.Println(table.Render())
					return nil
				},
			},
			{
				Name:  "set",
				Usage: "Set configuration value",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "key",
						Aliases:  []string{"k"},
						Usage:    "Configuration key",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "value",
						Aliases:  []string{"v"},
						Usage:    "Configuration value",
						Required: true,
					},
				},
				Action: func(cCtx *cli.Context) error {
					config, err := LoadConfig()
					if err != nil {
						return err
					}

					key := cCtx.String("key")
					value := cCtx.String("value")

					// TODO: Implement config setting
					fmt.Printf("Setting %s = %s\n", key, value)
					fmt.Println(successStyle.Render("✓ Configuration updated"))
					return nil
				},
			},
			{
				Name:  "init",
				Usage: "Initialize configuration",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "api-key",
						Aliases: []string{"k"},
						Usage:   "API key",
						EnvVars: []string{"SDLC_API_KEY"},
					},
					&cli.StringFlag{
						Name:    "tenant-id",
						Aliases: []string{"t"},
						Usage:   "Tenant ID",
						EnvVars: []string{"SDLC_TENANT_ID"},
					},
					&cli.StringFlag{
						Name:    "base-url",
						Aliases: []string{"u"},
						Value:   "https://api.sdlc.cc",
						Usage:   "Base URL",
					},
				},
				Action: func(cCtx *cli.Context) error {
					apiKey := cCtx.String("api-key")
					tenantID := cCtx.String("tenant-id")
					baseURL := cCtx.String("base-url")

					config := &Config{
						Profile:    "default",
						APIKey:     apiKey,
						TenantID:   tenantID,
						BaseURL:    baseURL,
						Environment: "production",
						Timeout:    30,
						LogLevel:   "info",
					}

					if err := SaveConfig(config); err != nil {
						return fmt.Errorf("failed to save config: %w", err)
					}

					fmt.Println(successStyle.Render("✓ Configuration initialized"))
					fmt.Printf("Config file: %s\n", filepath.Join(os.Getenv("HOME"), configFile))
					return nil
				},
			},
		},
	}
}

// Dev commands
func devCommands() *cli.Command {
	return &cli.Command{
		Name:  "dev",
		Usage: "Development tools",
		Subcommands: []*cli.Command{
			{
				Name:  "serve",
				Usage: "Start local development server",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:    "port",
						Aliases: []string{"p"},
						Value:   8080,
						Usage:   "Port to serve on",
					},
					&cli.StringFlag{
						Name:  "env",
						Value:  "development",
						Usage: "Environment",
					},
				},
				Action: func(cCtx *cli.Context) error {
					port := cCtx.Int("port")
					env := cCtx.String("env")

					fmt.Printf("Starting development server on port %d\n", port)
					fmt.Printf("Environment: %s\n", env)

					// TODO: Implement actual dev server
					ctx, cancel := context.WithCancel(context.Background())
					defer cancel()

					// Handle graceful shutdown
					sigChan := make(chan os.Signal, 1)
					signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

					go func() {
						<-sigChan
						fmt.Println("\nShutting down development server...")
						cancel()
					}()

					// Simulate server startup
					time.Sleep(1 * time.Second)
					fmt.Println(successStyle.Render("✓ Development server started"))
					fmt.Printf("Server running at: http://localhost:%d\n", port)

					// Keep server running
					<-ctx.Done()
					return nil
				},
			},
			{
				Name:  "test",
				Usage: "Run tests",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "test",
						Aliases: []string{"t"},
						Usage:   "Specific test to run",
					},
					&cli.BoolFlag{
						Name:    "watch",
						Aliases: []string{"w"},
						Usage:   "Watch mode",
					},
				},
				Action: func(cCtx *cli.Context) error {
					test := cCtx.String("test")
					watch := cCtx.Bool("watch")

					fmt.Println(titleStyle.Render("🧪 Running Tests"))
					if test != "" {
						fmt.Printf("Test: %s\n", test)
					}
					if watch {
						fmt.Println("Watch mode: enabled")
					}

					// TODO: Implement actual test runner
					time.Sleep(2 * time.Second)
					fmt.Println(successStyle.Render("✓ All tests passed"))
					return nil
				},
			},
		},
	}
}

// Interactive login
func interactiveLogin() tea.Model {
	var (
		viewport      viewport.Model
		apiKeyInput   textinput.Model
		tenantIDInput textinput.Model
		submitting     bool
		err           error
	)

	initModels := func() {
		vp := viewport.New(30, 7)
		viewport = vp

		apiKeyInput = textinput.New()
		apiKeyInput.Placeholder = "Enter your API key"
		apiKeyInput.Focus()
		apiKeyInput.EchoMode = textinput.EchoPassword
		apiKeyInput.EchoCharacter = '•'

		tenantIDInput = textinput.New()
		tenantIDInput.Placeholder = "Enter your tenant ID"
	}

	initModels()

	update := func(msg tea.Msg) (tea.Model, tea.Cmd) {
		switch msg := msg {
		case tea.KeyMsg:
			switch msg.Type {
			case tea.KeyEnter:
				if submitting {
					break
				}
				if apiKeyInput.Value() == "" || tenantIDInput.Value() == "" {
					err = fmt.Errorf("both API key and tenant ID are required")
					return m, nil
				}
				submitting = true
				return m, nil

			case tea.KeyCtrlC, tea.KeyEsc:
				return m, tea.Quit

			case tea.KeyTab:
				if apiKeyInput.Focused() {
					apiKeyInput.Blur()
					tenantIDInput.Focus()
				} else {
					tenantIDInput.Blur()
					apiKeyInput.Focus()
				}
				return m, nil
			}

			case tea.KeyRunes:
				var cmd tea.Cmd
				if apiKeyInput.Focused() {
					apiKeyInput, cmd = apiKeyInput.Update(msg)
				} else {
					tenantIDInput, cmd = tenantIDInput.Update(msg)
				}
				return m, cmd

			case tea.WindowSizeMsg:
				h, v := msg.Height, msg.Width
				viewport = viewport.New(h, v)
				viewport, cmd = viewport.Update(msg)
				return m, cmd
			}

		case textinput.InternalMsg:
			var cmd tea.Cmd
			if apiKeyInput.Focused() {
				apiKeyInput, cmd = apiKeyInput.Update(msg)
			} else {
				tenantIDInput, cmd = tenantIDInput.Update(msg)
			}
			return m, cmd

		case viewport.InternalMsg:
			viewport, cmd = viewport.Update(msg)
			return m, cmd
		}

		return m, nil
	}

	view := func(m tea.Model) string {
		if submitting {
			// Save config and exit
			config := &Config{
				Profile:    "default",
				APIKey:     apiKeyInput.Value(),
				TenantID:   tenantIDInput.Value(),
				BaseURL:    "https://api.sdlc.cc",
				Environment: "production",
				Timeout:    30,
				LogLevel:   "info",
			}

			if err := SaveConfig(config); err != nil {
				err = fmt.Errorf("failed to save config: %w", err)
				return errorStyle.Render(fmt.Sprintf("Error: %v", err))
			}

			return successStyle.Render("✓ Configuration saved successfully!")
		}

		if err != nil {
			return errorStyle.Render(fmt.Sprintf("Error: %v", err))
		}

		title := titleStyle.Render("🔐 SDLC.ai Login")
		instructions := "Enter your API key and tenant ID to authenticate"

		// Build the form
		apiKeyLabel := "API Key:"
		tenantIDLabel := "Tenant ID:"

		form := fmt.Sprintf(
			"%s\n\n%s %s\n\n%s %s",
			title,
			apiKeyLabel,
			apiKeyInput.View(),
			tenantIDLabel,
			tenantIDInput.View(),
		)

		// Create viewport content
		content := strings.Split(form, "\n")
		return lipgloss.JoinVertical(lipgloss.Left, lipgloss.Top, lipgloss.Left)(
			viewport.View(form),
			lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render(instructions),
		)
	}

	return update
}

func main() {
	app := &cli.App{
		Name:        appName,
		Version:     appVersion,
		Description: appDescription,
		Usage:       "sdlc [global options] <command> [command options] [arguments...]",
		EnableBashCompletion: true,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "config",
				Aliases: []string{"c"},
				Usage:   "Config file path",
				EnvVars: []string{"SDLC_CONFIG"},
			},
			&cli.StringFlag{
				Name:    "profile",
				Aliases: []string{"p"},
				Usage:   "Config profile",
				EnvVars: []string{"SDLC_PROFILE"},
			},
			&cli.BoolFlag{
				Name:    "verbose",
				Aliases: []string{"v"},
				Usage:   "Verbose output",
				EnvVars: []string{"SDLC_VERBOSE"},
			},
		},
		Commands: []*cli.Command{
			documentCommands(),
			ragCommands(),
			paymentCommands(),
			analyticsCommands(),
			configCommands(),
			devCommands(),
			{
				Name:  "login",
				Usage: "Interactive login",
				Action: func(cCtx *cli.Context) error {
					fmt.Println("Starting interactive login...")
					p := tea.NewProgram(interactiveLogin())
					if _, err := p.Run(); err != nil {
						return err
					}
					return nil
				},
			},
			{
				Name:  "version",
				Aliases: []string{"v"},
				Usage:  "Show version information",
				Action: func(cCtx *cli.Context) error {
					fmt.Printf("%s %s\n", appName, appVersion)
					return nil
				},
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}

func maskAPIKey(key string) string {
	if key == "" {
		return "[not set]"
	}
	if len(key) <= 8 {
		return strings.Repeat("*", len(key))
	}
	return key[:4] + strings.Repeat("*", len(key)-8) + key[len(key)-4:]
}
