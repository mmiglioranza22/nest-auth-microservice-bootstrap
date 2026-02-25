# nest-auth-microservice-bootstrap

🚧 **WORK IN PROGRESS** 🚧

Pending work:

- [ ] Testing (refactor)
- [ ] Shared modules (refactor as **packages**)
- [ ] Outbox pattern (sync between auth_user and user entities)
- [ ] Update READMEs (nats jetstream instructions, main instractions for pem keys)
- [ ] Remove comments (TODOs)

This is the microservices version of [nestjs-auth-bootstrap](https://github.com/mmiglioranza22/nestjs-auth-bootstrap)

## What's different?

- pnpm workspace that handles three NestJS applications:
  - `main-api`: business application goes here (handle **users** as an example)
  - `client-api-gateway`: HTTP entry point for clients
  - `auth-ms`: hybrid NestJS application for authentication logic (asymmetric flow)
- Database-per-service infrastructure
- NATS Core used for internal application communication
- NATS JetStream implementation as a shared package `nats-jetstream-transport-module`
- RS256 public-private-key authentication implementation using `jose` and `jwks-rsa` with token rotation and public key discovery (/.well-known/jwks.json)
