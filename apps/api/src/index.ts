import path from 'node:path';
import { fileURLToPath } from 'node:url';

function isDirectExecution(moduleUrl: string, entryPath: string | undefined = process.argv[1]): boolean {
    if (!entryPath) return false;
    return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

export async function run(): Promise<void> {
    await import('dotenv/config');
    const serviceToken = process.env.API_SERVICE_TOKEN;
    if (!serviceToken || serviceToken.length < 32) throw new Error('API_SERVICE_TOKENは32文字以上で設定してください。');

    const { createProductionApplication } = await import('./bootstrap/createProductionApplication.js');
    const application = createProductionApplication(serviceToken);
    await application.start();

    let stopping = false;
    const stop = (): void => {
        if (stopping) return;
        stopping = true;
        void application.stop().catch((error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`API shutdown error: ${message}\n`);
            process.exitCode = 1;
        });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}

if (isDirectExecution(import.meta.url)) {
    void run().catch((error: unknown): void => {
        const message = error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`API startup error: ${message}\n`);
        process.exitCode = 1;
    });
}
