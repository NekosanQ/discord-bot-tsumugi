import { PrismaClient } from '@prisma/client';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

import CommandHandler from '../commands/CommandHandler.js';
import { createCommands } from '../commands/index.js';
import EventHandler from '../events/EventHandler.js';
import { createEvents } from '../events/events.js';
import CommandService from '../services/CommandService.js';
import { type Config, initializeConfig, loadConfig, resetConfigAfterFailedInitialization } from '../utils/config.js';
import { configureLogging, logger, shutdownLogging } from '../utils/log.js';
import { BotApplication, createApplication } from './createApplication.js';

/** production用の具象依存を組み立てる */
export async function createProductionApplication(discordToken: string): Promise<BotApplication> {
    let prismaToCleanUp: PrismaClient | undefined;
    let clientToCleanUp: Client | undefined;
    let configToReset: Config | undefined;

    try {
        configureLogging();

        const applicationConfig = loadConfig();
        initializeConfig(applicationConfig);
        configToReset = applicationConfig;
        logger.info('コンフィグファイルを読み込みました。');

        const prisma = new PrismaClient();
        prismaToCleanUp = prisma;
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

        const commands = createCommands({ prisma });
        const commandHandler = new CommandHandler(commands, client, applicationConfig.guildId);
        CommandService.initialize(commandHandler);

        const createdEvents = createEvents({ client, commandHandler, prisma });
        const eventHandler = new EventHandler(createdEvents.events);

        return createApplication({
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
            disconnectDatabase: async (): Promise<void> => {
                await prisma.$disconnect();
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
        if (prismaToCleanUp) {
            const prisma = prismaToCleanUp;
            await runCleanup((): Promise<void> => prisma.$disconnect());
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
