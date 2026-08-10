import type { DrawOmikuji } from '../application/fun/omikuji/DrawOmikuji.js';
import type { PlayRockPaperScissors } from '../application/fun/rps/PlayRockPaperScissors.js';
import type { SpinSlot } from '../application/fun/slot/SpinSlot.js';
import type { KeywordManagement } from '../application/keyword/KeywordManagement.js';
import { OmikujiCommand } from '../interface-adapter/discord/fun/omikuji/OmikujiCommand.js';
import { RPCCommand } from '../interface-adapter/discord/fun/rps/RPCCommand.js';
import { SlotCommand } from '../interface-adapter/discord/fun/slot/SlotCommand.js';
import { InteractionBase } from './base/interaction_base.js';
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
    drawOmikuji: DrawOmikuji;
    keywordManagement: KeywordManagement;
    playRockPaperScissors: PlayRockPaperScissors;
    spinSlot: SpinSlot;
}

export function createCommands(dependencies: CommandFactoryDependencies): InteractionBase[] {
    const omikujiCommand = new OmikujiCommand(dependencies.drawOmikuji);
    const rpsCommand = new RPCCommand(dependencies.playRockPaperScissors);
    const slotCommand = new SlotCommand(dependencies.spinSlot);
    const keywordCommandGroup = new KeywordCommandGroup();
    const keywordAddModal = new KeywordAddModal(dependencies.keywordManagement);
    const keywordListMenuAction = new KeywordListMenuAction(dependencies.keywordManagement);
    const keywordAddCommand = new KeywordAddCommand(keywordCommandGroup, keywordAddModal);
    const keywordRemoveCommand = new KeywordRemoveCommand(keywordCommandGroup, dependencies.keywordManagement);
    const keywordListCommand = new KeywordListCommand(keywordCommandGroup, dependencies.keywordManagement, keywordListMenuAction);

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
