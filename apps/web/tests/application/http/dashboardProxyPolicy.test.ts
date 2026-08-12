import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertSameOriginMutation,
    DashboardProxyPolicyError,
    parseDashboardMutationBody,
    parseKeywordFormInput,
    resolveDashboardProxyTarget,
    safeReturnTo
} from '../../../src/application/http/dashboardProxyPolicy.js';

void test('dashboard proxyはallowlist済みendpointだけを解決する', (): void => {
    assert.deepEqual(resolveDashboardProxyTarget('GET', ['session']), {
        method: 'GET',
        apiPath: '/v1/dashboard/session',
        keywordMutation: undefined
    });
    assert.deepEqual(resolveDashboardProxyTarget('PUT', ['guilds', '12345678901234567', 'channels', '22345678901234567', 'keywords']), {
        method: 'PUT',
        apiPath: '/v1/dashboard/guilds/12345678901234567/channels/22345678901234567/keywords',
        keywordMutation: 'save'
    });
    assert.deepEqual(resolveDashboardProxyTarget('GET', ['guilds', '12345678901234567']), {
        method: 'GET',
        apiPath: '/v1/dashboard/guilds/12345678901234567/channels',
        keywordMutation: undefined
    });
    assert.deepEqual(resolveDashboardProxyTarget('DELETE', ['guilds', '12345678901234567', 'channels', '22345678901234567', 'keywords']), {
        method: 'POST',
        apiPath: '/v1/dashboard/guilds/12345678901234567/channels/22345678901234567/keywords/delete',
        keywordMutation: 'delete'
    });
    assert.throws((): void => {
        resolveDashboardProxyTarget('GET', ['auth', 'discord', 'start']);
    }, DashboardProxyPolicyError);
    assert.throws(
        (): void => {
            resolveDashboardProxyTarget('GET', ['guilds', 'not-a-snowflake']);
        },
        (error: unknown): boolean => error instanceof DashboardProxyPolicyError && error.status === 404
    );
});

void test('状態変更はexact same-originだけを許可する', (): void => {
    assert.doesNotThrow((): void => {
        assertSameOriginMutation('PUT', 'https://dashboard.example', 'https://dashboard.example', 'same-origin');
    });
    assert.throws(
        (): void => {
            assertSameOriginMutation('DELETE', 'https://dashboard.example', 'https://evil.example', 'cross-site');
        },
        (error: unknown): boolean => error instanceof DashboardProxyPolicyError && error.status === 403
    );
    assert.throws(
        (): void => {
            assertSameOriginMutation('POST', 'https://dashboard.example', null, null);
        },
        (error: unknown): boolean => error instanceof DashboardProxyPolicyError && error.status === 403
    );
});

void test('keyword入力を正規化し危険な応答を拒否する', (): void => {
    assert.deepEqual(parseKeywordFormInput('hello', 'one\n\ntwo'), { trigger: 'hello', responses: ['one', 'two'] });
    assert.deepEqual(parseDashboardMutationBody('delete', { trigger: 'hello' }), { trigger: 'hello' });
    assert.throws(
        (): void => {
            parseKeywordFormInput('hello', '@everyone');
        },
        (error: unknown): boolean => error instanceof DashboardProxyPolicyError && error.status === 400
    );
    assert.throws((): void => {
        parseDashboardMutationBody('save', { trigger: '', responses: ['ok'] });
    }, DashboardProxyPolicyError);
});

void test('returnToをdashboard配下へ限定する', (): void => {
    assert.equal(safeReturnTo('/dashboard/guilds/123?tab=keyword'), '/dashboard/guilds/123?tab=keyword');
    assert.equal(safeReturnTo('https://evil.example/'), '/dashboard');
    assert.equal(safeReturnTo('//evil.example/dashboard'), '/dashboard');
    assert.equal(safeReturnTo('/settings'), '/dashboard');
});
