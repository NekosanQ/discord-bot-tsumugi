export interface DashboardUser {
    readonly id: string;
    readonly displayName: string;
    readonly avatarHash: string | null;
}

export interface DiscordGuildMembership {
    readonly id: string;
    readonly name: string;
    readonly iconHash: string | null;
    readonly owner: boolean;
    readonly permissions: string;
}

export type ManagedChannelType = 'text' | 'announcement';

export interface ManagedChannelSnapshot {
    readonly id: string;
    readonly name: string;
    readonly type: ManagedChannelType;
}

const administratorPermission = 1n << 3n;
const manageGuildPermission = 1n << 5n;

export function canManageGuild(membership: DiscordGuildMembership): boolean {
    if (membership.owner) return true;
    try {
        const permissions = BigInt(membership.permissions);
        return (permissions & administratorPermission) !== 0n || (permissions & manageGuildPermission) !== 0n;
    } catch {
        return false;
    }
}

export function normalizeDashboardReturnTo(value: string | undefined): string {
    if (!value || value.length > 512 || value.includes('\\') || value.startsWith('//')) return '/dashboard';
    return value === '/dashboard' || value.startsWith('/dashboard/') ? value : '/dashboard';
}

export function discordAvatarUrl(user: DashboardUser): string | null {
    return user.avatarHash ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatarHash}.png?size=128` : null;
}

export function discordGuildIconUrl(guild: DiscordGuildMembership): string | null {
    return guild.iconHash ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.iconHash}.png?size=128` : null;
}
