# Billpro Service Monitor

A comprehensive monitoring system for various services including XML-based APIs, REST APIs, and database connections with time-based monitoring capabilities.

## Overview

The Billpro Service Monitor is a Spring Boot application that provides automated monitoring for:
- **XML-based API services** (generic, mdwc, sp, nsl)
- **REST API services** (JSON-based systems like TEDDK)
- **Database connections** (Oracle, MySQL, etc.)
- **Time-based monitoring** for performance-critical requests
- **Alert notifications** via email, SMS, and Slack

## Features

- **Multi-service monitoring**: Support for multiple service types and endpoints
- **Time-based monitoring**: Automatic timeout detection for critical requests
- **JSON API monitoring**: Generic support for REST API-based systems
- **Database health checks**: Connection and query validation
- **Configurable alerts**: Email, SMS, and Slack notifications
- **Scheduled execution**: Automated monitoring at configurable intervals
- **Environment-specific configurations**: Separate configs for test, production, etc.

## Quick Start

### Prerequisites

- Java 11 or higher
- Gradle 7.1.1 or higher
- Access to monitored services and databases

### Building the Application

```bash
./gradlew build
```

### Running the Application

#### Development/Testing
```bash
# For test environment
./gradlew bootRun --args='--spring.profiles.active=test'

# For production environment
./gradlew bootRun --args='--spring.profiles.active=prod'

# For specific environment (e.g., prod-nsl)
./gradlew bootRun --args='--spring.profiles.active=prod-nsl'
```

#### Production Deployment
```bash
# Build production JAR
./gradlew clean build -x test

# Run with production profile
java -jar build/libs/monitor-*.jar --spring.profiles.active=prod

# Run with JVM optimizations
java -Xms512m -Xmx2g -XX:+UseG1GC \
  -Dspring.profiles.active=prod \
  -jar build/libs/monitor-*.jar
```

## Configuration

### 1. Service Definitions

Services are defined in the `sanity-app.services` section of your configuration file:

```yaml
sanity-app:
  services:
    # XML-based service (generic)
    - { name: generic_prod1, type: generic, url: "http://server:7002/", requests: [ CheckConnections,GetAvailableMsisdns ], dbignorelist: [ EtrayDB,FotonDB ] }
    
    # XML-based service with time-based monitoring
    - { name: mdwc_prod1, type: mdwc, url: "http://server:7022/", requests: [ CheckConnections,MeMDWC_GetLimit ], timeoutSeconds: 60 }
    
    # JSON-based service (REST API)
    - { name: teddk_prod, type: teddk, url: "https://prod.teddk.telia.dk", requests: [ sanity ], timeoutSeconds: 45 }
```

### 2. Service Types

#### XML-based Services
- **generic**: Generic XML interface
- **mdwc**: MDWC XML interface
- **sp**: SP XML interface
- **nsl**: NSL XML interface

#### JSON-based Services
- **teddk**: TEDDK REST API
- **json**: Generic JSON-based systems

### 3. Request Files

#### XML Requests
Place XML request files in the appropriate directories:

```
src/main/resources/requestXMLs/
├── generic/
│   ├── CheckConnections.xml
│   └── GetAvailableMsisdns.xml
├── mdwc/
│   ├── CheckConnections.xml
│   └── TimeBase/
│       └── MeMDWC_GetLimit.xml
├── sp/
│   └── CheckConnections.xml
└── nsl/
    └── GetAvailableTelephoneNumbers.xml
```

#### JSON Requests
Place JSON request files in system-specific directories:

```
src/main/resources/requestXMLs/
└── teddk/
    └── sanity.json
```

### 4. Time-based Monitoring Configuration

Enable and configure time-based monitoring:

```yaml
time-based-monitoring:
  enabled: true
  default-timeout-seconds: 30
```

### 5. Database Configuration

Configure database connections:

```yaml
database:
  dbname: PROD
  datasources:
    - {name: ninja, jdbc_url: server:1521/DB, user: username, password: "encrypted_password", driver_class_name: "oracle.jdbc.driver.OracleDriver"}
    - {name: fokus, jdbc_url: server:1521/DB, user: username, password: "encrypted_password", driver_class_name: "oracle.jdbc.driver.OracleDriver"}
```

### 6. Alert Configuration

#### Email Alerts
```yaml
email_enabled: true
email:
  sender_email: monitor@company.com
  sender_password: "encrypted_password"
  host: smtp.company.com
  port: 587
  ssl: true
  auth: true
  recipients: "admin@company.com"
  from: "Service Monitor"
```

