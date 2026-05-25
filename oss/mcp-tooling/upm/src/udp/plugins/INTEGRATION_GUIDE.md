# UDP Plugin Integration Guide

This guide provides detailed integration instructions for each UDP plugin across all supported package managers and build systems.

## Integration Matrix

| Ecosystem | Plugin | CLI Command | Build Integration | Config Files | Bridge Types |
|-----------|--------|-------------|-------------------|--------------|--------------|
| **Java** | Maven | `mvn udp:setup` | Maven lifecycle | `pom.xml` + `udp.yml` | JVM, JNI, Subprocess |
| **Java/Kotlin** | Gradle | `./gradlew udpSetup` | Gradle tasks | `build.gradle` + `udp.yml` | JVM, JNI, Subprocess |
| **JavaScript** | NPM | `udp setup` | npm scripts | `package.json` + `udp.yml` | V8, WASM, Subprocess |
| **Python** | Pip | `udp setup` | setuptools hooks | `setup.py` + `udp.yml` | CPython, FFI, Subprocess |
| **Rust** | Cargo | `cargo udp setup` | build.rs | `Cargo.toml` + `udp.yml` | FFI, WASM, Subprocess |
| **Go** | Go Modules | `udp setup` | go generate | `go.mod` + `udp.yml` | CGO, Subprocess |
| **PHP** | Composer | `udp setup` | composer scripts | `composer.json` + `udp.yml` | FFI, Subprocess |
| **.NET** | NuGet | `udp setup` | MSBuild targets | `.csproj` + `udp.yml` | P/Invoke, Subprocess |
| **Swift** | CocoaPods | `udp setup` | build phases | `Podfile` + `udp.yml` | Swift-C, Subprocess |
| **Dart** | Pub | `udp setup` | pub hooks | `pubspec.yaml` + `udp.yml` | FFI, Method Channels |
| **Ruby** | Bundler | `udp setup` | bundler hooks | `Gemfile` + `udp.yml` | FFI, C Extensions |
| **Elixir** | Hex | `mix udp.setup` | mix tasks | `mix.exs` + `udp.yml` | NIFs, Ports |

## Installation Instructions

### 1. Maven Plugin (Java)

```xml
<!-- Add to pom.xml -->
<plugin>
    <groupId>com.udp</groupId>
    <artifactId>udp-maven-plugin</artifactId>
    <version>1.0.0</version>
    <executions>
        <execution>
            <phase>generate-sources</phase>
            <goals>
                <goal>setup</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <configFile>udp.yml</configFile>
        <verbose>false</verbose>
    </configuration>
</plugin>
```

**Commands:**
```bash
mvn udp:analyze          # Analyze dependencies
mvn udp:download         # Download cross-ecosystem deps
mvn udp:generate-bridges # Generate bridge code
mvn udp:setup           # Complete setup
```

### 2. Gradle Plugin (Java/Kotlin/Android)

```gradle
// Add to build.gradle
plugins {
    id 'com.udp.gradle' version '1.0.0'
}

udp {
    configFile = 'udp.yml'
    verbose = false
    serviceUrl = 'https://api.universaldependency.com'
}
```

**Commands:**
```bash
./gradlew udpAnalyze
./gradlew udpDownload
./gradlew udpGenerateBridges
./gradlew udpSetup
```

### 3. NPM Plugin (JavaScript/TypeScript)

```bash
# Global installation
npm install -g @udp/npm-plugin

# Project installation
npm install --save-dev @udp/npm-plugin
```

```json
// Add to package.json
{
  "scripts": {
    "preinstall": "udp setup",
    "postinstall": "udp verify",
    "udp:analyze": "udp analyze",
    "udp:download": "udp download",
    "udp:bridges": "udp generate-bridges"
  },
  "udp": {
    "configFile": "udp.yml",
    "outputDir": "node_modules/.udp"
  }
}
```

### 4. Pip Plugin (Python)

```bash
# Installation
pip install udp-pip-plugin

# Project setup
udp install  # Adds UDP integration to project
```

```python
# Add to setup.py
setup(
    name="my-project",
    install_requires=[
        "udp-pip-plugin>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "my-app=my_app.main:main",
        ],
    },
    udp_config="udp.yml",
)
```

### 5. Cargo Plugin (Rust)

```bash
# Installation
cargo install udp-cargo-plugin
```

```toml
# Add to Cargo.toml
[build-dependencies]
udp-cargo-plugin = "1.0.0"

[[bin]]
name = "udp-setup"
path = "build.rs"
```

```rust
// build.rs
use udp_cargo_plugin::setup;

fn main() {
    setup("udp.yml").expect("UDP setup failed");
}
```

### 6. Go Modules Plugin (Go)

```bash
# Installation
go install github.com/universal-dependency-platform/udp-go-plugin/cmd/udp@latest
```

```go
// Add to main.go
//go:generate udp setup

package main

import (
    "github.com/universal-dependency-platform/udp-go-plugin/runtime"
)

func main() {
    udp := runtime.NewUdpRuntime()
    defer udp.Close()

    // Use cross-language dependencies
}
```

