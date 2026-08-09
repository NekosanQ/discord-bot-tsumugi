export type RedisDependencyState = 'disabled' | 'connecting' | 'ready' | 'degraded';

export interface RedisMetricsSnapshot {
    state: RedisDependencyState;
    acquired: number;
    rejected: number;
    fallbacks: number;
    timeouts: number;
}

export class RedisMetrics {
    private state: RedisDependencyState = 'disabled';
    private acquired = 0;
    private rejected = 0;
    private fallbacks = 0;
    private timeouts = 0;

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

    public recordDecision(acquired: boolean): void {
        if (acquired) this.acquired++;
        else this.rejected++;
    }

    public recordFallback(timedOut: boolean): void {
        this.fallbacks++;
        if (timedOut) this.timeouts++;
        this.markDegraded();
    }

    public snapshot(): RedisMetricsSnapshot {
        return {
            state: this.state,
            acquired: this.acquired,
            rejected: this.rejected,
            fallbacks: this.fallbacks,
            timeouts: this.timeouts
        };
    }

    private setState(nextState: RedisDependencyState): void {
        if (this.state === nextState) return;
        this.state = nextState;
        this.reportStateChange(nextState);
    }
}
