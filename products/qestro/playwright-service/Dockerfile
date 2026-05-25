FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app

# Copy package management files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies and build
RUN npm install
COPY src ./src
RUN npx tsc

# Set port and start the node service
ENV PORT=4000
EXPOSE 4000

# The base image already has the necessary OS dependencies for Chromium
CMD ["node", "dist/index.js"]
