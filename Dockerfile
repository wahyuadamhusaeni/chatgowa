# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Set default DATABASE_URL for build (used by prisma generate only, not db push)
ENV DATABASE_URL="file:./prisma/dev.db"

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDeps needed for tsc + prisma generate)
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy compiled output (includes dist/generated/ from tsc — explicit Prisma client)
COPY --from=builder /app/dist ./dist

# Copy Prisma files (schema + migrations — needed for prisma migrate deploy at runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# Copy package files and install production dependencies only
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Expose port
EXPOSE 3000

# Run migrations then start server
CMD ["./entrypoint.sh"]
