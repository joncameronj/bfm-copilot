# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.13.1

# Build stage
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

# Install dependencies
COPY --link package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source files
COPY --link . .

# Build the TypeScript project (assumes `build` script compiles TS to dist/)
RUN --mount=type=cache,target=/root/.npm \
    npm run build

# Remove dev dependencies and install only production dependencies
RUN --mount=type=cache,target=/root/.npm \
    rm -rf node_modules && npm ci --production

# Production stage
FROM node:${NODE_VERSION}-slim AS final
WORKDIR /app

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy built app and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
USER appuser

# Expose port 3000 (common for Next.js/Node apps; adjust if needed)
EXPOSE 3000

# Start the app (assumes `start` script is defined in package.json)
CMD ["npm", "start"]
