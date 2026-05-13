FROM node:22-alpine AS base

# Add necessary dependencies for Alpine
RUN apk add --no-cache libc6-compat openssl

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prepare Prisma client
RUN npx prisma@5.19.1 generate

# Set environment for build
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WASABI_CDN
ENV NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_WASABI_CDN=$NEXT_PUBLIC_WASABI_CDN
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DB_URL="mysql://root@localhost:3306/placeholder"

# Build Next.js application using next build directly
RUN npx next build

# Runner
FROM base AS runner
WORKDIR /app

# Add database tools and compression for Backup
RUN apk add --no-cache mysql-client gzip

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Prisma and essential folders
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

# Copy standalone build files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Grant permissions to prevent permission errors
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
