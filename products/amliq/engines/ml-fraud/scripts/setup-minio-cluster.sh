#!/bin/bash

# QuantumBeam.io - MinIO Cluster Setup Script
# This script sets up a production-ready MinIO cluster with high availability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MINIO_VERSION="RELEASE.2024-01-16T16-07-38Z"
MINIO_BASE_DIR="/opt/minio"
MINIO_CONFIG_DIR="/etc/minio"
MINIO_DATA_DIR="/var/lib/minio"
MINIO_LOG_DIR="/var/log/minio"
MINIO_USER="minio"
MINIO_GROUP="minio"

# Cluster configuration
MINIO_NODES=("minio-1" "minio-2" "minio-3" "minio-4")
MINIO_PORTS=("9000" "9001" "9002" "9003")
MINIO_CONSOLE_PORTS=("9001" "9002" "9003" "9004")

# Access configuration
MINIO_ROOT_USER="quantumbeamadmin"
MINIO_ROOT_PASSWORD="quantumbeam_minio_$(openssl rand -hex 16)"
MINIO_REGION="us-east-1"

# Storage configuration
DRIVE_COUNT=4
DRIVE_SIZE="100G"
PARITY_COUNT=2
ERASURE_CODE_COUNT=4

echo -e "${BLUE}🚀 QuantumBeam.io - MinIO Cluster Setup${NC}"
echo -e "${BLUE}=====================================${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    if command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y \
            wget \
            curl \
            gnupg \
            software-properties-common \
            adduser \
            systemd \
            ca-certificates \
            parted \
            lvm2
    elif command -v yum >/dev/null 2>&1; then
        yum update -y
        yum install -y \
            wget \
            curl \
            gnupg \
            systemd \
            ca-certificates \
            parted \
            lvm2
    else
        print_error "Unsupported package manager. Please install dependencies manually."
        exit 1
    fi
}

# Create MinIO user and group
create_minio_user() {
    print_status "Creating MinIO user and group..."

    if ! getent group $MINIO_GROUP >/dev/null 2>&1; then
        groupadd --system $MINIO_GROUP
    fi

    if ! getent passwd $MINIO_USER >/dev/null 2>&1; then
        useradd --system --group --home-dir $MINIO_DATA_DIR --shell /usr/sbin/nologin $MINIO_USER
    fi
}

# Create directories
create_directories() {
    print_status "Creating MinIO directories..."

    mkdir -p $MINIO_BASE_DIR
    mkdir -p $MINIO_CONFIG_DIR
    mkdir -p $MINIO_LOG_DIR
    mkdir -p /var/run/minio

    # Create data directories for each node
    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        node_data_dir="$MINIO_DATA_DIR/$node"
        mkdir -p "$node_data_dir"

        # Create individual drive directories
        for ((j=1; j<=DRIVE_COUNT; j++)); do
            mkdir -p "$node_data_dir/drive$j"
        done

        chown -R $MINIO_USER:$MINIO_GROUP "$node_data_dir"
        chmod 750 "$node_data_dir"
    done

    chown -R $MINIO_USER:$MINIO_GROUP $MINIO_LOG_DIR
    chown -R $MINIO_USER:$MINIO_GROUP /var/run/minio
    chmod 755 $MINIO_LOG_DIR
    chmod 755 /var/run/minio
}

# Download and install MinIO
install_minio() {
    print_status "Downloading and installing MinIO $MINIO_VERSION..."

    # Detect architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64)
            ARCH="arm64"
            ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac

    # Download MinIO server
    cd /tmp
    wget -O minio "https://dl.min.io/server/minio/release/linux-$ARCH/minio.$MINIO_VERSION"
    chmod +x minio
    mv minio $MINIO_BASE_DIR/

    # Download MinIO client
    wget -O mc "https://dl.min.io/client/mc/release/linux-$ARCH/mc.RELEASE.2023-12-23T07-38-18Z"
    chmod +x mc
    mv mc $MINIO_BASE_DIR/

    # Create symbolic links
    ln -sf $MINIO_BASE_DIR/minio /usr/local/bin/minio
    ln -sf $MINIO_BASE_DIR/mc /usr/local/bin/mc

    print_status "MinIO installed successfully"
}

