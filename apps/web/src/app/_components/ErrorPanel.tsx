'use client';

export interface ErrorPanelProps {
    reset: () => void;
}

function errorPanel({ reset }: ErrorPanelProps): React.JSX.Element {
    return (
        <section className="error-panel" role="alert">
            <h2>画面を読み込めませんでした</h2>
            <p>内部情報を保護するため詳細は表示していません。時間をおいて、もう一度お試しください。</p>
            <button className="button-secondary" type="button" onClick={reset}>
                再試行
            </button>
        </section>
    );
}

export { errorPanel as ErrorPanel };
