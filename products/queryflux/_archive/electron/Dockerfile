# Multi-stage Dockerfile for cross-platform Electron builds
FROM ubuntu:22.04 AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    software-properties-common \
    git \
    python3 \
    python3-pip \
    build-essential \
    rpm \
    dpkg-dev \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxkbcommon-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libxrandr-dev \
    libgbm-dev \
    libxss1 \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Build all platforms
RUN npm run dist:all

# Extract build artifacts
FROM scratch AS artifacts
COPY --from=base /app/release /

# Runtime image for testing
FROM base AS runtime
WORKDIR /app
COPY --from=base /app/release .
COPY --from=base /app/dist .

# Install xvfb for headless testing
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

# Set display for headless operation
ENV DISPLAY=:99

# Start Xvfb in background
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 & npm start"]