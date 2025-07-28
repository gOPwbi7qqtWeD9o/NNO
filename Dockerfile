# Use Node.js 18 Alpine image for smaller size
FROM node:18-alpine

# Install build dependencies for node-pty
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]