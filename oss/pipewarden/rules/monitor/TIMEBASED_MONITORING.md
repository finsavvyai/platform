# Time-Based Monitoring Feature

## Overview

The time-based monitoring feature extends the existing monitoring system to automatically detect and monitor XML requests that are located in the `TimeBase` folder, as well as REST API requests for JSON-based systems. These requests are executed with a configurable timeout, and alerts are sent if the requests don't complete within the specified time period.

## How It Works

1. **Automatic Detection**: The system automatically detects XML requests that are located in the `src/main/resources/requestXMLs/mdwc/TimeBase/` folder and JSON requests for JSON-based systems.

2. **Timeout Configuration**: Each service can have a specific timeout configured, or it will use the default timeout from the configuration.

3. **Asynchronous Execution**: Requests are executed asynchronously with a timeout mechanism using `CompletableFuture`.

4. **Alert Generation**: If a request times out or fails, it generates an alert that is included in the regular monitoring reports (email, SMS, Slack).

## Configuration

### Time-Based Monitoring Properties

Add the following configuration to your `application-*.yaml` files:

```yaml
time-based-monitoring:
  enabled: true
  default-timeout-seconds: 30
```

- `enabled`: Enable or disable time-based monitoring globally
- `default-timeout-seconds`: Default timeout in seconds for requests that don't have a specific timeout configured

### Service Configuration

For services that should include time-based monitoring, add the `timeoutSeconds` property:

```yaml
sanity-app:
  services:
    - { name: mdwc_prod1, type: mdwc, url: "http://example.com/", requests: [ CheckConnections,MeMDWC_GetLimit ], timeoutSeconds: 60 }
```

- `timeoutSeconds`: Specific timeout for this service (overrides the default)

## File Structure

### XML-based Time-based Requests
Time-based XML requests should be placed in:
```
src/main/resources/requestXMLs/mdwc/TimeBase/
```

Example:
```
src/main/resources/requestXMLs/mdwc/TimeBase/MeMDWC_GetLimit.xml
```

### JSON-based Requests
JSON-based requests should be placed in:
```
src/main/resources/requestXMLs/{system-type}/
```

Example:
```
src/main/resources/requestXMLs/teddk/sanity.json
```

## Alert Messages

When a time-based request fails, the following types of alerts are generated:

1. **Timeout Alert**: "Request timed out after X seconds"
2. **Execution Error**: "Error executing time-based request: [error message]"
3. **Validation Failure**: "Request failed validation within X seconds"
4. **JSON Response Error**: "JSON response does not indicate success"

## Integration

The time-based monitoring is integrated into the existing monitoring system:

- **ScheduledSanity**: Automatically includes time-based monitoring results in the scheduled checks
- **Email Alerts**: Time-based failures are included in email reports
- **SMS Alerts**: Time-based failures are included in SMS alerts
- **Slack Integration**: Time-based failures can be sent to Slack
- **JSON Monitoring**: Generic JSON monitoring for REST API-based systems

## Example Configuration

### Test Environment
```yaml
time-based-monitoring:
  enabled: true
  default-timeout-seconds: 30

sanity-app:
  services:
    - { name: mdwc_at, type: mdwc, url: "http://test-server:7082/", requests: [ CheckConnections,MeMDWC_GetLimit ], timeoutSeconds: 45 }
    - { name: teddk_test, type: teddk, url: "https://test.teddk.telia.dk", requests: [ sanity ], timeoutSeconds: 30 }
```

### Production Environment
```yaml
time-based-monitoring:
  enabled: true
  default-timeout-seconds: 45

sanity-app:
  services:
    - { name: mdwc_prod1, type: mdwc, url: "http://prod-server:7022/", requests: [ CheckConnections,MeMDWC_GetLimit ], timeoutSeconds: 60 }
    - { name: teddk_prod, type: teddk, url: "https://prod.teddk.telia.dk", requests: [ sanity ], timeoutSeconds: 45 }
```

## Monitoring

The time-based monitoring results are included in the regular monitoring reports with separate sections:

- **HTML Reports**: Includes "Time-Based Monitoring" and "JSON Monitoring" sections with detailed information
- **Plain Text Reports**: Includes time-based and JSON monitoring results in the text format
- **Logging**: All time-based monitoring activities are logged with appropriate log levels

## Troubleshooting

1. **Request Not Detected**: Ensure the XML file is in the correct `TimeBase` folder or JSON file is in the correct system folder
2. **Timeout Issues**: Adjust the `timeoutSeconds` configuration based on your requirements
3. **Configuration Issues**: Verify the `time-based-monitoring.enabled` property is set to `true`
4. **Resource Issues**: Check that the XML/JSON files are properly accessible in the classpath
5. **JSON System Type**: Ensure the system type is configured as a JSON-based system (e.g., "teddk", "json")
