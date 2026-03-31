# Stage 1: Build
FROM node:20-slim AS build
RUN npm install -g bun

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

COPY prisma ./prisma/
RUN bunx prisma generate

COPY . .
RUN bun run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma

ENV NODE_ENV=prod

EXPOSE 3000
CMD ["node", "dist/main"]
