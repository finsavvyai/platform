#!/bin/bash

# QuantumBeam.io - Redis Cluster Setup Script
# This script sets up a Redis cluster for production use

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REDIS_VERSION="7.2"
REDIS_BASE_DIR="/opt/redis"
REDIS_CONFIG_DIR="/etc/redis"
REDIS_DATA_DIR="/var/lib/redis"
REDIS_LOG_DIR="/var/log/redis"
REDIS_USER="redis"
REDIS_GROUP="redis"

# Cluster nodes configuration
declare -a REDIS_NODES=("redis-1" "redis-2" "redis-3" "redis-4" "redis-5" "redis-6")
declare -a REDIS_PORTS=("6379" "6380" "6381" "6382" "6383" "6384")

echo -e "${BLUE}🚀 QuantumBeam.io - Redis Cluster Setup${NC}"
echo -e "${BLUE}============================================${NC}"

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
    apt-get update
    apt-get install -y \
        build-essential \
        tcl \
        pkg-config \
        openssl \
        libssl-dev \
        wget \
        curl \
        uuid-dev \
        systemd
}

# Create Redis user and group
create_redis_user() {
    print_status "Creating Redis user and group..."

    if ! getent group $REDIS_GROUP >/dev/null 2>&1; then
        groupadd --system $REDIS_GROUP
    fi

    if ! getent passwd $REDIS_USER >/dev/null 2>&1; then
        useradd --system --group --home-dir $REDIS_DATA_DIR --shell /usr/sbin/nologin $REDIS_USER
    fi
}

# Create directories
create_directories() {
    print_status "Creating Redis directories..."

    mkdir -p $REDIS_BASE_DIR
    mkdir -p $REDIS_CONFIG_DIR
    mkdir -p $REDIS_DATA_DIR
    mkdir -p $REDIS_LOG_DIR
    mkdir -p /var/run/redis

    chown -R $REDIS_USER:$REDIS_GROUP $REDIS_DATA_DIR
    chown -R $REDIS_USER:$REDIS_GROUP $REDIS_LOG_DIR
    chown -R $REDIS_USER:$REDIS_GROUP /var/run/redis
    chmod 755 $REDIS_DATA_DIR
    chmod 755 $REDIS_LOG_DIR
    chmod 755 /var/run/redis
}

# Download and compile Redis
install_redis() {
    print_status "Downloading and compiling Redis $REDIS_VERSION..."

    cd /tmp
    wget -O redis.tar.gz "http://download.redis.io/releases/redis-$REDIS_VERSION.tar.gz"
    tar -xzf redis.tar.gz
    cd redis-$REDIS_VERSION

    # Compile Redis
    make
    make test
    make install PREFIX=$REDIS_BASE_DIR

    # Create symbolic links
    ln -sf $REDIS_BASE_DIR/bin/redis-server /usr/local/bin/redis-server
    ln -sf $REDIS_BASE_DIR/bin/redis-cli /usr/local/bin/redis-cli
    ln -sf $REDIS_BASE_DIR/bin/redis-sentinel /usr/local/bin/redis-sentinel
    ln -sf $REDIS_BASE_DIR/bin/redis-benchmark /usr/local/bin/redis-benchmark

    # Clean up
    rm -rf /tmp/redis-$REDIS_VERSION
    rm -f /tmp/redis.tar.gz
}

# Generate cluster configuration
generate_cluster_config() {
    local node_id=$1
    local port=$2
    local config_file="$REDIS_CONFIG_DIR/redis-$node_id.conf"

    print_status "Generating configuration for Redis node $node_id (port: $port)..."

    cat > $config_file << EOF
# QuantumBeam.io - Redis Cluster Node Configuration
# Node: $node_id, Port: $port

# Network
bind 0.0.0.0
port $port
cluster-enabled yes
cluster-config-file nodes-$node_id.conf
cluster-node-timeout 5000
cluster-announce-ip $node_id
cluster-announce-port $port
cluster-announce-bus-port $((port + 10000))

# Directories
dir $REDIS_DATA_DIR/$node_id

# Persistence
appendonly yes
appendfilename "appendonly-$node_id.aof"
appendfsync everysec

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Security
# requirepass your_strong_password_here
# masterauth your_strong_password_here

# Logging
loglevel notice
logfile $REDIS_LOG_DIR/redis-$node_id.log

# Performance
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
dbfilename dump-$node_id.rdb

# Cluster settings
cluster-migration-barrier 1
cluster-require-full-coverage yes
cluster-replica-validity-factor 10

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Client limits
maxclients 10000

# TCP settings
tcp-keepalive 300
tcp-backlog 511
timeout 0

# Memory optimization
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# Other settings
daemonize yes
pidfile /var/run/redis/redis-$node_id.pid
syslog-enabled yes
syslog-ident redis-$node_id
databases 16
always-show-logo no
EOF

    chown $REDIS_USER:$REDIS_GROUP $config_file
    chmod 640 $config_file
}

