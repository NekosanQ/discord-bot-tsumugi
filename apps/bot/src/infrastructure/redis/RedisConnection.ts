import { createClient } from 'redis';

import { RedisMetrics } from './RedisMetrics.js';

export class RedisCommandTimeoutError extends Error {
    public constructor(public readonly timeoutMs: number) {
        super(`Redis command timed out after ${String(timeoutMs)}ms.`);
        this.name = 'RedisCommandTimeoutError';
    }
}

export interface RedisConnectionOptions {
    url: string;
    connectTimeoutMs: number;
    commandTimeoutMs: number;
    reconnectBaseDelayMs: number;
    reconnectMaxDelayMs: number;
    metrics: RedisMetrics;
    random?: () => number;
}

export class RedisConnection {
    private readonly client;
    private readonly random: () => number;
    private closing = false;
    private started = false;

    public constructor(private readonly options: RedisConnectionOptions) {
        this.random = options.random ?? Math.random;
        this.client = createClient({
            url: options.url,
            disableOfflineQueue: true,
            socket: {
                connectTimeout: options.connectTimeoutMs,
                reconnectStrategy: (retries): number => {
                    const exponential = Math.min(options.reconnectBaseDelayMs * 2 ** Math.min(retries, 8), options.reconnectMaxDelayMs);
                    return Math.round(exponential / 2 + this.random() * (exponential / 2));
                }
            }
        });
        this.client.on('ready', (): void => {
            options.metrics.markReady();
        });
        this.client.on('reconnecting', (): void => {
            options.metrics.markConnecting();
        });
        this.client.on('error', (): void => {
            options.metrics.markDegraded();
        });
        this.client.on('end', (): void => {
            if (!this.closing) options.metrics.markDegraded();
        });
    }

    public start(): void {
        if (this.started) return;
        this.started = true;
        this.options.metrics.markConnecting();
        void this.client.connect().catch((): void => {
            if (!this.closing) this.options.metrics.markDegraded();
        });
    }

    public setIfAbsent(key: string, ttlMs: number): Promise<string | null> {
        return this.withTimeout((abortSignal) =>
            this.client.withCommandOptions({ abortSignal }).set(key, '1', {
                // Redis protocol option names are uppercase by API contract.
                // eslint-disable-next-line @typescript-eslint/naming-convention
                NX: true,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                PX: ttlMs
            })
        );
    }

    public ttl(key: string): Promise<number> {
        return this.withTimeout((abortSignal) => this.client.withCommandOptions({ abortSignal }).pTTL(key));
    }

    public delete(key: string): Promise<number> {
        return this.withTimeout((abortSignal) => this.client.withCommandOptions({ abortSignal }).del(key));
    }

    public close(): Promise<void> {
        if (this.closing) return Promise.resolve();
        this.closing = true;
        if (this.client.isOpen) this.client.destroy();
        return Promise.resolve();
    }

    private async withTimeout<T>(operation: (abortSignal: AbortSignal) => Promise<T>): Promise<T> {
        const controller = new AbortController();
        const timeout = setTimeout((): void => {
            controller.abort(new RedisCommandTimeoutError(this.options.commandTimeoutMs));
        }, this.options.commandTimeoutMs);
        timeout.unref();
        try {
            return await operation(controller.signal);
        } catch (error) {
            if (controller.signal.aborted) throw new RedisCommandTimeoutError(this.options.commandTimeoutMs);
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}
