# UDP Maven Plugin

The Universal Dependency Platform (UDP) Maven Plugin enables Java projects to use dependencies from multiple programming language ecosystems including Python, JavaScript, Rust, and more.

## Features

- **Cross-Language Dependencies**: Use libraries from Python (PyPI), JavaScript (NPM), Rust (Cargo), and other ecosystems in Java projects
- **Automatic Bridge Generation**: Generate Java wrapper classes for non-Java dependencies
- **Dependency Resolution**: Advanced dependency resolution using UDP service with conflict detection
- **Security Analysis**: Vulnerability scanning across all dependency ecosystems
- **Performance Optimization**: Caching, parallel loading, and optimized runtime bridges

## Quick Start

### 1. Add Plugin to Your Project

Add the UDP Maven plugin to your `pom.xml`:

```xml
<plugin>
    <groupId>com.udp</groupId>
    <artifactId>udp-maven-plugin</artifactId>
    <version>1.0.0</version>
    <configuration>
        <configFile>${project.basedir}/udp.yml</configFile>
    </configuration>
    <executions>
        <execution>
            <phase>generate-sources</phase>
            <goals>
                <goal>setup-bridges</goal>
                <goal>download-dependencies</goal>
            </goals>
        </execution>
        <execution>
            <phase>verify</phase>
            <goals>
                <goal>analyze</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

### 2. Create UDP Configuration

Create a `udp.yml` file in your project root:

```yaml
project: my-java-project
target_language: java
java_version: "8"

dependencies:
  # Native Java dependencies (handled by Maven)
  java:
    - "org.apache.commons:commons-lang3:3.12.0"
    - "com.fasterxml.jackson.core:jackson-databind:2.15.2"

  # Python libraries for data processing
  python:
    - "pandas:1.5.2"
    - "requests:2.28.1"
    - "numpy:1.21.0"

  # JavaScript utilities
  javascript:
    - "lodash:4.17.21"
    - "moment:2.29.4"

  # Rust libraries for performance
  rust:
    - "serde:1.0.152"
    - "regex:1.7.0"

bridges:
  python:
    enabled: true
    runtime: jython
    version: "3.8"
    dependencies_path: "lib/python"

  javascript:
    enabled: true
    runtime: graalvm
    version: "es2020"
    dependencies_path: "lib/js"

  rust:
    enabled: true
    runtime: jni
    target: "x86_64-unknown-linux-gnu"
    dependencies_path: "lib/rust"

performance:
  preload_bridges: true
  cache_modules: true
  parallel_loading: true
  cache_directory: ".udp/cache"

udp_service:
  url: "http://localhost:8040"
  api_key: "${UDP_API_KEY}"
  organization_id: "${UDP_ORG_ID}"
  timeout: 30
  retry_count: 3
```

### 3. Use Cross-Language Dependencies

After running the plugin, you can use cross-language dependencies in your Java code:

```java
package com.example;

// Generated bridge classes
import udp.bridges.python.Pandas;
import udp.bridges.python.Requests;
import udp.bridges.javascript.Lodash;
import udp.bridges.rust.SerdeJson;
import udp.runtime.UDPBridge;

public class CrossLanguageExample {

    public void demonstrateCrossLanguageUsage() {
        // Use Python's pandas for data processing
        Pandas pd = Pandas.getInstance();
        var dataFrame = pd.read_csv("data.csv");
        var filtered = dataFrame.query("age > 25");

        // Use Python's requests for HTTP calls
        Requests requests = Requests.getInstance();
        var response = requests.get("https://api.example.com/data");
        String jsonData = response.text();

        // Use JavaScript's lodash for utilities
        Lodash _ = Lodash.getInstance();
        var processedData = _.pick(response.json(), Arrays.asList("id", "name", "email"));

        // Use Rust's serde for fast JSON processing
        SerdeJson serde = SerdeJson.getInstance();
        String optimizedJson = serde.to_string(processedData);

        System.out.println("Processed with cross-language dependencies: " + optimizedJson);
    }
}
```

## Plugin Goals

### `udp:setup-bridges`

Generates Java bridge classes for cross-language dependencies.

**Parameters:**
- `configFile` - Path to UDP configuration file (default: `${project.basedir}/udp.yml`)
- `bridgeOutputDirectory` - Output directory for generated bridges (default: `${project.build.directory}/generated-sources/udp-bridges`)
- `forceRegenerate` - Force regeneration even if bridges exist (default: false)
- `validateBridges` - Validate generated bridges (default: true)

**Usage:**
```bash
mvn udp:setup-bridges
```

### `udp:download-dependencies`

Downloads cross-language dependencies from multiple ecosystems.

**Parameters:**
- `dependenciesDirectory` - Where to download dependencies (default: `${project.build.directory}/udp-dependencies`)
- `forceDownload` - Force re-download (default: false)
- `resolveDependencies` - Resolve dependencies before download (default: true)
- `includeTransitive` - Include transitive dependencies (default: true)
- `verifyIntegrity` - Verify downloaded files (default: true)

**Usage:**
```bash
mvn udp:download-dependencies
```

### `udp:analyze`

Performs comprehensive dependency analysis including security vulnerabilities.

**Parameters:**
- `reportsDirectory` - Output directory for reports (default: `${project.build.directory}/udp-reports`)
- `failOnCriticalSeverity` - Fail build on critical vulnerabilities (default: true)
- `failOnHighSeverity` - Fail build on high severity vulnerabilities (default: false)
- `generateDetailedReport` - Generate detailed analysis report (default: true)
- `includeDependencyGraph` - Include dependency graph analysis (default: true)

**Usage:**
```bash
mvn udp:analyze
```

## Configuration Reference

### UDP Service Configuration

```yaml
udp_service:
  url: "http://localhost:8040"           # UDP service URL
  api_key: "${UDP_API_KEY}"              # API key (use environment variable)
  organization_id: "${UDP_ORG_ID}"       # Organization ID
  timeout: 30                            # Request timeout in seconds
  retry_count: 3                         # Number of retries
