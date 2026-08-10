import type { DrawOmikuji } from '../application/fun/omikuji/DrawOmikuji.js';
import type { PlayRockPaperScissors } from '../application/fun/rps/PlayRockPaperScissors.js';
import type { SpinSlot } from '../application/fun/slot/SpinSlot.js';
import type { GetBotInformation } from '../application/general/bot/GetBotInformation.js';
import type { CommandFailureLogger } from '../application/general/CommandFailureLogger.js';
import type { FollowAnnouncement } from '../application/general/follow/FollowAnnouncement.js';
import type { GetGuildInformation } from '../application/general/guild/GetGuildInformation.js';
import type { MeasurePing } from '../application/general/ping/MeasurePing.js';
import type { GetUserInformation } from '../application/general/user/GetUserInformation.js';
import type { KeywordManagement } from '../application/keyword/KeywordManagement.js';
import { OmikujiCommand } from '../interface-adapter/discord/fun/omikuji/OmikujiCommand.js';
import { RPCCommand } from '../interface-adapter/discord/fun/rps/RPCCommand.js';
import { SlotCommand } from '../interface-adapter/discord/fun/slot/SlotCommand.js';
import { BotCommand } from '../interface-adapter/discord/general/bot/BotCommand.js';
import { BotController } from '../interface-adapter/discord/general/bot/BotController.js';
import { type BotPresentationOptions, BotPresenter } from '../interface-adapter/discord/general/bot/BotPresenter.js';
import { FollowCommand } from '../interface-adapter/discord/general/follow/FollowCommand.js';
import { FollowController } from '../interface-adapter/discord/general/follow/FollowController.js';
import { FollowPresenter } from '../interface-adapter/discord/general/follow/FollowPresenter.js';
import { GuildCommand } from '../interface-adapter/discord/general/guild/GuildCommand.js';
import { GuildController } from '../interface-adapter/discord/general/guild/GuildController.js';
import { GuildPresenter } from '../interface-adapter/discord/general/guild/GuildPresenter.js';
import { PingCommand } from '../interface-adapter/discord/general/ping/PingCommand.js';
import { PingController } from '../interface-adapter/discord/general/ping/PingController.js';
import { PingPresenter } from '../interface-adapter/discord/general/ping/PingPresenter.js';
import { UserCommand } from '../interface-adapter/discord/general/user/UserCommand.js';
import { UserController } from '../interface-adapter/discord/general/user/UserController.js';
import { UserPresenter } from '../interface-adapter/discord/general/user/UserPresenter.js';
import type { DiscordEmbedFactory } from '../interface-adapter/discord/presentation/DiscordEmbedFactory.js';
import { InteractionBase } from './base/interaction_base.js';
import helpSelectMenuAction from './general/help/actions/HelpCategoryMenuAction.js';
import helpOperationMenuAction from './general/help/actions/HelpOperationMenuAction.js';
import helpCommand from './general/help/HelpCommand.js';
import { KeywordAddModal } from './keywordChat/action/KeywordAddModal.js';
import { KeywordListMenuAction } from './keywordChat/action/KeywordListMenuAction.js';
import { KeywordAddCommand } from './keywordChat/KeywordAddCommand.js';
import { KeywordCommandGroup } from './keywordChat/KeywordCommandGroup.js';
import { KeywordListCommand } from './keywordChat/KeywordListCommand.js';
import { KeywordRemoveCommand } from './keywordChat/KeywordRemoveCommand.js';

export interface CommandFactoryDependencies {
    botInformation: GetBotInformation;
    botPresentation: BotPresentationOptions;
    commandFailureLogger: CommandFailureLogger;
    drawOmikuji: DrawOmikuji;
    embedFactory: DiscordEmbedFactory;
    followAnnouncement: FollowAnnouncement;
    guildInformation: GetGuildInformation;
    keywordManagement: KeywordManagement;
    measurePing: MeasurePing;
    playRockPaperScissors: PlayRockPaperScissors;
    spinSlot: SpinSlot;
    userInformation: GetUserInformation;
}

export function createCommands(dependencies: CommandFactoryDependencies): InteractionBase[] {
    const pingCommand = new PingCommand(new PingController(dependencies.measurePing, new PingPresenter(dependencies.embedFactory)));
    const botCommand = new BotCommand(
        new BotController(
            dependencies.botInformation,
            new BotPresenter(dependencies.embedFactory, dependencies.botPresentation),
            dependencies.commandFailureLogger
        )
    );
    const followCommand = new FollowCommand(new FollowController(dependencies.followAnnouncement, new FollowPresenter()));
    const userCommand = new UserCommand(new UserController(dependencies.userInformation, new UserPresenter(dependencies.embedFactory)));
    const guildCommand = new GuildCommand(new GuildController(dependencies.guildInformation, new GuildPresenter(dependencies.embedFactory)));
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
