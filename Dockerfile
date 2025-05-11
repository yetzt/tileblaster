FROM node:22-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache python3 make g++
COPY . .
RUN npm install

ENTRYPOINT ["node", "./bin/tileblaster.js"]
CMD []