import assert from 'node:assert/strict';
import test from 'node:test';

import type { BotInformationSnapshot } from '../../../../src/application/general/bot/BotInformationReader.js';
import { GetBotInformation } from '../../../../src/application/general/bot/GetBotInformation.js';
import type { CommandFailureLogger } from '../../../../src/application/general/CommandFailureLogger.js';
import { FollowAnnouncement } from '../../../../src/application/general/follow/FollowAnnouncement.js';
import { GetGuildInformation } from '../../../../src/application/general/guild/GetGuildInformation.js';
import type { GuildInformationSnapshot } from '../../../../src/application/general/guild/GuildInformationReader.js';
import { MeasurePing } from '../../../../src/application/general/ping/MeasurePing.js';
import { GetUserInformation } from '../../../../src/application/general/user/GetUserInformation.js';
import type { UserInformationSnapshot } from '../../../../src/application/general/user/UserInformationReader.js';
import { BotController } from '../../../../src/interface-adapter/discord/general/bot/BotController.js';
import { BotPresenter } from '../../../../src/interface-adapter/discord/general/bot/BotPresenter.js';
import { FollowController } from '../../../../src/interface-adapter/discord/general/follow/FollowController.js';
import { FollowPresenter } from '../../../../src/interface-adapter/discord/general/follow/FollowPresenter.js';
import { GuildController } from '../../../../src/interface-adapter/discord/general/guild/GuildController.js';
import { GuildPresenter } from '../../../../src/interface-adapter/discord/general/guild/GuildPresenter.js';
import { PingController } from '../../../../src/interface-adapter/discord/general/ping/PingController.js';
import { PingPresenter } from '../../../../src/interface-adapter/discord/general/ping/PingPresenter.js';
import { UserController } from '../../../../src/interface-adapter/discord/general/user/UserController.js';
import { UserPresenter } from '../../../../src/interface-adapter/discord/general/user/UserPresenter.js';
import { DiscordEmbedFactory } from '../../../../src/interface-adapter/discord/presentation/DiscordEmbedFactory.js';

const clock = { now: (): Date => new Date(2026, 0, 2, 3, 4, 5) };
const logger: CommandFailureLogger = { failure: (): void => undefined };
const embedUser = { displayName: '実行者', displayAvatarURL: (): string => 'https://example.com/avatar.png' };
const embedFactory = new DiscordEmbedFactory({ botColor: '0', errorColor: '1', errorEmoji: '⚠️' });

void test('PingControllerはfake interactionから時刻を取得して測定中と結果を順番に表示する', async (): Promise<void> => {
    const titles: (string | undefined)[] = [];
    const fields: unknown[] = [];
    const controller = new PingController(new MeasurePing(), new PingPresenter(embedFactory));

    await controller.execute({
        user: embedUser,
        websocketPingMilliseconds: 42,
        createdTimestamp: 1_000,
        fetchReplyCreatedTimestamp: (): Promise<number> => Promise.resolve(1_125),
        editReply: (embed): Promise<void> => {
            const json = embed.toJSON();
            titles.push(json.title);
            fields.push(json.fields);
            return Promise.resolve();
        }
    });

    assert.deepEqual(titles, ['Pingを測定中...', 'Pingを測定しました']);
    assert.deepEqual(fields[1], [
        { name: 'WebSocket Ping', value: '42ms' },
        { name: 'APIレイテンシ', value: '125ms' }
    ]);
});

void test('BotControllerはapplication結果をEmbedとリンクbuttonへ変換する', async (): Promise<void> => {
    let title: string | undefined;
    let componentCount = 0;
    const controller = new BotController(
        new GetBotInformation(
            {
                read: (): BotInformationSnapshot => ({
                    username: 'Tsumugi',
                    version: '3.0.0',
                    createdAt: new Date('2020-01-01T00:00:00Z'),
                    guildCount: 3,
                    userCount: 10
                })
            },
            clock
        ),
        new BotPresenter(embedFactory, {
            iconUrl: 'https://example.com/icon.png',
            inviteUrl: 'https://example.com/invite',
            supportGuildUrl: 'https://example.com/support'
        }),
        logger
    );

    await controller.execute({
        user: embedUser,
        editReply: (embed, components): Promise<void> => {
            title = embed.toJSON().author?.name;
            componentCount = components.toJSON().components.length;
            return Promise.resolve();
        }
    });

    assert.equal(title, 'Tsumugiの情報');
    assert.equal(componentCount, 2);
});

