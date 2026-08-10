import { PermissionTranslator } from '../../../utils/PermissionTranslator.js';
import type { Clock } from '../Clock.js';
import type { CommandFailureLogger } from '../CommandFailureLogger.js';
import { formatDateTime } from '../formatDateTime.js';
import type { UserInformationReader, UserInformationSnapshot } from './UserInformationReader.js';

const MAX_ROLE_LIST_LENGTH = 1_000;

export interface UserInformationSymbols {
    botEmoji: string;
    statusEmoji: {
        online: string;
        idle: string;
        dnd: string;
        streaming: string;
        invisible: string;
    };
}

export interface UserInformationView {
    title: string;
    basicInformation: string;
    memberInformation: string;
    rolesTitle: string;
    roles: string;
    permissionsTitle: string;
    permissions: string;
    thumbnailUrl: string;
}

export type GetUserInformationResult =
    | { status: 'success'; information: UserInformationView }
    | { status: 'guild-required' }
    | { status: 'member-fetch-failed' };

export interface GetUserInformationInput {
    guildId: string | null;
    targetUserId: string;
}

export class GetUserInformation {
    public constructor(
        private readonly reader: UserInformationReader,
        private readonly logger: CommandFailureLogger,
        private readonly clock: Clock,
        private readonly symbols: UserInformationSymbols
    ) {}

    public async execute(input: GetUserInformationInput): Promise<GetUserInformationResult> {
        if (!input.guildId) return { status: 'guild-required' };

        let snapshot: UserInformationSnapshot;
        try {
            snapshot = await this.reader.read(input.guildId, input.targetUserId);
        } catch (error) {
            this.logger.failure('user-member-fetch', error);
            return { status: 'member-fetch-failed' };
        }

        return { status: 'success', information: this.format(snapshot) };
    }

    private format(snapshot: UserInformationSnapshot): UserInformationView {
        const now = this.clock.now();
        const permissionNames = new PermissionTranslator(snapshot.permissionBitfield).permissionNames;
        const permissions = permissionNames.length > 0 ? permissionNames.map((name) => `\`${name}\``).join(', ') : 'なし';
        const basicInformation = [
            `ユーザー名(ID): ${snapshot.username} (${snapshot.userId})`,
            `表示名: ${snapshot.globalName ?? 'なし'}`,
            this.formatStatus(snapshot.presenceStatus),
            `アカウント作成日: ${formatDateTime(snapshot.createdAt, now)}`
        ].join('\n');
        const memberInformation = [
            `ニックネーム: ${snapshot.nickname ?? 'なし'}`,
            `サーバー参加日: ${snapshot.joinedAt ? formatDateTime(snapshot.joinedAt, now) : '不明'}`
        ].join('\n');

        return {
            title: `ユーザー情報 ${snapshot.isBot ? this.symbols.botEmoji : ''}`,
            basicInformation,
            memberInformation,
            rolesTitle: `役職 (${String(snapshot.roleCount)})`,
            roles: this.formatRoles(snapshot.roleMentions),
            permissionsTitle: `権限 (${String(snapshot.permissionBitfield)})`,
            permissions,
            thumbnailUrl: snapshot.avatarUrl
        };
    }

    private formatRoles(roleMentions: readonly string[]): string {
        if (roleMentions.length === 0) return 'なし';

        let result = '';
        let processedCount = 0;
        for (const role of roleMentions) {
            const separator = result.length > 0 ? ', ' : '';
            const remainingCount = roleMentions.length - processedCount;
            const placeholderEllipsis = `, ...他${String(remainingCount)}件`;
            if (result.length + separator.length + role.length + placeholderEllipsis.length > MAX_ROLE_LIST_LENGTH) break;
            result += separator + role;
            processedCount++;
        }

        if (processedCount < roleMentions.length) result += `, ...他${String(roleMentions.length - processedCount)}件`;
        return result;
    }

    private formatStatus(status: string): string {
        const statusLabel: Record<string, string> = {
            online: `${this.symbols.statusEmoji.online} オンライン`,
            idle: `${this.symbols.statusEmoji.idle} 退席中`,
            dnd: `${this.symbols.statusEmoji.dnd} 取り込み中`,
            streaming: `${this.symbols.statusEmoji.streaming} 配信中`,
            offline: `${this.symbols.statusEmoji.invisible} オフライン`
        };
        return `ステータス: ${statusLabel[status] ?? '不明'}`;
    }
}
