import Link from 'next/link';

import { EmptyState } from './_components/EmptyState.js';
import { SiteHeader } from './_components/SiteHeader.js';

export default function notFoundPage(): React.JSX.Element {
    return (
        <>
            <SiteHeader />
            <main className="site-shell dashboard-main">
                <EmptyState
                    title="ページが見つかりません"
                    description="URLを確認するか、ダッシュボードへ戻ってください。"
                    action={
                        <Link className="button" href="/dashboard">
                            ダッシュボードへ戻る
                        </Link>
                    }
                />
            </main>
        </>
    );
}
