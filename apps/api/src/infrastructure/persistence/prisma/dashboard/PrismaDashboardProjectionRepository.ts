import { AuditActorType, AuditOutcome, DiscordChannelType, type PrismaClient } from '@prisma/client';

import type { DashboardGuildProjection, DashboardProjectionRepository } from '../../../../application/dashboard/DashboardPorts.js';
import { ManagedChannelOwnershipError } from '../../../../application/keyword/KeywordApplicationErrors.js';
import { DashboardDependencyError } from '../../../../domain/dashboard/DashboardErrors.js';
import type { ManagedChannelSnapshot, ManagedChannelType } from '../../../../domain/dashboard/DashboardTypes.js';

function toPrismaChannelType(type: ManagedChannelType): DiscordChannelType {
    return type === 'text' ? DiscordChannelType.TEXT : DiscordChannelType.ANNOUNCEMENT;
}

function toDomainChannelType(type: DiscordChannelType): ManagedChannelType {
    return type === DiscordChannelType.TEXT ? 'text' : 'announcement';
}

export class PrismaDashboardProjectionRepository implements DashboardProjectionRepository {
    public constructor(private readonly prisma: PrismaClient) {}

    public async syncGuild(guildId: string, installed: boolean, channels: readonly ManagedChannelSnapshot[], correlationId: string): Promise<void> {
        await this.run(async (): Promise<void> => {
            await this.prisma.$transaction(async (transaction): Promise<void> => {
                const now = new Date();
                await transaction.managedGuild.upsert({
                    where: { id: guildId },
                    update: { botInstalled: installed },
                    create: { id: guildId, botInstalled: installed }
                });
                await transaction.channel.updateMany({ where: { guildId }, data: { available: false, syncedAt: now } });
                if (installed) {
                    for (const channel of channels) {
                        const existing = await transaction.channel.findUnique({ where: { id: channel.id }, select: { guildId: true } });
                        if (existing?.guildId && existing.guildId !== guildId) throw new ManagedChannelOwnershipError(channel.id, guildId);
                        await transaction.channel.upsert({
                            where: { id: channel.id },
                            update: {
                                guildId,
                                name: channel.name,
                                type: toPrismaChannelType(channel.type),
                                available: true,
                                syncedAt: now
                            },
                            create: {
                                id: channel.id,
                                guildId,
                                name: channel.name,
                                type: toPrismaChannelType(channel.type),
                                available: true,
                                syncedAt: now
                            }
                        });
                    }
                }
                await transaction.auditLog.create({
                    data: {
                        actorType: AuditActorType.SERVICE,
                        actorId: 'bot',
                        guildId,
                        action: 'guild.snapshot.sync',
                        outcome: AuditOutcome.SUCCEEDED,
                        resourceType: 'guild',
                        resourceId: guildId,
                        correlationId
                    }
                });
            });
        });
    }

    public async findGuilds(guildIds: readonly string[]): Promise<DashboardGuildProjection[]> {
        if (guildIds.length === 0) return [];
        return this.run(
            async (): Promise<DashboardGuildProjection[]> =>
                this.prisma.managedGuild.findMany({ where: { id: { in: [...guildIds] } }, select: { id: true, botInstalled: true } })
        );
    }

    public async listAvailableChannels(guildId: string): Promise<ManagedChannelSnapshot[] | undefined> {
        return this.run(async (): Promise<ManagedChannelSnapshot[] | undefined> => {
            const guild = await this.prisma.managedGuild.findUnique({ where: { id: guildId }, select: { botInstalled: true } });
            if (!guild?.botInstalled) return undefined;
            const channels = await this.prisma.channel.findMany({
                where: { guildId, available: true, name: { not: null }, type: { not: null } },
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                select: { id: true, name: true, type: true }
            });
            return channels.flatMap((channel): ManagedChannelSnapshot[] =>
                channel.name && channel.type ? [{ id: channel.id, name: channel.name, type: toDomainChannelType(channel.type) }] : []
            );
        });
    }

    private async run<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof ManagedChannelOwnershipError) throw error;
            throw new DashboardDependencyError('ダッシュボードprojectionの永続化に失敗しました。', { cause: error });
        }
    }
}
