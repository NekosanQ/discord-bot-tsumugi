import type { DashboardRateLimitBucket, DashboardRateLimiter } from '../../application/dashboard/DashboardPorts.js';

export interface DashboardRateLimitPolicy {
    readonly windowMs: number;
    readonly limits: Readonly<Record<DashboardRateLimitBucket, number>>;
}

interface Entry {
    count: number;
    expiresAt: number;
}

export class InMemoryDashboardRateLimiter implements DashboardRateLimiter {
    private readonly entries = new Map<string, Entry>();

    public constructor(
        private readonly policy: DashboardRateLimitPolicy,
        private readonly clock: () => number = Date.now,
        private readonly maximumEntries = 10000
    ) {}

    public consume(bucket: DashboardRateLimitBucket, identifier: string): Promise<boolean> {
        const now = this.clock();
        const key = `${bucket}:${identifier}`;
        const existing = this.entries.get(key);
        if (!existing || existing.expiresAt <= now) {
            this.evictExpired(now);
            if (this.entries.size >= this.maximumEntries) return Promise.resolve(false);
            this.entries.set(key, { count: 1, expiresAt: now + this.policy.windowMs });
            return Promise.resolve(true);
        }
        existing.count += 1;
        return Promise.resolve(existing.count <= this.policy.limits[bucket]);
    }

    private evictExpired(now: number): void {
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) this.entries.delete(key);
        }
    }
}
