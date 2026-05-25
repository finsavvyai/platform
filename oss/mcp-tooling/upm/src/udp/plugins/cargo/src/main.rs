use anyhow::Result;
use clap::{Parser, Subcommand};
use log::LevelFilter;
use std::path::PathBuf;
use udp_cargo_plugin::{UdpManager, UdpConfig};

#[derive(Parser)]
#[command(
    name = "cargo-udp",
    about = "Universal Dependency Platform Cargo Plugin",
    long_about = "Cargo plugin for Universal Dependency Platform (UDP) integration.
Enables cross-language dependency management for Rust projects."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose logging
    #[arg(short, long, global = true)]
    verbose: bool,

    /// UDP configuration file path
    #[arg(short, long, global = true, default_value = "udp.yml")]
    config: PathBuf,
}

#[derive(Subcommand)]
enum Commands {
    /// Analyze udp.yml and validate cross-language dependencies
    Analyze {
        /// UDP configuration file path
        #[arg(short, long, default_value = "udp.yml")]
        config: PathBuf,
    },
    /// Download cross-ecosystem dependencies from UDP service
    Download {
        /// UDP configuration file path
        #[arg(short, long, default_value = "udp.yml")]
        config: PathBuf,
        /// Output directory for dependencies
        #[arg(short, long, default_value = "target/udp")]
        output: PathBuf,
    },
    /// Generate bridge code for cross-language interoperability
    GenerateBridges {
        /// UDP configuration file path
        #[arg(short, long, default_value = "udp.yml")]
        config: PathBuf,
        /// Output directory for bridge code
        #[arg(short, long, default_value = "src/udp_bridges")]
        output: PathBuf,
    },
    /// Complete UDP setup: analyze, download, and generate bridges
    Setup {
        /// UDP configuration file path
        #[arg(short, long, default_value = "udp.yml")]
        config: PathBuf,
    },
    /// Install UDP integration in current Rust project
    Install,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logger
    let log_level = if cli.verbose {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    };

    env_logger::Builder::from_default_env()
        .filter_level(log_level)
        .init();

    let manager = UdpManager::new();

    match cli.command {
        Commands::Analyze { config } => {
            manager.analyze(&config).await?;
            println!("✅ Analysis completed successfully");
        }
        Commands::Download { config, output } => {
            manager.download(&config, &output).await?;
            println!("✅ Dependencies downloaded successfully");
        }
        Commands::GenerateBridges { config, output } => {
            manager.generate_bridges(&config, &output).await?;
            println!("✅ Bridge code generated successfully");
        }
        Commands::Setup { config } => {
            manager.setup(&config).await?;
            println!("✅ UDP setup completed successfully");
        }
        Commands::Install => {
            manager.install().await?;
            println!("✅ UDP integration installed successfully");
        }
    }

    Ok(())
}

/// This is called when running as a Cargo subcommand
/// cargo-udp <args> gets translated to cargo udp <args>
#[allow(dead_code)]
fn main_cargo_subcommand() -> Result<()> {
    // Remove the first argument which is the binary name
    let args: Vec<String> = std::env::args().skip(1).collect();

    // If called as cargo-udp, the first arg might be "udp", so skip it
    let args = if args.first().map(|s| s.as_str()) == Some("udp") {
        args.into_iter().skip(1).collect()
    } else {
        args
    };

    // Parse arguments manually since we've modified them
    let cli = Cli::try_parse_from(std::iter::once("cargo-udp".to_string()).chain(args))?;

    // Initialize runtime and run
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        main().await
    })
}