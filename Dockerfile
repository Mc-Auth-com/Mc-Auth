# syntax=docker/dockerfile:1
FROM node:16-alpine as base

LABEL maintainer="Christian Koop <contact@sprax2013.de>"

EXPOSE 8091
VOLUME ["/app/storage/"]

WORKDIR /app/
RUN chown node:node /app/

USER node

COPY --chown=node:node LICENSE README.md ./
COPY --chown=node:node package.json package-lock.json ./


##
# Builder: Compiles the project into js files (optionally generates source maps too)
##
FROM base as builder

ARG BUILD_SCRIPT=build

RUN npm ci
COPY --chown=node:node tsconfig.json ./tsconfig.json
COPY --chown=node:node src/ ./src/
RUN npm run $BUILD_SCRIPT
RUN ls -l


##
# Production: Copies the resources and compiled js files and starts the application
##
FROM base as prod

ENV NODE_ENV=production
RUN npm ci && \
    npm cache clean --force

COPY --chown=node:node --from=builder /app/dist/ ./dist/
COPY --chown=node:node resources/ ./resources/

CMD ["node", "dist/index.js"]


##
# Development: Copies the resources, compiled js files and source maps and starts the application with source map support
##
FROM base as dev

# TODO: Check if volume mounts could be beneficial for development
RUN npm ci

COPY --chown=node:node --from=builder /app/dist/ ./dist/
COPY --chown=node:node resources/ ./resources/

CMD ["node", "--enable-source-maps", "dist/index.js"]
