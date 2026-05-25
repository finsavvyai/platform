/*!
# UDP Cargo Plugin

Universal Dependency Platform integration for Rust projects using Cargo.

This crate provides cross-language dependency management capabilities for Rust projects,
allowing seamless integration with dependencies from other ecosystems like Java, JavaScript,
Python, and more.

## Features

- Cross-language dependency resolution via udp.yml
- Bridge code generation for multi-ecosystem integration
- Integration with Cargo build system
- FFI bindings generation
- Security scanning and license compliance

## Usage

### As a Cargo subcommand

```bash
cargo install udp-cargo-plugin
cargo udp setup
```

### As a library

```rust
use udp_cargo_plugin::{UdpManager, UdpConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let manager = UdpManager::new();
    manager.setup("udp.yml").await?;
    Ok(())
}
```
*/

pub mod config;
pub mod manager;
pub mod bridges;
pub mod generators;
pub mod integrators;
pub mod utils;

pub use config::{UdpConfig, BridgeConfig, SecurityConfig};
pub use manager::UdpManager;
pub use bridges::BridgeManager;

use anyhow::Result;
use std::path::Path;

/// Initialize UDP in a Rust project
pub async fn init_project<P: AsRef<Path>>(project_path: P) -> Result<()> {
    let manager = UdpManager::new();
    manager.init_project(project_path).await
}

/// Analyze UDP configuration
pub async fn analyze_config<P: AsRef<Path>>(config_path: P) -> Result<UdpConfig> {
    let manager = UdpManager::new();
    manager.load_config(config_path).await
}

/// Download dependencies for a project
pub async fn download_dependencies<P: AsRef<Path>>(
    config_path: P,
    output_dir: P,
) -> Result<()> {
    let manager = UdpManager::new();
    manager.download(&config_path, &output_dir).await
}

/// Generate bridge code for cross-language interop
pub async fn generate_bridges<P: AsRef<Path>>(
    config_path: P,
    output_dir: P,
) -> Result<()> {
    let manager = UdpManager::new();
    manager.generate_bridges(&config_path, &output_dir).await
}