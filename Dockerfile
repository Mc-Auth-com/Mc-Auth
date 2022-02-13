# syntax=docker/dockerfile:1
FROM node:16-alpine as base

LABEL maintainer="Christian Koop <contact@sprax2013.de>"

EXPOSE 8091
VOLUME ["/app/storage/"]

USER node
WORKDIR /app/
COPY --chown=node:node LICENSE README.md ./
COPY --chown=node:node package.json package-lock.json ./


FROM base as builder

ARG BUILD_SCRIPT=build

RUN npm ci
COPY --chown=node:node tsconfig.json ./tsconfig.json
COPY --chown=node:node src/ ./src/
RUN npm run $BUILD_SCRIPT
RUN ls -l


FROM base as prod

ENV NODE_ENV=production
RUN npm ci && \
    npm cache clean --force

COPY --chown=node:node --from=builder /app/dist/ ./dist/
COPY --chown=node:node resources/ ./resources/

CMD ["node", "dist/index.js"]


FROM base as dev

# TODO: Check if volume mounts could be beneficial for development
RUN npm ci

COPY --chown=node:node --from=builder /app/dist/ ./dist/
COPY --chown=node:node resources/ ./resources/

CMD ["node", "--enable-source-maps", "dist/index.js"]
