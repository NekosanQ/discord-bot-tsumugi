export interface CooldownKey {
    commandKey: string;
    userId: string;
}

export type CooldownDecision = { acquired: true } | { acquired: false; retryAfterMs: number };

export interface CooldownStore {
    acquire: (key: CooldownKey, ttlMs: number) => Promise<CooldownDecision>;
}
