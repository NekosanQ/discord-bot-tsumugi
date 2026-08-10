export class DashboardAuthenticationError extends Error {
    public constructor(message = 'ダッシュボードsessionが無効です。') {
        super(message);
        this.name = 'DashboardAuthenticationError';
    }
}

export class DashboardAuthorizationError extends Error {
    public constructor(message = 'このサーバーを管理する権限がありません。') {
        super(message);
        this.name = 'DashboardAuthorizationError';
    }
}

export class DashboardCsrfError extends Error {
    public constructor(message = 'CSRF検証に失敗しました。') {
        super(message);
        this.name = 'DashboardCsrfError';
    }
}

export class DashboardRateLimitError extends Error {
    public constructor(message = 'リクエスト回数の上限に達しました。') {
        super(message);
        this.name = 'DashboardRateLimitError';
    }
}

export class DashboardValidationError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'DashboardValidationError';
    }
}

export class DashboardDependencyError extends Error {
    public constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'DashboardDependencyError';
    }
}

export class OAuthStateError extends Error {
    public constructor(message = 'OAuth stateが無効または期限切れです。') {
        super(message);
        this.name = 'OAuthStateError';
    }
}

export class ManagedDashboardResourceError extends Error {
    public constructor(message = '管理対象のサーバーまたはチャンネルが見つかりません。') {
        super(message);
        this.name = 'ManagedDashboardResourceError';
    }
}