#### SMS Alerts
```yaml
sms_enabled: true
twilio:
  sender: +1234567890
  sid: your_twilio_sid
  token: your_twilio_token
  recipients: ["+1234567890"]
```

#### Slack Integration
```yaml
# Slack webhook URL is configured in MonitorUtils.java
```

### 7. Scheduler Configuration

```yaml
scheduler:
  period: PT30M  # ISO 8601 duration (30 minutes)
  skip_time_interval: "23:10-23:45"  # Skip monitoring during maintenance window
```

## Request File Formats

### XML Request Format

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE TMDXmlRequest SYSTEM "file://TMDXmlRequest.dtd">
<TMDXmlRequest application="NinjaGenericInterface" service="CheckConnections">
    <parameter name="InvokingSystem">Petrix</parameter>
    <parameter name="CallerId">petrix</parameter>
    <parameter name="Password">ptrxgen</parameter>
</TMDXmlRequest>
```

### JSON Request Format

```json
{
  "url": "/api/sanity",
  "method": "GET",
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://prod-web.teddk.telia.dk",
    "priority": "u=1, i",
    "referer": "https://prod-web.teddk.telia.dk/",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "x-access-token": "null",
    "x-apigw-api-id": "kddet31122$2$"
  },
  "expectedResponse": {
    "status": "Success",
    "sanity_result": {
      "COMPANY_REGISTER_API_ACCESS": "Valid",
      "TEDDK_DB": "Valid"
    }
  }
}
```

## Adding New Services

### 1. XML-based Service

1. **Create request files** in `src/main/resources/requestXMLs/{service-type}/`
2. **Add service configuration** in your environment config:

```yaml
sanity-app:
  services:
    - { name: new_service, type: new_type, url: "http://server:port/", requests: [ RequestName1,RequestName2 ] }
```

3. **Add URL mapping** in `MonitorUtils.java`:

```java
public static final Map<String, String> PROJECT_URL_NAMES =
    Arrays.stream(new String[][]{
        {"new_type", "NewTypeInterface"},
        // ... existing mappings
    }).collect(Collectors.toMap(keyMapper -> keyMapper[0],
        valueMapper -> valueMapper[1]));
```

### 2. JSON-based Service

1. **Create JSON request file** in `src/main/resources/requestXMLs/{service-type}/request.json`
2. **Add service configuration**:

```yaml
sanity-app:
  services:
    - { name: new_json_service, type: new_json_type, url: "https://api.server.com", requests: [ request ], timeoutSeconds: 30 }
```

3. **Add system type** to `JsonMonitoringService.isJsonBasedSystem()`:

```java
private boolean isJsonBasedSystem(String systemType) {
    return "teddk".equals(systemType) || "new_json_type".equals(systemType);
}
```

4. **Add response parsing** in `JsonMonitoringService.parseJsonResponse()`:

```java
switch (systemType) {
    case "new_json_type":
        return parseNewJsonTypeResponse(responseBody, responseDetails);
    // ... existing cases
}
```

### 3. Time-based Monitoring

For XML requests that need time-based monitoring:

1. **Place request file** in `src/main/resources/requestXMLs/mdwc/TimeBase/`
2. **Add to service configuration** with timeout:

```yaml
- { name: mdwc_service, type: mdwc, url: "http://server:port/", requests: [ CheckConnections,TimeBasedRequest ], timeoutSeconds: 45 }
```

## Environment Configurations

### Test Environment (`application-test.yaml`)
```yaml
envname: TEST
message_subject: "Billpro Service Monitor alert"
scheduler:
  period: PT30M
time-based-monitoring:
  enabled: true
  default-timeout-seconds: 30
```

### Production Environment (`application-prod.yaml`)
```yaml
envname: PROD
message_subject: "Billpro Service Monitor alert"
scheduler:
  period: PT30M
  skip_time_interval: "23:10-23:45"
time-based-monitoring:
  enabled: true
  default-timeout-seconds: 45
```

## Production Deployment

### 1. Production Build

```bash
# Create production-ready JAR
./gradlew clean build -x test

# Verify the build
ls -la build/libs/
```

### 2. Production Deployment Options

#### Option A: Direct Java Execution
```bash
cd build/libs/
java -jar monitor-*.jar --spring.profiles.active=prod
```

#### Option B: With JVM Optimizations
```bash
java -Xms512m -Xmx2g -XX:+UseG1GC \
  -Djava.awt.headless=true \
  -Dspring.profiles.active=prod \
  -jar build/libs/monitor-*.jar
