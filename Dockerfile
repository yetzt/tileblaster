FROM node:22-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache python3 make gcc g++ libc6-compat
RUN npm install tileblaster

ENTRYPOINT ["node", "node_modules/tileblaster/bin/tileblaster.js"]
CMD []