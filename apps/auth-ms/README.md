<!-- https://stackoverflow.com/questions/72152120/how-to-handle-rpcexception-in-nestjs/75335979#75335979 -->

- No specific dto is used for successful responses ({success: true / false, code: TOKEN_NOT_FOUND, etc }), as empty observables just return EMPTY from their respective controllers after they executed the service logic required to perform their respective actions
- Errors in microservice are thrown and catch by its own global exception filter, handled and normalized there to be sent to the api gateway exception filter, where a specific response is mapped to be returneed to the client

<!-- https://chatgpt.com/c/698b6211-2438-8326-ab6e-21c6ef8999ee -->

Important clarification

A microservice exception filter does not propagate exceptions directly to the gateway.

Instead, it transforms any thrown error into a structured RpcException, which is then serialized and delivered to the API Gateway.

- Seeding in auth creates users, roles and syncs main api through outbox pattern. Seeding in main api only creates ta$$bles and roles entities, not users

Notes on why outbox pattern and nats jetstream

<!-- https://microservices.io/patterns/data/shared-database.html -->

Notes on why not shared db

<!-- https://www.youtube.com/watch?v=tV11trlimLk -->
