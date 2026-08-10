import assert from 'node:assert/strict';
import test from 'node:test';

import { DrawOmikuji } from '../../src/application/fun/omikuji/DrawOmikuji.js';
import { PlayRockPaperScissors } from '../../src/application/fun/rps/PlayRockPaperScissors.js';
import { SpinSlot } from '../../src/application/fun/slot/SpinSlot.js';
import type { BotInformationSnapshot } from '../../src/application/general/bot/BotInformationReader.js';
import { GetBotInformation } from '../../src/application/general/bot/GetBotInformation.js';
import type { CommandFailureLogger } from '../../src/application/general/CommandFailureLogger.js';
import { FollowAnnouncement } from '../../src/application/general/follow/FollowAnnouncement.js';
import { GetGuildInformation } from '../../src/application/general/guild/GetGuildInformation.js';
import { MeasurePing } from '../../src/application/general/ping/MeasurePing.js';
import { GetUserInformation } from '../../src/application/general/user/GetUserInformation.js';
import type { KeywordManagement } from '../../src/application/keyword/KeywordManagement.js';
import type { InteractionBase } from '../../src/commands/base/interaction_base.js';
import { type CommandFactoryDependencies, createCommands } from '../../src/commands/index.js';
import { DiscordEmbedFactory } from '../../src/interface-adapter/discord/presentation/DiscordEmbedFactory.js';

const keywordManagement: KeywordManagement = {
    save: (): Promise<void> => Promise.resolve(),
    remove: (): Promise<void> => Promise.resolve(),
    get: (): Promise<never> => Promise.reject(new Error('not used')),
    list: (): Promise<[]> => Promise.resolve([]),
    resolve: (): Promise<undefined> => Promise.resolve(undefined)
};

function findCommand(commands: InteractionBase[], commandName: string): InteractionBase {
    const command = commands.find((candidate) => candidate.command?.name === commandName);
    assert.ok(command);
    return command;
}

void test('createCommandsは移行済みコマンドを呼び出しごとに生成する', (): void => {
    const randomSource = { next: (): number => 0 };
    const clock = { now: (): Date => new Date('2026-01-01T00:00:00Z') };
    const commandFailureLogger: CommandFailureLogger = { failure: (): void => undefined };
    const dependencies = {
        botInformation: new GetBotInformation(
            {
                read: (): BotInformationSnapshot => ({ username: 'Tsumugi', version: '3.0.0', guildCount: 1, userCount: 2 })
            },
            clock
        ),
        botPresentation: {
            iconUrl: 'https://example.com/icon.png',
            inviteUrl: 'https://example.com/invite',
            supportGuildUrl: 'https://example.com/support'
        },
        commandFailureLogger,
        drawOmikuji: new DrawOmikuji(randomSource),
        embedFactory: new DiscordEmbedFactory({ botColor: '0', errorColor: '0', errorEmoji: 'error' }),
        followAnnouncement: new FollowAnnouncement({ follow: (): Promise<boolean> => Promise.resolve(true) }),
        guildInformation: new GetGuildInformation(
            { read: (): Promise<never> => Promise.reject(new Error('not used')) },
            commandFailureLogger,
            clock,
            {
                memberEmoji: 'member',
                botEmoji: 'bot',
                emoji: 'emoji',
                gifEmoji: 'gif',
                channelEmoji: {
                    category: 'category',
                    publicText: 'publicText',
                    lockedText: 'lockedText',
                    publicVoice: 'publicVoice',
                    lockedVoice: 'lockedVoice',
                    publicAnnouncement: 'publicAnnouncement',
                    lockedAnnouncement: 'lockedAnnouncement',
                    publicStage: 'publicStage',
                    lockedStage: 'lockedStage'
                }
            }
        ),
        keywordManagement,
        measurePing: new MeasurePing(),
        playRockPaperScissors: new PlayRockPaperScissors(randomSource),
        spinSlot: new SpinSlot(randomSource, { wait: (): Promise<void> => Promise.resolve() }),
        userInformation: new GetUserInformation({ read: (): Promise<never> => Promise.reject(new Error('not used')) }, commandFailureLogger, clock, {
            botEmoji: 'bot',
            statusEmoji: { online: 'online', idle: 'idle', dnd: 'dnd', streaming: 'streaming', invisible: 'offline' }
        })
    } satisfies CommandFactoryDependencies;

    const first = createCommands(dependencies);
    const second = createCommands(dependencies);

    for (const commandName of ['ping', 'bot', 'follow', 'user', 'guild', 'omikuji', 'rpc', 'slot']) {
        assert.notStrictEqual(findCommand(first, commandName), findCommand(second, commandName));
    }
});