# Generate MinIO configuration
generate_config() {
    print_status "Generating MinIO configuration..."

    cat > $MINIO_CONFIG_DIR/config.json << EOF
{
  "version": "1",
  "region": "$MINIO_REGION",
  "credential": {
    "accessKey": "$MINIO_ROOT_USER",
    "secretKey": "$MINIO_ROOT_PASSWORD"
  },
  "logger": {
    "console": {
      "enable": true,
      "level": "info"
    },
    "file": {
      "enable": true,
      "fileName": "$MINIO_LOG_DIR/minio.log",
      "level": "info"
    }
  },
  "notify": {
    "webhook": {
      "1": {
        "enable": true,
        "endpoint": "http://localhost:9000/api/v1/webhooks/minio"
      }
    }
  },
  "storage": {
    "name": "fs",
    "fs": {
      "path": "$MINIO_DATA_DIR"
    }
  },
  "compression": {
    "enable": true,
    "allow_encryption": true,
    "extensions": [".txt", ".log", ".csv", ".json", ".xml", ".yaml", ".yml", ".gz", ".zip"]
  },
  "cache": {
    "drives": ["/tmp/cache"],
    "expiry": 30,
    "maxuse": 80
  },
  "api": {
    "corsAllowOrigin": ["*"],
    "secureCORS": false
  },
  "browser": {
    "redirect": true,
    "loginBanner": "QuantumBeam.io - Object Storage Cluster"
  },
  "site": {
    "name": "QuantumBeam MinIO Cluster",
    "region": "$MINIO_REGION",
    "domain": "",
    "comment": "QuantumBeam.io Object Storage Cluster"
  },
  "monitoring": {
    "web": {
      "enable": true,
      "address": ":9000"
    },
    "prometheus": {
      "enable": true,
      "address": ":9000/metrics",
      "auth_type": "public"
    }
  },
  "heal": {
    "max_drives": 0,
    "max_objects": 0,
    "max_io_errors": 0
  },
  "scanner": {
    "delay": 10,
    "cycle": 24,
    "unit": "h"
  },
  "usage": {
    "batch_size": 1000,
    "delay": 2,
    "cycle": 24,
    "unit": "h"
  }
}
EOF

    chown $MINIO_USER:$MINIO_GROUP $MINIO_CONFIG_DIR/config.json
    chmod 640 $MINIO_CONFIG_DIR/config.json
}

