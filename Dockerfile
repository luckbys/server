FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache \
    curl \
    tzdata \
    && cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime \
    && echo "America/Sao_Paulo" > /etc/timezone

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S evolution -u 1001

# Create directories needed
RUN mkdir -p /app/logs/errors /app/logs/webhooks && \
    chown -R evolution:nodejs /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies (using npm install for Docker compatibility)
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY src/ ./src/
COPY start-*.js ./
COPY test-*.js ./

# Set permissions
RUN chown -R evolution:nodejs /app
USER evolution

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "start-production.js"]

# Metadata
LABEL maintainer="BKCRM Team <dev@bkcrm.com.br>" \
      version="2.0.0" \
      description="BKCRM Evolution Webhook Server" \
      org.opencontainers.image.source="https://github.com/bkcrm/evolution-webhook"

# Set environment variables
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    LOG_LEVEL=info \
    LOG_DIRECTORY=/app/logs \
    LOG_MAX_SIZE=20m \
    LOG_MAX_FILES=14d \
    LOG_COMPRESS=true \
    LOG_ERROR_MAX_FILES=30d \
    LOG_WEBHOOK_MAX_FILES=7d

# Define volume for logs
VOLUME ["/app/logs"] 