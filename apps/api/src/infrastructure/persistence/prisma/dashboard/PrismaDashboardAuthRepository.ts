import type { PrismaClient } from '@prisma/client';

import type {
    CreateDashboardSessionRecord,
    DashboardAuthRepository,
    DashboardSessionRecord,
    OAuthAttemptRecord
} from '../../../../application/dashboard/DashboardPorts.js';
import { DashboardDependencyError } from '../../../../domain/dashboard/DashboardErrors.js';

export class PrismaDashboardAuthRepository implements DashboardAuthRepository {
    public constructor(private readonly prisma: PrismaClient) {}

    public async createOAuthAttempt(attempt: OAuthAttemptRecord): Promise<void> {
        await this.run(async (): Promise<void> => {
            await this.prisma.oAuthAttempt.create({ data: attempt });
        });
    }

    public async consumeOAuthAttempt(stateHash: string, now: Date): Promise<OAuthAttemptRecord | undefined> {
        return this.run(
            async (): Promise<OAuthAttemptRecord | undefined> =>
                this.prisma.$transaction(async (transaction): Promise<OAuthAttemptRecord | undefined> => {
                    const consumed = await transaction.oAuthAttempt.updateMany({
                        where: { stateHash, consumedAt: null, expiresAt: { gt: now } },
                        data: { consumedAt: now }
                    });
                    if (consumed.count === 0) return undefined;
                    const attempt = await transaction.oAuthAttempt.findUnique({ where: { stateHash } });
                    return attempt ? { stateHash: attempt.stateHash, returnTo: attempt.returnTo, expiresAt: attempt.expiresAt } : undefined;
                })
        );
    }

    public async createSession(session: CreateDashboardSessionRecord): Promise<void> {
        await this.run(async (): Promise<void> => {
            await this.prisma.$transaction(async (transaction): Promise<void> => {
                await transaction.dashboardUser.upsert({
                    where: { id: session.user.id },
                    update: { displayName: session.user.displayName, avatarHash: session.user.avatarHash },
                    create: { id: session.user.id, displayName: session.user.displayName, avatarHash: session.user.avatarHash }
                });
                await transaction.dashboardSession.create({
                    data: {
                        idHash: session.idHash,
                        userId: session.user.id,
                        accessTokenCiphertext: session.accessTokenCiphertext,
                        refreshTokenCiphertext: session.refreshTokenCiphertext,
                        tokenExpiresAt: session.tokenExpiresAt,
                        idleExpiresAt: session.idleExpiresAt,
                        absoluteExpiresAt: session.absoluteExpiresAt,
                        csrfHash: session.csrfHash
                    }
                });
            });
        });
    }

    public async findSession(idHash: string): Promise<DashboardSessionRecord | undefined> {
        return this.run(async (): Promise<DashboardSessionRecord | undefined> => {
            const session = await this.prisma.dashboardSession.findUnique({ where: { idHash }, include: { user: true } });
            if (!session) return undefined;
            return {
                idHash: session.idHash,
                user: { id: session.user.id, displayName: session.user.displayName, avatarHash: session.user.avatarHash },
                accessTokenCiphertext: session.accessTokenCiphertext,
                refreshTokenCiphertext: session.refreshTokenCiphertext,
                tokenExpiresAt: session.tokenExpiresAt,
                idleExpiresAt: session.idleExpiresAt,
                absoluteExpiresAt: session.absoluteExpiresAt,
                csrfHash: session.csrfHash,
                revokedAt: session.revokedAt
            };
        });
    }

    public async updateTokens(
        idHash: string,
        tokens: Pick<DashboardSessionRecord, 'accessTokenCiphertext' | 'refreshTokenCiphertext' | 'tokenExpiresAt'>
    ): Promise<void> {
        await this.run(async (): Promise<void> => {
            await this.prisma.dashboardSession.update({ where: { idHash }, data: tokens });
        });
    }

    public async touchSession(idHash: string, idleExpiresAt: Date, now: Date): Promise<boolean> {
        return this.run(async (): Promise<boolean> => {
            const updated = await this.prisma.dashboardSession.updateMany({
                where: { idHash, revokedAt: null, idleExpiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
                data: { idleExpiresAt, lastSeenAt: now }
            });
            return updated.count === 1;
        });
    }

    public async revokeSession(idHash: string, now: Date): Promise<void> {
        await this.run(async (): Promise<void> => {
            await this.prisma.dashboardSession.updateMany({ where: { idHash, revokedAt: null }, data: { revokedAt: now } });
        });
    }

    private async run<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw new DashboardDependencyError('ダッシュボード認証情報の永続化に失敗しました。', { cause: error });
        }
    }
}