# Create systemd services for cluster nodes
create_systemd_services() {
    print_status "Creating systemd services for MinIO cluster..."

    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        port="${MINIO_PORTS[$i]}"
        console_port="${MINIO_CONSOLE_PORTS[$i]}"
        node_data_dir="$MINIO_DATA_DIR/$node"

        # Build server addresses for erasure coding
        server_args=""
        for j in "${!MINIO_NODES[@]}"; do
            if [[ $j -eq $i ]]; then
                # Local node - include all drives
                drives=""
                for ((k=1; k<=DRIVE_COUNT; k++)); do
                    drives="$drives http://localhost:$port/data/node$i/drive$k"
                done
                server_args="$server_args $drives"
            else
                # Remote node
                remote_port="${MINIO_PORTS[$j]}"
                remote_node="${MINIO_NODES[$j]}"
                server_args="$server_args http://$remote_node:$remote_port/data/$remote_node"
            fi
        done

        cat > /etc/systemd/system/minio-$node.service << EOF
[Unit]
Description=MinIO Cluster Node $node
Documentation=https://docs.min.io/
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=$MINIO_BASE_DIR/minio

[Service]
WorkingDirectory=$MINIO_BASE_DIR/

User=$MINIO_USER
Group=$MINIO_GROUP

ProtectProc=invisible
ProcSubset=pid
ProtectSystem=full
ProtectClock=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=true
SystemCallFilter=@system-call
SystemCallErrorNumber=EPERM
SystemCallArchitectures=native

TasksMax=infinity
TimeoutStartSec=infinity
TimeoutStopSec=infinity

ExecStartPre=/bin/bash -c "if [ -z \"\${MINIO_ROOT_USER}\" ] || [ -z \"\${MINIO_ROOT_PASSWORD}\" ]; then echo \"MinIO access credentials not set\"; exit 1; fi"
ExecStart=$MINIO_BASE_DIR/minio server $server_args --console-address ":$console_port"

# Let systemd restart this service always
Restart=always

# Specifies the maximum file descriptor number that can be opened by this process
LimitNOFILE=65536

# Specifies the maximum number of threads this process can create
TasksMax=infinity

# Disable timeout logic and wait until process is stopped
TimeoutStopSec=infinity

[Install]
WantedBy=multi-user.target
EOF

        # Create environment file for this node
        cat > $MINIO_CONFIG_DIR/$node.env << EOF
# MinIO environment configuration for node $node
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_REGION=$MINIO_REGION
MINIO_BROWSER_REDIRECT_URL=http://localhost:$console_port
MINIO_SERVER_URL=http://localhost:$port
MINIO_STORAGE_CLASS_STANDARD=EC:$ERASURE_CODE_COUNT
MINIO_ERASURE_SET_DRIVE_COUNT=$DRIVE_COUNT
MINIO_VOLUMES=$server_args
MINIO_OPTS="--config-dir $MINIO_CONFIG_DIR --address :$port --console-address :$console_port"
EOF

        chown $MINIO_USER:$MINIO_GROUP $MINIO_CONFIG_DIR/$node.env
        chmod 640 $MINIO_CONFIG_DIR/$node.env

        systemctl daemon-reload
        systemctl enable minio-$node
    done
}

# Initialize MinIO cluster
initialize_cluster() {
    print_status "Initializing MinIO cluster..."

    # Start all nodes
    for node in "${MINIO_NODES[@]}"; do
        systemctl start minio-$node
        print_status "Started $node"
        sleep 2
    done

    # Wait for cluster to be ready
    print_status "Waiting for MinIO cluster to be ready..."
    sleep 30

    # Check if first node is responding
    for i in {1..30}; do
        if curl -s http://localhost:${MINIO_PORTS[0]}/minio/health/live >/dev/null 2>&1; then
            print_status "MinIO cluster is ready"
            break
        fi
        sleep 2
    done

    # Configure client
    export MC_HOST_cluster1="http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@localhost:${MINIO_PORTS[0]}"

    # Create initial buckets
    buckets=(
        "quantumbeam-documents"
        "quantumbeam-models"
        "quantumbeam-backups"
        "quantumbeam-logs"
        "quantumbeam-temp"
        "fraud-reports"
        "ml-models"
        "quantum-models"
        "audit-logs"
        "user-data"
    )

    for bucket in "${buckets[@]}"; do
        if mc mb cluster1/$bucket >/dev/null 2>&1; then
            print_status "Created bucket: $bucket"
        else
            print_warning "Bucket $bucket may already exist or failed to create"
        fi
    done

    # Set bucket policies
    print_status "Setting up bucket policies..."

    # Public read policy for documents bucket
    mc anonymous set download cluster1/quantumbeam-documents 2>/dev/null || true

    # Set up bucket lifecycle policies
    mc ilm rule add cluster1/quantumbeam-temp --expire-days 7 2>/dev/null || true
    mc ilm rule add cluster1/quantumbeam-logs --expire-days 90 2>/dev/null || true
    mc ilm rule add cluster1/quantumbeam-backups --expire-days 365 2>/dev/null || true
}

