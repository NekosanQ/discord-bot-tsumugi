import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function dashboardLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
    return <>{children}</>;
}
