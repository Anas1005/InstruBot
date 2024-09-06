# Use Node Alpine as base image
FROM node:alpine

# Install necessary packages
RUN apk add --no-cache curl ffmpeg python3

# Set NODE_ENV to default to production (override during build for development)
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY ../package.json ./
COPY ../package-lock.json ./

# Install Node.js dependencies
RUN if [ "${NODE_ENV}" = "development" ]; \
    then npm install --only=development; \
    else npm install; \
    fi

# Download yt-dlp standalone binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Ensure ffmpeg and ffprobe are correctly linked
RUN ln -s /usr/bin/ffmpeg /usr/local/bin/ffmpeg && \
    ln -s /usr/bin/ffprobe /usr/local/bin/ffprobe

# Copy the entire service directory into the Docker image
COPY . .

# Command to run the converter service
CMD ["npm", "run", "start-converter"]
