import Redis from 'ioredis';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { type EnvVariables } from 'config/env-variables';
import { REDIS_CLIENT } from './redis.factory';
import { type UserAuthInfo } from 'src/resources/auth/interfaces/user-auth-info.interface';
import { isUUID } from 'src/utils';
import { INVALID_CACHE_KEY_FORMAT } from 'src/common/constants/error-messages';

export type CacheTokenValue = UserAuthInfo & { hash: string };

// ? Note on architecture:
// This cache service will exists in auth-ms and will be used by it directly (it can eventually be set in a different ms, but there is no need at this point)
// - auth-ms writes mainly to it (one way usage)
// - client-gateway reads mainly from it via a direct connection (not cache-service/auth-ms)
// - should other ms/app modify cache, it goes through auth-ms (user deactivated/deleted)
// ** Cache used exclusively for reading tokens (refresh token and roles)
@Injectable()
export class CacheService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(
    private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    private readonly configService: ConfigService<EnvVariables>,
  ) {
    this.logger.setContext(CacheService.name);
  }
  onApplicationBootstrap() {
    this.logger.info('Redis cache service bootstrap');
    // await this.redisClient.connect(); // should be called in test env (lazyConnect : true)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onApplicationShutdown(signal?: string) {
    this.logger.info('Redis client closing...');
    await this.redisClient.quit();
  }

  // !!! MAIN REASON FOR THIS TO BE SHARED LIB
  getKey(userId: string): string {
    return `auth:user:${userId}`;
  }

  async getValue(userId: string): Promise<CacheTokenValue | null> {
    if (!isUUID(userId)) {
      throw new BadRequestException(INVALID_CACHE_KEY_FORMAT);
    }
    const stringValue = await this.redisClient.get(this.getKey(userId));
    return this.toObject(stringValue);
  }

  private get isDev() {
    return this.configService.getOrThrow('NODE_ENV') === 'development';
  }

  private toObject(value?: string | null): CacheTokenValue | null {
    try {
      if (value) {
        return JSON.parse(value) as CacheTokenValue;
      } else {
        return null;
      }
    } catch (error: unknown) {
      this.logger.error(error);
      throw new InternalServerErrorException('Check cache service');
    }
  }
}

// Notes on cache
// https://dev.to/randazraik/microservices-caching-demystified-strategies-topologies-and-best-practices-43ad

