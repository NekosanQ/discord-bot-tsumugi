export class DashboardApiError extends Error {
    public constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'DashboardApiError';
    }
}
