# ─────────────────────────────────────────────────
# NutriSense — Multi-stage Dockerfile
# Base: node:20-alpine  (≈ 60 MB compressed)
# ─────────────────────────────────────────────────

# Stage 1 – Install only production dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first for Docker layer-cache efficiency
COPY package*.json ./

# Install ONLY production deps (no devDependencies)
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────

# Stage 2 – Final lean image
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S nutrisense && adduser -S nutrisense -G nutrisense

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY server.js   ./server.js
COPY public/     ./public/

# Cloud Run injects PORT automatically; default 8080
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Drop privileges before starting
USER nutrisense

# Start the lightweight Express server
CMD ["node", "server.js"]
