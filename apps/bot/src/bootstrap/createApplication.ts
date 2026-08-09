export interface ApplicationDependencies {
    startDependencies: () => void | Promise<void>;
    registerEvents: () => void;
    unregisterEvents: () => void;
    stopBackgroundTasks: () => void;
    waitForInFlight: () => Promise<void>;
    login: () => Promise<void>;
    destroyClient: () => Promise<void>;
    shutdownDependencies: () => Promise<void>;
    shutdownLogging: () => Promise<void>;
}

export interface BotApplication {
    start: () => Promise<void>;
    stop: () => Promise<void>;
}

export interface ApplicationOptions {
    cleanupTimeoutMs?: number;
}

export class ApplicationCleanupTimeoutError extends Error {
    public constructor(
        public readonly cleanupName: string,
        public readonly timeoutMs: number
    ) {
        super(`終了処理(${cleanupName})が${String(timeoutMs)}ms以内に完了しませんでした。`);
        this.name = 'ApplicationCleanupTimeoutError';
    }
}

type ApplicationState = 'created' | 'starting' | 'started' | 'stopping' | 'stopped';

/** DiscordやDBの具象型を持たない、Botの起動・終了境界を作成する */
export function createApplication(dependencies: ApplicationDependencies, options: ApplicationOptions = {}): BotApplication {
    let state: ApplicationState = 'created';
    let startPromise: Promise<void> | undefined;
    let stopPromise: Promise<void> | undefined;
    const cleanupTimeoutMs = options.cleanupTimeoutMs ?? 10_000;

    const runWithTimeout = (cleanupName: string, cleanup: () => void | Promise<void>): Promise<void> =>
        new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new ApplicationCleanupTimeoutError(cleanupName, cleanupTimeoutMs));
            }, cleanupTimeoutMs);

            void Promise.resolve()
                .then(cleanup)
                .then(resolve, reject)
                .finally(() => {
                    clearTimeout(timeout);
                });
        });

    const beginCleanup = (pendingStart?: Promise<void>): Promise<void> => {
        if (stopPromise) return stopPromise;

        state = 'stopping';
        stopPromise = (async (): Promise<void> => {
            const errors: unknown[] = [];

            const runCleanup = async (cleanupName: string, cleanup: () => void | Promise<void>): Promise<void> => {
                try {
                    await runWithTimeout(cleanupName, cleanup);
                } catch (error) {
                    errors.push(error);
                }
            };

            await runCleanup('event unregister', dependencies.unregisterEvents);
            await runCleanup('background task stop', dependencies.stopBackgroundTasks);
            if (pendingStart) {
                await runCleanup('startup completion', (): Promise<void> => pendingStart);
            }
            await runCleanup('in-flight event drain', dependencies.waitForInFlight);
            await runCleanup('Discord client destroy', dependencies.destroyClient);
            await runCleanup('dependency shutdown', dependencies.shutdownDependencies);
            await runCleanup('logger shutdown', dependencies.shutdownLogging);

            state = 'stopped';
            if (errors.length > 0) {
                throw new AggregateError(errors, 'Botの終了処理中にエラーが発生しました。');
            }
        })();

        return stopPromise;
    };

    const stop = (): Promise<void> => {
        const pendingStart = state === 'starting' ? startPromise : undefined;
        return beginCleanup(pendingStart);
    };

    const shutdownInProgress = (): boolean => state === 'stopping' || state === 'stopped';

    const start = async (): Promise<void> => {
        if (state === 'started') return;
        if (state === 'starting' && startPromise) return startPromise;
        if (state !== 'created') {
            throw new Error(`現在の状態(${state})ではBotを起動できません。`);
        }

        state = 'starting';
        startPromise = (async (): Promise<void> => {
            try {
                await dependencies.startDependencies();
                dependencies.registerEvents();
                await dependencies.login();
                if (!shutdownInProgress()) {
                    state = 'started';
                }
            } catch (error) {
                if (shutdownInProgress()) return;

                try {
                    await beginCleanup();
                } catch (shutdownError) {
                    throw new AggregateError([error, shutdownError], 'Botの起動と終了処理に失敗しました。');
                }
                throw error;
            }
        })();

        return startPromise;
    };

    return { start, stop };
}
