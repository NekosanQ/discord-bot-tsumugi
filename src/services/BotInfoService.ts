import { Client } from 'discord.js';

import pkg from '../../package.json' with { type: 'json' };

// ボット情報のデータ構造を定義
export interface BotInfo {
    username: string;
    version: string;
    createdAt: Date;
    guildCount: string;
    userCount: string;
}

/**
 * Botの情報を一元管理するサービスクラス
 */
class BotInfoService {
    /**
     * Botに関する情報をまとめて取得する
     * @returns Bot情報のオブジェクト
     */
    public getBotInfo(client: Client): BotInfo {
        return {
            username: client.user?.username ?? '不明なBot',
            version: pkg.version,
            createdAt: client.user?.createdAt ?? new Date(),
            guildCount: client.guilds.cache.size.toString(),
            userCount: client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0).toString()
        };
    }
}

export default new BotInfoService();