void test('FollowControllerはfake interactionの送信先IDだけをapplicationへ渡す', async (): Promise<void> => {
    const followedChannelIds: string[] = [];
    const replies: string[] = [];
    const controller = new FollowController(
        new FollowAnnouncement({
            follow: (channelId: string): Promise<boolean> => {
                followedChannelIds.push(channelId);
                return Promise.resolve(true);
            }
        }),
        new FollowPresenter()
    );

    await controller.execute({
        destinationChannelId: 'destination-channel',
        editReply: (content: string): Promise<void> => {
            replies.push(content);
            return Promise.resolve();
        }
    });

    assert.deepEqual(followedChannelIds, ['destination-channel']);
    assert.deepEqual(replies, ['Botからのお知らせをフォローしました']);
});

void test('UserControllerはguildとtarget user IDを抽出済みDTOとして扱う', async (): Promise<void> => {
    const requests: { guildId: string; userId: string }[] = [];
    let title: string | undefined;
    const getUserInformation = new GetUserInformation(
        {
            read: (guildId: string, userId: string): Promise<UserInformationSnapshot> => {
                requests.push({ guildId, userId });
                return Promise.resolve({
                    userId,
                    username: 'target',
                    globalName: '表示名',
                    isBot: false,
                    avatarUrl: 'https://example.com/target.png',
                    createdAt: new Date(2020, 0, 1),
                    nickname: null,
                    joinedAt: new Date(2021, 0, 1),
                    presenceStatus: 'online',
                    permissionBitfield: 0n,
                    roleMentions: [],
                    roleCount: 0
                });
            }
        },
        logger,
        clock,
        {
            botEmoji: '🤖',
            statusEmoji: { online: '🟢', idle: '🟡', dnd: '🔴', streaming: '🟣', invisible: '⚫' }
        }
    );
    const controller = new UserController(getUserInformation, new UserPresenter(embedFactory));

    await controller.execute({
        user: embedUser,
        guildId: 'guild-1',
        targetUserId: 'target-1',
        editReply: (embed): Promise<void> => {
            title = embed.toJSON().title;
            return Promise.resolve();
        }
    });

    assert.deepEqual(requests, [{ guildId: 'guild-1', userId: 'target-1' }]);
    assert.equal(title, 'ユーザー情報 ');
});

void test('GuildControllerは取得snapshotを既存の統計Embedへ変換する', async (): Promise<void> => {
    let statistics = '';
    const getGuildInformation = new GetGuildInformation(
        {
            read: (): Promise<GuildInformationSnapshot> =>
                Promise.resolve({
                    id: 'guild-1',
                    name: 'Guild',
                    description: null,
                    createdAt: new Date(2020, 0, 1),
                    iconUrl: null,
                    ownerId: 'owner-1',
                    ownerMention: '<@owner-1>',
                    memberCount: 2,
                    members: [{ isBot: false }, { isBot: true }],
                    premiumSubscriptionCount: 0,
                    premiumTier: 0,
                    channels: [
                        { kind: 'category', visibleToEveryone: true },
                        { kind: 'text', visibleToEveryone: true },
                        { kind: 'text', visibleToEveryone: false }
                    ],
                    emojis: [{ animated: false }, { animated: true }],
                    stickerCount: 1,
                    soundboardCount: 2,
                    roles: [
                        { id: 'guild-1', mention: '@everyone', position: 0 },
                        { id: 'role-1', mention: '<@&role-1>', position: 1 }
                    ]
                })
        },
        logger,
        clock,
        {
            memberEmoji: 'member',
            botEmoji: 'bot',
            emoji: 'emoji',
            gifEmoji: 'gif',
            channelEmoji: {
                category: 'category',
                publicText: 'public-text',
                lockedText: 'locked-text',
                publicVoice: 'public-voice',
                lockedVoice: 'locked-voice',
                publicAnnouncement: 'public-announcement',
                lockedAnnouncement: 'locked-announcement',
                publicStage: 'public-stage',
                lockedStage: 'locked-stage'
            }
        }
    );
    const controller = new GuildController(getGuildInformation, new GuildPresenter(embedFactory));

    await controller.execute({
        user: embedUser,
        guildId: 'guild-1',
        editReply: (embed): Promise<void> => {
            statistics = embed.toJSON().fields?.find((field) => field.name === '統計情報')?.value ?? '';
            return Promise.resolve();
        }
    });

    assert.match(statistics, /\*\*メンバー数\*\*: 2 \(member: 1, bot: 1\)/);
    assert.match(statistics, /\*\*チャンネル数\*\*: 3 \(category 1, public-text 1, locked-text 1\)/);
});
