import assert from 'node:assert/strict';
import test from 'node:test';

import { ChannelType, PermissionFlagsBits } from 'discord.js';

import type { GuildSnapshot } from '../../../../src/application/guild/GuildSnapshotSynchronization.js';
import type { GuildSnapshotSyncTrigger } from '../../../../src/application/guild/GuildSnapshotSyncLogger.js';
import type { GuildSnapshotSyncUseCase } from '../../../../src/application/guild/SyncGuildSnapshot.js';
import {
    type DiscordClientGuildSnapshotSource,
    type DiscordGuildChannelSource,
    type DiscordGuildMemberSource,
    type DiscordGuildSnapshotSource,
    DiscordGuildSnapshotSynchronizer
} from '../../../../src/interface-adapter/discord/guild-snapshot/DiscordGuildSnapshotSynchronizer.js';

interface ExecutedSnapshot {
    snapshot: GuildSnapshot;
    trigger: GuildSnapshotSyncTrigger;
}

const botMember: DiscordGuildMemberSource = { id: '923456789012345678' };

function fakeChannel(id: string, name: string, type: ChannelType, canViewAndSend = true): DiscordGuildChannelSource {
    return {
        id,
        name,
        type,
        permissionsFor: (): { has: (permissions: bigint[]) => boolean } => ({
            has: (permissions): boolean =>
                canViewAndSend && permissions.includes(PermissionFlagsBits.ViewChannel) && permissions.includes(PermissionFlagsBits.SendMessages)
        })
    };
}

function fakeGuild(
    id: string,
    channels: readonly DiscordGuildChannelSource[],
    member: DiscordGuildMemberSource | null = botMember
): DiscordGuildSnapshotSource {
    return {
        id,
        members: { me: member },
        channels: { cache: new Map(channels.map((channel) => [channel.id, channel])) }
    };
}

function createSynchronizer(executed: ExecutedSnapshot[]): DiscordGuildSnapshotSynchronizer {
    const useCase: GuildSnapshotSyncUseCase = {
        execute: (snapshot, trigger): Promise<void> => {
            executed.push({ snapshot, trigger });
            return Promise.resolve();
        }
    };
    return new DiscordGuildSnapshotSynchronizer(useCase);
}

void test('GuildTextとGuildAnnouncementだけを完全snapshotへ変換する', async (): Promise<void> => {
    const executed: ExecutedSnapshot[] = [];
    const synchronizer = createSynchronizer(executed);
    const guild = fakeGuild('123456789012345678', [
        fakeChannel('223456789012345678', 'general', ChannelType.GuildText),
        fakeChannel('323456789012345678', 'news', ChannelType.GuildAnnouncement),
        fakeChannel('423456789012345678', 'private', ChannelType.GuildText, false),
        fakeChannel('523456789012345678', 'voice', ChannelType.GuildVoice),
        fakeChannel('623456789012345678', 'category', ChannelType.GuildCategory)
    ]);

    await synchronizer.synchronizeGuild(guild, 'channel-update');

    assert.deepEqual(executed, [
        {
            trigger: 'channel-update',
            snapshot: {
                guildId: '123456789012345678',
                installed: true,
                channels: [
                    { id: '223456789012345678', name: 'general', type: 'text' },
                    { id: '323456789012345678', name: 'news', type: 'announcement' }
                ]
            }
        }
    ]);
});

void test('ready時はfake client内の全guildを同期し、guildDeleteは空snapshotを送る', async (): Promise<void> => {
    const executed: ExecutedSnapshot[] = [];
    const synchronizer = createSynchronizer(executed);
    const firstGuild = fakeGuild('123456789012345678', []);
    const secondGuild = fakeGuild('223456789012345678', [fakeChannel('323456789012345678', 'chat', ChannelType.GuildText)]);
    const client: DiscordClientGuildSnapshotSource = {
        guilds: {
            cache: new Map([
                [firstGuild.id, firstGuild],
                [secondGuild.id, secondGuild]
            ])
        }
    };

    await synchronizer.synchronizeClient(client);
    await synchronizer.synchronizeDeletedGuild(secondGuild.id);

    assert.deepEqual(executed, [
        {
            trigger: 'client-ready',
            snapshot: { guildId: firstGuild.id, installed: true, channels: [] }
        },
        {
            trigger: 'client-ready',
            snapshot: {
                guildId: secondGuild.id,
                installed: true,
                channels: [{ id: '323456789012345678', name: 'chat', type: 'text' }]
            }
        },
        {
            trigger: 'guild-delete',
            snapshot: { guildId: secondGuild.id, installed: false, channels: [] }
        }
    ]);
});

void test('Bot memberを取得できないguildはavailable channelを公開しない', async (): Promise<void> => {
    const executed: ExecutedSnapshot[] = [];
    const synchronizer = createSynchronizer(executed);
    const guild = fakeGuild('123456789012345678', [fakeChannel('223456789012345678', 'general', ChannelType.GuildText)], null);

    await synchronizer.synchronizeGuild(guild, 'guild-create');

    assert.deepEqual(executed, [
        {
            trigger: 'guild-create',
            snapshot: { guildId: guild.id, installed: true, channels: [] }
        }
    ]);
});

void test('同じguildのsnapshotはevent順に直列送信する', async (): Promise<void> => {
    const executed: GuildSnapshotSyncTrigger[] = [];
    let releaseFirst = (): void => assert.fail('first snapshot has not started');
    const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    const useCase: GuildSnapshotSyncUseCase = {
        execute: (_snapshot, trigger): Promise<void> => {
            executed.push(trigger);
            return executed.length === 1 ? firstGate : Promise.resolve();
        }
    };
    const synchronizer = new DiscordGuildSnapshotSynchronizer(useCase);
    const guild = fakeGuild('123456789012345678', []);

    const installed = synchronizer.synchronizeGuild(guild, 'channel-create');
    const deleted = synchronizer.synchronizeDeletedGuild(guild.id);
    await Promise.resolve();

    assert.deepEqual(executed, ['channel-create']);
    releaseFirst();
    await Promise.all([installed, deleted]);
    assert.deepEqual(executed, ['channel-create', 'guild-delete']);
});
