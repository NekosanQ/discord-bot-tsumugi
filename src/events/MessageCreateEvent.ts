import { PrismaClient } from '@prisma/client';
import { Message, TextChannel } from 'discord.js';

import { logger } from '../utils/log.js';
import { EventBase } from './base/event_base.js';

/**
 * messageCreateイベントを処理するクラス
 */
export class MessageCreateEvent extends EventBase<'messageCreate'> {
    public eventName = 'messageCreate' as const;

    public constructor(private readonly prisma: PrismaClient) {
        super();
    }

    public async listener(message: Message): Promise<void> {
        if (message.author.bot || !message.guild) return;
        await this.validateMessage(message);
    }
    private async validateMessage(message: Message): Promise<void> {
        if (message.mentions.users.size > 0 || message.mentions.roles.size > 0 || message.mentions.everyone) return;

        const MAX_MESSAGE_LENGTH = 200;
        if (message.content.length > MAX_MESSAGE_LENGTH) return;

        try {
            const keywords = await this.prisma.keyword.findMany({
                where: {
                    channelId: message.channel.id
                }
            });
            for (const keyword of keywords) {
                if (message.content.includes(keyword.trigger)) {
                    if (Array.isArray(keyword.responses) && keyword.responses.length > 0) {
                        const responses = keyword.responses as string[];
                        const response = responses[Math.floor(Math.random() * responses.length)];
                        await (message.channel as TextChannel).send(response);
                    }
                    return;
                }
            }
        } catch (error) {
            logger.error('MessageCreateEventでエラーが発生', error);
            return;
        }
    }
}
