# ────────────────────────────────────────────────────────────
#  STAGE 1 — Builder
#  Install ALL dependencies, generate Prisma client, build TS
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install system libraries required by Prisma's query engine
RUN apk add --no-cache libc6-compat openssl

# Copy dependency manifests first for Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate the Prisma client (engines + types)
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy TypeScript config and source code, then compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies so we can copy a leaner node_modules later
RUN npm prune --omit=dev

# ────────────────────────────────────────────────────────────
#  STAGE 2 — Production
#  Minimal runtime image: non-root, only what is needed at runtime
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Required by Prisma's query engine at runtime
RUN apk add --no-cache libc6-compat openssl

# Create a non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 appuser --ingroup appgroup

# Copy production node_modules from builder (already pruned)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled JavaScript
COPY --from=builder /app/dist ./dist

# Copy Prisma schema + migrations (needed if running migrate at startup)
COPY --from=builder /app/prisma ./prisma

# Copy package manifests for metadata
COPY --from=builder /app/package.json ./

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 4000

# Environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://0.0.0.0:4000/api/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
