#!/bin/bash

# Qestro Log Rotation Script
# Rotates and compresses old log files

LOG_DIR="/var/log/qestro"
RETENTION_DAYS=30

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Rotate logs older than 7 days or larger than 100MB
find "$LOG_DIR" -name "*.log" -type f -mtime +7 -exec gzip {} \;
find "$LOG_DIR" -name "*.log.gz" -type f -mtime +$RETENTION_DAYS -delete

# Clean up old monitoring reports
find /opt/qestro/reports -name "*" -type f -mtime +$RETENTION_DAYS -delete

echo "$(date): Log rotation completed"