/**
 * is it ok for two microservices to access cache?
 * 
Yes, it is generally okay for two or more microservices to access a shared cache (such as Redis or Memcached), but it depends on the use case and must be managed carefully to avoid violating microservice principles. 

While the "shared-nothing" architecture suggests each service should have its own database, sharing a cache is a common, acceptable, and effective way to improve performance, reduce database load, and share data between services, provided it does not lead to tight coupling. 

Here is a breakdown of when it is acceptable and the potential pitfalls:

When Sharing a Cache is Acceptable (Good Patterns)

Performance Optimization: Caching frequently accessed, read-only data (e.g., product catalogs, configuration data) across multiple services to avoid redundant, slow database calls.

Shared Session Management: Sharing user session data between services (e.g., Auth Service and User Profile Service).

Distributed Rate Limiting: Using a central cache (Redis) to track API request limits across multiple service instances.

Eventual Consistency Mechanisms: As long as the cache is not the only source of truth and services are designed to handle eventual consistency, it is acceptable. 


Risks and Pitfalls (What to Avoid)

Tight Coupling: If Service A directly writes to a cache, and Service B depends on that specific structure, they become tightly coupled. If A changes its data format, B breaks.

Cache Invalidation Problems: If both services write to the same cache keys, it is difficult to know when to invalidate data, leading to stale data and inconsistency.

Single Point of Failure: A shared cache (e.g., a single Redis instance) becomes a single point of failure for all connected services. 


Best Practices for Sharing Caches

Use Unique Keys/Namespacing: Ensure each service uses unique prefixes for its keys (e.g., serviceA:user:123 vs serviceB:user:123) to prevent accidental overwrites.

Define Ownership: Only one service should be the "owner" (writer) of a specific set of data in the cache. Other services should treat it as read-only.

Handle Serialization/Deserialization: If multiple services use the same cache, they must use compatible data serialization formats (e.g., JSON) to avoid errors.

Use Distributed Caches: Use robust, distributed caching solutions like Redis clusters that offer high availability rather than relying on local in-memory caches. 


*
* should cache be in client gateway or auth microservice?
* 

The cache for authentication data should ideally be implemented in a distributed manner accessible by both the API Gateway and the auth microservice, but the primary lookups should occur at the API Gateway level to improve performance and reduce backend load. 

Here is a breakdown of why and how:

API Gateway Caching

It is a common practice to offload authentication and authorization responsibilities to the API Gateway. The gateway acts as a single entry point and can cache session information or validation results (e.g., whether a JSON Web Token (JWT) is valid). 

Benefits:

Reduced Latency: Most requests require authentication/authorization, so validating the token at the gateway minimizes the delay for the client.

Lower Backend Load: It prevents repetitive validation calls from reaching the auth microservice and other backend services, thereby reducing their computational load.

Centralized Control: It ensures consistent security policy enforcement across all microservices. 


Auth Microservice Caching

The auth microservice itself still needs a caching mechanism, particularly when issuing new tokens or managing user credentials. 

Benefits:

Rapid Token Issuance: Caching frequently accessed user data (like roles and permissions) speeds up the process of generating new tokens.

Database Protection: It shields the underlying authentication database from direct access for every minor detail or lookup. 


Recommended Approach: Distributed Cache 

The most effective solution in a scalable microservices architecture is to use a distributed cache (e.g., Redis) that both the API Gateway and the auth microservice can access. 

The API Gateway is configured to check the cache first. If a valid, non-expired token is found in the cache, the request is immediately routed to the correct microservice with the necessary authorization context attached (e.g., user ID, roles).

If the token is not in the cache or requires re-validation, the auth microservice handles the validation, updates the distributed cache, and the process continues.

This approach ensures high performance while allowing services to scale independently. 


*
* should microservices access cache directly or via a specific microservice?
* 

Microservices should generally access a shared, distributed cache (e.g., Redis) directly, rather than through a dedicated "cache service," to maximize performance and minimize latency. Using a shared cache ensures data consistency across multiple instances while adhering to domain boundaries, whereas accessing via another service adds unnecessary network hops and complexity. 

Key Considerations for Cache Access:

Direct Access (Shared Cache):

Advantages: High performance, low latency, and consistent data across multiple service instances.

Best For: Most scenarios in distributed systems, especially when using Redis or Memcached to avoid data silos.


Via a Specific Microservice (Data Owner):

Advantages: Strong data consistency; the owning service controls when data is updated in the cache.

Best For: Scenarios where only one service is responsible for writing data, and others only read it, preventing cache invalidation issues.

Risks of In-Memory Caching: Using local in-memory caches within each microservice instance can lead to data inconsistency ("cache incoherence") when multiple instances are running.

Best Practices: Utilize cache-aside (lazy loading) or write-through patterns to manage data consistency efficiently. 

For high-performance needs, direct access to a shared Redis cluster is the industry standard. 


*
* is it bad practice to consult cache on each request by api gateway?
* 

Consulting a cache on every request at the API Gateway is generally good practice for read-heavy workloads, not bad practice, as it reduces backend load and improves latency. It acts as an in-memory lookup, serving responses faster than hitting services like Lambda or database systems, provided that data does not require strict real-time updates. 
Here is a breakdown of why this is considered a best practice:
Performance & Latency: By enabling caching, API Gateway checks for a response in memory before invoking the backend, leading to significantly lower latency and faster user response times.
Reduced Backend Load & Costs: It minimizes the number of calls made to downstream services, saving money on compute resources and reducing database strain.
Optimal Use Cases: It is ideal for GET requests where data is shared across users or does not change frequently, such as user lists or static configuration data.
Configuration Flexibility: You can control the Time To Live (TTL) to manage data freshness (default is 300 seconds) and set up specific cache keys based on headers or query parameters. 
When it might be bad practice:
Highly Dynamic Data: If the data changes immediately upon being written, caching can lead to users seeing stale, outdated information.
Large Payloads: If responses exceed the cache size (e.g., 1MB in AWS API Gateway), caching may not be effective.
Not Setting Proper Cache Keys: Failing to define unique cache keys (e.g., for different user IDs) can result in one user seeing another user's data. 
To implement this safely, ensure that sensitive or volatile data is not cached, and configure appropriate TTL settings. 

*/
