# syntax=docker/dockerfile:1
# =====================================================================
# Aniverse PRO — Multi-stage Dockerfile
# Stage 1 (builder): install deps + build Next.js (dengan build tools
#                    untuk native module better-sqlite3).
# Stage 2 (runner):  image produksi ringkas, non-root user.
# =====================================================================

# ---------- Stage 1: Builder ----------
FROM node:20-alpine AS builder

# Build tools agar better-sqlite3 (native module) dapat dikompilasi
# jika prebuilt binary tidak tersedia untuk platform target.
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Salin manifest dependency dulu agar layer npm install di-cache.
# (Tidak ada package-lock.json di repo → pakai npm install; setelah
#  npm install pertama kali dijalankan, lock file akan dibuat.)
COPY package*.json ./
RUN npm install

# Salin seluruh source (node_modules & .next sudah di-exclude via .dockerignore).
COPY . .

# Build produksi Next.js.
ENV NODE_ENV=production
RUN npm run build

# ---------- Stage 2: Runner ----------
FROM node:20-alpine AS runner

# libc6-compat untuk kompatibilitas prebuilt binary better-sqlite3 di musl.
RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# User non-root bawaan image node:alpine (uid 1000).
# Buat folder data (SQLite) yang dapat ditulis oleh user node.
RUN mkdir -p /app/data && chown -R node:node /app

# Salin artifact build dari stage builder.
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

# Health check opsional (membutuhkan curl; di alpine tidak terpasang default,
# jadi tidak diaktifkan — aktifkan sendiri jika dibutuhkan).
# HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
#   CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
