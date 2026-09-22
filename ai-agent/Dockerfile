FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY docs ./docs
RUN NODE_OPTIONS=--max-old-space-size=6144 npx tsc -p tsconfig.build.json

EXPOSE 8080

CMD ["node", "dist/index.js"]
