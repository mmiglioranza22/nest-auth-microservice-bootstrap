FROM node:krypton-alpine3.23

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./

RUN pnpm install

COPY . .

# Must match your env exposed port if you run it locally
# EXPOSE 3001 

# CMD ["pnpm", "run", "start:dev"]
