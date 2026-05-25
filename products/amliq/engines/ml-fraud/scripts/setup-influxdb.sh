#!/bin/bash

# QuantumBeam.io - InfluxDB Setup Script
# This script sets up InfluxDB 2.x for production time-series analytics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INFLUXDB_VERSION="2.7"
INFLUXDB_BASE_DIR="/opt/influxdb"
INFLUXDB_CONFIG_DIR="/etc/influxdb2"
INFLUXDB_DATA_DIR="/var/lib/influxdb2"
INFLUXDB_LOG_DIR="/var/log/influxdb2"
INFLUXDB_USER="influxdb"
INFLUXDB_GROUP="influxdb"

# Default organization and bucket settings
ORG_NAME="quantumbeam"
ADMIN_USER="admin"
ADMIN_PASSWORD="quantumbeam_admin_2024"
ADMIN_TOKEN="quantumbeam_admin_token_$(date +%s)"
DEFAULT_BUCKET="metrics"
RETENTION_POLICY="30d"

echo -e "${BLUE}🚀 QuantumBeam.io - InfluxDB Setup${NC}"
echo -e "${BLUE}==================================${NC}"

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
            ca-certificates
    elif command -v yum >/dev/null 2>&1; then
        yum update -y
        yum install -y \
            wget \
            curl \
            gnupg \
            systemd \
            ca-certificates
    else
        print_error "Unsupported package manager. Please install dependencies manually."
        exit 1
    fi
}

# Create InfluxDB user and group
create_influxdb_user() {
    print_status "Creating InfluxDB user and group..."

    if ! getent group $INFLUXDB_GROUP >/dev/null 2>&1; then
        groupadd --system $INFLUXDB_GROUP
    fi

    if ! getent passwd $INFLUXDB_USER >/dev/null 2>&1; then
        useradd --system --group --home-dir $INFLUXDB_DATA_DIR --shell /usr/sbin/nologin $INFLUXDB_USER
    fi
}

# Create directories
create_directories() {
    print_status "Creating InfluxDB directories..."

    mkdir -p $INFLUXDB_BASE_DIR
    mkdir -p $INFLUXDB_CONFIG_DIR
    mkdir -p $INFLUXDB_DATA_DIR
    mkdir -p $INFLUXDB_LOG_DIR
    mkdir -p /var/run/influxdb

    chown -R $INFLUXDB_USER:$INFLUXDB_GROUP $INFLUXDB_DATA_DIR
    chown -R $INFLUXDB_USER:$INFLUXDB_GROUP $INFLUXDB_LOG_DIR
    chown -R $INFLUXDB_USER:$INFLUXDB_GROUP /var/run/influxdb
    chmod 755 $INFLUXDB_DATA_DIR
    chmod 755 $INFLUXDB_LOG_DIR
    chmod 755 /var/run/influxdb
}

