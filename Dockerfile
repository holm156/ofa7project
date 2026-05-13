FROM node:22-alpine AS base

# إضافة التبعيات اللازمة لـ Alpine
RUN apk add --no-cache libc6-compat openssl

# الاعتماديات (Dependencies)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# البناء (Build)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# تجهيز عميل Prisma
RUN npx prisma@5.19.1 generate

# إعداد البيئة للبناء
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CDN_URL
ENV NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DB_URL="mysql://root@localhost:3306/placeholder"

# بناء تطبيق Next.js بالاعتماد على أمر next build مباشرة للابتعاد عن السكريبتات الجانبية
RUN npx next build

# التشغيل (Runner)
FROM base AS runner
WORKDIR /app

# إضافة أدوات قواعد البيانات والضغط للـ Backup
RUN apk add --no-cache mysql-client gzip

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# نقل مجلدات Prisma والأمور الهامة
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

# نسخ ملفات النشر المصغّرة (Standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# نسخ سكريبت التشغيل
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# إعطاء الصلاحيات لمنع أخطاء الـ permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
