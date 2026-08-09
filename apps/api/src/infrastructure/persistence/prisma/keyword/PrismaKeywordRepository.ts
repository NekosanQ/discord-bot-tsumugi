import { Prisma, type PrismaClient } from '@prisma/client';

import { KeywordDependencyError, ManagedChannelOwnershipError } from '../../../../application/keyword/KeywordApplicationErrors.js';
import type { KeywordRepository, KeywordScope } from '../../../../application/keyword/KeywordRepository.js';
import { createKeyword, type Keyword } from '../../../../domain/keyword/Keyword.js';
import { decodeKeywordResponses } from './keywordJsonCodec.js';

type TransactionClient = Prisma.TransactionClient;

export class PrismaKeywordRepository implements KeywordRepository {
    public constructor(private readonly prisma: PrismaClient) {}

    public async save(keyword: Keyword): Promise<void> {
        await this.run(async (transaction): Promise<void> => {
            await this.claimChannel(transaction, keyword);
            await transaction.keyword.upsert({
                where: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    channelId_trigger: { channelId: keyword.channelId, trigger: keyword.trigger }
                },
                update: { responses: [...keyword.responses] },
                create: { channelId: keyword.channelId, trigger: keyword.trigger, responses: [...keyword.responses] }
            });
        });
    }

    public async remove(scope: KeywordScope, trigger: string): Promise<boolean> {
        return this.run(async (transaction): Promise<boolean> => {
            await this.claimChannel(transaction, scope);
            const result = await transaction.keyword.deleteMany({ where: { channelId: scope.channelId, trigger } });
            return result.count > 0;
        });
    }

    public async findByTrigger(scope: KeywordScope, trigger: string): Promise<Keyword | undefined> {
        return this.run(async (transaction): Promise<Keyword | undefined> => {
            await this.claimChannel(transaction, scope);
            const record = await transaction.keyword.findUnique({
                where: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    channelId_trigger: { channelId: scope.channelId, trigger }
                }
            });
            return record ? this.toDomain(scope.guildId, record) : undefined;
        });
    }

    public async list(scope: KeywordScope): Promise<Keyword[]> {
        return this.run(async (transaction): Promise<Keyword[]> => {
            await this.claimChannel(transaction, scope);
            const records = await transaction.keyword.findMany({ where: { channelId: scope.channelId } });
            return records.map((record): Keyword => this.toDomain(scope.guildId, record));
        });
    }

    private async claimChannel(transaction: TransactionClient, scope: KeywordScope): Promise<void> {
        await transaction.managedGuild.upsert({
            where: { id: scope.guildId },
            update: { botInstalled: true },
            create: { id: scope.guildId, botInstalled: true }
        });

        const existing = await transaction.channel.findUnique({ where: { id: scope.channelId }, select: { guildId: true } });
        if (!existing) {
            await transaction.channel.create({ data: { id: scope.channelId, guildId: scope.guildId } });
            return;
        }
        if (existing.guildId === scope.guildId) return;
        if (existing.guildId !== null) throw new ManagedChannelOwnershipError(scope.channelId, scope.guildId);

        const claimed = await transaction.channel.updateMany({
            where: { id: scope.channelId, guildId: null },
            data: { guildId: scope.guildId }
        });
        if (claimed.count === 0) {
            const current = await transaction.channel.findUnique({ where: { id: scope.channelId }, select: { guildId: true } });
            if (current?.guildId !== scope.guildId) throw new ManagedChannelOwnershipError(scope.channelId, scope.guildId);
        }
    }

    private toDomain(guildId: string, record: { channelId: string; trigger: string; responses: Prisma.JsonValue }): Keyword {
        return createKeyword({
            guildId,
            channelId: record.channelId,
            trigger: record.trigger,
            responses: decodeKeywordResponses(record.responses)
        });
    }

    private async run<T>(operation: (transaction: TransactionClient) => Promise<T>): Promise<T> {
        try {
            return await this.prisma.$transaction(operation);
        } catch (error) {
            if (error instanceof ManagedChannelOwnershipError) throw error;
            throw new KeywordDependencyError('キーワード永続化処理に失敗しました。', { cause: error });
        }
    }
}
