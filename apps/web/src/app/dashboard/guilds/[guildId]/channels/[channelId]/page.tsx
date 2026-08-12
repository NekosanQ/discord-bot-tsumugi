import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { DashboardHeader } from '../../../../../_components/DashboardHeader.js';
import { createDashboardComposition, getDashboardRequestContext } from '../../../../../_composition/dashboard.js';
import { KeywordManager } from './KeywordManager.js';

interface ChannelPageProps {
    params: Promise<{ guildId: string; channelId: string }>;
}

const snowflakePattern = /^\d{17,20}$/;

export default async function channelPage({ params }: ChannelPageProps): Promise<React.JSX.Element> {
    const { guildId, channelId } = await params;
    if (!snowflakePattern.test(guildId) || !snowflakePattern.test(channelId)) notFound();
    const composition = createDashboardComposition();
    const requestContext = await getDashboardRequestContext();
    const session = await composition.queries.getSession(requestContext);
    if (!session.authenticated || !session.user || !session.csrfToken) redirect('/?auth=required');
    const [{ guild, channels }, { keywords }] = await Promise.all([
        composition.queries.getGuild(requestContext, guildId),
        composition.queries.listKeywords(requestContext, guildId, channelId)
    ]);
    const channel = channels.find((candidate): boolean => candidate.id === channelId);
    if (!guild.botInstalled || !channel) notFound();

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
                        <li>
                            <Link href={`/dashboard/guilds/${guild.id}`}>{guild.name}</Link>
                        </li>
                        <li aria-hidden="true">/</li>
                        <li>#{channel.name}</li>
                    </ol>
                    <p className="eyebrow">Keyword responses</p>
                    <h1>#{channel.name}</h1>
                    <p>メッセージ本文がキーワードに一致したときの応答を管理します。変更前にAPIが権限と所属を再確認します。</p>
                </header>
                <KeywordManager channelId={channelId} csrfToken={session.csrfToken} guildId={guildId} initialKeywords={[...keywords]} />
            </main>
        </>
    );
}