```

#### Option C: Systemd Service (Linux)
Create `/etc/systemd/system/monitor.service`:
```ini
[Unit]
Description=Billpro Service Monitor
After=network.target

[Service]
Type=simple
User=monitor
WorkingDirectory=/opt/monitor
ExecStart=/usr/bin/java -Xms512m -Xmx2g -XX:+UseG1GC -Dspring.profiles.active=prod -jar monitor.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable monitor
sudo systemctl start monitor
sudo systemctl status monitor
```

#### Option D: Docker Deployment
```bash
# Build Docker image
docker build -t billpro-monitor .

# Run container
docker run -d \
  --name monitor \
  -p 9092:9092 \
  -e SPRING_PROFILES_ACTIVE=prod \
  billpro-monitor
```

### 3. Production Environment Variables

```bash
export SPRING_PROFILES_ACTIVE=prod
export JAVA_OPTS="-Xms512m -Xmx2g -XX:+UseG1GC"
export SERVER_PORT=9092
```

### 4. Production Scripts

#### Start Script (`start-monitor.sh`)
```bash
#!/bin/bash
cd /opt/monitor
nohup java -Xms512m -Xmx2g -XX:+UseG1GC \
  -Dspring.profiles.active=prod \
  -jar monitor.jar > monitor.log 2>&1 &
echo $! > monitor.pid
```

#### Stop Script (`stop-monitor.sh`)
```bash
#!/bin/bash
if [ -f monitor.pid ]; then
    kill $(cat monitor.pid)
    rm monitor.pid
    echo "Monitor stopped"
else
    echo "Monitor not running"
fi
```

#### Status Script (`status-monitor.sh`)
```bash
#!/bin/bash
if [ -f monitor.pid ]; then
    if kill -0 $(cat monitor.pid) 2>/dev/null; then
        echo "Monitor is running (PID: $(cat monitor.pid))"
    else
        echo "Monitor is not running"
        rm monitor.pid
    fi
else
    echo "Monitor is not running"
fi
```

### 5. Production Security

#### File Permissions
```bash
# Create dedicated user
sudo useradd -r -s /bin/false monitor

# Set proper permissions
sudo chown -R monitor:monitor /opt/monitor
sudo chmod 755 /opt/monitor
sudo chmod 644 /opt/monitor/*.jar
```

#### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 9092/tcp
sudo ufw enable
```

### 6. Production Monitoring

#### Health Check
```bash
curl http://localhost:9092/sanity
```

#### Log Monitoring
```bash
tail -f logs/monitor.log
```

#### System Resources
```bash
ps aux | grep monitor
netstat -tlnp | grep 9092
```

### 7. Production Deployment Checklist

- [ ] Build application with `./gradlew clean build -x test`
- [ ] Verify JAR file is created in `build/libs/`
- [ ] Configure production environment variables
- [ ] Set up proper logging configuration
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Test health check endpoint
- [ ] Verify all services are accessible
- [ ] Set up automated restart on failure
- [ ] Configure backup and recovery procedures

## Monitoring Endpoints

### Health Check
```
GET /sanity
```
Returns "OK" if all checks pass, "Failure" if any check fails.

## Alert Messages

The system generates different types of alert messages:

- **API Failures**: Service connection or response validation failures
- **Database Failures**: Connection or query execution failures
- **Timeout Alerts**: Requests that exceed configured timeouts
- **JSON Response Errors**: Invalid JSON responses or missing expected fields

## Troubleshooting

### Common Issues

1. **Service Not Detected**
   - Verify request files are in correct directories
   - Check service type configuration
   - Ensure URL mappings are correct

2. **Timeout Issues**
   - Adjust `timeoutSeconds` in service configuration
   - Check network connectivity
   - Verify service response times

3. **Configuration Errors**
   - Validate YAML syntax
   - Check profile activation
   - Verify property names

4. **Database Connection Issues**
   - Verify JDBC URLs and credentials
   - Check database availability
   - Validate driver class names

### Logs

Monitor application logs for detailed error information:
```bash
tail -f logs/monitor.log
```

## Security

- Database passwords are encrypted using the application's encryption utility
- API credentials should be stored securely
- Use HTTPS for external API calls
- Implement proper access controls for monitoring endpoints

## Contributing

1. Follow the existing code structure
2. Add appropriate tests for new features
3. Update documentation for configuration changes
4. Use consistent naming conventions

## License

[Add your license information here]
