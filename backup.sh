#!/bin/bash

# Database Backup Script for Public Resource & Procurement Management Platform
# Usage: ./backup.sh [postgres|sqlite]

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_TYPE=${1:-sqlite}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

if [ "$DB_TYPE" = "postgres" ]; then
    # PostgreSQL backup
    echo "Creating PostgreSQL backup..."
    docker-compose exec -T postgres pg_dump -U procurement_user procurement_platform > "$BACKUP_DIR/postgres_backup_$TIMESTAMP.sql"
    echo "PostgreSQL backup created: $BACKUP_DIR/postgres_backup_$TIMESTAMP.sql"
else
    # SQLite backup (development)
    echo "Creating SQLite backup..."
    cp server/prisma/dev.db "$BACKUP_DIR/sqlite_backup_$TIMESTAMP.db"
    echo "SQLite backup created: $BACKUP_DIR/sqlite_backup_$TIMESTAMP.db"
fi

# Keep only last 30 backups
find "$BACKUP_DIR" -type f -name "*.sql" -o -name "*.db" | sort -r | tail -n +31 | xargs rm -f

echo "Backup completed. Retaining last 30 backups."
