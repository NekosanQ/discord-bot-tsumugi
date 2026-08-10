import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { PrismaClient } from '@prisma/client';

import { ManagedDashboardResourceError } from '../../src/domain/dashboard/DashboardErrors.js';
import { createKeyword } from '../../src/domain/keyword/Keyword.js';
import { PrismaDashboardKeywordRepository } from '../../src/infrastructure/persistence/prisma/dashboard/PrismaDashboardKeywordRepository.js';
import { PrismaDashboardProjectionRepository } from '../../src/infrastructure/persistence/prisma/dashboard/PrismaDashboardProjectionRepository.js';

const databaseUrl = process.env.API_MYSQL_TEST_URL;

function snowflake(base: bigint): string {
    const random = BigInt(`0x${randomBytes(6).toString('hex')}`);
    return String(base + (random % 1000000000000000n));
}

void test(
    'dashboardは同期済みtenantだけを更新しkeywordと監査を同一transactionで保存する',
    { skip: databaseUrl ? false : 'API_MYSQL_TEST_URLが未設定です。' },
    async (): Promise<void> => {
        if (!databaseUrl) return;
        const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
        const guildId = snowflake(80000000000000000n);
        const otherGuildId = snowflake(81000000000000000n);
        const channelId = snowflake(82000000000000000n);
        const projection = new PrismaDashboardProjectionRepository(prisma);
        const keywords = new PrismaDashboardKeywordRepository(prisma);

        try {
            await projection.syncGuild(guildId, true, [{ id: channelId, name: 'general', type: 'text' }], randomUUID());
            await projection.syncGuild(otherGuildId, true, [], randomUUID());
            await keywords.saveWithAudit(
                createKeyword({ guildId, channelId, trigger: 'こんにちは', responses: ['やあ'] }),
                snowflake(83000000000000000n),
                randomUUID()
            );

            assert.equal((await keywords.list({ guildId, channelId })).length, 1);
            await assert.rejects(() => keywords.list({ guildId: otherGuildId, channelId }), ManagedDashboardResourceError);
            const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { guildId: true } });
            assert.equal(channel?.guildId, guildId);
            assert.equal(await prisma.auditLog.count({ where: { guildId, action: 'keyword.save', outcome: 'SUCCEEDED' } }), 1);
        } finally {
            await prisma.keyword.deleteMany({ where: { channelId } });
            await prisma.auditLog.deleteMany({ where: { guildId: { in: [guildId, otherGuildId] } } });
            await prisma.channel.deleteMany({ where: { id: channelId } });
            await prisma.managedGuild.deleteMany({ where: { id: { in: [guildId, otherGuildId] } } });
            await prisma.$disconnect();
        }
    }
);
