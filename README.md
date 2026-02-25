# nest-auth-microservice-bootstrap

🚧 **WORK IN PROGRESS** 🚧

Pending work:

- [ ] Testing (refactor)
- [ ] Shared modules (refactor as **packages**)
- [ ] Outbox pattern (sync between auth_user and user entities)
- [ ] Update READMEs (nats jetstream instructions, main instractions for pem keys)
- [ ] Remove comments (TODOs)
- [ ] Fix Dockerfiles
- [ ] Update env-variables.ts for each app

This is the microservices version of [nestjs-auth-bootstrap](https://github.com/mmiglioranza22/nestjs-auth-bootstrap)

## Why?

Authentication with microservices can be a challenge and this can give you a mental model and practical example of how that can be achieved in NestJS.

Note: NATS JetStream is not _required_ for this, yet it was developed with the intention of solving distributed system consistency that comes with any microservices architecture through the outbox pattern (i.e: creating a user in sign up -auth service database- should create a user in the main application's database). Other solutions can be adopted for this particular problem (change data capture), but outbox pattern fitted nicely and NATS JetStream was the go to solution for it, despite not being supported out of the box by the Nest team (awesome community [plugins](https://github.com/Redningsselskapet/nestjs-plugins/tree/master/packages/nestjs-nats-jetstream-transport) exist though, check them out).

## What's different?

- pnpm workspace that handles three NestJS applications:
  - `main-api`: business application goes here (handle **users** as an example)
  - `client-api-gateway`: HTTP entry point for clients
  - `auth-ms`: hybrid NestJS application for authentication logic (asymmetric flow)
- Database-per-service infrastructure
- NATS Core used for internal application communication
- NATS JetStream implementation as a shared package `nats-jetstream-transport-module`
- RS256 public-private-key authentication implementation using `jose` and `jwks-rsa` with token rotation and public key discovery (/.well-known/jwks.json). Refresh token signed with regular HS256 algorithm (secret).
- Specific Postman collection (only difference is the public key certs route and folder organization)
- [Auth cycle](https://github.com/mmiglioranza22/nestjs-auth-bootstrap?tab=readme-ov-file#auth-cycle) is essentially the same from the client POV. Only difference is that internally all authorization logic is done by the authentication microservice (better scalability), keeping in sync with the api gateway all refresh tokens with the shared Redis instance. Authentication and authorization guards are implemented by the api gateway (although it can be more fine grained in each microservice if wished so).

## Currently working OK

- Internal communication between apps using NATS Core transport
- Authentication: Token rotation and invalidation at api gateway level (public and private keys must be created in `auth-ms/public/certs/` or configured at infrastructure level - docker secrets, env variables, etc. - for production level).
- Authorization: role-based at api gateway level (guards, decorators)
- Persistent message communication through NATS JetStream: Only happy path (Error handling to be implemented)

### Creating pem certs (public/private keys)

You must create your public and private keys for the JwtStrategy to work properly.

With `openssl`

```
openssl genrsa -out private.pem 2048

openssl rsa -in private.pem -pubout -out public.pem
```

Here is a [video example](https://youtu.be/KQPuPbaf7vk?si=S0IY-orSTH8Oc8W9&t=649) if you've never done this before

## Local development

Create your `.env.development` variables following the `.env.template` for each app. Each `.env.development` file should be located at each app's `/config` directory.

Once that is done, always from the root of your pnpm workspace:

1- Start docker containers

```
docker compose -f compose.workspace.dev.yaml down && docker compose -f compose.workspace.dev.yaml up
```

2- Install deps and build apps

```
pnpm install
pnpm run build
```

3- Start apps: You can either start all apps in parallel

```
pnpm run start:dev
```

Or run them in separate terminals / shells

```
pnpm --filter @apps/auth-ms start:dev
pnpm --filter @apps/main-api start:dev
pnpm --filter @apps/client-api-gateway start:dev

```

## Postman

You need to seed apps before starting

From the [postman collection Microservices version](https://www.postman.com/orbital-module-astronomer-66959558/workspace/nestjs-auth-bootstrap/collection/16327695-2963349f-906f-4faf-b25e-e7612d6de197?action=share&source=copy-link&creator=16327695), seed all apps (`/seed`)

Once done and successful, you can login with the default user, sign in a new one (verification email sent to your mailbox sandbox)
