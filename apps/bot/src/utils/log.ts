import { inspect } from 'node:util';

import { BaseInteraction, DiscordAPIError } from 'discord.js';
import log4js from 'log4js';

import { getWorkdirPath } from './workdir.js';

let loggingConfigured = false;

/** log4jsをproduction bootstrapから明示的に設定する */
export function configureLogging(): void {
    if (loggingConfigured) return;

    log4js.configure({
        appenders: {
            file: {
                type: 'file',
                filename: getWorkdirPath('bot.log'),
                maxLogSize: 10 * 1024 * 1024,
                backups: 3
            },
            console: {
                type: 'console'
            }
        },
        categories: {
            default: {
                appenders: ['file', 'console'],
                level: 'info'
            }
        }
    });
    loggingConfigured = true;
}

/** バッファ中のログを書き出してloggerを終了する */
export async function shutdownLogging(): Promise<void> {
    if (!loggingConfigured) return;

    try {
        await new Promise<void>((resolve, reject) => {
            log4js.shutdown((error?: Error): void => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    } finally {
        loggingConfigured = false;
    }
}

/**
 * アプリケーションのログ出力を管理するクラス
 */
class AppLogger {
    private readonly sysLogger = log4js.getLogger('app');

    /**
     * INFOログを出力する
     * @param source ログメッセージ or Interaction
     * @param message Interactionを渡した場合のログメッセージ
     */
    public info(source: string | BaseInteraction, message?: string): void {
        if (typeof source === 'string') {
            this.sysLogger.info(source);
            return;
        }

        const context = this.extractContext(source);
        this.sysLogger.info(`${context} ${message ?? ''}`);
    }

    /**
     * WARNログを出力する
     * @param source ログメッセージ or Interaction
     * @param detail Interactionを渡した場合の詳細情報
     */
    public warn(source: string | BaseInteraction, detail?: unknown): void {
        let context = '';
        if (typeof source !== 'string') {
            context = this.extractContext(source);
        }

        const { message, stack } = this.parseError(detail);

        const prefix = typeof source === 'string' ? source : '';
        const logMessage = prefix ? `${prefix} - ${message}` : message;

        if (stack) {
            this.sysLogger.warn(`${context} ${logMessage}\n${stack}`.trim());
        } else {
            this.sysLogger.warn(`${context} ${logMessage}`.trim());
        }
    }

    /**
     * エラーログを出力する
     * 1行目にコンテキストとエラー概要、2行目以降にスタックトレースを出力
     * @param source エラーメッセージ or Interaction
     * @param error エラーオブジェクト (省略可能)
     */
    public error(source: string | BaseInteraction, error?: unknown): void {
        let context = '';
        if (source instanceof BaseInteraction) {
            context = this.extractContext(source);
        }

        const { message, stack } = this.parseError(error);

        const prefix = typeof source === 'string' ? source : '';
        const logMessage = prefix ? `${prefix} - ${message}` : message;

        if (stack) {
            this.sysLogger.error(`${context} ${logMessage}\n${stack}`.trim());
        } else {
            this.sysLogger.error(`${context} ${logMessage}`.trim());
        }
    }

    /**
     * Interactionからコンテキスト情報を抽出
     * format: [Guild:ID] [User:ID] [Cmd:Name]
     */
    private extractContext(interaction: BaseInteraction): string {
        const guildId = interaction.guildId ?? 'DM';
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        let commandInfo = 'Unknown';
        if (interaction.isCommand() || interaction.isAutocomplete()) {
            commandInfo = `/${interaction.commandName}`;
            if (interaction.isChatInputCommand()) {
                const sub = interaction.options.getSubcommand(false);
                if (sub) commandInfo += ` ${sub}`;
            }
        } else if (interaction.isMessageComponent()) {
            commandInfo = `Component:${interaction.customId}`;
        }

        return `[Guild:${guildId}] [User:${userName}(${userId})] [Cmd:${commandInfo}]`;
    }

    /**
     * エラーオブジェクトを解析し、メッセージとスタックトレースに分離して返す
     */
    private parseError(error: unknown): { message: string; stack?: string } {
        if (error === null || error === undefined) {
            return { message: 'Unknown Error (null/undefined)' };
        }

        if (error instanceof DiscordAPIError) {
            return {
                message: `DiscordAPIError[${String(error.code)}]: ${error.message} (Path: ${error.url})`,
                stack: error.stack
            };
        }

        if (error instanceof Error) {
            return {
                message: error.message,
                stack: error.stack
            };
        }

        if (typeof error === 'string') {
            return { message: error };
        }

        try {
            return { message: JSON.stringify(error) };
        } catch {
            return { message: inspect(error) };
        }
    }
}

export const logger = new AppLogger();
