# Use Node Alpine as base image
FROM node:alpine

# Set NODE_ENV to default to production (override during build for development)
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json from root
COPY ../package.json ./
COPY ../package-lock.json ./

# Install dependencies based on NODE_ENV
RUN if [ "${NODE_ENV}" = "development" ]; \
    then npm install --only=development; \
    else npm install; \
    fi

# Copy the entire service directory into the Docker image
COPY . .

# Command to run the bot service using nodemon during development
CMD ["npm", "run", "start-search"]