# Download and install InfluxDB
install_influxdb() {
    print_status "Downloading and installing InfluxDB $INFLUXDB_VERSION..."

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

    # Download InfluxDB
    cd /tmp
    wget -O influxdb2.tar.gz "https://dl.influxdata.com/influxdb/releases/influxdb2-${INFLUXDB_VERSION}-linux-${ARCH}.tar.gz"

    # Extract
    tar -xzf influxdb2.tar.gz
    cd "influxdb2_linux_${ARCH}/"

    # Copy binaries
    cp usr/bin/* $INFLUXDB_BASE_DIR/bin/
    mkdir -p $INFLUXDB_BASE_DIR/bin
    cp usr/bin/* $INFLUXDB_BASE_DIR/bin/
    cp -r etc/* $INFLUXDB_CONFIG_DIR/
    cp -r usr/share/* $INFLUXDB_BASE_DIR/share/

    # Create symbolic links
    ln -sf $INFLUXDB_BASE_DIR/bin/influxd /usr/local/bin/influxd
    ln -sf $INFLUXDB_BASE_DIR/bin/influx /usr/local/bin/influx

    # Clean up
    rm -rf /tmp/influxdb2_linux_${ARCH}
    rm -f /tmp/influxdb2.tar.gz

    print_status "InfluxDB installed successfully"
}

# Generate InfluxDB configuration
generate_config() {
    print_status "Generating InfluxDB configuration..."

    cat > $INFLUXDB_CONFIG_DIR/influxdb.conf << EOF
# QuantumBeam.io - InfluxDB Configuration
# Generated on $(date)

[coordinator]
  write-timeout = "30s"
  max-concurrent-queries = 0
  query-timeout = "0s"
  max-select-point = 0
  max-select-series = 0
  max-select-buckets = 0

[data]
  dir = "$INFLUXDB_DATA_DIR/engine/data"
  wal-dir = "$INFLUXDB_DATA_DIR/engine/wal"
  cache-snapshot-memory-size = "256m"
  cache-snapshot-write-cold-duration = "10m"
  compact-full-write-cold-duration = "4h"
  max-series-per-database = 10000000
  max-values-per-tag = 10000000
  max-index-bytes = "10485760"
  max-concurrent-compactions = 4
  max-concurrent-queries = 64
  query-timeout = "0s"
  log-queries-after = "1s"
  trace-logging-enabled = false

[retention]
  enabled = true
  check-interval = "30m"

[shard-precreation]
  enabled = true
  advance-period = "30m"

[monitor]
  store-enabled = true
  store-database = "internal"
  store-interval = "10s"

[http]
  enabled = true
  bind-address = ":8086"
  auth-enabled = false
  log-enabled = true
  max-body-size = "25m"
  max-concurrent-connections = 0
  max-connection-limit = 25
  shared-secret = ""
  realm = "InfluxDB"
  max-body-size = 25000000
  access-log-path = "$INFLUXDB_LOG_DIR/access.log"
  pprof-enabled = true
  pprof-auth-enabled = false

[logging]
  level = "info"
  query-log-enabled = true
  suppress-logo = false
  format = "auto"

[continuous_queries]
  log-enabled = true
  query-stats-enabled = false
  run-interval = "1s"

[hinted-handoff]
  enabled = true
  dir = "$INFLUXDB_DATA_DIR/hh"
  max-size = 1073741824
  max-age = "168h"
  retry-convergence-interval = "1m"
  retry-rate-limit = 0
  retry-interval = "1s"
  retry-max-interval = "1m"
  purge-interval = "1h"
  retry-batch-size = 1048576
EOF

    chown $INFLUXDB_USER:$INFLUXDB_GROUP $INFLUXDB_CONFIG_DIR/influxdb.conf
    chmod 640 $INFLUXDB_CONFIG_DIR/influxdb.conf
}

# Create systemd service
create_systemd_service() {
    print_status "Creating systemd service for InfluxDB..."

    cat > /etc/systemd/system/influxdb.service << EOF
[Unit]
Description=InfluxDB 2.x service
Documentation=https://docs.influxdata.com/influxdb/
After=network-online.target

[Service]
User=$INFLUXDB_USER
Group=$INFLUXDB_GROUP

LimitNOFILE=1048576
LimitNPROC=infinity

EnvironmentFile=-$INFLUXDB_CONFIG_DIR/influxdb.env
ExecStart=$INFLUXDB_BASE_DIR/bin/influxd \$INFLUXD_OPTS
KillMode=control-group
Restart=on-failure
RestartSec=5
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
EOF

    # Create environment file
    cat > $INFLUXDB_CONFIG_DIR/influxdb.env << EOF
# InfluxDB environment configuration
INFLUXD_CONFIG_PATH=$INFLUXDB_CONFIG_DIR/influxdb.conf
INFLUXD_ENGINE_PATH=$INFLUXDB_DATA_DIR/engine
INFLUXD_BOLT_PATH=$INFLUXDB_DATA_DIR/influxd.bolt
INFLUXD_META_DIR=$INFLUXDB_DATA_DIR/meta
INFLUXD_DATA_DIR=$INFLUXDB_DATA_DIR/data
INFLUXD_LOGS_PATH=$INFLUXDB_LOG_DIR
INFLUXD_HTTP_BIND_ADDRESS=:8086
INFLUXD_REPORTING_DISABLED=false
EOF

    chown $INFLUXDB_USER:$INFLUXDB_GROUP $INFLUXDB_CONFIG_DIR/influxdb.env
    chmod 640 $INFLUXDB_CONFIG_DIR/influxdb.env

    systemctl daemon-reload
    systemctl enable influxdb
}

# Initialize InfluxDB
initialize_influxdb() {
    print_status "Initializing InfluxDB..."

    # Start InfluxDB
    systemctl start influxdb

    # Wait for InfluxDB to be ready
    print_status "Waiting for InfluxDB to start..."
    sleep 10

    # Check if InfluxDB is running
    if ! systemctl is-active --quiet influxdb; then
        print_error "Failed to start InfluxDB"
        journalctl -u influxdb --no-pager
        exit 1
    fi

    # Setup initial configuration
    print_status "Creating initial organization, user, and bucket..."

    # Check if already initialized
    if [[ -f "$INFLUXDB_DATA_DIR/influxd.bolt" ]]; then
        print_warning "InfluxDB appears to be already initialized. Skipping setup."
        return 0
    fi

    # Generate setup tokens and passwords
    SETUP_TOKEN=$(openssl rand -hex 32)
    ADMIN_TOKEN="quantumbeam_$(openssl rand -hex 32)"

    # Create the initial setup using CLI
    export INFLUX_HOST="http://localhost:8086"
    export INFLUX_ORG="$ORG_NAME"
    export INFLUX_TOKEN="$SETUP_TOKEN"

    # Wait for setup to be available
    for i in {1..30}; do
        if curl -s http://localhost:8086/health >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Perform initial setup
    influx setup \
        --host http://localhost:8086 \
        --org "$ORG_NAME" \
        --bucket "$DEFAULT_BUCKET" \
        --username "$ADMIN_USER" \
        --password "$ADMIN_PASSWORD" \
        --retention "$RETENTION_POLICY" \
        --force

    # Get the admin token
    INFLUX_TOKEN=$(influx auth list \
        --user "$ADMIN_USER" \
        --org "$ORG_NAME" \
        --hide-headers \
        | grep 'active' \
        | awk '{print $2}')

    if [[ -z "$INFLUX_TOKEN" ]]; then
        print_error "Failed to retrieve admin token"
        exit 1
    fi

    # Save admin token to file
    echo "$INFLUX_TOKEN" > $INFLUXDB_CONFIG_DIR/admin-token
    chmod 600 $INFLUXDB_CONFIG_DIR/admin-token

    print_status "InfluxDB setup completed successfully"
}

# Create additional buckets
create_buckets() {
    print_status "Creating additional buckets..."

    # Get the admin token
    if [[ -f "$INFLUXDB_CONFIG_DIR/admin-token" ]]; then
        ADMIN_TOKEN=$(cat $INFLUXDB_CONFIG_DIR/admin-token)
    else
        print_error "Admin token not found"
        return 1
    fi

    export INFLUX_HOST="http://localhost:8086"
    export INFLUX_ORG="$ORG_NAME"
    export INFLUX_TOKEN="$ADMIN_TOKEN"

    # Create buckets for different purposes
    buckets=(
        "fraud_metrics:7d"
        "quantum_metrics:30d"
        "performance_metrics:1d"
        "user_activity:90d"
        "system_metrics:30d"
        "alerts:30d"
        "ml_models:90d"
    )

    for bucket_config in "${buckets[@]}"; do
        bucket_name=$(echo "$bucket_config" | cut -d':' -f1)
        retention=$(echo "$bucket_config" | cut -d':' -f2)

        if influx bucket create --name "$bucket_name" --retention "$retention" >/dev/null 2>&1; then
            print_status "Created bucket: $bucket_name (retention: $retention)"
        else
            print_warning "Bucket $bucket_name may already exist or failed to create"
        fi
    done
}

# Setup log rotation
setup_log_rotation() {
    print_status "Setting up log rotation..."

    cat > /etc/logrotate.d/influxdb << EOF
$INFLUXDB_LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $INFLUXDB_USER $INFLUXDB_GROUP
    postrotate
        systemctl reload influxdb >/dev/null 2>&1 || true
    endscript
}
EOF

    chmod 644 /etc/logrotate.d/influxdb
}

# Setup firewall rules
setup_firewall() {
    print_status "Setting up firewall rules..."

    if command -v ufw >/dev/null 2>&1; then
        ufw allow 8086/tcp comment "InfluxDB HTTP API"
        ufw --force enable
    elif command -v firewall-cmd >/dev/null 2>&1; then
        firewall-cmd --permanent --add-port=8086/tcp
        firewall-cmd --reload
    else
        print_warning "No firewall manager found. Please configure firewall manually."
    fi
}

# Create management scripts
create_management_scripts() {
    print_status "Creating management scripts..."

    # Backup script
    cat > /usr/local/bin/influxdb-backup << 'EOF'
#!/bin/bash

# InfluxDB backup script
BACKUP_DIR="/backup/influxdb/$(date +%Y%m%d_%H%M%S)"
INFLUXDB_DATA_DIR="/var/lib/influxdb2"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "Creating InfluxDB backup to $BACKUP_DIR..."

# Stop InfluxDB service
systemctl stop influxdb

# Backup data
cp -r "$INFLUXDB_DATA_DIR" "$BACKUP_DIR/"

# Start InfluxDB service
systemctl start influxdb

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"

# Clean up old backups
find /backup/influxdb -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR.tar.gz"
EOF

    # Restore script
    cat > /usr/local/bin/influxdb-restore << 'EOF'
#!/bin/bash

# InfluxDB restore script
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/influxdb_restore_$(date +%s)"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring InfluxDB from $BACKUP_FILE..."

# Stop InfluxDB service
systemctl stop influxdb

# Remove existing data
rm -rf /var/lib/influxdb2/*

# Extract backup
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# Restore data
cp -r "$RESTORE_DIR"/* /var/lib/influxdb2/

# Fix ownership
chown -R influxdb:influxdb /var/lib/influxdb2/

# Start InfluxDB service
systemctl start influxdb

# Clean up
rm -rf "$RESTORE_DIR"

echo "Restore completed"
EOF

    # Status script
    cat > /usr/local/bin/influxdb-status << 'EOF'
#!/bin/bash

echo "InfluxDB Status"
echo "==============="

# Service status
systemctl is-active influxdb
systemctl status influxdb --no-pager -l

# Database status
echo ""
echo "Database Info:"
influx ping 2>/dev/null || echo "InfluxDB not responding"

# Disk usage
echo ""
echo "Disk Usage:"
du -sh /var/lib/influxdb2

# Memory usage
echo ""
echo "Memory Usage:"
ps aux | grep influxd | grep -v grep

# Connections
echo ""
echo "Active Connections:"
netstat -an | grep :8086 | wc -l
EOF

    chmod +x /usr/local/bin/influxdb-*
}

# Display setup information
display_info() {
    print_status "InfluxDB setup completed successfully!"
    echo ""
    echo -e "${GREEN}Configuration:${NC}"
    echo "InfluxDB Version: $INFLUXDB_VERSION"
    echo "Organization: $ORG_NAME"
    echo "Admin User: $ADMIN_USER"
    echo "Default Bucket: $DEFAULT_BUCKET"
    echo "Retention Policy: $RETENTION_POLICY"
    echo "Data Directory: $INFLUXDB_DATA_DIR"
    echo "Config Directory: $INFLUXDB_CONFIG_DIR"
    echo "Log Directory: $INFLUXDB_LOG_DIR"
    echo ""
    echo -e "${GREEN}Connection Information:${NC}"
    echo "HTTP API: http://localhost:8086"
    echo "Admin Token: $(cat $INFLUXDB_CONFIG_DIR/admin-token 2>/dev/null || echo 'Not found')"
    echo ""
    echo -e "${GREEN}Management Commands:${NC}"
    echo "  Check status: influxdb-status"
    echo "  Create backup: influxdb-backup"
    echo "  Restore backup: influxdb-restore <backup_file.tar.gz>"
    echo ""
    echo -e "${YELLOW}Important Notes:${NC}"
    echo "1. Save the admin token securely - it's required for API access"
    echo "2. Configure proper firewall rules for production"
    echo "3. Set up regular backups using cron: 0 2 * * * /usr/local/bin/influxdb-backup"
    echo "4. Monitor disk usage and set up alerts"
    echo "5. Consider enabling TLS for production deployments"
    echo "6. Review and adjust retention policies based on your needs"
}

# Main execution
main() {
    check_root
    install_dependencies
    create_influxdb_user
    create_directories
    install_influxdb
    generate_config
    create_systemd_service
    initialize_influxdb
    create_buckets
    setup_log_rotation
    setup_firewall
    create_management_scripts
    display_info

    print_status "InfluxDB setup completed successfully!"
}

# Run main function
main "$@"