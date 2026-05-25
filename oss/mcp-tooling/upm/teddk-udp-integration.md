# TEDDK + UDP Integration Guide

## 🎯 **Your UDP Platform is Live!**
- **UDP API**: http://34.29.39.106/
- **Health Check**: http://34.29.39.106/health
- **Status**: ✅ Running on Google Cloud

## Step 1: Configure TEDDK for UDP

### Create UDP Configuration File
Create `/Users/shaharsolomon/projects/telia/teddk/udp.yml`:

```yaml
# UDP Configuration for TEDDK Project
project: teddk
organization: telia
target_language: java
java_version: 8

# Enable cross-language bridges
bridges:
  python:
    runtime: jython
    version: "3.8"
    enabled: true
    endpoint: "http://34.29.39.106/api/python"

  javascript:
    runtime: graalvm
    version: "es2020"
    enabled: true
    endpoint: "http://34.29.39.106/api/javascript"

  rust:
    runtime: jni
    enabled: false  # Start with false, enable later
    endpoint: "http://34.29.39.106/api/rust"

# Dependencies managed by UDP
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

# UDP Platform Configuration
udp_platform:
  base_url: "http://34.29.39.106"
  api_key: "your-api-key-here"  # Get from UDP platform
  timeout: 30000
  retry_attempts: 3
```

### Add UDP Maven Plugin to TEDDK
Update your TEDDK `pom.xml`:

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
        <udpEndpoint>http://34.29.39.106</udpEndpoint>
    </configuration>
    <executions>
        <execution>
            <phase>generate-sources</phase>
            <goals>
                <goal>setup-bridges</goal>
                <goal>download-dependencies</goal>
                <goal>register-project</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## Step 2: Enhanced TEDDK Components

### 1. Improve HTTP Client (Replace Jersey with Python's Requests)

**Current TEDDK Code:**
```java
// telia/server/API/CompanyRegister/WebClient.java
import org.glassfish.jersey.client.ClientBuilder;

public class WebClient {
    private Client client = ClientBuilder.newClient();

    public String fetchCompanyData(String cvr) {
        return client.target("https://api.companyregister.dk")
                    .path("/company/" + cvr)
                    .request()
                    .get(String.class);
    }
}
```

**Enhanced with UDP:**
```java
// Enhanced WebClient using UDP + Python's requests
package telia.server.API.CompanyRegister;

import telia.server.udp.bridges.python.Requests;
import telia.server.udp.bridges.UDPBridge;
import telia.server.udp.UDPClient;

public class WebClient {
    private final UDPClient udpClient;
    private final Requests requests;

    public WebClient() {
        this.udpClient = new UDPClient("http://34.29.39.106");
        this.requests = udpClient.getPythonBridge("requests");
    }

    public String fetchCompanyData(String cvr) {
        try {
            // Use Python's requests via UDP platform
            Response response = requests.get(
                "https://api.companyregister.dk/company/" + cvr,
                Map.of(
                    "timeout", 30,
                    "headers", Map.of("User-Agent", "TEDDK/1.0"),
                    "verify", true  // SSL verification
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

### 2. Improve CSV Processing (Replace manual parsing with Pandas)

**Current TEDDK Code:**
```java
// Manual CSV processing in RR2R component
public class RR2R {
    public Map<String, Set<String>> handleInputFile(String inputFile) {
        // Manual CSV parsing with lots of string manipulation
        BufferedReader reader = new BufferedReader(new FileReader(inputFile));
        // ... complex parsing logic
    }
}
```

**Enhanced with UDP:**
```java
package telia.server.RR2R;

import telia.server.udp.bridges.python.Pandas;
import telia.server.udp.UDPClient;

public class RR2R {
    private final UDPClient udpClient;
    private final Pandas pd;

    public RR2R() {
        this.udpClient = new UDPClient("http://34.29.39.106");
        this.pd = udpClient.getPythonBridge("pandas");
    }

