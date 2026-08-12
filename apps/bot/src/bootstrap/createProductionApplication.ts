import { Client, GatewayIntentBits, Partials } from 'discord.js';

import type { CooldownStore } from '../application/cooldown/CooldownStore.js';
import { DrawOmikuji } from '../application/fun/omikuji/DrawOmikuji.js';
import { PlayRockPaperScissors } from '../application/fun/rps/PlayRockPaperScissors.js';
import { SpinSlot } from '../application/fun/slot/SpinSlot.js';
import { GetBotInformation } from '../application/general/bot/GetBotInformation.js';
import { FollowAnnouncement } from '../application/general/follow/FollowAnnouncement.js';
import { GetGuildInformation } from '../application/general/guild/GetGuildInformation.js';
import { MeasurePing } from '../application/general/ping/MeasurePing.js';
import { GetUserInformation } from '../application/general/user/GetUserInformation.js';
import { SyncGuildSnapshot } from '../application/guild/SyncGuildSnapshot.js';
import CommandHandler from '../commands/CommandHandler.js';
import { createCommands } from '../commands/index.js';
import EventHandler from '../events/EventHandler.js';
import { createEvents } from '../events/events.js';
import { HttpKeywordManagementClient } from '../infrastructure/api-client/keyword/HttpKeywordManagementClient.js';
import { InMemoryCooldownStore } from '../infrastructure/cooldown/memory/InMemoryCooldownStore.js';
import { BotRedisKeyBuilder } from '../infrastructure/cooldown/redis/BotRedisKeyBuilder.js';
import { RedisCooldownStore } from '../infrastructure/cooldown/redis/RedisCooldownStore.js';
import { ResilientCooldownStore } from '../infrastructure/cooldown/ResilientCooldownStore.js';
import { MathRandomSource } from '../infrastructure/fun/MathRandomSource.js';
import { SystemDelay } from '../infrastructure/fun/SystemDelay.js';
import { DiscordBotInformationReader } from '../infrastructure/general/bot/DiscordBotInformationReader.js';
import { DiscordAnnouncementFollower } from '../infrastructure/general/follow/DiscordAnnouncementFollower.js';
import { DiscordGuildInformationReader } from '../infrastructure/general/guild/DiscordGuildInformationReader.js';
import { SafeCommandFailureLogger } from '../infrastructure/general/SafeCommandFailureLogger.js';
import { SystemClock } from '../infrastructure/general/SystemClock.js';
import { DiscordUserInformationReader } from '../infrastructure/general/user/DiscordUserInformationReader.js';
import { SafeGuildSnapshotSyncLogger } from '../infrastructure/guild/SafeGuildSnapshotSyncLogger.js';
import { RedisConnection } from '../infrastructure/redis/RedisConnection.js';
import { RedisMetrics } from '../infrastructure/redis/RedisMetrics.js';
import { DiscordGuildSnapshotSynchronizer } from '../interface-adapter/discord/guild-snapshot/DiscordGuildSnapshotSynchronizer.js';
import { DiscordEmbedFactory } from '../interface-adapter/discord/presentation/DiscordEmbedFactory.js';
import { type Config, initializeConfig, loadConfig, resetConfigAfterFailedInitialization } from '../utils/config.js';
import { configureLogging, logger, shutdownLogging } from '../utils/log.js';
import { BotApplication, createApplication } from './createApplication.js';

