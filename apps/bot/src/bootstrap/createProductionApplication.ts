import { Client, GatewayIntentBits, Partials } from 'discord.js';

import type { CooldownStore } from '../application/cooldown/CooldownStore.js';
import { DrawOmikuji } from '../application/fun/omikuji/DrawOmikuji.js';
import { PlayRockPaperScissors } from '../application/fun/rps/PlayRockPaperScissors.js';
import { SpinSlot } from '../application/fun/slot/SpinSlot.js';
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
import { RedisConnection } from '../infrastructure/redis/RedisConnection.js';
import { RedisMetrics } from '../infrastructure/redis/RedisMetrics.js';
import CommandService from '../services/CommandService.js';
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
        const commands = createCommands({
            drawOmikuji: new DrawOmikuji(randomSource),
            keywordManagement,
            playRockPaperScissors: new PlayRockPaperScissors(randomSource),
            spinSlot: new SpinSlot(randomSource, new SystemDelay())
        });
        const commandHandler = new CommandHandler(commands, client, applicationConfig.guildId, cooldownStore);
        CommandService.initialize(commandHandler);

        const createdEvents = createEvents({ client, commandHandler, keywordManagement });
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
