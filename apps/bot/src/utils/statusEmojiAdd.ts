import { config } from './config.js';

/**
 * Discordのステータス文字列に絵文字を追加します。
 * @param status Discordのステータス文字列
 * @returns 絵文字が追加されたステータス文字列
 */
export function statusAddEmoji(status: string): string {
    switch (status) {
        case 'online':
            status = `${config.statusEmoji.online} オンライン`;
            break;
        case 'idle':
            status = `${config.statusEmoji.idle} 退席中`;
            break;
        case 'dnd':
            status = `${config.statusEmoji.dnd} 取り込み中`;
            break;
        case 'streaming':
            status = `${config.statusEmoji.streaming} 配信中`;
            break;
        case 'offline':
            status = `${config.statusEmoji.invisible} オフライン`;
            break;
        default:
            status = '不明';
    }
    return `ステータス: ${status}`;
}
