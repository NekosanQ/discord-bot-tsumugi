import type { DashboardUserDto } from '@tsumugi/contracts';
import Link from 'next/link';

import { LogoutButton } from './LogoutButton.js';
import { SafeAvatar } from './SafeAvatar.js';

export interface DashboardHeaderProps {
    user: DashboardUserDto;
    csrfToken: string;
}

function dashboardHeader({ user, csrfToken }: DashboardHeaderProps): React.JSX.Element {
    return (
        <header className="dashboard-header site-shell">
            <Link className="brand-link" href="/dashboard">
                <span className="brand-mark" aria-hidden="true">
                    T
                </span>
                Tsumugi Dashboard
            </Link>
            <div className="header-actions">
                <div className="user-summary">
                    <SafeAvatar className="avatar" name={user.username} url={user.avatarUrl} />
                    <span className="user-name">{user.username}</span>
                </div>
                <LogoutButton csrfToken={csrfToken} />
            </div>
        </header>
    );
}

export { dashboardHeader as DashboardHeader };
