# Redis Setup for Windows - Alternative Solutions

Since Docker is not available, here are alternative ways to run Redis on Windows:

## Option 1: Install Redis Directly (Recommended for Development)

### Step 1: Download Redis for Windows
Redis is not natively supported on Windows, but you can use:

**Memurai** (Redis-compatible for Windows):
- Download from: https://www.memurai.com/get-memurai/
- Or use the MicrosoftArchive Redis port: https://github.com/microsoftarchive/redis/releases

### Step 2: Install Redis
1. Download the Redis Windows port from GitHub releases
2. Extract to a folder (e.g., `C:\redis`)
3. Run `redis-server.exe` to start the server

### Step 3: Test Redis Connection
```powershell
# In a new terminal
cd C:\redis
redis-cli.exe ping
# Should return: PONG
```

## Option 2: Use Memory-Based Queue (Development Only)

For development without Redis, you can modify the queue configuration to use memory storage:

### Update clearanceQueue.ts:
```typescript
// Replace REDIS_CONFIG with memory storage
const QUEUE_NAME = 'clearance-queue';

// For development without Redis, use memory storage
const QUEUE_CONFIG = {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  // Or use memory-based queue for development
  // storage: 'memory',
};
```

## Option 3: Cloud Redis Service

Use a free cloud Redis service:

**Redis Cloud (Free Tier):**
- Sign up at: https://redis.com/try-free/
- Get connection string and update `.env` file

**Upstash (Free Tier):**
- Sign up at: https://upstash.com/
- Get connection string and update `.env` file

### Update .env file:
```env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

## Option 4: Install Docker Desktop (Recommended for Production)

### Install Docker Desktop for Windows:
1. Download from: https://www.docker.com/products/docker-desktop/
2. Run the installer
3. Start Docker Desktop
4. Run the Redis command again:
```powershell
docker run -d -p 6379:6379 redis:alpine
```

## Current Development Recommendation

For immediate development without Redis, you can:

1. **Skip Redis queue features temporarily** - The clearance queue and payment services will work without Redis, just without background processing
2. **Use synchronous processing** - Modify the services to process synchronously for development
3. **Install Memurai** - Use Redis-compatible Windows server

### Quick Start with Memurai:
```powershell
# Download Memurai from https://www.memurai.com/get-memurai/
# Install and run:
memurai.exe
```

Then update your `.env` file:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Testing Redis Connection

After installing Redis, test the connection:
```powershell
cd server
node -e "const redis = require('ioredis'); const client = new redis({ host: 'localhost', port: 6379 }); client.ping().then(() => console.log('Redis connected!')).catch(err => console.error('Redis connection failed:', err));"
```

## Recommendation

For development purposes, I recommend:
1. **Install Memurai** (Redis for Windows) - Quick and easy
2. **Or use cloud Redis** (Upstash free tier) - No installation needed
3. **Or skip Redis initially** - Core features will work without it

The enterprise architecture will work with or without Redis - queue features will just process synchronously instead of asynchronously.
