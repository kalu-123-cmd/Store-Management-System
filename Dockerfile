# Dockerfile for Public Resource & Procurement Management Platform

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build server
WORKDIR /app/server
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm ci --only=production

# Copy built server from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/src ./server/src

# Copy uploads directory structure
RUN mkdir -p uploads

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if(r.statusCode !== 200) process.exit(1)})"

# Start server
CMD ["node", "server/dist/index.js"]
