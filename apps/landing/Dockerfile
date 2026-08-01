# Stage 1: Build
FROM node:23-alpine AS builder
WORKDIR /app

# Enable corepack
RUN corepack enable

# Copy lock files and workspace configs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/guru2digit/package.json ./apps/guru2digit/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build guru2digit app
RUN cd apps/guru2digit && pnpm build

# Stage 2: Production Server with Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/apps/guru2digit/dist /usr/share/nginx/html

# Copy Nginx custom configuration
COPY apps/guru2digit/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]