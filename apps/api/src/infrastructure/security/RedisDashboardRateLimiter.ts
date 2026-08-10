import type { DashboardRateLimitBucket, DashboardRateLimiter, SecretCodec } from '../../application/dashboard/DashboardPorts.js';
import type { RedisConnection } from '../redis/RedisConnection.js';
import type { DashboardRateLimitPolicy } from './InMemoryDashboardRateLimiter.js';

export class RedisDashboardRateLimiter implements DashboardRateLimiter {
    public constructor(
        private readonly connection: RedisConnection,
        private readonly secrets: SecretCodec,
        private readonly environment: string,
        private readonly policy: DashboardRateLimitPolicy
    ) {}

    public consume(bucket: DashboardRateLimitBucket, identifier: string): Promise<boolean> {
        const opaqueIdentifier = this.secrets.digest(identifier);
        const bucketName = bucket === 'oauthStart' ? 'oauth-start' : bucket === 'oauthCallback' ? 'oauth-callback' : bucket;
        const key = `tsumugi:api-security:v1:${this.environment}:rate-limit:${bucketName}:${opaqueIdentifier}`;
        return this.connection.consumeFixedWindow(key, this.policy.limits[bucket], this.policy.windowMs);
    }
}