# Create data directories for each node
create_node_directories() {
    for node in "${REDIS_NODES[@]}"; do
        mkdir -p $REDIS_DATA_DIR/$node
        chown $REDIS_USER:$REDIS_GROUP $REDIS_DATA_DIR/$node
        chmod 750 $REDIS_DATA_DIR/$node
    done
}

# Create systemd service files
create_systemd_services() {
    print_status "Creating systemd service files..."

    for i in "${!REDIS_NODES[@]}"; do
        node="${REDIS_NODES[$i]}"
        port="${REDIS_PORTS[$i]}"

        cat > /etc/systemd/system/redis-$node.service << EOF
[Unit]
Description=Redis Cluster Node $node
After=network.target
Documentation=https://redis.io/documentation

[Service]
Type=forking
ExecStart=$REDIS_BASE_DIR/bin/redis-server $REDIS_CONFIG_DIR/redis-$node.conf
ExecStop=/usr/local/bin/redis-cli -p $port shutdown
TimeoutStopSec=0
Restart=always
User=$REDIS_USER
Group=$REDIS_GROUP
RuntimeDirectory=redis
RuntimeDirectoryMode=0755
LimitNOFILE=65536
PrivateTmp=true
ProtectSystem=strict
ReadWriteDirectories=$REDIS_DATA_DIR/$node $REDIS_LOG_DIR
ReadWriteDirectories=-/var/run/redis

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload
        systemctl enable redis-$node
    done
}

# Create sentinel configuration
create_sentinel_config() {
    print_status "Creating Redis Sentinel configuration..."

    cat > $REDIS_CONFIG_DIR/redis-sentinel.conf << EOF
# QuantumBeam.io - Redis Sentinel Configuration

bind 0.0.0.0
port 26379
daemonize yes
pidfile /var/run/redis/redis-sentinel.pid
logfile $REDIS_LOG_DIR/redis-sentinel.log

# Monitor the master
sentinel monitor mymaster redis-1 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000

# Security
# sentinel auth-pass mymaster your_strong_password_here

# Notification scripts
# sentinel notification-script mymaster /etc/redis/sentinel_notify.sh
# sentinel client-reconfig-script mymaster /etc/redis/sentinel_reconfig.sh

# Advanced settings
sentinel deny-scripts-reconfig yes
sentinel resolve-hostnames yes
sentinel announce-hostnames no
EOF

    chown $REDIS_USER:$REDIS_GROUP $REDIS_CONFIG_DIR/redis-sentinel.conf
    chmod 640 $REDIS_CONFIG_DIR/redis-sentinel.conf
}

# Create sentinel systemd service
create_sentinel_service() {
    print_status "Creating Redis Sentinel service..."

    cat > /etc/systemd/system/redis-sentinel.service << EOF
[Unit]
Description=Redis Sentinel
After=network.target
Documentation=https://redis.io/documentation

[Service]
Type=forking
ExecStart=$REDIS_BASE_DIR/bin/redis-sentinel $REDIS_CONFIG_DIR/redis-sentinel.conf
ExecStop=/usr/local/bin/redis-cli -p 26379 shutdown
TimeoutStopSec=0
Restart=always
User=$REDIS_USER
Group=$REDIS_GROUP
RuntimeDirectory=redis
RuntimeDirectoryMode=0755
LimitNOFILE=65536
PrivateTmp=true
ProtectSystem=strict
ReadWriteDirectories=$REDIS_DATA_DIR $REDIS_LOG_DIR
ReadWriteDirectories=-/var/run/redis

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable redis-sentinel
}

# Start Redis cluster
start_cluster() {
    print_status "Starting Redis cluster nodes..."

    for node in "${REDIS_NODES[@]}"; do
        systemctl start redis-$node
        print_status "Started $node"
        sleep 2
    done

    # Wait for nodes to be ready
    print_status "Waiting for nodes to be ready..."
    sleep 10

    # Create the cluster
    print_status "Creating Redis cluster..."
    local redis_cli="$REDIS_BASE_DIR/bin/redis-cli --cluster create"

    for i in "${!REDIS_NODES[@]}"; do
        node="${REDIS_NODES[$i]}"
        port="${REDIS_PORTS[$i]}"
        redis_cli="$redis_cli $node:$port"
    done

    redis_cli="$redis_cli --cluster-replicas 1 --cluster-yes"

    print_status "Executing cluster creation command..."
    # Uncomment the next line to actually create the cluster
    # $redis_cli
}

