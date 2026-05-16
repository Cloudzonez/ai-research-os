#!/bin/bash
# MongoDB Backup Script for AI Research OS
# Usage: ./scripts/backup.sh [backup_dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

echo "Starting AI Research OS backup..."
echo "Backup path: $BACKUP_PATH"

# Create backup directory
mkdir -p "$BACKUP_PATH"

# MongoDB dump
echo "Dumping MongoDB..."
mongodump --db ai_research --out "$BACKUP_PATH/mongodb" 2>&1 || {
  echo "Warning: MongoDB dump failed (is mongod running?)"
}

# Copy uploads if they exist
if [ -d "./uploads" ]; then
  echo "Backing up uploads..."
  cp -r ./uploads "$BACKUP_PATH/uploads"
fi

# Copy env file (without overwriting production secrets)
if [ -f ".env" ]; then
  cp .env "$BACKUP_PATH/.env.backup"
fi

# Create tar.gz archive
echo "Creating archive..."
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"

# Cleanup uncompressed directory
rm -rf "$BACKUP_PATH"

# Keep only last 7 backups
ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo "Backup complete: $BACKUP_PATH.tar.gz"
echo "Size: $(du -h "$BACKUP_PATH.tar.gz" | cut -f1)"
