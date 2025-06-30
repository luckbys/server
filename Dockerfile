FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S evolution -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies (using npm install for Docker compatibility)
RUN npm install --only=production && npm cache clean --force

# Copy application files
COPY src/ ./src/
COPY start-production.js ./
COPY start-simple.js ./
COPY test-evolution-compatibility.js ./

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