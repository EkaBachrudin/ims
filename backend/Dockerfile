FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

EXPOSE 3000

# Terapkan migration lalu jalankan server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
