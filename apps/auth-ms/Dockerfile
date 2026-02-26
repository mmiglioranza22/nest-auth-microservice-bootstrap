# https://pnpm.io/docker
FROM node:krypton-alpine3.23 AS deps

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json ./
# COPY pnpm-lock.yaml ./
# COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

RUN pnpm install

# 
FROM node:krypton-alpine3.23 AS build

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY --from=deps /usr/src/app/node_modules ./node_modules

ARG CACHE_BUST=1

COPY . .

RUN pnpm run build

# 
FROM node:krypton-alpine3.23 AS prod

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

ENV NODE_ENV development

USER appuser


# Must match your env exposed port if you run it locally
# EXPOSE 3001 

# CMD ["pnpm", "run", "start:dev"]
