import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BotApplication } from './bootstrap/createApplication.js';

function isDirectExecution(moduleUrl: string, entryPath: string | undefined = process.argv[1]): boolean {
    if (!entryPath) return false;
    return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

function reportFatalError(error: unknown): void {
    const message = error instanceof Error ? error.message : '不明なエラー';
    process.stderr.write(`Botを起動できませんでした: ${message}\n`);
}

/** 環境を読み込み、production用Botを起動する */
export async function run(): Promise<void> {
    await import('dotenv/config');

    const discordToken = process.env.DISCORD_TOKEN;
    if (!discordToken?.trim()) {
        throw new Error('DISCORD_TOKENが設定されていません。');
    }
    const apiServiceToken = process.env.BOT_API_SERVICE_TOKEN;
    if (!apiServiceToken || apiServiceToken.length < 32) {
        throw new Error('BOT_API_SERVICE_TOKENは32文字以上で設定してください。');
    }

    const { createProductionApplication } = await import('./bootstrap/createProductionApplication.js');
    const application: BotApplication = await createProductionApplication(discordToken, apiServiceToken);

    let shutdownStarted = false;
    const handleSignal = (signal: NodeJS.Signals): void => {
        if (shutdownStarted) return;
        shutdownStarted = true;

        process.removeListener('SIGINT', handleSignal);
        process.removeListener('SIGTERM', handleSignal);

        void application.stop().catch((error: unknown): void => {
            reportFatalError(error);
            process.exitCode = 1;
        });
        process.stderr.write(`${signal}を受信したため、Botを終了します。\n`);
    };

    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);

    try {
        await application.start();
    } catch (error) {
        process.removeListener('SIGINT', handleSignal);
        process.removeListener('SIGTERM', handleSignal);
        throw error;
    }
}

if (isDirectExecution(import.meta.url)) {
    void run().catch((error: unknown): void => {
        reportFatalError(error);
        process.exitCode = 1;
    });
}
