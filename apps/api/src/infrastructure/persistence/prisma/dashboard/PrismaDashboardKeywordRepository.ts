import { AuditActorType, AuditOutcome, Prisma, type PrismaClient } from '@prisma/client';

import type { DashboardKeywordRepository } from '../../../../application/dashboard/DashboardPorts.js';
import type { KeywordScope } from '../../../../application/keyword/KeywordRepository.js';
import { DashboardDependencyError, ManagedDashboardResourceError } from '../../../../domain/dashboard/DashboardErrors.js';
import { createKeyword, type Keyword } from '../../../../domain/keyword/Keyword.js';
import { decodeKeywordResponses } from '../keyword/keywordJsonCodec.js';

type TransactionClient = Prisma.TransactionClient;

export class PrismaDashboardKeywordRepository implements DashboardKeywordRepository {
    public constructor(private readonly prisma: PrismaClient) {}

    public async list(scope: KeywordScope): Promise<Keyword[]> {
        return this.run(
            async (): Promise<Keyword[]> =>
                this.prisma.$transaction(async (transaction): Promise<Keyword[]> => {
                    await this.assertManagedChannel(transaction, scope);
                    const records = await transaction.keyword.findMany({ where: { channelId: scope.channelId }, orderBy: { trigger: 'asc' } });
                    return records.map(
                        (record): Keyword =>
                            createKeyword({
                                ...scope,
                                trigger: record.trigger,
                                responses: decodeKeywordResponses(record.responses)
                            })
                    );
                })
        );
    }

    public async saveWithAudit(keyword: Keyword, actorId: string, correlationId: string): Promise<void> {
        await this.run(async (): Promise<void> => {
            await this.prisma.$transaction(async (transaction): Promise<void> => {
                await this.assertManagedChannel(transaction, keyword);
                await transaction.keyword.upsert({
                    where: {
                        // Prisma's generated compound key follows schema field names.
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        channelId_trigger: { channelId: keyword.channelId, trigger: keyword.trigger }
                    },
                    update: { responses: [...keyword.responses] },
                    create: { channelId: keyword.channelId, trigger: keyword.trigger, responses: [...keyword.responses] }
                });
                await this.recordAudit(transaction, keyword, actorId, correlationId, 'keyword.save');
            });
        });
    }

    public async removeWithAudit(scope: KeywordScope, trigger: string, actorId: string, correlationId: string): Promise<boolean> {
        return this.run(
            async (): Promise<boolean> =>
                this.prisma.$transaction(async (transaction): Promise<boolean> => {
                    await this.assertManagedChannel(transaction, scope);
                    const removed = await transaction.keyword.deleteMany({ where: { channelId: scope.channelId, trigger } });
                    if (removed.count === 0) return false;
                    await this.recordAudit(transaction, scope, actorId, correlationId, 'keyword.delete');
                    return true;
                })
        );
    }

    private async assertManagedChannel(transaction: TransactionClient, scope: KeywordScope): Promise<void> {
        const guild = await transaction.managedGuild.findUnique({ where: { id: scope.guildId }, select: { botInstalled: true } });
        if (!guild?.botInstalled) throw new ManagedDashboardResourceError('Botが導入済みのサーバーではありません。');
        const channel = await transaction.channel.findUnique({ where: { id: scope.channelId }, select: { guildId: true, available: true } });
        if (!channel?.available || channel.guildId !== scope.guildId) throw new ManagedDashboardResourceError();
    }

    private async recordAudit(
        transaction: TransactionClient,
        scope: KeywordScope,
        actorId: string,
        correlationId: string,
        action: string
    ): Promise<void> {
        await transaction.auditLog.create({
            data: {
                actorType: AuditActorType.USER,
                actorId,
                guildId: scope.guildId,
                action,
                outcome: AuditOutcome.SUCCEEDED,
                resourceType: 'keyword',
                resourceId: scope.channelId,
                correlationId
            }
        });
    }

    private async run<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof ManagedDashboardResourceError) throw error;
            throw new DashboardDependencyError('ダッシュボードのキーワード永続化に失敗しました。', { cause: error });
        }
    }
}
