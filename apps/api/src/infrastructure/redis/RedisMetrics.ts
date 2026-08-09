export type RedisDependencyState = 'disabled' | 'connecting' | 'ready' | 'degraded';

export interface RedisMetricsSnapshot {
    state: RedisDependencyState;
    hits: number;
    misses: number;
    fallbacks: number;
    timeouts: number;
    invalidValues: number;
    usedMemoryBytes?: number;
    evictedKeys?: number;
}

export class RedisMetrics {
    private state: RedisDependencyState = 'disabled';
    private hits = 0;
    private misses = 0;
    private fallbacks = 0;
    private timeouts = 0;
    private invalidValues = 0;

    public constructor(private readonly reportStateChange: (state: RedisDependencyState) => void = (): void => undefined) {}

    public markConnecting(): void {
        this.setState('connecting');
    }

    public markReady(): void {
        this.setState('ready');
    }

    public markDegraded(): void {
        this.setState('degraded');
    }

    public recordHit(): void {
        this.hits++;
    }

    public recordMiss(): void {
        this.misses++;
    }

    public recordFallback(timedOut: boolean): void {
        this.fallbacks++;
        if (timedOut) this.timeouts++;
        this.markDegraded();
    }

    public recordInvalidValue(): void {
        this.invalidValues++;
    }

    public snapshot(runtime: { usedMemoryBytes?: number; evictedKeys?: number } = {}): RedisMetricsSnapshot {
        return {
            state: this.state,
            hits: this.hits,
            misses: this.misses,
            fallbacks: this.fallbacks,
            timeouts: this.timeouts,
            invalidValues: this.invalidValues,
            ...runtime
        };
    }

    private setState(nextState: RedisDependencyState): void {
        if (this.state === nextState) return;
        this.state = nextState;
        this.reportStateChange(nextState);
    }
}
