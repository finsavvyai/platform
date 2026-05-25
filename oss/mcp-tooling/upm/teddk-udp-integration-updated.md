# 🚀 TEDDK + UPM Platform Integration (Updated with Domain)

## Your UPM Platform Domain
- **Main Platform**: https://upmplus.dev
- **API Endpoint**: https://api.upmplus.dev
- **Documentation**: https://docs.upmplus.dev

## Step 1: Update TEDDK Configuration

Create/update `/Users/shaharsolomon/projects/telia/teddk/upm.yml`:

```yaml
# UPM Platform Configuration for TEDDK
project: teddk
organization: telia
target_language: java
java_version: 8

# UPM Platform Connection
upm_platform:
  base_url: "https://upmplus.dev"
  api_endpoint: "https://api.upmplus.dev"
  api_key: "your-api-key-here"
  timeout: 30000
  retry_attempts: 3

# Cross-language bridges
bridges:
  python:
    runtime: jython
    version: "3.8"
    enabled: true
    upm_endpoint: "https://api.upmplus.dev/python"

  javascript:
    runtime: graalvm
    version: "es2020"
    enabled: true
    upm_endpoint: "https://api.upmplus.dev/javascript"

  rust:
    runtime: jni
    enabled: false  # Start with false, enable later
    upm_endpoint: "https://api.upmplus.dev/rust"

# Enhanced dependencies for TEDDK
dependencies:
  # Keep existing Java dependencies
  java:
    - "io.helidon:helidon-se:1.3.1"
    - "org.postgresql:postgresql:42.2.25"
    - "com.fasterxml.jackson.core:jackson-databind:2.15.2"
    - "com.jcraft:jsch:0.1.55"

  # Add Python libraries for enhanced functionality
  python:
    - "requests:2.28.1"          # Better HTTP client than Java's
    - "pandas:1.5.2"             # CSV/data processing
    - "python-dateutil:2.8.2"    # Better date parsing
    - "paramiko:2.12.0"          # Better SFTP than JSch

  # Add JavaScript utilities
  javascript:
    - "lodash:4.17.21"           # Utility functions
    - "moment:2.29.4"            # Date manipulation
    - "csv-parser:3.0.0"         # Fast CSV parsing
```

## Step 2: Update Maven Configuration

Update your `pom.xml` in TEDDK:

```xml
<!-- Add UDP Maven Plugin -->
<plugin>
    <groupId>com.udp</groupId>
    <artifactId>udp-maven-plugin</artifactId>
    <version>1.0.0</version>
    <configuration>
        <configFile>udp.yml</configFile>
        <generateBridges>true</generateBridges>
        <bridgePackage>telia.server.udp.bridges</bridgePackage>
        <udpEndpoint>https://api.upmplus.dev</udpEndpoint>
    </configuration>
    <executions>
        <execution>
            <phase>generate-sources</phase>
            <goals>
                <goal>setup-bridges</goal>
                <goal>download-dependencies</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## Step 3: Enhanced Components with UDP

### Improved HTTP Client (Replace Jersey with Python's Requests)

```java
// Enhanced WebClient using UDP Platform
package telia.server.API.CompanyRegister;

import telia.server.udp.bridges.python.Requests;
import telia.server.udp.bridges.UDPBridge;

public class WebClient {
    private final Requests requests = UDPBridge.python("requests");
    private final String udpEndpoint = "https://api.upmplus.dev";

    public String fetchCompanyData(String cvr) {
        try {
            // Use Python's requests via UDP Platform
            Response response = requests.get(
                "https://api.companyregister.dk/company/" + cvr,
                Map.of(
                    "timeout", 30,
                    "headers", Map.of("User-Agent", "TEDDK/1.0"),
                    "verify", true
                )
            );

            if (response.status_code() == 200) {
                return response.text();
            } else {
                throw new TeddkAPICallException("HTTP " + response.status_code());
            }
        } catch (Exception e) {
            // Fallback to Java implementation
            return fetchWithJavaClient(cvr);
        }
    }
}
```

### Improved CSV Processing (Replace manual parsing with Pandas)

```java
// Enhanced RR2R using UDP Platform
package telia.server.RR2R;

import telia.server.udp.bridges.python.Pandas;
import telia.server.udp.bridges.UDPBridge;

public class RR2R {
    private final Pandas pd = UDPBridge.python("pandas");
    private final String udpEndpoint = "https://api.upmplus.dev";

    public Map<String, Set<String>> handleInputFile(String inputFile) {
        try {
            // Use pandas via UDP Platform for robust CSV processing
            DataFrame df = pd.read_csv(inputFile, Map.of(
                "encoding", "utf-8",
                "delimiter", ";",
                "error_bad_lines", false
            ));

            // Filter and process data with pandas
            DataFrame rr2rData = df.query("status == 'ACTIVE'");
            DataFrame sapData = df.query("requires_sap_sync == true");

            // Convert back to Java collections
            Set<String> rr2rRows = rr2rData.to_java_set();
            Set<String> sapRows = sapData.to_java_set();

            return Map.of(
                "RR2R", rr2rRows,
                "SAP", sapRows
            );

        } catch (Exception e) {
            // Fallback to Java implementation
            return handleInputFileJava(inputFile);
        }
    }
}
```

### Improved SFTP Operations (Replace JSch with Paramiko)

```java
// Enhanced FTPClientHandler using UDP Platform
package telia.server.FTPClientHandler;

