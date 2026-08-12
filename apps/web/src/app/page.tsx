import Link from 'next/link';

import { SiteHeader } from './_components/SiteHeader.js';
import { createDashboardComposition, getDashboardRequestContext } from './_composition/dashboard.js';

interface HomePageProps {
    searchParams: Promise<{ auth?: string | string[] }>;
}

const authMessages: Record<string, string> = {
    failed: 'Discordログインを完了できませんでした。もう一度お試しください。',
    invalid: '安全でない認証先が返されたため、ログインを中止しました。',
    unavailable: '認証サービスを利用できません。しばらく待ってからお試しください。',
    required: 'ダッシュボードを利用するにはDiscordログインが必要です。'
};

export default async function homePage({ searchParams }: HomePageProps): Promise<React.JSX.Element> {
    const requestContext = await getDashboardRequestContext();
    let authenticated = false;
    try {
        authenticated = (await createDashboardComposition().queries.getSession(requestContext)).authenticated;
    } catch {
        // The landing page remains available while the API is degraded.
    }
    const requestedMessage = (await searchParams).auth;
    const authMessage = typeof requestedMessage === 'string' ? authMessages[requestedMessage] : undefined;

    return (
        <>
            <SiteHeader />
            <main className="site-shell hero">
                <section>
                    <p className="eyebrow">Server management, without shared secrets</p>
                    <h1>紬の設定を、わかりやすく。</h1>
                    <p className="hero-copy">
                        Discordで管理権限を確認したサーバーだけを、安全なセッションから操作できます。BotのcredentialやOAuth
                        tokenがbrowserへ渡ることはありません。
                    </p>
                    {authMessage ? (
                        <p className="notice" role="alert">
                            {authMessage}
                        </p>
                    ) : null}
                    <div className="button-row">
                        {authenticated ? (
                            <Link className="button" href="/dashboard">
                                ダッシュボードを開く
                            </Link>
                        ) : (
                            <a className="button" href="/auth/login?returnTo=%2Fdashboard">
                                Discordでログイン
                            </a>
                        )}
                    </div>
                </section>
                <aside className="feature-panel" aria-label="セキュリティ機能">
                    <ul>
                        <li>
                            <span className="feature-index">01</span>
                            <div>
                                <strong>権限はAPIで再確認</strong>
                                <span>画面表示だけを認可根拠にせず、変更のたびにserver-sideで検証します。</span>
                            </div>
                        </li>
                        <li>
                            <span className="feature-index">02</span>
                            <div>
                                <strong>秘密情報をbrowserへ渡さない</strong>
                                <span>WebはHttpOnly sessionだけを利用し、Discord tokenを保持しません。</span>
                            </div>
                        </li>
                        <li>
                            <span className="feature-index">03</span>
                            <div>
                                <strong>同一Originからだけ変更</strong>
                                <span>CSRF tokenとOrigin検証を通過した操作だけをAPIへ転送します。</span>
                            </div>
                        </li>
                    </ul>
                </aside>
            </main>
        </>
    );
}
