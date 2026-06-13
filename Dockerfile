FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── Dependencies (production only) ──────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Dev Dependencies (includes @nestjs/cli for build) ───────────────────────
FROM base AS dev-deps
COPY package*.json ./
RUN npm ci && npm cache clean --force

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

# Print config files so any misconfiguration is visible in build logs
RUN echo "=== nest-cli.json ===" && cat nest-cli.json && \
    echo "=== tsconfig.build.json ===" && cat tsconfig.build.json && \
    echo "=== tsconfig.json ===" && cat tsconfig.json

# Generate Prisma client before build
RUN npx prisma generate

# Check for TypeScript errors explicitly before building
RUN npx tsc --noEmit 2>&1

# Build NestJS app using tsc builder — verbose output, stderr merged so nothing is swallowed
RUN DEBUG=* npm run build 2>&1 || (echo "ERROR: nest build exited with non-zero status $?" && exit 1)

# Verify dist was created and contains the expected entry point
RUN echo "=== dist/ contents ===" && ls -la dist/ && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found after build!" && exit 1)

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma       ./prisma
COPY                --chown=nestjs:nodejs package*.json     ./

# Generate Prisma client against production node_modules
RUN npx prisma generate

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
