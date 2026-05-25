# LM Studio Clustering Guide

**Turn multiple LM Studio instances into a production-ready LLM cluster**

---

## Overview

FinSavvyAI's cluster manager enables you to:
- ✅ Run LM Studio across multiple machines
- ✅ Auto-discover instances on your network
- ✅ Load balance requests across nodes
- ✅ Automatically failover when nodes go down
- ✅ Monitor cluster health in real-time

---

## Quick Start

### Prerequisites

1. **Multiple machines** running LM Studio
2. **FinSavvyAI installed** on each machine
3. **Network connectivity** between all machines

### Step 1: Start LM Studio on Each Machine

**Machine A (192.168.1.100):**
```bash
# Start LM Studio
# Load a model (e.g., Llama 3)
# Enable API Server: Settings → Developer → Enable API Server
```

**Machine B (192.168.1.101):**
```bash
# Start LM Studio
# Load a model (e.g., Mistral)
# Enable API Server
```

**Machine C (192.168.1.102):**
```bash
# Start LM Studio
# Load a model (e.g., Gemma)
# Enable API Server
```

### Step 2: Start FinSavvyAI Workers

On each machine, start a FinSavvyAI worker:

```bash
# Machine A
python -m src.workers.worker_node \
  --worker-id worker-a \
  --provider lmstudio \
  --base-url http://192.168.1.100:1234

# Machine B
python -m src.workers.worker_node \
  --worker-id worker-b \
  --provider lmstudio \
  --base-url http://192.168.1.101:1234

# Machine C
python -m src.workers.worker_node \
  --worker-id worker-c \
  --provider lmstudio \
  --base-url http://192.168.1.102:1234
```

### Step 3: Start Cluster Manager

On any machine (or a dedicated server):

```bash
python -m src.cluster.manager
```

The cluster manager will:
1. Auto-discover all LM Studio instances
2. Register them as cluster nodes
3. Begin health monitoring
4. Aggregate available models

### Step 4: Start API Gateway

```bash
python -m src.api.gateway
```

### Step 5: Use the Cluster

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="any",
)

# FinSavvyAI automatically load balances across nodes
response = client.chat.completions.create(
    model="lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
    messages=[{"role": "user", "content": "Hello from the cluster!"}],
)

print(response.choices[0].message.content)
```

---

## Cluster Management API

### Get Cluster Status

```bash
curl http://localhost:8080/api/cluster/status
```

Response:
```json
{
  "cluster_name": "default",
  "status": "healthy",
  "stats": {
    "total_nodes": 3,
    "online_nodes": 3,
    "offline_nodes": 0,
    "total_models": 6,
    "total_requests": 127,
    "total_errors": 2
  },
  "nodes": [
    {
      "node_id": "192.168.1.100:1234",
      "name": "LM Studio at 192.168.1.100",
      "host": "192.168.1.100",
      "port": 1234,
      "status": "online",
      "models": ["lmstudio/Meta-Llama-3-8B-Instruct-GGUF"],
      "request_count": 45,
      "error_count": 0,
      "last_heartbeat": "2026-03-06T12:34:56"
    }
  ]
}
```

### List All Nodes

```bash
curl http://localhost:8080/api/cluster/nodes
```

### List All Available Models

```bash
curl http://localhost:8080/api/cluster/models
```

Response:
```json
{
  "models": [
    "lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
    "lmstudio/Mistral-7B-Instruct-v0.3-GGUF",
    "lmstudio/gemma-7b-it"
  ]
}
```

### Trigger Discovery

```bash
curl -X POST http://localhost:8080/api/cluster/discover
```

### Remove a Node

```bash
curl -X DELETE http://localhost:8080/api/cluster/nodes/192.168.1.100:1234
```

---

## Load Balancing

FinSavvyAI automatically load balances requests across nodes:

### Strategy: Least Connections

Requests are routed to the node with the fewest active requests for that model.

**Example:**
```
Request 1 → Node A (0 requests) ✓
Request 2 → Node B (0 requests) ✓
Request 3 → Node C (0 requests) ✓
Request 4 → Node A (1 request) ✓
Request 5 → Node B (1 request) ✓
```

### Automatic Failover

If a node goes down, requests automatically route to remaining nodes:

```
Request 1 → Node A (online) ✓
Request 2 → Node B (offline) → Node C (online) ✓
Request 3 → Node A (online) ✓
```

---

## Health Monitoring

The cluster manager monitors node health every 30 seconds:

### Health Checks

1. **HTTP GET** to `/v1/models` endpoint
2. **Status check:** 200 = healthy, other = unhealthy
3. **Error tracking:** Nodes with high error counts marked as degraded

### Node States

- **online:** Node is healthy and accepting requests
- **offline:** Node is unreachable
- **error:** Node is returning errors
- **loading:** Node is starting up

### Automatic Recovery

Nodes that come back online are automatically reintegrated into the cluster.

---

## Discovery Methods

### mDNS/Bonjour (Recommended)

Automatically discovers LM Studio instances broadcasting on the local network.

**Requirements:**
```bash
pip install zeroconf
```

**Usage:**
```python
from src.discovery import LMStudioDiscovery

