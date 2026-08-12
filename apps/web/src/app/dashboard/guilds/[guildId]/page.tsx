import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { DashboardHeader } from '../../../_components/DashboardHeader.js';
import { EmptyState } from '../../../_components/EmptyState.js';
import { createDashboardComposition, getDashboardRequestContext } from '../../../_composition/dashboard.js';

interface GuildPageProps {
    params: Promise<{ guildId: string }>;
}

const snowflakePattern = /^\d{17,20}$/;

export default async function guildPage({ params }: GuildPageProps): Promise<React.JSX.Element> {
    const { guildId } = await params;
    if (!snowflakePattern.test(guildId)) notFound();
    const composition = createDashboardComposition();
    const requestContext = await getDashboardRequestContext();
    const session = await composition.queries.getSession(requestContext);
    if (!session.authenticated || !session.user || !session.csrfToken) redirect('/?auth=required');
    const { guild, channels } = await composition.queries.getGuild(requestContext, guildId);
    if (!guild.botInstalled) notFound();

    return (
        <>
            <DashboardHeader csrfToken={session.csrfToken} user={session.user} />
            <main className="site-shell dashboard-main">
                <header className="page-heading">
                    <ol className="breadcrumbs" aria-label="現在位置">
                        <li>
                            <Link href="/dashboard">サーバー</Link>
                        </li>
                        <li aria-hidden="true">/</li>
                        <li>{guild.name}</li>
                    </ol>
                    <p className="eyebrow">Select a channel</p>
                    <h1>{guild.name}</h1>
                    <p>キーワード応答を管理するテキストチャンネルを選択してください。</p>
                </header>
                {channels.length === 0 ? (
                    <EmptyState
                        title="管理できるチャンネルがありません"
                        description="Botが閲覧できるテキストチャンネルが同期されるまでお待ちください。"
                    />
                ) : (
                    <div className="card-grid">
                        {channels.map(
                            (channel): React.JSX.Element => (
                                <Link className="channel-card" href={`/dashboard/guilds/${guild.id}/channels/${channel.id}`} key={channel.id}>
                                    <span className="channel-symbol" aria-hidden="true">
                                        #
                                    </span>
                                    <div className="card-copy">
                                        <h2 className="card-title">{channel.name}</h2>
                                        <p className="card-meta">{channel.type === 'announcement' ? 'アナウンスチャンネル' : 'テキストチャンネル'}</p>
                                    </div>
                                </Link>
                            )
                        )}
                    </div>
                )}
            </main>
        </>
    );
}
