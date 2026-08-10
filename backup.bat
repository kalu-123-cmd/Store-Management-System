@echo off
REM Database Backup Script for Public Resource & Procurement Management Platform
REM Usage: backup.bat [postgres|sqlite]

set BACKUP_DIR=.\backups
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set DB_TYPE=%1
if "%DB_TYPE%"=="" set DB_TYPE=sqlite

REM Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

if "%DB_TYPE%"=="postgres" (
    echo Creating PostgreSQL backup...
    docker-compose exec -T postgres pg_dump -U procurement_user procurement_platform > "%BACKUP_DIR%\postgres_backup_%TIMESTAMP%.sql"
    echo PostgreSQL backup created: %BACKUP_DIR%\postgres_backup_%TIMESTAMP%.sql
) else (
    echo Creating SQLite backup...
    copy server\prisma\dev.db "%BACKUP_DIR%\sqlite_backup_%TIMESTAMP%.db"
    echo SQLite backup created: %BACKUP_DIR%\sqlite_backup_%TIMESTAMP%.db
)

echo Backup completed.
