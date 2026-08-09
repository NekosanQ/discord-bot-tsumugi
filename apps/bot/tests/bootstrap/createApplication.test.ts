import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationCleanupTimeoutError, type ApplicationDependencies, createApplication } from '../../src/bootstrap/createApplication.js';

function createDependencies(calls: string[], overrides: Partial<ApplicationDependencies> = {}): ApplicationDependencies {
    const dependencies: ApplicationDependencies = {
        registerEvents: (): void => {
            calls.push('registerEvents');
        },
        unregisterEvents: (): void => {
            calls.push('unregisterEvents');
        },
        stopBackgroundTasks: (): void => {
            calls.push('stopBackgroundTasks');
        },
        waitForInFlight: (): Promise<void> => {
            calls.push('waitForInFlight');
            return Promise.resolve();
        },
        login: (): Promise<void> => {
            calls.push('login');
            return Promise.resolve();
        },
        destroyClient: (): Promise<void> => {
            calls.push('destroyClient');
            return Promise.resolve();
        },
        shutdownDependencies: (): Promise<void> => {
            calls.push('shutdownDependencies');
            return Promise.resolve();
        },
        shutdownLogging: (): Promise<void> => {
            calls.push('shutdownLogging');
            return Promise.resolve();
        }
    };

    return { ...dependencies, ...overrides };
}

void test('startとstopは並行・重複呼び出しでも各処理を一度だけ実行する', async (): Promise<void> => {
    const calls: string[] = [];
    const application = createApplication(createDependencies(calls));

    await Promise.all([application.start(), application.start()]);
    assert.deepEqual(calls, ['registerEvents', 'login']);

    await Promise.all([application.stop(), application.stop()]);
    assert.deepEqual(calls, [
        'registerEvents',
        'login',
        'unregisterEvents',
        'stopBackgroundTasks',
        'waitForInFlight',
        'destroyClient',
        'shutdownDependencies',
        'shutdownLogging'
    ]);
});

void test('login失敗時も全resourceを後始末して元のerrorを返す', async (): Promise<void> => {
    const calls: string[] = [];
    const loginError = new Error('login failed');
    const application = createApplication(
        createDependencies(calls, {
            login: (): Promise<void> => {
                calls.push('login');
                return Promise.reject(loginError);
            }
        })
    );

    await assert.rejects(application.start(), (error: unknown): boolean => error === loginError);
    assert.deepEqual(calls, [
        'registerEvents',
        'login',
        'unregisterEvents',
        'stopBackgroundTasks',
        'waitForInFlight',
        'destroyClient',
        'shutdownDependencies',
        'shutdownLogging'
    ]);

    await application.stop();
    assert.equal(calls.filter((call) => call === 'destroyClient').length, 1);
});

void test('cleanupの一部が失敗しても残りを続行してAggregateErrorを返す', async (): Promise<void> => {
    const calls: string[] = [];
    const unregisterError = new Error('unregister failed');
    const application = createApplication(
        createDependencies(calls, {
            unregisterEvents: (): void => {
                calls.push('unregisterEvents');
                throw unregisterError;
            }
        })
    );

    await application.start();
    await assert.rejects(application.stop(), (error: unknown): boolean => error instanceof AggregateError && error.errors.includes(unregisterError));
    assert.deepEqual(calls.slice(-6), [
        'unregisterEvents',
        'stopBackgroundTasks',
        'waitForInFlight',
        'destroyClient',
        'shutdownDependencies',
        'shutdownLogging'
    ]);
});

void test('cleanupがtimeoutしても後続resourceの解放を続ける', async (): Promise<void> => {
    const calls: string[] = [];
    const application = createApplication(
        createDependencies(calls, {
            waitForInFlight: (): Promise<void> => {
                calls.push('waitForInFlight');
                return new Promise<void>(() => undefined);
            }
        }),
        { cleanupTimeoutMs: 5 }
    );

    await application.start();
    await assert.rejects(
        application.stop(),
        (error: unknown): boolean => error instanceof AggregateError && error.errors.some((item) => item instanceof ApplicationCleanupTimeoutError)
    );
    assert.deepEqual(calls.slice(-3), ['destroyClient', 'shutdownDependencies', 'shutdownLogging']);
});

void test('login中のstopはlogin確定後にresourceを解放し、再起動を拒否する', async (): Promise<void> => {
    const calls: string[] = [];
    let resolveLogin: (() => void) | undefined;
    const application = createApplication(
        createDependencies(calls, {
            login: (): Promise<void> => {
                calls.push('login');
                return new Promise<void>((resolve) => {
                    resolveLogin = resolve;
                }).then((): void => {
                    calls.push('loginComplete');
                });
            }
        })
    );

    const startPromise = application.start();
    assert.ok(resolveLogin);

    const stopPromise = application.stop();
    await new Promise<void>((resolve) => {
        setImmediate(resolve);
    });
    assert.equal(calls.includes('destroyClient'), false);

    resolveLogin();
    await Promise.all([startPromise, stopPromise]);

    assert.deepEqual(calls.slice(-5), ['loginComplete', 'waitForInFlight', 'destroyClient', 'shutdownDependencies', 'shutdownLogging']);

    await assert.rejects(application.start(), /現在の状態\(stopped\)ではBotを起動できません。/);
    assert.equal(calls.filter((call) => call === 'unregisterEvents').length, 1);
});
