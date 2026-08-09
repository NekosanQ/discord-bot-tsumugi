import { Message, TextChannel } from 'discord.js';

import type { KeywordManagement } from '../application/keyword/KeywordManagement.js';
import { logger } from '../utils/log.js';
import { EventBase } from './base/event_base.js';

/**
 * messageCreateイベントを処理するクラス
 */
export class MessageCreateEvent extends EventBase<'messageCreate'> {
    public eventName = 'messageCreate' as const;

    public constructor(private readonly keywordManagement: KeywordManagement) {
        super();
    }

    public async listener(message: Message): Promise<void> {
        if (message.author.bot || !message.guild) return;
        await this.validateMessage(message);
    }
    private async validateMessage(message: Message): Promise<void> {
        if (!message.guildId) return;
        if (message.mentions.users.size > 0 || message.mentions.roles.size > 0 || message.mentions.everyone) return;

        const MAX_MESSAGE_LENGTH = 200;
        if (message.content.length > MAX_MESSAGE_LENGTH) return;

        try {
            const match = await this.keywordManagement.resolve({ guildId: message.guildId, channelId: message.channel.id }, message.content);
            if (match) await (message.channel as TextChannel).send(match.response);
        } catch (error) {
            logger.error('MessageCreateEventでエラーが発生', error);
            return;
        }
    }
}
