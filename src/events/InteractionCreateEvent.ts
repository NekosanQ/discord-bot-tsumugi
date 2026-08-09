import { Interaction } from 'discord.js';

import CommandHandler from '../commands/CommandHandler.js';
import { EventBase } from './base/event_base.js';

/**
 * インタラクションが作成されたときに実行されるイベント
 */
export class InteractionCreateEvent extends EventBase<'interactionCreate'> {
    public eventName = 'interactionCreate' as const;

    public constructor(private readonly commandHandler: CommandHandler) {
        super();
    }

    public async listener(interaction: Interaction): Promise<void> {
        await this.commandHandler.onInteractionCreate(interaction);
    }
}
