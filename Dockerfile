# Use the official Node.js 22 Alpine image as the base image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install the tileblaster package globally
RUN npm install -g tileblaster

# Set the entry point to run tileblaster with customizable parameters
ENTRYPOINT ["node", "tileblaster"]

# Allow users to pass additional arguments
CMD []