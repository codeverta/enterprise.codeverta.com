# Stage 1: Build
FROM node:23-alpine AS builder
WORKDIR /app

# Enable pnpm bawaan Node 23
RUN corepack enable

# Copy file config monorepo (PENTING: Context harus dari root)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json spesifik app ini
COPY apps/admin/package.json ./apps/admin/

# Install dependencies (untuk semua workspace biar aman)
# pnpm v10 build-script approvals are configured in pnpm-workspace.yaml.
RUN pnpm install --frozen-lockfile
#RUN pnpm install --frozen-lockfile

# Copy seluruh source code
COPY . .

ARG BUILD_MODE=production
ENV BUILD_MODE=${BUILD_MODE}

# Build app spesifik (gunakan --filter)
RUN cd apps/admin && pnpm build --mode ${BUILD_MODE}

# Stage 2: Serve dengan Nginx
FROM nginx:alpine
# Copy hasil build
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
# COPY CONFIG CUSTOM DISINI
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
