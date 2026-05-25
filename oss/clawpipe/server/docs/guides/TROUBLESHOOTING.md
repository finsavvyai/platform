# 🔧 Troubleshooting Guide

Common issues and solutions for FinSavvyAI.

---

## Services Not Starting

### Port Already in Use

**Error**: `Address already in use`

**Solution**:
```bash
# Find process using port
lsof -i :8000
lsof -i :8001
lsof -i :8080

# Kill process or change port
kill -9 <PID>
# Or
export FINSAVVYAI_GATEWAY_PORT=8081
```

### Permission Denied

**Error**: `Permission denied`

**Solution**:
```bash
# Check file permissions
chmod +x deploy_production.sh
chmod +x start_*.sh

# Or run with sudo (if needed)
sudo ./deploy_production.sh
```

---

## Workers Not Registering

### Master Not Running

**Symptom**: Worker can't connect to master

**Solution**:
```bash
# Check master is running
curl http://localhost:8000/health

# Start master if not running
./start_master.sh
```

### Network Issues

**Symptom**: Connection timeout

**Solution**:
```bash
# Check network connectivity
ping <master-ip>

# Check firewall
sudo ufw status
sudo ufw allow 8000/tcp
```

### Wrong Master Address

**Symptom**: Worker connects to wrong master

**Solution**:
```bash
# Specify correct master address
python3 src/workers/worker_node.py --master <correct-ip>
```

---

## API Gateway Issues

### 500 Errors

**Symptom**: Gateway returns 500 errors

**Solution**:
```bash
# Check gateway logs
tail -f logs/gateway.log

# Check worker status
curl http://localhost:8001/health

# Restart gateway
./stop.sh
./deploy_production.sh
```

### Circuit Breaker Open

**Symptom**: 503 Service Unavailable

**Solution**:
```bash
# Check circuit breaker status
curl http://localhost:8080/ | jq .circuit_breakers

# Wait for timeout or restart worker
```

---

## Performance Issues

### Slow Responses

**Symptom**: Requests taking too long

**Solution**:
```bash
# Check metrics
curl http://localhost:8080/metrics

# Check worker load
curl http://localhost:8001/health

# Add more workers
python3 src/workers/worker_node.py --master localhost --port 8002
```

### High Memory Usage

**Symptom**: System running out of memory

**Solution**:
```bash
# Check memory usage
ps aux | grep python

# Reduce request queue size
# Edit config: api.queue_max_size
```

---

## Authentication Issues

### API Key Not Working

**Symptom**: 401 Unauthorized

**Solution**:
```bash
# Check auth is enabled
echo $FINSAVVYAI_AUTH_ENABLED

# Generate new key
python3 scripts/manage_api_keys.py generate --name test

# Use correct header
curl -H "X-API-Key: finsavvy-..." http://localhost:8080/v1/models
```

---

## Logging Issues

### No Logs

**Symptom**: Logs not appearing

**Solution**:
```bash
# Check log directory exists
mkdir -p logs

# Check permissions
chmod 755 logs/

# Check config
cat ~/.finsavvyai/cluster-config.json | grep log
```

### Too Many Logs

**Symptom**: Logs filling up disk

**Solution**:
```bash
# Set log level
export FINSAVVYAI_LOG_LEVEL=WARNING

# Or configure log rotation
# Use systemd or logrotate
```

---

## Configuration Issues

### Config Not Loading

**Symptom**: Default values used instead of config

**Solution**:
```bash
# Check config file exists
ls -la ~/.finsavvyai/cluster-config.json

# Check JSON is valid
python3 -m json.tool ~/.finsavvyai/cluster-config.json

# Check permissions
chmod 644 ~/.finsavvyai/cluster-config.json
```

---

## Getting Help

If you're still experiencing issues:

1. Check logs: `tail -f logs/*.log`
2. Check status: `./status.sh`
3. Review documentation
4. Open an issue on GitHub

---

## See Also

- [Deployment Guide](DEPLOYMENT.md)
- [Configuration Guide](CONFIGURATION.md)
- [Architecture](../ARCHITECTURE.md)