```

### Bridge Configuration

```yaml
bridges:
  python:
    enabled: true                        # Enable Python bridge
    runtime: jython                      # jython, graalvm, subprocess
    version: "3.8"                       # Python version
    dependencies_path: "lib/python"      # Where to store Python deps

  javascript:
    enabled: true
    runtime: graalvm                     # graalvm, nashorn, subprocess
    version: "es2020"                    # JavaScript version
    dependencies_path: "lib/js"

  rust:
    enabled: true
    runtime: jni                         # JNI bridge for Rust
    target: "x86_64-unknown-linux-gnu"   # Rust compilation target
    dependencies_path: "lib/rust"
```

### Performance Configuration

```yaml
performance:
  preload_bridges: true                  # Preload bridge modules
  cache_modules: true                    # Cache loaded modules
  parallel_loading: true                # Load dependencies in parallel
  cache_directory: ".udp/cache"         # Cache directory
```

## Examples

### Data Processing with Python

```java
public class DataProcessor {
    public void processCustomerData() {
        Pandas pd = Pandas.getInstance();

        // Load and process data using Python's pandas
        var df = pd.read_csv("customers.csv");
        var filtered = df.query("age > 25 && city == 'Copenhagen'");
        var summary = filtered.groupby("department").sum();

        // Convert back to Java for further processing
        List<Customer> customers = filtered.toJavaList(Customer.class);
    }
}
```

### HTTP Client with Python Requests

```java
public class ApiClient {
    private final Requests requests = Requests.getInstance();

    public ApiResponse callApi(String url, Map<String, Object> data) {
        var response = requests.post(url, data);

        if (response.status_code() == 200) {
            return new ApiResponse(response.json());
        } else {
            throw new ApiException("API call failed: " + response.text());
        }
    }
}
```

### Utilities with JavaScript Lodash

```java
public class DataTransformer {
    private final Lodash _ = Lodash.getInstance();

    public Map<String, Object> transformData(Map<String, Object> input) {
        // Use JavaScript utilities for data transformation
        return _.pick(input, Arrays.asList("id", "name", "email"))
                .mapValues(value -> _.trim(value.toString()));
    }
}
```

## Advanced Features

### Custom Bridge Types

You can specify custom bridge types for specific dependencies:

```yaml
dependencies:
  generic:
    - name: "custom-lib"
      version: "1.0.0"
      ecosystem: "custom"
      bridge: "jni"
      optional: true
```

### Environment-Specific Configuration

Use environment variables for sensitive configuration:

```yaml
udp_service:
  url: "${UDP_SERVICE_URL:-http://localhost:8040}"
  api_key: "${UDP_API_KEY}"
  organization_id: "${UDP_ORG_ID}"
```

### Conditional Bridge Enabling

```yaml
bridges:
  python:
    enabled: "${UDP_ENABLE_PYTHON:-true}"
  rust:
    enabled: "${UDP_ENABLE_RUST:-false}"
```

## Troubleshooting

### Common Issues

1. **UDP Service Connection Failed**
   - Ensure UDP service is running at the configured URL
   - Check network connectivity and firewall settings
   - Verify API key and organization ID

2. **Bridge Generation Failed**
   - Check that target ecosystem dependencies are available
   - Verify bridge runtime is properly installed (Jython, GraalVM, etc.)
   - Check UDP service logs for detailed error messages

3. **Dependency Download Failed**
   - Verify network access to package repositories
   - Check dependency names and versions are correct
   - Ensure sufficient disk space in target directory

### Debug Mode

Enable debug logging by setting the Maven debug flag:

```bash
mvn -X udp:setup-bridges
```

Or configure logging in your `udp.yml`:

```yaml
logging:
  level: DEBUG
  file: "udp-plugin.log"
```

## Requirements

- Java 8 or higher
- Maven 3.6.0 or higher
- UDP service running and accessible
- Bridge runtimes (optional, depending on enabled bridges):
  - Jython 2.7+ (for Python bridge)
  - GraalVM 21+ (for JavaScript/Python bridge)
  - Rust toolchain (for Rust bridge)

## Support

- Documentation: [https://docs.universaldependency.com](https://docs.universaldependency.com)
- Issues: [https://github.com/universal-dependency-platform/udp-maven-plugin/issues](https://github.com/universal-dependency-platform/udp-maven-plugin/issues)
- Support: [support@universaldependency.com](mailto:support@universaldependency.com)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.