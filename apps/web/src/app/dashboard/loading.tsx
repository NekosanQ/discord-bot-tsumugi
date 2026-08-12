export default function dashboardLoading(): React.JSX.Element {
    return (
        <main className="site-shell dashboard-main" aria-busy="true" aria-label="読み込み中">
            <div className="loading-grid">
                <div className="loading-block" />
                <div className="loading-block" />
            </div>
        </main>
    );
}
