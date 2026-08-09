import { EmbedBuilder, User } from 'discord.js';

import { config } from './config.js';

/**
 * アプリケーション全体で共通のEmbedを生成するクラス
 */
class EmbedGenerator {
    /**
     * エラー発生時のEmbedメソッド
     * (赤色、エラータイトル付き)
     */
    public error(user: User, message: string): EmbedBuilder {
        return this.createBase(user)
            .setColor(Number(config.errorColor))
            .setTitle(`${config.errorEmoji} エラーが発生しました`)
            .setDescription(message);
    }

    /**
     * Botがユーザーに応答する際のEmbedメソッド
     */
    public info(user: User): EmbedBuilder {
        return this.createBase(user);
    }

    /**
     * システムログなどで使用するEmbedメソッド
     */
    public system(): EmbedBuilder {
        return new EmbedBuilder().setColor(Number(config.botColor)).setTimestamp();
    }

    /**
     * 共通のベースEmbedを作成するメソッド
     */
    private createBase(user: User): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(Number(config.botColor))
            .setTimestamp()
            .setFooter({
                text: `実行者: ${user.displayName}`,
                iconURL: user.displayAvatarURL() || undefined
            });
    }
}

export const embeds = new EmbedGenerator();
