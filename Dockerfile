FROM node:22-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json first to leverage caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

ENTRYPOINT ["node", "./bin/tileblaster.js"]
CMD []