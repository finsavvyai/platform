package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/universal-dependency-platform/udp-go-plugin/internal/manager"
	"github.com/universal-dependency-platform/udp-go-plugin/internal/config"
	"github.com/universal-dependency-platform/udp-go-plugin/internal/logger"
)

var (
	verbose    bool
	configFile string
	outputDir  string
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "udp",
	Short: "Universal Dependency Platform Go Plugin",
	Long: `Universal Dependency Platform Go Plugin provides cross-language
dependency management for Go projects.

Features:
- Cross-language dependency resolution via udp.yml
- Bridge code generation for multi-ecosystem integration
- Integration with Go modules
- CGO bindings generation
- Security scanning and license compliance`,
}

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "Analyze udp.yml and validate cross-language dependencies",
	RunE: func(cmd *cobra.Command, args []string) error {
		log := logger.New(verbose)
		mgr := manager.New(log)

		if err := mgr.Analyze(configFile); err != nil {
			log.Error("Analysis failed: %v", err)
			return err
		}

		log.Success("Analysis completed successfully")
		return nil
	},
}

var downloadCmd = &cobra.Command{
	Use:   "download",
	Short: "Download cross-ecosystem dependencies from UDP service",
	RunE: func(cmd *cobra.Command, args []string) error {
		log := logger.New(verbose)
		mgr := manager.New(log)

		if err := mgr.Download(configFile, outputDir); err != nil {
			log.Error("Download failed: %v", err)
			return err
		}

		log.Success("Dependencies downloaded successfully")
		return nil
	},
}

var generateBridgesCmd = &cobra.Command{
	Use:   "generate-bridges",
	Short: "Generate bridge code for cross-language interoperability",
	RunE: func(cmd *cobra.Command, args []string) error {
		log := logger.New(verbose)
		mgr := manager.New(log)

		if err := mgr.GenerateBridges(configFile, outputDir); err != nil {
			log.Error("Bridge generation failed: %v", err)
			return err
		}

		log.Success("Bridge code generated successfully")
		return nil
	},
}

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Complete UDP setup: analyze, download, and generate bridges",
	RunE: func(cmd *cobra.Command, args []string) error {
		log := logger.New(verbose)
		mgr := manager.New(log)

		if err := mgr.Setup(configFile); err != nil {
			log.Error("Setup failed: %v", err)
			return err
		}

		log.Success("UDP setup completed successfully")
		return nil
	},
}

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install UDP integration in current Go project",
	RunE: func(cmd *cobra.Command, args []string) error {
		log := logger.New(verbose)
		mgr := manager.New(log)

		if err := mgr.Install(); err != nil {
			log.Error("Installation failed: %v", err)
			return err
		}

		log.Success("UDP integration installed successfully")
		return nil
	},
}

func init() {
	// Global flags
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "enable verbose logging")
	rootCmd.PersistentFlags().StringVarP(&configFile, "config", "c", "udp.yml", "UDP configuration file")

	// Command-specific flags
	downloadCmd.Flags().StringVarP(&outputDir, "output", "o", "vendor/udp", "output directory for dependencies")
	generateBridgesCmd.Flags().StringVarP(&outputDir, "output", "o", "internal/udp_bridges", "output directory for bridge code")

	// Add commands
	rootCmd.AddCommand(analyzeCmd)
	rootCmd.AddCommand(downloadCmd)
	rootCmd.AddCommand(generateBridgesCmd)
	rootCmd.AddCommand(setupCmd)
	rootCmd.AddCommand(installCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}