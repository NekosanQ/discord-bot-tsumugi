import Link from 'next/link';

function siteHeader(): React.JSX.Element {
    return (
        <header className="site-header site-shell">
            <Link className="brand-link" href="/">
                <span className="brand-mark" aria-hidden="true">
                    T
                </span>
                Tsumugi Dashboard
            </Link>
        </header>
    );
}

export { siteHeader as SiteHeader };
