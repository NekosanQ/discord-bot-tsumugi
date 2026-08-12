import type { ReactNode } from 'react';

export interface EmptyStateProps {
    title: string;
    description: string;
    action?: ReactNode;
}

function emptyState({ title, description, action }: EmptyStateProps): React.JSX.Element {
    return (
        <section className="empty-state" aria-live="polite">
            <h2>{title}</h2>
            <p>{description}</p>
            {action}
        </section>
    );
}

export { emptyState as EmptyState };
