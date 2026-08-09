import type { PrismaClient } from '@prisma/client';

import type { ManagedGuildRepository } from '../../../../application/guild/ManagedGuildRepository.js';
import { KeywordDependencyError } from '../../../../application/keyword/KeywordApplicationErrors.js';
import type { ManagedGuild } from '../../../../domain/guild/ManagedGuild.js';

export class PrismaManagedGuildRepository implements ManagedGuildRepository {
    public constructor(private readonly prisma: PrismaClient) {}

    public async saveInstallation(guild: ManagedGuild): Promise<void> {
        try {
            await this.prisma.managedGuild.upsert({
                where: { id: guild.id },
                update: { botInstalled: guild.botInstalled },
                create: { id: guild.id, botInstalled: guild.botInstalled }
            });
        } catch (error) {
            throw new KeywordDependencyError('サーバー導入状態の保存に失敗しました。', { cause: error });
        }
    }
}
