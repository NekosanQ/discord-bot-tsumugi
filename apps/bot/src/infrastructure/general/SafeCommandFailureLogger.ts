import type { CommandFailureLogger, CommandFailureOperation } from '../../application/general/CommandFailureLogger.js';

export interface ErrorLogSink {
    error: (message: string, detail?: unknown) => void;
}

function operationMessage(operation: CommandFailureOperation): string {
    switch (operation) {
        case 'bot-information':
            return 'Bot情報の取得中にエラーが発生しました';
        case 'guild-information':
            return 'サーバー情報の取得中にエラーが発生しました';
        case 'user-member-fetch':
            return 'ユーザー情報用メンバーの取得に失敗しました';
    }
}

/** Error本文やDiscord IDを記録せず、失敗の種類だけを既存loggerへ渡す。 */
export class SafeCommandFailureLogger implements CommandFailureLogger {
    public constructor(private readonly sink: ErrorLogSink) {}

    public failure(operation: CommandFailureOperation, error: unknown): void {
        const errorKind = error instanceof Error ? 'Error' : 'UnknownFailure';
        this.sink.error(operationMessage(operation), errorKind);
    }
}
