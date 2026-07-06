# Stage 1: Build
FROM node:20-slim AS build
RUN npm install -g bun

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

ARG VITE_POSTHOG_KEY
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY

ARG VITE_POSTHOG_HOST
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT

# Version identification — baked into the bundle at build time.
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ARG BUILT_AT=unknown
ENV VITE_APP_VERSION=$APP_VERSION \
    VITE_GIT_SHA=$GIT_SHA \
    VITE_BUILT_AT=$BUILT_AT

RUN bun run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ARG BUILT_AT=unknown
LABEL org.opencontainers.image.title="pelvi-web" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.created=$BUILT_AT \
      org.opencontainers.image.source="https://github.com/brav-lima/pelvi-ui"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
