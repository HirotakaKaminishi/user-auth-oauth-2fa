# Multi-stage Dockerfile for Node.js Express application
# Optimized for production with security best practices

# Stage 1: Base image with dependencies
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app user (non-root for security)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Stage 2: Development
FROM base AS development

ENV NODE_ENV=development

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]

# Stage 3: Build
FROM base AS build

ENV NODE_ENV=production

# Install all dependencies first (for building)
RUN npm ci

# Copy source code
COPY --chown=nodejs:nodejs . .

# Build TypeScript
RUN npm run build

# Remove devDependencies
RUN npm prune --production && \
    npm cache clean --force

# Stage 4: Production
FROM base AS production

ENV NODE_ENV=production

# Copy only production dependencies
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
