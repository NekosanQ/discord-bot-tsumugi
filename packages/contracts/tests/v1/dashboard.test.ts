import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    ContractValidationError,
    parseDashboardGuildListResponse,
    parseDashboardSessionResponse,
    parseSaveDashboardKeywordRequest
} from '../../src/index.js';

describe('dashboard contract', (): void => {
    it('認証済みsessionを実行時検証する', (): void => {
        assert.deepEqual(
            parseDashboardSessionResponse({
                authenticated: true,
                user: { id: '123', username: 'tsumugi', avatarUrl: null },
                csrfToken: 'csrf-token'
            }),
            {
                authenticated: true,
                user: { id: '123', username: 'tsumugi', avatarUrl: null },
                csrfToken: 'csrf-token'
            }
        );
    });

    it('管理対象guild一覧を実行時検証する', (): void => {
        assert.deepEqual(
            parseDashboardGuildListResponse({
                guilds: [{ id: '123', name: 'server', iconUrl: null, botInstalled: true }]
            }),
            { guilds: [{ id: '123', name: 'server', iconUrl: null, botInstalled: true }] }
        );
    });

    it('keyword responseの不正な配列要素を拒否する', (): void => {
        assert.throws(() => parseSaveDashboardKeywordRequest({ trigger: 'hello', responses: ['world', 1] }), ContractValidationError);
    });
});
