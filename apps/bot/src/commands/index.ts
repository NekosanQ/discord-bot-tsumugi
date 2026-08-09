import { PrismaClient } from '@prisma/client';

import { InteractionBase } from './base/interaction_base.js';
import omikujiCommand from './fun/omikuji/OmikujiCommand.js';
import rpsCommand from './fun/rps/RPCCommand.js';
import slotCommand from './fun/slot/SlotCommand.js';
import botCommand from './general/bot/BotCommand.js';
import followCommand from './general/follow/FollowCommand.js';
import guildCommand from './general/guild/GuildCommand.js';
import helpSelectMenuAction from './general/help/actions/HelpCategoryMenuAction.js';
import helpOperationMenuAction from './general/help/actions/HelpOperationMenuAction.js';
import helpCommand from './general/help/HelpCommand.js';
import pingCommand from './general/ping/PingCommand.js';
import userCommand from './general/user/UserCommand.js';
import { KeywordAddModal } from './keywordChat/action/KeywordAddModal.js';
import { KeywordListMenuAction } from './keywordChat/action/KeywordListMenuAction.js';
import { KeywordAddCommand } from './keywordChat/KeywordAddCommand.js';
import { KeywordCommandGroup } from './keywordChat/KeywordCommandGroup.js';
import { KeywordListCommand } from './keywordChat/KeywordListCommand.js';
import { KeywordRemoveCommand } from './keywordChat/KeywordRemoveCommand.js';

export interface CommandFactoryDependencies {
    prisma: PrismaClient;
}

export function createCommands(dependencies: CommandFactoryDependencies): InteractionBase[] {
    const keywordCommandGroup = new KeywordCommandGroup();
    const keywordAddModal = new KeywordAddModal(dependencies.prisma);
    const keywordListMenuAction = new KeywordListMenuAction(dependencies.prisma);
    const keywordAddCommand = new KeywordAddCommand(keywordCommandGroup, keywordAddModal);
    const keywordRemoveCommand = new KeywordRemoveCommand(keywordCommandGroup, dependencies.prisma);
    const keywordListCommand = new KeywordListCommand(keywordCommandGroup, dependencies.prisma, keywordListMenuAction);

    return [
        pingCommand,
        helpCommand,
        helpSelectMenuAction,
        helpOperationMenuAction,
        botCommand,
        omikujiCommand,
        followCommand,
        slotCommand,
        rpsCommand,
        keywordAddCommand,
        keywordAddModal,
        keywordCommandGroup,
        keywordRemoveCommand,
        keywordListCommand,
        keywordListMenuAction,
        userCommand,
        guildCommand
    ];
}
