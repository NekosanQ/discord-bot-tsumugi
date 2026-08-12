import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
    title: {
        default: 'Tsumugi Dashboard',
        template: '%s | Tsumugi Dashboard'
    },
    description: 'DiscordサーバーのTsumugi Bot設定を安全に管理します。',
    robots: { index: false, follow: false }
};

export default function rootLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
    return (
        <html lang="ja">
            <body>{children}</body>
        </html>
    );
}
