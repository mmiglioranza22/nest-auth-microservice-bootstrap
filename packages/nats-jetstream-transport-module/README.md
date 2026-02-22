# nats-jetstream-transport-module

Usecases

Previous requirements (nats server, consumers, streams)

How does it work (overall, dependencies, options, config)

How to configure (options, use with ClientsModule)

How to set in hybrid apps

How to set in microservices only apps

How should services import it

How should hooks be registered (onModuleInit)

How ack should be done
NATS JetStream messages should be acknowledged (ack()) immediately after they are successfully processed by the consumer application to ensure at-least-once delivery.