    public Map<String, Set<String>> handleInputFile(String inputFile) {
        try {
            // Use pandas for robust CSV processing via UDP
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

### 3. Improve SFTP Operations (Replace JSch with Paramiko)

**Current TEDDK Code:**
```java
// Using JSch for SFTP (known vulnerabilities)
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;

public class FTPClientHandler {
    public List<String> fetchFilesByConfig(Config sftpConfig) {
        JSch jsch = new JSch();
        // Complex JSch setup with manual key management
    }
}
```

**Enhanced with UDP:**
```java
package telia.server.FTP;

import telia.server.udp.bridges.python.Paramiko;
import telia.server.udp.UDPClient;

public class FTPClientHandler {
    private final UDPClient udpClient;
    private final Paramiko paramiko;

    public FTPClientHandler() {
        this.udpClient = new UDPClient("http://34.29.39.106");
        this.paramiko = udpClient.getPythonBridge("paramiko");
    }

    public List<String> fetchFilesByConfig(Config sftpConfig) {
        try {
            // Use Paramiko via UDP platform (more secure than JSch)
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

## Step 3: UDP Client Implementation

Create the UDP client for TEDDK:

```java
// telia/server/udp/UDPClient.java
package telia.server.udp;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Duration;

public class UDPClient {
    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public UDPClient(String baseUrl) {
        this.baseUrl = baseUrl;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.objectMapper = new ObjectMapper();
    }

    public <T> T getPythonBridge(String library) {
        return createBridge("python", library);
    }

    public <T> T getJavaScriptBridge(String library) {
        return createBridge("javascript", library);
    }

    private <T> T createBridge(String language, String library) {
        try {
            // Call UDP platform to get bridge
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/bridge/" + language + "/" + library))
                .timeout(Duration.ofSeconds(30))
                .build();

            HttpResponse<String> response = httpClient.send(request, 
                HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), (Class<T>) Object.class);
            } else {
                throw new RuntimeException("Failed to get bridge: " + response.statusCode());
            }
        } catch (Exception e) {
            throw new RuntimeException("UDP bridge creation failed", e);
        }
    }
}
```

## Step 4: Test the Integration

### 1. Test UDP Platform Connection
```java
// TestUDPConnection.java
public class TestUDPConnection {
    public static void main(String[] args) {
        UDPClient udp = new UDPClient("http://34.29.39.106");
        
        try {
            // Test Python bridge
            Requests requests = udp.getPythonBridge("requests");
            System.out.println("✅ Python bridge working");
            
            // Test JavaScript bridge
            Lodash lodash = udp.getJavaScriptBridge("lodash");
            System.out.println("✅ JavaScript bridge working");
            
        } catch (Exception e) {
            System.err.println("❌ UDP connection failed: " + e.getMessage());
        }
    }
}
```

### 2. Run TEDDK with UDP Integration
```bash
# Navigate to TEDDK project
cd /Users/shaharsolomon/projects/telia/teddk

# Initialize UDP integration
mvn udp:setup-bridges

# Build with UDP dependencies
mvn clean compile

# Test enhanced components
mvn test -Dtest=WebClientTest
mvn test -Dtest=RR2RTest
mvn test -Dtest=FTPClientHandlerTest
```

## Step 5: Monitor and Optimize

### Check UDP Platform Status
```bash
# Check if UDP platform is healthy
curl http://34.29.39.106/health

# Check dependency status
curl http://34.29.39.106/api/dependencies/status

# View project registration
curl http://34.29.39.106/api/projects/teddk
```

### Performance Monitoring
```java
// Add to your TEDDK components
public class UDPMetrics {
    private final UDPClient udpClient;
    
    public void logBridgeUsage(String bridge, long executionTime) {
        udpClient.sendMetrics(Map.of(
            "bridge", bridge,
            "execution_time", executionTime,
            "timestamp", System.currentTimeMillis()
        ));
    }
}
```

## Benefits for TEDDK

### Immediate Improvements:
1. **Security**: Replace vulnerable JSch with secure Paramiko
2. **Reliability**: Robust CSV parsing with Pandas vs manual string manipulation  
3. **Features**: Rich HTTP client with automatic retries, better error handling

### New Capabilities:
1. **Data Analytics**: Customer segmentation analysis with pandas/numpy
2. **Better Date Handling**: Automatic date format detection with Moment.js
3. **Enhanced Utilities**: Complex data transformations with lodash

### Long-term Benefits:
1. **Future-Proofing**: Easy adoption of new libraries from any language
2. **Performance**: Can add Rust libraries for CPU-intensive operations
3. **Developer Productivity**: Use best-of-breed tools for each task

## Next Steps

1. **Test the integration** with your existing TEDDK components
2. **Gradually replace** vulnerable components (JSch → Paramiko)
3. **Add new capabilities** using Python/JavaScript libraries
4. **Monitor performance** and optimize as needed

Your UDP platform is ready to enhance TEDDK with cross-language dependencies! 🚀


