# Use the official Node.js 22 image as the base
FROM node:22-slim

# Install system dependencies for media processing (FFmpeg and ImageMagick)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    graphicsmagick \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first to optimize build caching
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose port 10000 for the web server (Pairing Code interface)
EXPOSE 10000

# Command to start the bot
CMD ["node", "index.js"]
