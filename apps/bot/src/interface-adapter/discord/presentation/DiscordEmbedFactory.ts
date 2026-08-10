import { EmbedBuilder } from 'discord.js';

export interface DiscordEmbedUser {
    displayName: string;
    displayAvatarURL: () => string;
}

export interface DiscordEmbedStyle {
    botColor: string;
    errorColor: string;
    errorEmoji: string;
}

export class DiscordEmbedFactory {
    public constructor(private readonly style: DiscordEmbedStyle) {}

    public info(user: DiscordEmbedUser): EmbedBuilder {
        return this.createBase(user);
    }

    public error(user: DiscordEmbedUser, message: string): EmbedBuilder {
        return this.createBase(user)
            .setColor(Number(this.style.errorColor))
            .setTitle(`${this.style.errorEmoji} エラーが発生しました`)
            .setDescription(message);
    }

    private createBase(user: DiscordEmbedUser): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(Number(this.style.botColor))
            .setTimestamp()
            .setFooter({ text: `実行者: ${user.displayName}`, iconURL: user.displayAvatarURL() || undefined });
    }
}