discovery = LMStudioDiscovery()
instances = await discovery.discover(timeout=5)
```

### Network Scanning (Fallback)

Scans IP range for LM Studio instances.

**Usage:**
```python
instances = await discovery.discover(
    timeout=5,
    scan_range="192.168.1.0/24"
)
```

**Note:** Scanning can take 1-2 minutes for a /24 network.

---

## Configuration

### Environment Variables

```bash
# Cluster manager
CLUSTER_NAME=my-production-cluster
CLUSTER_HEALTH_CHECK_INTERVAL=30  # seconds

# Discovery
DISCOVERY_METHOD=mdns  # or "scan"
DISCOVERY_TIMEOUT=5
DISCOVERY_SCAN_RANGE=192.168.1.0/24

# Load balancing
LOAD_BALANCER_STRATEGY=least_connections
LOAD_BALANCER_RETRY_COUNT=3
LOAD_BALANCER_RETRY_DELAY=1  # seconds
```

### Python Configuration

```python
from src.cluster.manager import ClusterManager

manager = ClusterManager(
    cluster_name="production",
    health_check_interval=30,
)
await manager.start()
```

---

## Monitoring

### Prometheus Metrics

FinSavvyAI exposes cluster metrics:

```bash
curl http://localhost:8080/metrics
```

**Metrics:**
```
finsavvyai_cluster_nodes_total{cluster="default"} 3
finsavvyai_cluster_nodes_online{cluster="default"} 3
finsavvyai_cluster_nodes_offline{cluster="default"} 0
finsavvyai_cluster_requests_total{node="192.168.1.100:1234"} 45
finsavvyai_cluster_errors_total{node="192.168.1.100:1234"} 0
```

### Grafana Dashboard

Import the cluster dashboard from `observability/grafana/cluster-dashboard.json`

---

## Production Deployment

### Docker Compose

```yaml
version: "3.8"

services:
  cluster-manager:
    image: finsavvyai:latest
    command: python -m src.cluster.manager
    environment:
      - CLUSTER_NAME=production
      - DISCOVERY_METHOD=mdns
    ports:
      - "8000:8000"
    restart: unless-stopped

  gateway:
    image: finsavvyai:latest
    command: python -m src.api.gateway
    environment:
      - FINSAVVYAI_MASTER_HOST=cluster-manager
    ports:
      - "8080:8080"
    depends_on:
      - cluster-manager
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: finsavvyai-cluster
spec:
  replicas: 1
  selector:
    matchLabels:
      app: finsavvyai-cluster
  template:
    metadata:
      labels:
        app: finsavvyai-cluster
    spec:
      containers:
      - name: cluster-manager
        image: finsavvyai:latest
        command: ["python", "-m", "src.cluster.manager"]
        env:
        - name: CLUSTER_NAME
          value: "production"
        ports:
        - containerPort: 8000
```

---

## Troubleshooting

### Nodes Not Discovered

**Problem:** Cluster manager doesn't find LM Studio instances

**Solutions:**
1. Check LM Studio is running on each machine
2. Verify API server is enabled (Settings → Developer → Enable API Server)
3. Ensure network connectivity between machines
4. Try manual network scan: `curl -X POST http://localhost:8080/api/cluster/discover`

### Nodes Show as Offline

**Problem:** Nodes discovered but marked as offline

**Solutions:**
1. Check LM Studio API server is running: `curl http://<host>:1234/v1/models`
2. Verify firewall isn't blocking connections
3. Check network latency: `ping <host>`
4. Review cluster manager logs for errors

### Requests Not Load Balanced

**Problem:** All requests go to one node

**Solutions:**
1. Verify nodes are online: `curl http://localhost:8080/api/cluster/nodes`
2. Check nodes have the requested model
3. Review load balancer logs
4. Ensure health checks are passing

### High Error Rate

**Problem:** Many requests failing

**Solutions:**
1. Check node health in cluster status
2. Review error logs from affected nodes
3. Verify models are loaded in LM Studio
4. Check resource usage (CPU/GPU) on nodes

---

## Best Practices

### Network
- Use wired connections for nodes (not WiFi)
- Ensure low latency between nodes (< 10ms)
- Use dedicated network for large clusters

### Resources
- Monitor GPU/CPU usage on nodes
- Add nodes when utilization > 80%
- Use heterogeneous hardware (mix of GPU/CPU)

### Reliability
- Run cluster manager on separate machine
- Use multiple gateways for high availability
- Implement backup DNS for service discovery

### Security
- Enable authentication in production
- Use TLS for inter-node communication
- Restrict cluster API to trusted IPs
- Monitor audit logs

---

## Next Steps

1. **Scale Out:** Add more nodes as needed
2. **Monitor:** Set up Grafana dashboards
3. **Automate:** Use Terraform/Ansible for deployment
4. **Optimize:** Tune load balancing strategy
5. **Document:** Create runbooks for operations

---

## Resources

- [Architecture Guide](./ARCHITECTURE.md)
- [LM Studio Integration](./LM_STUDIO_INTEGRATION.md)
- [Production Deployment](./DEPLOYMENT_RUNBOOK.md)
- [Observability](../observability/README.md)

---

**Need help?** Join our Discord or open a GitHub issue!
