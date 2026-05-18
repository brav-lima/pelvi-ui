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

RUN apt-get update -y && apt-get install -y openssl

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma/
COPY --from=build /app/prisma.config.ts ./

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

# Version identification — read at runtime by GET /api/version.
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ARG BUILT_AT=unknown
ENV APP_VERSION=$APP_VERSION \
    GIT_SHA=$GIT_SHA \
    BUILT_AT=$BUILT_AT

LABEL org.opencontainers.image.title="pelvi-api" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.created=$BUILT_AT \
      org.opencontainers.image.source="https://github.com/brav-lima/pelvi-ui"

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
