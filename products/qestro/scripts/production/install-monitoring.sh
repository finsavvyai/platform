#!/bin/bash

# Qestro Monitoring Installation Script
# Installs monitoring scripts and configuration on production server

set -euo pipefail

INSTALL_DIR="/opt/qestro"
SERVICE_NAME="qestro-health-monitor"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create installation directory
create_directories() {
    log "📁 Creating installation directories..."

    sudo mkdir -p "$INSTALL_DIR"/{scripts/production,config/production,reports,logs}
    sudo chown -R \$USER:\$USER "$INSTALL_DIR"

    log "✅ Directories created"
}

# Install monitoring scripts
install_scripts() {
    log "📜 Installing monitoring scripts..."

    # Copy scripts
    cp health-check.sh database-backup.sh performance-test.sh security-audit.sh rotate-logs.sh "$INSTALL_DIR/scripts/production/"

    # Copy configuration
    cp config/production/* "$INSTALL_DIR/config/production/"

    # Make scripts executable
    chmod +x "$INSTALL_DIR/scripts/production"/*

    log "✅ Scripts installed"
}

# Install SystemD service
install_service() {
    log "⚙️ Installing SystemD service..."

    sudo cp "$INSTALL_DIR/config/production/qestro-health-monitor.service" "/etc/systemd/system/"

    # Create timer for periodic execution
    sudo tee "/etc/systemd/system/$SERVICE_NAME.timer" > /dev/null << EOL
[Unit]
Description=Run Qestro Health Monitor every 5 minutes
Requires=$SERVICE_NAME.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOL

    # Reload systemd and enable timer
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME.timer"
    sudo systemctl start "$SERVICE_NAME.timer"

    log "✅ SystemD service installed and started"
}

# Install cron jobs
install_cron() {
    log "⏰ Installing cron jobs..."

    # Add cron jobs to current user's crontab
    (crontab -l 2>/dev/null; cat "$INSTALL_DIR/config/production/crontab-backup") | crontab -

    log "✅ Cron jobs installed"
}

# Create logrotate configuration
install_logrotate() {
    log "📋 Installing logrotate configuration..."

    sudo tee "/etc/logrotate.d/qestro" > /dev/null << EOL
/var/log/qestro/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 \$USER \$USER
    postrotate
        systemctl reload qestro-health-monitor || true
    endscript
}
EOL

    log "✅ Logrotate configuration installed"
}

# Verify installation
verify_installation() {
    log "🔍 Verifying installation..."

    # Check if scripts are executable
    if [ -x "$INSTALL_DIR/scripts/production/health-check.sh" ]; then
        log "✅ Health check script is executable"
    else
        log "❌ Health check script is not executable"
        return 1
    fi

    # Check if service is running
    if systemctl is-active --quiet "$SERVICE_NAME.timer"; then
        log "✅ SystemD timer is running"
    else
        log "❌ SystemD timer is not running"
        return 1
    fi

    # Run initial health check
    "$INSTALL_DIR/scripts/production/health-check.sh"

    log "✅ Installation verified successfully"
}

# Main installation
main() {
    log "🚀 Installing Qestro monitoring system..."

    create_directories
    install_scripts
    install_service
    install_cron
    install_logrotate
    verify_installation

    log "🎉 Qestro monitoring installation completed!"
    log ""
    log "📊 Monitoring Services:"
    log "  - Health checks: Every 5 minutes via SystemD timer"
    log "  - Database backups: Daily at 2 AM via cron"
    log "  - Performance tests: Weekly on Sundays at 3 AM"
    log "  - Security audits: Monthly on 1st at 1 AM"
    log ""
    log "📁 Installation directory: $INSTALL_DIR"
    log "📋 Logs location: /var/log/qestro/"
    log "📊 Reports location: $INSTALL_DIR/reports/"
}

# Execute installation
main "$@"
