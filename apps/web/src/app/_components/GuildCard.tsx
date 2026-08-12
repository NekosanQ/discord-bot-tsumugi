import type { DashboardGuildDto } from '@tsumugi/contracts';
import Link from 'next/link';

import { SafeAvatar } from './SafeAvatar.js';

function guildCard({ guild }: { guild: DashboardGuildDto }): React.JSX.Element {
    const content = (
        <>
            <SafeAvatar className="guild-icon" name={guild.name} url={guild.iconUrl} />
            <div className="card-copy">
                <h2 className="card-title">{guild.name}</h2>
                <p className="card-meta">{guild.botInstalled ? 'Bot導入済み・管理可能' : 'Botが導入されていません'}</p>
            </div>
        </>
    );
    if (!guild.botInstalled) {
        return (
            <div className="guild-card" aria-disabled="true">
                {content}
            </div>
        );
    }
    return (
        <Link className="guild-card" href={`/dashboard/guilds/${guild.id}`}>
            {content}
        </Link>
    );
}

export { guildCard as GuildCard };
