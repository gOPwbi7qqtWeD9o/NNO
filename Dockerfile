# Use Node.js 18 Alpine image for smaller size
FROM node:18-alpine

# Install build dependencies for node-pty
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]