# Setup monitoring
setup_monitoring() {
    print_status "Setting up MinIO monitoring..."

    # Create Prometheus configuration
    cat > $MINIO_CONFIG_DIR/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "minio_rules.yml"

scrape_configs:
  - job_name: 'minio-cluster'
    static_configs:
EOF

    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        port="${MINIO_PORTS[$i]}"
        cat >> $MINIO_CONFIG_DIR/prometheus.yml << EOF
      - targets: ['localhost:$port']
        labels:
          instance: '$node'
EOF
    done

    # Create Prometheus rules
    cat > $MINIO_CONFIG_DIR/minio_rules.yml << EOF
groups:
  - name: minio.rules
    rules:
      - alert: MinIODown
        expr: up{job="minio-cluster"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MinIO node {{ \$labels.instance }} is down"
          description: "MinIO node {{ \$labels.instance }} has been down for more than 1 minute."

      - alert: MinIODiskSpaceLow
        expr: minio_disk_free_bytes / minio_disk_total_bytes < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "MinIO node {{ \$labels.instance }} disk space low"
          description: "MinIO node {{ \$labels.instance }} has less than 10% free disk space."
EOF

    chown $MINIO_USER:$MINIO_GROUP $MINIO_CONFIG_DIR/prometheus.yml
    chown $MINIO_USER:$MINIO_GROUP $MINIO_CONFIG_DIR/minio_rules.yml
    chmod 644 $MINIO_CONFIG_DIR/prometheus.yml
    chmod 644 $MINIO_CONFIG_DIR/minio_rules.yml
}

# Setup log rotation
setup_log_rotation() {
    print_status "Setting up log rotation..."

    cat > /etc/logrotate.d/minio << EOF
$MINIO_LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $MINIO_USER $MINIO_GROUP
    postrotate
        systemctl reload minio-1 >/dev/null 2>&1 || true
        systemctl reload minio-2 >/dev/null 2>&1 || true
        systemctl reload minio-3 >/dev/null 2>&1 || true
        systemctl reload minio-4 >/dev/null 2>&1 || true
    endscript
}
EOF

    chmod 644 /etc/logrotate.d/minio
}

# Create management scripts
create_management_scripts() {
    print_status "Creating management scripts..."

    # Cluster status script
    cat > /usr/local/bin/minio-cluster-status << 'EOF'
#!/bin/bash

echo "MinIO Cluster Status"
echo "====================="

nodes=("minio-1" "minio-2" "minio-3" "minio-4")
ports=("9000" "9001" "9002" "9003")

for i in "${!nodes[@]}"; do
    node="${nodes[$i]}"
    port="${ports[$i]}"

    echo "Node: $node (Port: $port)"
    if systemctl is-active --quiet minio-$node; then
        echo "  Status: Running"
        if curl -s http://localhost:$port/minio/health/live >/dev/null 2>&1; then
            echo "  Health: Healthy"
        else
            echo "  Health: Unhealthy"
        fi
    else
        echo "  Status: Stopped"
    fi
    echo ""
done
EOF

    # Cluster restart script
    cat > /usr/local/bin/minio-cluster-restart << 'EOF'
#!/bin/bash

echo "Restarting MinIO cluster..."

nodes=("minio-1" "minio-2" "minio-3" "minio-4")

for node in "${nodes[@]}"; do
    echo "Restarting $node..."
    systemctl restart minio-$node
    sleep 2
done

echo "Cluster restart completed"
EOF

    # Cluster backup script
    cat > /usr/local/bin/minio-cluster-backup << 'EOF'
#!/bin/bash

BACKUP_DIR="/backup/minio/$(date +%Y%m%d_%H%M%S)"
MINIO_DATA_DIR="/var/lib/minio"

mkdir -p "$BACKUP_DIR"

echo "Creating MinIO cluster backup to $BACKUP_DIR..."

# Stop MinIO services
nodes=("minio-1" "minio-2" "minio-3" "minio-4")
for node in "${nodes[@]}"; do
    systemctl stop minio-$node
done

# Backup data
for node in "${nodes[@]}"; do
    if [[ -d "$MINIO_DATA_DIR/$node" ]]; then
        cp -r "$MINIO_DATA_DIR/$node" "$BACKUP_DIR/"
    fi
done

# Backup configuration
cp -r /etc/minio "$BACKUP_DIR/"

# Start MinIO services
for node in "${nodes[@]}"; do
    systemctl start minio-$node
done

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"

# Clean up old backups (keep last 7 days)
find /backup/minio -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR.tar.gz"
EOF

    # Heal cluster script
    cat > /usr/local/bin/minio-cluster-heal << 'EOF'
#!/bin/bash

echo "Starting MinIO cluster heal..."

export MC_HOST_cluster1="http://quantumbeamadmin:$(cat /etc/minio/minio-1.env | grep MINIO_ROOT_PASSWORD | cut -d'=' -f2)@localhost:9000"

# Heal the entire cluster
mc admin heal cluster1/ --recursive

echo "Cluster heal initiated. Monitor progress with 'mc admin heal cluster1/'"
EOF

    chmod +x /usr/local/bin/minio-cluster-*
}

