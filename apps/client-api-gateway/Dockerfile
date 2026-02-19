FROM node:krypton-alpine3.23

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

# Install dotenvx
# RUN curl -sfS https://dotenvx.sh/install.sh | sh


COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./

RUN pnpm install

COPY . .

# Must match your env exposed port if you run it locally
EXPOSE 3000 

# CMD ["pnpm", "run", "start:watch"]
# CMD ["dotenvx", "run", "--", "pnpm", "run", "start:watch"]

