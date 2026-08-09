import { ActivityType, type Client } from 'discord.js';

import CommandHandler from '../commands/CommandHandler.js';
import { logger } from '../utils/log.js';
import { EventBase } from './base/event_base.js';

export class ClientReadyEvent extends EventBase<'clientReady'> {
    public eventName = 'clientReady' as const;
    public static totalGuilds = '情報取得中...';
    public static totalUsers = '情報取得中...';
    private readonly updateInterval = 15000;
    private updateTimer: NodeJS.Timeout | undefined;
    private stopped = false;

    public constructor(
        private readonly client: Client,
        private readonly commandHandler: CommandHandler
    ) {
        super();
    }

    public async listener(): Promise<void> {
        this.stop();
        this.stopped = false;
        try {
            await this.commandHandler.registerCommands();
            this.updateStatsAndActivity();
            this.startUpdateLoop();
            logger.info(`起動完了: ${this.client.user?.tag ?? 'Unknown User'}`);
        } catch (error) {
            logger.error('ClientReadyEventでエラーが発生', error);
        }
    }

    private startUpdateLoop(): void {
        if (this.stopped) return;

        ((): void => {
            try {
                this.updateStatsAndActivity();
            } catch (error) {
                logger.error('ステータスの定期更新中にエラーが発生', error);
            } finally {
                this.updateTimer = setTimeout(() => {
                    this.startUpdateLoop();
                }, this.updateInterval);
            }
        })();
    }

    private updateStatsAndActivity(): void {
        ClientReadyEvent.totalGuilds = this.checkTotalGuilds();
        ClientReadyEvent.totalUsers = this.checkTotalUsers();

        const name = `/help | Servers: ${ClientReadyEvent.totalGuilds} | Users: ${ClientReadyEvent.totalUsers}`;

        this.client.user?.setActivity({ name, type: ActivityType.Playing });
    }

    public checkTotalGuilds(): string {
        return this.client.guilds.cache.size.toString();
    }

    public checkTotalUsers(): string {
        return this.client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0).toString();
    }

    /** 定期更新を停止する */
    public stop(): void {
        this.stopped = true;
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = undefined;
        }
    }
}