# Create management scripts
create_management_scripts() {
    print_status "Creating management scripts..."

    # Cluster status script
    cat > /usr/local/bin/redis-cluster-status << 'EOF'
#!/bin/bash
echo "Redis Cluster Status"
echo "===================="
redis-cli -p 6379 cluster nodes | head -n 1
redis-cli -p 6379 cluster info | grep cluster_state
redis-cli -p 6379 cluster info | grep cluster_slots_filled
redis-cli -p 6379 cluster info | grep cluster_size
EOF

    # Cluster restart script
    cat > /usr/local/bin/redis-cluster-restart << 'EOF'
#!/bin/bash
echo "Restarting Redis Cluster..."
for node in redis-1 redis-2 redis-3 redis-4 redis-5 redis-6; do
    systemctl restart redis-$node
    echo "Restarted $node"
done
echo "Cluster restart completed"
EOF

    # Cluster backup script
    cat > /usr/local/bin/redis-cluster-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/redis/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "Creating Redis cluster backup to $BACKUP_DIR..."
for node in redis-1 redis-2 redis-3; do
    cp /var/lib/redis/$node/*.rdb $BACKUP_DIR/ 2>/dev/null || true
    cp /var/lib/redis/$node/*.aof $BACKUP_DIR/ 2>/dev/null || true
done

echo "Backup completed: $BACKUP_DIR"
EOF

    chmod +x /usr/local/bin/redis-cluster-*
}

# Setup firewall rules
setup_firewall() {
    print_status "Setting up firewall rules..."

    if command -v ufw >/dev/null 2>&1; then
        ufw allow 6379:6384/tcp comment "Redis Cluster"
        ufw allow 16379:16384/tcp comment "Redis Cluster Bus"
        ufw allow 26379/tcp comment "Redis Sentinel"
        ufw --force enable
    elif command -v firewall-cmd >/dev/null 2>&1; then
        firewall-cmd --permanent --add-port=6379-6384/tcp
        firewall-cmd --permanent --add-port=16379-16384/tcp
        firewall-cmd --permanent --add-port=26379/tcp
        firewall-cmd --reload
    else
        print_warning "No firewall manager found. Please configure firewall manually."
    fi
}

# Display cluster information
display_info() {
    print_status "Redis cluster setup completed!"
    echo ""
    echo -e "${GREEN}Cluster Configuration:${NC}"
    echo "Redis Version: $REDIS_VERSION"
    echo "Base Directory: $REDIS_BASE_DIR"
    echo "Config Directory: $REDIS_CONFIG_DIR"
    echo "Data Directory: $REDIS_DATA_DIR"
    echo "Log Directory: $REDIS_LOG_DIR"
    echo ""
    echo -e "${GREEN}Cluster Nodes:${NC}"
    for i in "${!REDIS_NODES[@]}"; do
        node="${REDIS_NODES[$i]}"
        port="${REDIS_PORTS[$i]}"
        echo "  $node: $port"
    done
    echo ""
    echo -e "${GREEN}Management Commands:${NC}"
    echo "  Check cluster status: redis-cluster-status"
    echo "  Restart cluster: redis-cluster-restart"
    echo "  Create backup: redis-cluster-backup"
    echo ""
    echo -e "${YELLOW}Important Notes:${NC}"
    echo "1. Update Redis passwords in configuration files for production"
    echo "2. Configure TLS certificates for secure communication"
    echo "3. Set up proper monitoring and alerting"
    echo "4. Configure backup retention policies"
    echo "5. Test failover procedures regularly"
}

# Main execution
main() {
    check_root
    install_dependencies
    create_redis_user
    create_directories
    install_redis

    # Create cluster configuration for each node
    for i in "${!REDIS_NODES[@]}"; do
        node="${REDIS_NODES[$i]}"
        port="${REDIS_PORTS[$i]}"
        generate_cluster_config $node $port
    done

    create_node_directories
    create_systemd_services
    create_sentinel_config
    create_sentinel_service
    create_management_scripts
    setup_firewall

    # Start cluster (commented out for safety)
    # start_cluster

    display_info

    print_status "Redis cluster setup completed successfully!"
    print_warning "Please update security settings before starting the cluster in production."
}

# Run main function
main "$@"