/** production用の具象依存を組み立てる */
export async function createProductionApplication(discordToken: string, apiServiceToken: string): Promise<BotApplication> {
    let clientToCleanUp: Client | undefined;
    let configToReset: Config | undefined;
    let redisToCleanUp: RedisConnection | undefined;

    try {
        configureLogging();

        const applicationConfig = loadConfig();
        initializeConfig(applicationConfig);
        configToReset = applicationConfig;
        logger.info('コンフィグファイルを読み込みました。');

        const keywordManagement = new HttpKeywordManagementClient(
            applicationConfig.serverManagementApi.baseUrl,
            apiServiceToken,
            applicationConfig.serverManagementApi.timeoutMs
        );
        const guildSnapshots = new DiscordGuildSnapshotSynchronizer(
            new SyncGuildSnapshot(keywordManagement, new SafeGuildSnapshotSyncLogger(logger))
        );
        const redisMetrics = new RedisMetrics((state): void => {
            if (state === 'degraded') logger.warn('Bot Redis cooldown state: degraded');
            if (state === 'ready') logger.info('Bot Redis cooldown state: ready');
        });
        const memoryCooldownStore = new InMemoryCooldownStore({ maxEntries: applicationConfig.cooldownStore.maxMemoryEntries });
        const redisUrl = process.env.BOT_REDIS_URL;
        let cooldownStore: CooldownStore = memoryCooldownStore;
        if (redisUrl) {
            const redisConnection = new RedisConnection({
                url: redisUrl,
                connectTimeoutMs: applicationConfig.cooldownStore.connectTimeoutMs,
                commandTimeoutMs: applicationConfig.cooldownStore.commandTimeoutMs,
                reconnectBaseDelayMs: applicationConfig.cooldownStore.reconnectBaseDelayMs,
                reconnectMaxDelayMs: applicationConfig.cooldownStore.reconnectMaxDelayMs,
                metrics: redisMetrics
            });
            redisToCleanUp = redisConnection;
            cooldownStore = new ResilientCooldownStore(
                new RedisCooldownStore(redisConnection, new BotRedisKeyBuilder(process.env.NODE_ENV ?? 'development')),
                memoryCooldownStore,
                redisMetrics
            );
        }
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildPresences
            ],
            partials: [Partials.Message, Partials.Channel]
        });
        clientToCleanUp = client;

        const randomSource = new MathRandomSource();
        const clock = new SystemClock();
        const commandFailureLogger = new SafeCommandFailureLogger(logger);
        const embedFactory = new DiscordEmbedFactory({
            botColor: applicationConfig.botColor,
            errorColor: applicationConfig.errorColor,
            errorEmoji: applicationConfig.errorEmoji
        });
        const commands = createCommands({
            botInformation: new GetBotInformation(new DiscordBotInformationReader(client), clock),
            botPresentation: {
                iconUrl: applicationConfig.iconURL,
                inviteUrl: applicationConfig.inviteURL,
                supportGuildUrl: applicationConfig.supportGuildURL
            },
            commandFailureLogger,
            drawOmikuji: new DrawOmikuji(randomSource),
            embedFactory,
            followAnnouncement: new FollowAnnouncement(new DiscordAnnouncementFollower(client, applicationConfig.announcementChannelId)),
            guildInformation: new GetGuildInformation(new DiscordGuildInformationReader(client), commandFailureLogger, clock, {
                memberEmoji: applicationConfig.memberEmoji,
                botEmoji: applicationConfig.botEmoji,
                emoji: applicationConfig.emoji,
                gifEmoji: applicationConfig.gifEmoji,
                channelEmoji: {
                    category: applicationConfig.channelEmoji.category,
                    publicText: applicationConfig.channelEmoji.publicText,
                    lockedText: applicationConfig.channelEmoji.lockedText,
                    publicVoice: applicationConfig.channelEmoji.publicVoice,
                    lockedVoice: applicationConfig.channelEmoji.lockedVoice,
                    publicAnnouncement: applicationConfig.channelEmoji.publicAnnouncement,
                    lockedAnnouncement: applicationConfig.channelEmoji.lockedAnnouncement,
                    publicStage: applicationConfig.channelEmoji.publicStage,
                    lockedStage: applicationConfig.channelEmoji.lockedStage
                }
            }),
            helpPresentation: {
                iconUrl: applicationConfig.iconURL,
                inviteUrl: applicationConfig.inviteURL,
                supportGuildUrl: applicationConfig.supportGuildURL
            },
            keywordManagement,
            measurePing: new MeasurePing(),
            playRockPaperScissors: new PlayRockPaperScissors(randomSource),
            spinSlot: new SpinSlot(randomSource, new SystemDelay()),
            userInformation: new GetUserInformation(new DiscordUserInformationReader(client), commandFailureLogger, clock, {
                botEmoji: applicationConfig.botEmoji,
                statusEmoji: {
                    online: applicationConfig.statusEmoji.online,
                    idle: applicationConfig.statusEmoji.idle,
                    dnd: applicationConfig.statusEmoji.dnd,
                    streaming: applicationConfig.statusEmoji.streaming,
                    invisible: applicationConfig.statusEmoji.invisible
                }
            })
        });
        const commandHandler = new CommandHandler(commands, client, applicationConfig.guildId, cooldownStore);

        const createdEvents = createEvents({ client, commandHandler, guildSnapshots, keywordManagement });
        const eventHandler = new EventHandler(createdEvents.events);

        return createApplication({
            startDependencies: (): void => {
                redisToCleanUp?.start();
            },
            registerEvents: (): void => {
                eventHandler.registerEvents(client);
            },
            unregisterEvents: (): void => {
                eventHandler.unregisterEvents();
            },
            stopBackgroundTasks: createdEvents.stopBackgroundTasks,
            waitForInFlight: (): Promise<void> => eventHandler.waitForIdle(),
            login: async (): Promise<void> => {
                await client.login(discordToken);
            },
            destroyClient: async (): Promise<void> => {
                await client.destroy();
            },
            shutdownDependencies: async (): Promise<void> => {
                const snapshot = redisMetrics.snapshot();
                logger.info(
                    `Bot Redis cooldown summary: state=${snapshot.state} acquired=${String(snapshot.acquired)} rejected=${String(snapshot.rejected)} fallbacks=${String(snapshot.fallbacks)} timeouts=${String(snapshot.timeouts)}`
                );
                await redisToCleanUp?.close();
            },
            shutdownLogging
        });
    } catch (error) {
        const cleanupErrors: unknown[] = [];
        const runCleanup = async (cleanup: () => void | Promise<void>): Promise<void> => {
            try {
                await cleanup();
            } catch (cleanupError) {
                cleanupErrors.push(cleanupError);
            }
        };

        if (clientToCleanUp) {
            const client = clientToCleanUp;
            await runCleanup(async (): Promise<void> => {
                await client.destroy();
            });
        }
        if (redisToCleanUp) {
            await runCleanup((): Promise<void> => redisToCleanUp?.close() ?? Promise.resolve());
        }
        await runCleanup(shutdownLogging);
        if (configToReset) {
            resetConfigAfterFailedInitialization(configToReset);
        }

        if (cleanupErrors.length > 0) {
            throw new AggregateError([error, ...cleanupErrors], 'Botの依存構築と後始末に失敗しました。');
        }
        throw error;
    }
}
