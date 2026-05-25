# ⚙️ Configuration Guide

Complete guide to configuring FinSavvyAI.

---

## Configuration Methods

FinSavvyAI supports multiple configuration methods:

1. **Configuration File** - `~/.finsavvyai/cluster-config.json`
2. **Environment Variables** - Override file settings
3. **Command Line Arguments** - Override all settings

---

## Configuration File

Location: `~/.finsavvyai/cluster-config.json`

### Default Configuration

```json
{
  "master": {
    "host": null,
    "port": 8000,
    "cluster_id": "finsavvy-home-cluster"
  },
  "worker": {
    "default_port": 8001,
    "heartbeat_interval": 30,
    "max_load": 100,
    "default_models": ["gpt-3.5-turbo-sim"]
  },
  "logging": {
    "level": "INFO",
    "file": "logs/finsavvyai.log",
    "format": "json",
    "console": true
  },
  "api": {
    "timeout": 30,
    "max_retries": 3,
    "cors_enabled": true,
    "auth_enabled": false,
    "rate_limit_enabled": true,
    "rate_limit_requests": 100,
    "rate_limit_window": 60,
    "max_request_size": 10485760
  },
  "router": {
    "enabled": true,
    "default_speed_preference": "balanced"
  }
}
```

---

## Environment Variables

### Master Settings

```bash
export FINSAVVYAI_MASTER_HOST=0.0.0.0
export FINSAVVYAI_MASTER_PORT=8000
export FINSAVVYAI_CLUSTER_ID=my-cluster
```

### API Settings

```bash
export FINSAVVYAI_AUTH_ENABLED=true
export FINSAVVYAI_RATE_LIMIT_REQUESTS=100
export FINSAVVYAI_RATE_LIMIT_WINDOW=60
export FINSAVVYAI_GATEWAY_PORT=8080
```

### Logging Settings

```bash
export FINSAVVYAI_LOG_LEVEL=INFO
export FINSAVVYAI_LOG_FILE=logs/finsavvyai.log
```

---

## Configuration Options

### Master Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `master.host` | `null` (auto-detect) | Master server host |
| `master.port` | `8000` | Master server port |
| `master.cluster_id` | `finsavvy-home-cluster` | Cluster identifier |

### Worker Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `worker.default_port` | `8001` | Default worker port |
| `worker.heartbeat_interval` | `30` | Heartbeat interval (seconds) |
| `worker.max_load` | `100` | Maximum worker load |
| `worker.default_models` | `["gpt-3.5-turbo-sim"]` | Default models |

### API Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `api.timeout` | `30` | Request timeout (seconds) |
| `api.cors_enabled` | `true` | Enable CORS |
| `api.auth_enabled` | `false` | Enable API key authentication |
| `api.rate_limit_enabled` | `true` | Enable rate limiting |
| `api.rate_limit_requests` | `100` | Requests per window |
| `api.rate_limit_window` | `60` | Rate limit window (seconds) |
| `api.max_request_size` | `10485760` | Max request size (10MB) |

### Logging Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `logging.level` | `INFO` | Log level (DEBUG, INFO, WARNING, ERROR) |
| `logging.file` | `logs/finsavvyai.log` | Log file path |
| `logging.format` | `json` | Log format (json, text) |
| `logging.console` | `true` | Output to console |

---

## Production Configuration

### Recommended Settings

```json
{
  "api": {
    "auth_enabled": true,
    "rate_limit_enabled": true,
    "rate_limit_requests": 1000,
    "rate_limit_window": 60,
    "max_request_size": 10485760
  },
  "logging": {
    "level": "INFO",
    "format": "json"
  }
}
```

---

## Validation

Configuration is validated on startup. Invalid values will use defaults and log warnings.

---

## See Also

- [Deployment Guide](DEPLOYMENT.md)
- [Troubleshooting](TROUBLESHOOTING.md)

