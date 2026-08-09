import type { CooldownDecision, CooldownKey, CooldownStore } from '../../../application/cooldown/CooldownStore.js';

export interface InMemoryCooldownStoreOptions {
    maxEntries: number;
    now?: () => number;
}

export class InMemoryCooldownStore implements CooldownStore {
    private readonly entries = new Map<string, number>();
    private readonly now: () => number;

    public constructor(private readonly options: InMemoryCooldownStoreOptions) {
        if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) {
            throw new RangeError('maxEntriesは1以上の整数である必要があります。');
        }
        this.now = options.now ?? Date.now;
    }

    public acquire(key: CooldownKey, ttlMs: number): Promise<CooldownDecision> {
        if (!Number.isInteger(ttlMs) || ttlMs < 1) return Promise.reject(new RangeError('ttlMsは1以上の整数である必要があります。'));
        const now = this.now();
        const entryKey = this.key(key);
        const expiresAt = this.entries.get(entryKey);
        if (expiresAt !== undefined && expiresAt > now) {
            return Promise.resolve({ acquired: false, retryAfterMs: expiresAt - now });
        }

        this.entries.delete(entryKey);
        this.entries.set(entryKey, now + ttlMs);
        this.evictExpiredAndOverflow(now);
        return Promise.resolve({ acquired: true });
    }

    private evictExpiredAndOverflow(now: number): void {
        for (const [key, expiresAt] of this.entries) {
            if (expiresAt <= now) this.entries.delete(key);
        }
        while (this.entries.size > this.options.maxEntries) {
            let earliestKey: string | undefined;
            let earliestExpiry = Number.POSITIVE_INFINITY;
            for (const [key, expiresAt] of this.entries) {
                if (expiresAt < earliestExpiry) {
                    earliestKey = key;
                    earliestExpiry = expiresAt;
                }
            }
            if (earliestKey === undefined) break;
            this.entries.delete(earliestKey);
        }
    }

    private key(key: CooldownKey): string {
        return `${key.commandKey}\u0000${key.userId}`;
    }
}
