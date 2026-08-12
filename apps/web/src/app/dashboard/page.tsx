import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DashboardHeader } from '../_components/DashboardHeader.js';
import { EmptyState } from '../_components/EmptyState.js';
import { GuildCard } from '../_components/GuildCard.js';
import { createDashboardComposition, getDashboardRequestContext } from '../_composition/dashboard.js';

export default async function dashboardPage(): Promise<React.JSX.Element> {
    const composition = createDashboardComposition();
    const requestContext = await getDashboardRequestContext();
    const session = await composition.queries.getSession(requestContext);
    if (!session.authenticated || !session.user || !session.csrfToken) redirect('/?auth=required');
    const { guilds } = await composition.queries.listGuilds(requestContext);

    return (
        <>
            <DashboardHeader csrfToken={session.csrfToken} user={session.user} />
            <main className="site-shell dashboard-main">
                <header className="page-heading">
                    <p className="eyebrow">Your manageable servers</p>
                    <h1>サーバーを選択</h1>
                    <p>Discordで管理権限が確認できたサーバーだけを表示しています。Bot未導入のサーバーは変更できません。</p>
                </header>
                {guilds.length === 0 ? (
                    <EmptyState
                        title="管理できるサーバーがありません"
                        description="Discord上の権限またはBotの導入状態を確認してから再読み込みしてください。"
                        action={
                            <Link className="button-secondary" href="/dashboard">
                                再読み込み
                            </Link>
                        }
                    />
                ) : (
                    <div className="card-grid">
                        {guilds.map(
                            (guild): React.JSX.Element => (
                                <GuildCard key={guild.id} guild={guild} />
                            )
                        )}
                    </div>
                )}
            </main>
        </>
    );
}