# Setup firewall rules
setup_firewall() {
    print_status "Setting up firewall rules..."

    if command -v ufw >/dev/null 2>&1; then
        for port in "${MINIO_PORTS[@]}" "${MINIO_CONSOLE_PORTS[@]}"; do
            ufw allow $port/tcp comment "MinIO Cluster"
        done
        ufw --force enable
    elif command -v firewall-cmd >/dev/null 2>&1; then
        for port in "${MINIO_PORTS[@]}" "${MINIO_CONSOLE_PORTS[@]}"; do
            firewall-cmd --permanent --add-port=$port/tcp
        done
        firewall-cmd --reload
    else
        print_warning "No firewall manager found. Please configure firewall manually."
    fi
}

# Display setup information
display_info() {
    print_status "MinIO cluster setup completed successfully!"
    echo ""
    echo -e "${GREEN}Cluster Configuration:${NC}"
    echo "MinIO Version: $MINIO_VERSION"
    echo "Cluster Nodes: ${#MINIO_NODES[@]}"
    echo "Drives per Node: $DRIVE_COUNT"
    echo "Erasure Code: $ERASURE_CODE_COUNT"
    echo "Parity: $PARITY_COUNT"
    echo "Region: $MINIO_REGION"
    echo ""
    echo -e "${GREEN}Access Information:${NC}"
    echo "Root User: $MINIO_ROOT_USER"
    echo "Root Password: $MINIO_ROOT_PASSWORD"
    echo ""
    echo -e "${GREEN}Node URLs:${NC}"
    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        port="${MINIO_PORTS[$i]}"
        console_port="${MINIO_CONSOLE_PORTS[$i]}"
        echo "  $node: API http://localhost:$port, Console http://localhost:$console_port"
    done
    echo ""
    echo -e "${GREEN}Management Commands:${NC}"
    echo "  Check status: minio-cluster-status"
    echo "  Restart cluster: minio-cluster-restart"
    echo "  Create backup: minio-cluster-backup"
    echo "  Heal cluster: minio-cluster-heal"
    echo ""
    echo -e "${YELLOW}Important Notes:${NC}"
    echo "1. Save the root credentials securely"
    echo "2. Configure proper firewall rules for production"
    echo "3. Set up automated monitoring and alerting"
    echo "4. Regularly test cluster healing procedures"
    echo "5. Implement proper backup strategies"
    echo "6. Monitor disk usage and plan capacity accordingly"
    echo "7. Configure proper IAM policies for bucket access"
    echo "8. Set up lifecycle policies for data retention"
}

# Main execution
main() {
    check_root
    install_dependencies
    create_minio_user
    create_directories
    install_minio
    generate_config
    create_systemd_services
    initialize_cluster
    setup_monitoring
    setup_log_rotation
    create_management_scripts
    setup_firewall
    display_info

    print_status "MinIO cluster setup completed successfully!"
}

# Run main function
main "$@"