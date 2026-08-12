import {
    type DeleteDashboardKeywordRequest,
    parseDeleteDashboardKeywordRequest,
    parseSaveDashboardKeywordRequest,
    type SaveDashboardKeywordRequest
} from '@tsumugi/contracts';

const discordSnowflakePattern = /^\d{17,20}$/;
const discordMentionPattern = /<@!?&?\d{17,20}>|@everyone|@here/i;
const discordTokenPatterns = [/[a-z0-9_-]{23,28}\.[a-z0-9_-]{6,7}\.[a-z0-9_-]{27}/i, /mfa\.[a-z0-9_-]{20,}/i];
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type DashboardProxyMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface DashboardProxyTarget {
    method: DashboardProxyMethod;
    apiPath: string;
    keywordMutation: 'save' | 'delete' | undefined;
}

export class DashboardProxyPolicyError extends Error {
    public constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'DashboardProxyPolicyError';
    }
}

function validSnowflake(value: string | undefined): value is string {
    return value !== undefined && discordSnowflakePattern.test(value);
}

export function resolveDashboardProxyTarget(method: string, segments: readonly string[]): DashboardProxyTarget {
    if (method === 'GET' && segments.length === 1 && segments[0] === 'session') {
        return { method: 'GET', apiPath: '/v1/dashboard/session', keywordMutation: undefined };
    }
    if (method === 'POST' && segments.length === 1 && segments[0] === 'logout') {
        return { method: 'POST', apiPath: '/v1/dashboard/logout', keywordMutation: undefined };
    }
    if (method === 'GET' && segments.length === 1 && segments[0] === 'guilds') {
        return { method: 'GET', apiPath: '/v1/dashboard/guilds', keywordMutation: undefined };
    }
    if (method === 'GET' && segments.length === 2 && segments[0] === 'guilds' && validSnowflake(segments[1])) {
        return { method: 'GET', apiPath: `/v1/dashboard/guilds/${segments[1]}/channels`, keywordMutation: undefined };
    }

    if (
        segments.length === 5 &&
        segments[0] === 'guilds' &&
        validSnowflake(segments[1]) &&
        segments[2] === 'channels' &&
        validSnowflake(segments[3]) &&
        segments[4] === 'keywords'
    ) {
        const apiPath = `/v1/dashboard/guilds/${segments[1]}/channels/${segments[3]}/keywords`;
        if (method === 'GET') return { method: 'GET', apiPath, keywordMutation: undefined };
        if (method === 'PUT') return { method: 'PUT', apiPath, keywordMutation: 'save' };
        if (method === 'DELETE') return { method: 'POST', apiPath: `${apiPath}/delete`, keywordMutation: 'delete' };
    }

    throw new DashboardProxyPolicyError(404, 'endpointが見つかりません。');
}

export function assertSameOriginMutation(method: string, requestOrigin: string, originHeader: string | null, fetchSiteHeader: string | null): void {
    if (!mutationMethods.has(method)) return;
    if (originHeader !== requestOrigin || (fetchSiteHeader !== null && fetchSiteHeader !== 'same-origin')) {
        throw new DashboardProxyPolicyError(403, 'same-originの操作だけを受け付けます。');
    }
}

function assertSafeTrigger(trigger: string): void {
    if (trigger.length === 0 || trigger.length > 100) {
        throw new DashboardProxyPolicyError(400, 'キーワードは1文字以上100文字以下で入力してください。');
    }
}

function assertSafeResponses(responses: readonly string[]): void {
    const combinedLength = responses.reduce((length, response, index): number => length + response.length + (index > 0 ? 1 : 0), 0);
    if (responses.length === 0 || combinedLength > 1000 || responses.some((response) => response.trim() === '')) {
        throw new DashboardProxyPolicyError(400, '応答は空行を除いて1件以上、合計1000文字以下で入力してください。');
    }
    if (responses.some((response) => discordMentionPattern.test(response))) {
        throw new DashboardProxyPolicyError(400, '応答にメンションを含めることはできません。');
    }
    if (responses.some((response) => discordTokenPatterns.some((pattern) => pattern.test(response)))) {
        throw new DashboardProxyPolicyError(400, '応答に機密情報と疑われる文字列が含まれています。');
    }
}

export function parseKeywordFormInput(trigger: string, responsesText: string): SaveDashboardKeywordRequest {
    const responses = responsesText.split('\n').filter((response) => response.trim() !== '');
    assertSafeTrigger(trigger);
    assertSafeResponses(responses);
    return { trigger, responses };
}

export function parseDashboardMutationBody(kind: 'save', value: unknown): SaveDashboardKeywordRequest;
export function parseDashboardMutationBody(kind: 'delete', value: unknown): DeleteDashboardKeywordRequest;
export function parseDashboardMutationBody(kind: 'save' | 'delete', value: unknown): SaveDashboardKeywordRequest | DeleteDashboardKeywordRequest {
    try {
        if (kind === 'save') {
            const command = parseSaveDashboardKeywordRequest(value);
            assertSafeTrigger(command.trigger);
            assertSafeResponses(command.responses);
            return command;
        }
        const command = parseDeleteDashboardKeywordRequest(value);
        assertSafeTrigger(command.trigger);
        return command;
    } catch (error) {
        if (error instanceof DashboardProxyPolicyError) throw error;
        throw new DashboardProxyPolicyError(400, '入力形式が正しくありません。');
    }
}

export function safeReturnTo(value: string | null): string {
    if (value === null || !value.startsWith('/dashboard') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
    try {
        const url = new URL(value, 'https://dashboard.invalid');
        return url.origin === 'https://dashboard.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
    } catch {
        return '/dashboard';
    }
}
