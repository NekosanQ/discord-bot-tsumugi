'use client';

import { ErrorPanel } from '../_components/ErrorPanel.js';
import { SiteHeader } from '../_components/SiteHeader.js';

export default function dashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }): React.JSX.Element {
    return (
        <>
            <SiteHeader />
            <main className="site-shell dashboard-main">
                <ErrorPanel reset={reset} />
            </main>
        </>
    );
}
