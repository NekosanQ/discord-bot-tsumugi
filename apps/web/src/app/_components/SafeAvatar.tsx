export interface SafeAvatarProps {
    url: string | null;
    name: string;
    className: 'avatar' | 'guild-icon';
}

export function safeDiscordCdnUrl(value: string | null): string | undefined {
    if (value === null) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === 'cdn.discordapp.com' ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

function safeAvatar({ url, name, className }: SafeAvatarProps): React.JSX.Element {
    const safeUrl = safeDiscordCdnUrl(url);
    const fallback = name.trim().slice(0, 1).toUpperCase() || '?';
    return <span className={className}>{safeUrl ? <img alt="" src={safeUrl} /> : <span aria-hidden="true">{fallback}</span>}</span>;
}

export { safeAvatar as SafeAvatar };
