import { type ChildProcess, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const appDirectory = process.cwd();
const fakeApiUrl = 'http://127.0.0.1:4010';
const webHealthUrl = 'http://127.0.0.1:3001';
const serverReadyTimeoutMs = 120_000;
const serverStopTimeoutMs = 5_000;

function startNode(args: string[], environment: NodeJS.ProcessEnv = process.env): ChildProcess {
    return spawn(process.execPath, args, {
        cwd: appDirectory,
        env: environment,
        stdio: 'inherit',
        windowsHide: true
    });
}

async function waitForReady(name: string, url: string, processToWatch: ChildProcess): Promise<void> {
    const deadline = Date.now() + serverReadyTimeoutMs;
    while (Date.now() < deadline) {
        if (processToWatch.exitCode !== null || processToWatch.signalCode !== null) {
            throw new Error(`${name} exited before becoming ready`);
        }
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
            if (response.ok) return;
        } catch {
            // The server is still starting.
        }
        await delay(250);
    }
    throw new Error(`${name} did not become ready within ${String(serverReadyTimeoutMs)}ms`);
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
    return new Promise((resolve): void => {
        const timeout = setTimeout((): void => {
            resolve(false);
        }, timeoutMs);
        child.once('exit', (): void => {
            clearTimeout(timeout);
            resolve(true);
        });
    });
}

async function stopChild(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    if (await waitForExit(child, serverStopTimeoutMs)) return;
    child.kill('SIGKILL');
    await waitForExit(child, serverStopTimeoutMs);
}

function exitCode(child: ChildProcess): Promise<number> {
    return new Promise((resolve, reject): void => {
        child.once('error', reject);
        child.once('exit', (code): void => {
            resolve(code ?? 1);
        });
    });
}

async function run(): Promise<void> {
    const fakeApi = startNode(['node_modules/tsx/dist/cli.mjs', 'e2e/fake-api.ts']);
    const webEnvironment = { ...process.env };
    const internalApiVariable = 'WEB_INTERNAL_API_URL';
    const proxyTokenVariable = 'WEB_API_PROXY_TOKEN';
    webEnvironment[internalApiVariable] = fakeApiUrl;
    webEnvironment[proxyTokenVariable] = 'fake-web-proxy-token-for-e2e-only';
    const web = startNode(['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3001'], webEnvironment);

    try {
        await Promise.all([
            waitForReady('fake API', `${fakeApiUrl}/health/live`, fakeApi),
            waitForReady('Web application', `${webHealthUrl}/health/live`, web)
        ]);
        const playwright = startNode(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.config.ts']);
        process.exitCode = await exitCode(playwright);
    } finally {
        await Promise.all([stopChild(web), stopChild(fakeApi)]);
    }
}

try {
    await run();
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Web E2E runner failed');
    process.exitCode = 1;
}
