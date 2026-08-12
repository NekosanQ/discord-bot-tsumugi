'use client';

import { useState } from 'react';

function logoutButton({ csrfToken }: { csrfToken: string }): React.JSX.Element {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string>();

    async function logout(): Promise<void> {
        setPending(true);
        setError(undefined);
        try {
            const headers = new Headers();
            headers.set('x-csrf-token', csrfToken);
            const response = await fetch('/api/dashboard/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers
            });
            if (!response.ok) throw new Error(`logout failed with status ${String(response.status)}`);
            window.location.assign('/');
        } catch {
            setError('ログアウトできませんでした。時間をおいて再度お試しください。');
            setPending(false);
        }
    }

    return (
        <div className="logout-control">
            <button
                className="button-secondary"
                type="button"
                disabled={pending}
                onClick={(): void => {
                    void logout();
                }}
            >
                {pending ? 'ログアウト中…' : 'ログアウト'}
            </button>
            {error ? <p role="alert">{error}</p> : null}
        </div>
    );
}

export { logoutButton as LogoutButton };
