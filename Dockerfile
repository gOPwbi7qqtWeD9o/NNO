# Use Node.js 18 Alpine image for smaller size
FROM node:18-alpine

# Install build dependencies for node-pty and build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    git \
    libc6-compat

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --verbose

# Copy application source code
COPY . .

# Set NODE_ENV for build
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Clean up dev dependencies after successful build
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

# No health check - curl not available in alpine

# Start the application
CMD ["npm", "start"]