### 7. Composer Plugin (PHP)

```bash
# Installation
composer require udp/composer-plugin
```

```json
// Add to composer.json
{
  "require": {
    "udp/composer-plugin": "^1.0"
  },
  "scripts": {
    "pre-install-cmd": ["udp setup"],
    "post-install-cmd": ["udp verify"]
  },
  "config": {
    "udp-config-file": "udp.yml"
  }
}
```

### 8. NuGet Plugin (.NET/C#)

```xml
<!-- Add to .csproj -->
<PackageReference Include="Udp.NugetPlugin" Version="1.0.0" />

<Target Name="UdpSetup" BeforeTargets="BeforeBuild">
  <Exec Command="udp setup" />
</Target>
```

```bash
# Installation
dotnet add package Udp.NugetPlugin
```

### 9. CocoaPods Plugin (iOS/Swift)

```ruby
# Add to Podfile
plugin 'udp-cocoapods-plugin'

target 'MyApp' do
  pod 'UdpCocoaPodsPlugin', '~> 1.0'
end

# UDP setup hook
pre_install do |installer|
  system("udp setup")
end
```

### 10. Pub Plugin (Dart/Flutter)

```yaml
# Add to pubspec.yaml
dev_dependencies:
  udp_pub_plugin: ^1.0.0

flutter:
  plugin:
    platforms:
      android:
        package: com.myapp.udp
        pluginClass: UdpPlugin
```

```bash
# Installation
dart pub add udp_pub_plugin
flutter pub get
```

### 11. Bundler Plugin (Ruby)

```ruby
# Add to Gemfile
gem 'udp-bundler-plugin', '~> 1.0'

# Add hook
Bundler.with_clean_env do
  system("udp setup")
end
```

### 12. Hex Plugin (Elixir)

```elixir
# Add to mix.exs
defp deps do
  [
    {:udp_hex_plugin, "~> 1.0"}
  ]
end

# Add to aliases
defp aliases do
  [
    setup: ["deps.get", "udp.setup"],
    "udp.setup": ["cmd udp setup"]
  ]
end
```

## Build Lifecycle Integration

### Pre-Compilation Phase
All plugins integrate with their respective build systems' pre-compilation phase:

- **Maven**: `generate-sources` phase
- **Gradle**: `compileJava` task dependency
- **NPM**: `preinstall` script
- **Pip**: `egg_info` command
- **Cargo**: `build.rs` script
- **Go**: `go generate` directive
- **Composer**: `pre-install-cmd` script
- **NuGet**: `BeforeBuild` target
- **CocoaPods**: `pre_install` hook
- **Pub**: `before_compile` hook
- **Bundler**: `pre-install` hook
- **Hex**: `compile` task dependency

### Generated Artifacts

Each plugin generates ecosystem-appropriate artifacts:

| Plugin | Generated Files | Location | Purpose |
|--------|----------------|----------|---------|
| Maven | `*.java`, `*.jar` | `target/generated-sources/udp/` | Bridge classes |
| Gradle | `*.java`, `*.kt` | `build/generated/source/udp/` | Bridge classes |
| NPM | `*.js`, `*.ts` | `src/udp-bridges/` | Bridge modules |
| Pip | `*.py`, `*.so` | `src/udp_bridges/` | Bridge modules |
| Cargo | `*.rs`, `*.so` | `src/udp_bridges/` | FFI bindings |
| Go | `*.go`, `*.so` | `internal/udp_bridges/` | CGO bindings |
| Composer | `*.php` | `src/UdpBridges/` | Bridge classes |
| NuGet | `*.cs`, `*.dll` | `Generated/UdpBridges/` | P/Invoke wrappers |
| CocoaPods | `*.swift`, `*.m` | `Sources/UdpBridges/` | Objective-C bridges |
| Pub | `*.dart` | `lib/udp_bridges/` | FFI bindings |
| Bundler | `*.rb`, `*.so` | `lib/udp_bridges/` | C extensions |
| Hex | `*.ex`, `*.so` | `lib/udp_bridges/` | NIF modules |

## Cross-Language Bridge Examples

### Python → Java (Maven)

**Generated Java Bridge:**
```java
@UdpBridge("python")
public class PythonBridge {
    private final PythonInterpreter interpreter;

    public DataFrame callPandas(String csvData) {
        return interpreter.eval("import pandas as pd; pd.read_csv", csvData);
    }
}
```

**Usage:**
```java
PythonBridge python = UdpRuntime.getBridge(PythonBridge.class);
DataFrame result = python.callPandas("data.csv");
```

### Rust → JavaScript (NPM)

**Generated TypeScript Bridge:**
```typescript
import { invoke } from '@udp/rust-bridge';

export class RustBridge {
    async processImage(imageData: Uint8Array): Promise<Uint8Array> {
        return await invoke('process_image', { data: imageData });
    }
}
```

**Usage:**
```typescript
import { RustBridge } from './udp-bridges/rust-bridge';

const rust = new RustBridge();
const processed = await rust.processImage(imageData);
```

