FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS dev-deps
COPY package*.json ./
RUN npm ci && npm cache clean --force

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Step 1: Run tsc --noEmit first so TypeScript errors are printed clearly
# before nest build has a chance to swallow them.
RUN echo ">>> Running TypeScript type-check (noEmit)..." && \
    npx tsc --noEmit 2>&1 || true
# Step 2: Run the actual build, merging stderr into stdout so nothing is lost.
RUN echo ">>> Starting nest build..." && \
    npm run build 2>&1; BUILD_EXIT=$?; \
    echo ">>> nest build exited with code $BUILD_EXIT"; \
    exit $BUILD_EXIT
# Step 3: Print the full dist tree so we can see exactly what was generated.
RUN echo ">>> Full dist directory structure:" && \
    find dist/ -print | sort && \
    echo ">>> Verifying dist/main.js..." && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found after build" && exit 1) && \
    echo ">>> dist/main.js confirmed."

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --chown=nestjs:nodejs package*.json ./

# Generate Prisma client in production
RUN npx prisma generate

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
