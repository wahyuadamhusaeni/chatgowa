# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Set default DATABASE_URL for build
ENV DATABASE_URL="file:./prisma/dev.db"

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create database with schema (for initial setup)
RUN npx prisma db push

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy necessary files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Expose port
EXPOSE 3000

# Start command
CMD ["npx", "tsx", "src/index.ts"]