### JavaScript → Rust (Cargo)

**Generated Rust Bridge:**
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct JsBridge {
    runtime: JsValue,
}

#[wasm_bindgen]
impl JsBridge {
    pub fn call_lodash(&self, data: &str) -> String {
        // Call JavaScript lodash functions
        js_sys::eval(&format!("_.uniq({})", data))
            .unwrap()
            .as_string()
            .unwrap()
    }
}
```

## Environment Configuration

### Environment Variables

All plugins support these common environment variables:

```bash
# Required
export UDP_API_KEY="your-api-key"
export UDP_ORGANIZATION_ID="your-org-id"

# Optional
export UDP_SERVICE_URL="https://api.universaldependency.com"
export UDP_CACHE_DIR="$HOME/.udp/cache"
export UDP_VERBOSE="true"
export UDP_SKIP_SECURITY_SCAN="false"
```

### Configuration Files

#### Global Configuration (`~/.udp/config.yml`)
```yaml
service:
  url: "https://api.universaldependency.com"
  timeout: 30
  retry_count: 3

cache:
  directory: "~/.udp/cache"
  max_size: "1GB"
  ttl: "7d"

security:
  auto_scan: true
  fail_on_critical: true
  allowed_licenses: ["MIT", "Apache-2.0"]

logging:
  level: "info"
  file: "~/.udp/logs/udp.log"
```

#### Project Configuration (`udp.yml`)
See examples in `/examples/` directory for ecosystem-specific configurations.

## Troubleshooting

### Common Issues

1. **Plugin Not Found**
   ```bash
   # Check plugin installation
   <package-manager> list | grep udp

   # Reinstall plugin
   <package-manager> install udp-<ecosystem>-plugin
   ```

2. **Bridge Generation Fails**
   ```bash
   # Enable verbose logging
   UDP_VERBOSE=true udp generate-bridges

   # Check bridge compatibility
   udp analyze --check-bridges
   ```

3. **Dependency Download Errors**
   ```bash
   # Check network connectivity
   curl -I $UDP_SERVICE_URL/health

   # Verify credentials
   udp auth status
   ```

4. **Build Integration Issues**
   ```bash
   # Check build system integration
   udp doctor

   # Reset UDP state
   udp clean && udp setup
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Environment variable
export UDP_DEBUG=true

# Command line flag
udp setup --debug

# Configuration file
debug: true
```

## Performance Optimization

### Caching Strategies

1. **Local Cache**: Dependencies cached locally for fast rebuilds
2. **Shared Cache**: Team-wide cache for consistent builds
3. **CI Cache**: Optimized for continuous integration
4. **CDN Cache**: Global distribution for faster downloads

### Parallel Processing

```yaml
# udp.yml
performance:
  parallel_downloads: 4
  concurrent_bridges: 2
  cache_preload: true
  lazy_loading: false
```

### Build Optimization

1. **Incremental Builds**: Only rebuild changed dependencies
2. **Smart Invalidation**: Detect when bridges need regeneration
3. **Hot Reload**: Live reload during development
4. **Dependency Pruning**: Remove unused cross-language dependencies

## Security Best Practices

### Dependency Scanning

```yaml
# udp.yml
security:
  scan_vulnerabilities: true
  fail_on_critical: true
  fail_on_high: false
  update_strategy: "patch"

  allowed_licenses:
    - "MIT"
    - "Apache-2.0"
    - "BSD-3-Clause"

  blocked_packages:
    - "known-malicious-package"

  custom_rules:
    - pattern: "*.min.js"
      action: "warn"
      reason: "Minified JS may hide malicious code"
```

### Supply Chain Security

1. **Package Verification**: Cryptographic signature checking
2. **Provenance Tracking**: Full dependency history
3. **Vulnerability Alerts**: Real-time security notifications
4. **Policy Enforcement**: Organizational security policies

## Contributing to Plugins

### Plugin Development Workflow

1. **Fork Repository**: Fork the UDP repository
2. **Create Plugin**: Use plugin template generator
3. **Implement Interfaces**: Follow plugin API specification
4. **Add Tests**: Unit, integration, and e2e tests
5. **Documentation**: README, examples, and API docs
6. **Submit PR**: Pull request with detailed description

### Plugin API Specification

```typescript
interface UdpPlugin {
  // Plugin metadata
  name: string;
  version: string;
  supportedEcosystems: string[];

  // Core functionality
  analyze(config: UdpConfig): Promise<AnalysisResult>;
  download(config: UdpConfig, outputDir: string): Promise<void>;
  generateBridges(config: UdpConfig, outputDir: string): Promise<void>;
  integrate(buildSystem: BuildSystem): Promise<void>;

  // Lifecycle hooks
  beforeInstall?(): Promise<void>;
  afterInstall?(): Promise<void>;
  beforeBuild?(): Promise<void>;
  afterBuild?(): Promise<void>;
}
```

For more detailed information, see individual plugin documentation in their respective directories.