import telia.server.udp.bridges.python.Paramiko;
import telia.server.udp.bridges.UDPBridge;

public class FTPClientHandler {
    private final Paramiko paramiko = UDPBridge.python("paramiko");
    private final String udpEndpoint = "https://api.upmplus.dev";

    public List<String> fetchFilesByConfig(Config sftpConfig) {
        try {
            // Use Paramiko via UDP Platform (more secure than JSch)
            SFTPClient sftp = paramiko.SSHClient()
                .set_missing_host_key_policy(paramiko.AutoAddPolicy())
                .connect(
                    hostname = sftpConfig.get("host").asString(),
                    username = sftpConfig.get("username").asString(),
                    key_filename = sftpConfig.get("private_key").asString()
                )
                .open_sftp();

            List<String> files = sftp.listdir(sftpConfig.get("remote_path").asString());
            return files.stream()
                       .filter(file -> file.endsWith(".csv"))
                       .collect(Collectors.toList());

        } catch (Exception e) {
            // Fallback to JSch implementation
            return fetchFilesWithJSch(sftpConfig);
        }
    }
}
```

## Step 4: Test Your Integration

### Test UDP Platform Connection

```java
// Test UDP Platform connectivity
package telia.server.udp.test;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class UDPPlatformTest {
    private static final String UDP_BASE_URL = "https://upmplus.dev";
    private static final String UDP_API_URL = "https://api.upmplus.dev";

    public static void main(String[] args) {
        HttpClient client = HttpClient.newHttpClient();

        // Test main platform
        testEndpoint(client, UDP_BASE_URL + "/health", "Main Platform");
        
        // Test API endpoint
        testEndpoint(client, UDP_API_URL + "/health", "API Endpoint");
    }

    private static void testEndpoint(HttpClient client, String url, String name) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            System.out.println(name + " (Status " + response.statusCode() + "): " + response.body());
        } catch (Exception e) {
            System.err.println("Error testing " + name + ": " + e.getMessage());
        }
    }
}
```

## Step 5: Implementation Commands

```bash
# Navigate to your TEDDK project
cd /Users/shaharsolomon/projects/telia/teddk

# Create UDP configuration
cat > udp.yml << 'EOF'
# UDP Platform Configuration for TEDDK
project: teddk
organization: telia
target_language: java
java_version: 8

udp_platform:
  base_url: "https://upmplus.dev"
  api_endpoint: "https://api.upmplus.dev"
  api_key: "your-api-key-here"
  timeout: 30000
  retry_attempts: 3

bridges:
  python:
    runtime: jython
    version: "3.8"
    enabled: true
    upm_endpoint: "https://api.upmplus.dev/python"

  javascript:
    runtime: graalvm
    version: "es2020"
    enabled: true
    upm_endpoint: "https://api.upmplus.dev/javascript"

dependencies:
  java:
    - "io.helidon:helidon-se:1.3.1"
    - "org.postgresql:postgresql:42.2.25"
    - "com.fasterxml.jackson.core:jackson-databind:2.15.2"
    - "com.jcraft:jsch:0.1.55"

  python:
    - "requests:2.28.1"
    - "pandas:1.5.2"
    - "python-dateutil:2.8.2"
    - "paramiko:2.12.0"

  javascript:
    - "lodash:4.17.21"
    - "moment:2.29.4"
    - "csv-parser:3.0.0"
EOF

# Add UDP Maven plugin to pom.xml (see above)

# Generate bridge classes
mvn udp:setup-bridges

# Build with new dependencies
mvn clean compile

# Test enhanced functionality
mvn test
```

## Benefits for TEDDK

### Immediate Improvements:
1. **Security**: Replace vulnerable JSch with secure Paramiko
2. **Reliability**: Robust CSV parsing with Pandas vs manual string manipulation
3. **Features**: Rich HTTP client with automatic retries, better error handling
4. **Professional**: Your own domain (upmplus.dev) instead of IP addresses

### New Capabilities:
1. **Data Analytics**: Customer segmentation analysis with pandas/numpy
2. **Better Date Handling**: Automatic date format detection with Moment.js
3. **Enhanced Utilities**: Complex data transformations with lodash

### Long-term Benefits:
1. **Future-Proofing**: Easy adoption of new libraries from any language
2. **Performance**: Can add Rust libraries for CPU-intensive operations
3. **Developer Productivity**: Use best-of-breed tools for each task
4. **Professional Branding**: Your own domain for the platform

Your UDP platform is now ready to enhance your TEDDK project with cross-language dependencies! 🚀
